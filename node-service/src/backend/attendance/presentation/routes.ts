import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ParticipationService } from '../application/participation.service';
import { ValidateScanUseCase } from '../application/validate-scan.usecase';
import { CompleteScanUseCase } from '../application/complete-scan.usecase';
import { PoolBalancer } from '../../qr-projection/application/services';
import { ActiveSessionRepository, ProjectionPoolRepository } from '../../../shared/infrastructure/valkey';
import { StudentSessionRepository } from '../infrastructure/student-session.repository';
import { FraudMetricsRepository } from '../infrastructure/fraud-metrics.repository';
import { QRStateAdapter, StudentStateAdapter, createCompleteScanDepsWithPersistence } from '../infrastructure/adapters';
import { AesGcmService } from '../../../shared/infrastructure/crypto';
import { mapValidationError } from './error-mapper';
import { logger } from '../../../shared/infrastructure/logger';

/**
 * Request body schema para validación
 */
interface ValidateRequestBody {
  encrypted: string;
  studentId: number;
}

/**
 * Request body schema para registro
 */
interface RegisterRequestBody {
  sessionId: string;
  studentId: number;
}

/**
 * Query params para status
 */
interface StatusQueryParams {
  sessionId: string;
  studentId: string;
}

/**
 * Registra las rutas del módulo de Attendance
 * 
 * Rutas:
 * - POST /asistencia/api/attendance/register - Registra participación
 * - POST /asistencia/api/attendance/validate - Valida un payload escaneado
 * - GET /asistencia/api/attendance/status - Consulta estado del estudiante
 * - POST /asistencia/api/attendance/refresh-qr - Solicita nuevo QR
 */
