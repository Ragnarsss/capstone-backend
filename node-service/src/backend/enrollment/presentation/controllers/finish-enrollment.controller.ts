import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { FinishEnrollmentUseCase } from '../../application/use-cases';
import type { FinishEnrollmentInput } from '../../application/use-cases';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * DTO para request de finish enrollment
 */
interface FinishEnrollmentRequestDTO {
  credential: RegistrationResponseJSON;
  deviceFingerprint: string;
}

/**
 * Controller para POST /api/enrollment/finish
 * Responsabilidad: Completar proceso de enrollment FIDO2
 */
export class FinishEnrollmentController {
  constructor(private readonly useCase: FinishEnrollmentUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: FinishEnrollmentRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Extraer usuario del JWT
      const user = request.user;
      if (!user) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }

      // Validar que el body contenga los datos necesarios
      const { credential, deviceFingerprint } = request.body;
      if (!credential || !deviceFingerprint) {
        reply.code(400).send({
          error: 'INVALID_REQUEST',
          message: 'credential y deviceFingerprint son requeridos',
        });
        return;
      }

      // Preparar input para el use case
      const input: FinishEnrollmentInput = {
        userId: user.userId.toNumber(),
        credential,
        deviceFingerprint,
      };

      // Ejecutar use case
      const output = await this.useCase.execute(input);

      // Retornar resultado exitoso
      reply.code(201).send({
        success: true,
        device: {
          deviceId: output.deviceId,
          credentialId: output.credentialId,
          aaguid: output.aaguid,
        },
        message: 'Dispositivo enrolado exitosamente',
      });
    } catch (error) {
      // Manejo de errores específicos
      if (error instanceof Error) {
        // Challenge no encontrado o expirado
        if (error.message.startsWith('CHALLENGE_NOT_FOUND')) {
          reply.code(400).send({
            error: 'CHALLENGE_NOT_FOUND',
            message: 'No se encontró un challenge activo. Inicia el proceso nuevamente.',
          });
          return;
        }

        if (error.message.startsWith('CHALLENGE_EXPIRED')) {
          reply.code(400).send({
            error: 'CHALLENGE_EXPIRED',
            message: 'El challenge ha expirado. Inicia el proceso nuevamente.',
          });
          return;
        }

        // Verificación WebAuthn falló
        if (error.message.startsWith('VERIFICATION_FAILED')) {
          reply.code(400).send({
            error: 'VERIFICATION_FAILED',
            message: 'La verificación de la credencial falló',
            details: error.message.replace('VERIFICATION_FAILED: ', ''),
          });
          return;
        }

        // Credencial ya existe
        if (error.message.startsWith('CREDENTIAL_ALREADY_EXISTS')) {
          reply.code(409).send({
            error: 'CREDENTIAL_ALREADY_EXISTS',
            message: 'Este dispositivo ya está enrolado',
          });
          return;
        }
      }

      // Error genérico
      logger.error('[FinishEnrollmentController] Error:', error);
      reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error al completar enrollment',
      });
    }
  }
}
