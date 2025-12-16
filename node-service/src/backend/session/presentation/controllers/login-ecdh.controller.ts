import type { FastifyRequest, FastifyReply } from 'fastify';
import { LoginEcdhUseCase } from '../../application/use-cases/login-ecdh.use-case';
import type { LoginEcdhInput } from '../../application/use-cases/login-ecdh.use-case';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * DTO para request de login ECDH
 */
interface LoginEcdhRequestDTO {
  credentialId: string;
  clientPublicKey: string; // Base64
  deviceFingerprint?: string; // Opcional - para verificacion de dispositivo
}

/**
 * Controller para POST /api/enrollment/login
 * Responsabilidad: Establecer sesión con ECDH key exchange
 */
export class LoginEcdhController {
  constructor(private readonly useCase: LoginEcdhUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: LoginEcdhRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Extraer usuario del JWT
      const user = request.user;
      if (!user) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }

      // Validar body
      const { credentialId, clientPublicKey } = request.body;
      if (!credentialId || !clientPublicKey) {
        reply.code(400).send({
          error: 'INVALID_REQUEST',
          message: 'credentialId y clientPublicKey son requeridos',
        });
        return;
      }

      // Preparar input para el use case
      const input: LoginEcdhInput = {
        userId: user.userId.toNumber(),
        credentialId,
        clientPublicKey,
      };

      // Ejecutar use case
      const output = await this.useCase.execute(input);

      // Retornar respuesta exitosa
      reply.code(200).send({
        success: true,
        session: {
          serverPublicKey: output.serverPublicKey,
          totpu: output.totpu,
          deviceId: output.deviceId,
        },
        message: 'Sesion establecida exitosamente',
      });
    } catch (error) {
      // Manejo de errores específicos
      if (error instanceof Error) {
        if (error.message.startsWith('DEVICE_NOT_FOUND')) {
          reply.code(404).send({
            error: 'DEVICE_NOT_FOUND',
            message: 'Dispositivo no encontrado. Verifica el credentialId.',
          });
          return;
        }

        if (error.message.startsWith('DEVICE_NOT_OWNED')) {
          reply.code(403).send({
            error: 'DEVICE_NOT_OWNED',
            message: 'El dispositivo no pertenece a este usuario',
          });
          return;
        }

        if (error.message.startsWith('DEVICE_REVOKED')) {
          reply.code(403).send({
            error: 'DEVICE_REVOKED',
            message: 'El dispositivo ha sido revocado. Debes enrolar nuevamente.',
          });
          return;
        }
      }

      // Error genérico
      logger.error('[LoginEcdhController] Error:', error);
      reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error al establecer sesión',
      });
    }
  }
}
