import type { FastifyRequest, FastifyReply } from 'fastify';
import { RevokeDeviceUseCase } from '../../application/use-cases';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * Params para la ruta
 */
interface RevokeDeviceParams {
  deviceId: string;
}

/**
 * Body opcional
 */
interface RevokeDeviceBody {
  reason?: string;
}

/**
 * Controller para DELETE /api/enrollment/devices/:deviceId
 * Responsabilidad: Revocar un dispositivo enrolado
 */
export class RevokeDeviceController {
  constructor(private readonly useCase: RevokeDeviceUseCase) {}

  async handle(
    request: FastifyRequest<{ Params: RevokeDeviceParams; Body: RevokeDeviceBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Extraer usuario del JWT
      const user = request.user;
      if (!user) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }

      // Parsear deviceId de params
      const deviceId = parseInt(request.params.deviceId, 10);
      if (isNaN(deviceId)) {
        reply.code(400).send({
          error: 'INVALID_DEVICE_ID',
          message: 'deviceId debe ser un número válido',
        });
        return;
      }

      // Ejecutar use case
      const output = await this.useCase.execute({
        userId: user.userId.toNumber(),
        deviceId,
        reason: request.body?.reason,
      });

      // Retornar resultado exitoso
      reply.code(200).send({
        success: true,
        deviceId: output.deviceId,
        message: output.message,
      });
    } catch (error) {
      // Manejo de errores específicos
      if (error instanceof Error) {
        if (error.message.startsWith('DEVICE_NOT_FOUND')) {
          reply.code(404).send({
            error: 'DEVICE_NOT_FOUND',
            message: 'Dispositivo no encontrado',
          });
          return;
        }

        if (error.message.startsWith('DEVICE_NOT_OWNED')) {
          reply.code(403).send({
            error: 'FORBIDDEN',
            message: 'No tienes permiso para revocar este dispositivo',
          });
          return;
        }

        if (error.message.startsWith('DEVICE_ALREADY_REVOKED')) {
          reply.code(409).send({
            error: 'DEVICE_ALREADY_REVOKED',
            message: 'El dispositivo ya está revocado',
          });
          return;
        }
      }

      // Error genérico
      logger.error('[RevokeDeviceController] Error:', error);
      reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error al revocar dispositivo',
      });
    }
  }
}
