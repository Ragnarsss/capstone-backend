import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AttendanceValidationService } from '../application/attendance-validation.service';
import { ParticipationService } from '../application/participation.service';
import type { ValidatePayloadRequest } from '../domain/models';

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
  validationService?: AttendanceValidationService,
  participationService?: ParticipationService
): Promise<void> {
  const validation = validationService ?? new AttendanceValidationService();
  const participation = participationService ?? new ParticipationService();

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

      const result = await validation.validateScannedPayload(encrypted, studentId);

      if (!result.valid) {
        return reply.status(400).send({
          success: false,
          error: {
            code: result.errorCode,
            message: result.reason,
          },
        });
      }

      // Respuesta según si completó o no
      if (result.isComplete) {
        return reply.send({
          success: true,
          data: {
            sessionId: result.payload!.sid,
            hostUserId: result.payload!.uid,
            round: result.payload!.r,
            validatedAt: result.validatedAt,
            isComplete: true,
            stats: result.stats,
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          sessionId: result.payload!.sid,
          hostUserId: result.payload!.uid,
          round: result.payload!.r,
          validatedAt: result.validatedAt,
          isComplete: false,
          nextRound: result.nextRound,
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

  console.log('[Attendance] Rutas registradas: register, validate, status, refresh-qr, health');
}