export async function registerAttendanceRoutes(
  fastify: FastifyInstance,
  participationService?: ParticipationService
): Promise<void> {
  const participation = participationService ?? new ParticipationService();
  const activeSessionRepo = new ActiveSessionRepository();

  // UseCases con pipeline
  const poolRepo = new ProjectionPoolRepository();
  const studentRepo = new StudentSessionRepository();
  
  // UseCase para solo validación (debugging)
  const validateScanUseCase = new ValidateScanUseCase({
    aesGcmService: new AesGcmService(),
    qrStateLoader: new QRStateAdapter(poolRepo),
    studentStateLoader: new StudentStateAdapter(studentRepo),
  });

  // UseCase completo (validación + side effects)
  // Habilitar persistencia PostgreSQL si ENABLE_POSTGRES_PERSISTENCE=true
  const enablePostgresPersistence = process.env.ENABLE_POSTGRES_PERSISTENCE === 'true';
  const { deps: completeScanDeps, persistence } = createCompleteScanDepsWithPersistence({
    enablePostgresPersistence,
  });
  const completeScanUseCase = new CompleteScanUseCase(completeScanDeps, {}, persistence);

  /**
   * GET /asistencia/api/attendance/active-session
   * 
   * Consulta si hay una sesión de QR activa
   * El estudiante usa esto para saber si puede registrar asistencia
   */
  fastify.get(
    '/asistencia/api/attendance/active-session',
    async (_request, reply) => {
      const session = await activeSessionRepo.getActiveSession();

      if (!session) {
        return reply.send({
          success: true,
          data: {
            hasActiveSession: false,
            message: 'No hay clase activa en este momento',
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          hasActiveSession: true,
          sessionId: session.sessionId,
          hostUsername: session.hostUsername,
          startedAt: session.startedAt,
        },
      });
    }
  );

  /**
   * POST /asistencia/api/attendance/register
   * 
   * Registra la participación de un estudiante en una sesión
   * Genera el primer QR para el round 1
   */
  fastify.post<{ Body: RegisterRequestBody }>(
    '/asistencia/api/attendance/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['sessionId', 'studentId'],
          properties: {
            sessionId: { type: 'string', minLength: 1 },
            studentId: { type: 'number', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId, studentId } = request.body;

      const result = await participation.registerParticipation(sessionId, studentId);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: result.errorCode,
            message: result.reason,
          },
        });
      }

      return reply.send({
        success: true,
        data: result.data,
      });
    }
  );

  /**
   * POST /asistencia/api/attendance/validate
   * 
   * Valida un payload QR escaneado por un estudiante
   * Usa el nuevo pipeline de validación con CompleteScanUseCase
   */
  fastify.post<{ Body: ValidateRequestBody }>(
    '/asistencia/api/attendance/validate',
    {
      schema: {
        body: {
          type: 'object',
          required: ['encrypted', 'studentId'],
          properties: {
            encrypted: { type: 'string', minLength: 10 },
            studentId: { type: 'number', minimum: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ValidateRequestBody }>, reply: FastifyReply) => {
      const { encrypted, studentId } = request.body;

      const result = await completeScanUseCase.execute(encrypted, studentId);

      if (!result.valid) {
        const errorResponse = result.error 
          ? mapValidationError(result.error)
          : { httpStatus: 400, code: 'UNKNOWN_ERROR', message: 'Error de validación' };
        
        return reply.status(errorResponse.httpStatus).send({
          success: false,
          error: {
            code: errorResponse.code,
            message: errorResponse.message,
          },
        });
      }

      // Respuesta según si completó o no
      if (result.isComplete) {
        return reply.send({
          success: true,
          data: {
            status: 'completed',
            sessionId: result.sessionId,
            validatedAt: result.validatedAt,
            stats: result.stats,
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          status: 'partial',
          sessionId: result.sessionId,
          validatedAt: result.validatedAt,
          next_round: result.nextRound?.round,
        },
      });
    }
  );

  /**
   * GET /asistencia/api/attendance/status
   * 
   * Consulta el estado actual del estudiante en la sesión
   */
  fastify.get<{ Querystring: StatusQueryParams }>(
    '/asistencia/api/attendance/status',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['sessionId', 'studentId'],
          properties: {
            sessionId: { type: 'string' },
            studentId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId, studentId } = request.query;
      const studentIdNum = parseInt(studentId, 10);

      if (isNaN(studentIdNum) || studentIdNum < 1) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_STUDENT_ID',
            message: 'studentId debe ser un número positivo',
          },
        });
      }

      const status = await participation.getStatus(sessionId, studentIdNum);

      return reply.send({
        success: true,
        data: status,
      });
    }
  );

  /**
   * POST /asistencia/api/attendance/refresh-qr
   * 
   * Solicita un nuevo QR (cuando el anterior expiró)
   */
  fastify.post<{ Body: RegisterRequestBody }>(
    '/asistencia/api/attendance/refresh-qr',
    {
      schema: {
        body: {
          type: 'object',
          required: ['sessionId', 'studentId'],
          properties: {
            sessionId: { type: 'string', minLength: 1 },
            studentId: { type: 'number', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId, studentId } = request.body;

      const result = await participation.requestNewQR(sessionId, studentId);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: result.errorCode,
            message: result.reason,
          },
        });
      }

      return reply.send({
        success: true,
        data: result.data,
      });
    }
  );

  /**
   * GET /asistencia/api/attendance/health
   * 
   * Health check del módulo de attendance
   */
  fastify.get('/asistencia/api/attendance/health', async () => {
    return {
      status: 'ok',
      module: 'attendance',
      timestamp: Date.now(),
    };
  });

  /**
   * POST /asistencia/api/attendance/validate-debug
   * 
   * Endpoint de debugging que usa el nuevo pipeline
   * Retorna trace detallado sin side effects
   */
  fastify.post<{ Body: ValidateRequestBody }>(
    '/asistencia/api/attendance/validate-debug',
    {
      schema: {
        body: {
          type: 'object',
          required: ['encrypted', 'studentId'],
          properties: {
            encrypted: { type: 'string', minLength: 10 },
            studentId: { type: 'number', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { encrypted, studentId } = request.body;

      const result = await validateScanUseCase.execute(encrypted, studentId);

      return reply.send({
        success: result.valid,
        pipeline: {
          valid: result.valid,
          error: result.error,
          trace: result.trace,
          failedAt: result.context?.failedAt,
          durationMs: result.context ? Date.now() - result.context.startedAt : 0,
        },
      });
    }
  );

  logger.info('[Attendance] Rutas registradas: active-session, register, validate, validate-debug, status, refresh-qr, health');

  // ===========================================================================
  // ENDPOINTS DE DESARROLLO - Solo habilitados si DEV_ENDPOINTS=true
  // ===========================================================================
  const devEndpointsEnabled = process.env.DEV_ENDPOINTS === 'true';
  
  if (devEndpointsEnabled) {
    const poolBalancer = new PoolBalancer(undefined, poolRepo);
    const fraudMetricsRepo = new FraudMetricsRepository();

    /**
     * POST /asistencia/api/attendance/dev/fakes
     * 
     * Inyecta QRs falsos en el pool de una sesion
     * Solo disponible en desarrollo
     */
    fastify.post<{ Body: { sessionId: string; count?: number } }>(
      '/asistencia/api/attendance/dev/fakes',
      {
        schema: {
          body: {
            type: 'object',
            required: ['sessionId'],
            properties: {
              sessionId: { type: 'string', minLength: 1 },
              count: { type: 'number', minimum: 1, maximum: 100 },
            },
          },
        },
      },
      async (request, reply) => {
        const { sessionId, count } = request.body;
        const toInject = count ?? 10;

        await poolBalancer.injectFakes(sessionId, toInject);
        const stats = await poolRepo.getPoolStats(sessionId);

        return reply.send({
          success: true,
          data: {
            injected: toInject,
            pool: stats,
          },
        });
      }
    );

    /**
     * POST /asistencia/api/attendance/dev/balance
     * 
     * Balancea el pool de una sesion (agrega/remueve falsos segun minPoolSize)
     */
    fastify.post<{ Body: { sessionId: string } }>(
      '/asistencia/api/attendance/dev/balance',
      {
        schema: {
          body: {
            type: 'object',
            required: ['sessionId'],
            properties: {
              sessionId: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      async (request, reply) => {
        const { sessionId } = request.body;

        const result = await poolBalancer.balance(sessionId);
        const stats = await poolRepo.getPoolStats(sessionId);

        return reply.send({
          success: true,
          data: {
            balanced: result,
            pool: stats,
          },
        });
      }
    );

    /**
     * GET /asistencia/api/attendance/dev/pool/:sessionId
     * 
     * Obtiene estadisticas del pool de proyeccion
     */
    fastify.get<{ Params: { sessionId: string } }>(
      '/asistencia/api/attendance/dev/pool/:sessionId',
      async (request, reply) => {
        const { sessionId } = request.params;
        const stats = await poolRepo.getPoolStats(sessionId);
        const config = poolBalancer.getConfig();

        return reply.send({
          success: true,
          data: {
            sessionId,
            pool: stats,
            config,
          },
        });
      }
    );

    /**
     * GET /asistencia/api/attendance/dev/fraud/:sessionId
     * 
     * Obtiene metricas de fraude de una sesion
     */
    fastify.get<{ Params: { sessionId: string } }>(
      '/asistencia/api/attendance/dev/fraud/:sessionId',
      async (request, reply) => {
        const { sessionId } = request.params;
        const stats = await fraudMetricsRepo.getStats(sessionId);
        const suspiciousStudents = await fraudMetricsRepo.getSuspiciousStudents(sessionId);

        return reply.send({
          success: true,
          data: {
            sessionId,
            fraud: stats,
            suspiciousStudents,
          },
        });
      }
    );

    /**
     * DELETE /asistencia/api/attendance/dev/pool/:sessionId
     * 
     * Limpia el pool de proyeccion de una sesion
     */
    fastify.delete<{ Params: { sessionId: string } }>(
      '/asistencia/api/attendance/dev/pool/:sessionId',
      async (request, reply) => {
        const { sessionId } = request.params;
        await poolRepo.clearPool(sessionId);

        return reply.send({
          success: true,
          data: {
            sessionId,
            message: 'Pool cleared',
          },
        });
      }
    );

    /**
     * PUT /asistencia/api/attendance/dev/config
     * 
     * Actualiza la configuracion del PoolBalancer en runtime
     */
    fastify.put<{ Body: { minPoolSize?: number } }>(
      '/asistencia/api/attendance/dev/config',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              minPoolSize: { type: 'number', minimum: 1, maximum: 100 },
            },
          },
        },
      },
      async (request, reply) => {
        const { minPoolSize } = request.body;

        if (minPoolSize !== undefined) {
          poolBalancer.updateConfig({ minPoolSize });
        }

        return reply.send({
          success: true,
          data: {
            config: poolBalancer.getConfig(),
          },
        });
      }
    );

    logger.info('[Attendance] DEV endpoints habilitados: dev/fakes, dev/balance, dev/pool, dev/fraud, dev/config');
  }
}
