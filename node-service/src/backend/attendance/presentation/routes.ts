import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AttendanceValidationService } from '../application/attendance-validation.service';
import type { ValidatePayloadRequest } from '../domain/models';

/**
 * Request body schema para validación
 */
interface ValidateRequestBody {
  encrypted: string;
  studentId: number;
}

/**
 * Registra las rutas del módulo de Attendance
 * 
 * Rutas:
 * - POST /asistencia/api/attendance/validate - Valida un payload escaneado
 */
export async function registerAttendanceRoutes(
  fastify: FastifyInstance,
  validationService?: AttendanceValidationService
): Promise<void> {
  const service = validationService ?? new AttendanceValidationService();

  /**
   * POST /asistencia/api/attendance/validate
   * 
   * Valida un payload QR escaneado por un estudiante
   * 
   * Body:
   * - encrypted: string - Payload encriptado (formato iv.ciphertext.authTag)
   * - studentId: number - ID del estudiante
   * 
   * Response:
   * - 200: { success: true, data: { sessionId, round, validatedAt } }
   * - 400: { success: false, error: { code, message } }
   * - 401: { success: false, error: { code: 'UNAUTHORIZED' } }
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
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  hostUserId: { type: 'number' },
                  round: { type: 'number' },
                  validatedAt: { type: 'number' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ValidateRequestBody }>, reply: FastifyReply) => {
      const { encrypted, studentId } = request.body;

      // TODO: En producción, validar JWT del estudiante y extraer studentId del token
      // Por ahora aceptamos el studentId del body para desarrollo

      const result = await service.validateScannedPayload(encrypted, studentId);

      if (!result.valid) {
        return reply.status(400).send({
          success: false,
          error: {
            code: result.errorCode,
            message: result.reason,
          },
        });
      }

      // Éxito - retornar datos relevantes
      return reply.send({
        success: true,
        data: {
          sessionId: result.payload!.sid,
          hostUserId: result.payload!.uid,
          round: result.payload!.r,
          validatedAt: result.validatedAt,
        },
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

  console.log('[Attendance] Rutas registradas: POST /asistencia/api/attendance/validate');
}
