import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { FinishEnrollmentUseCase } from '../../application/use-cases';
import type { FinishEnrollmentInput } from '../../application/use-cases';
import type { OneToOnePolicyService, RevokeResult } from '../../domain/services';
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
 * 
 * Responsabilidad: Orquestar proceso de enrollment FIDO2
 * 
 * Flujo según spec-architecture.md:
 * 1. Validar request
 * 2. ANTES de persistir: Ejecutar revokeViolations() para mantener política 1:1
 * 3. Ejecutar use case (verificar WebAuthn + persistir)
 * 4. Retornar éxito
 */
export class FinishEnrollmentController {
  constructor(
    private readonly useCase: FinishEnrollmentUseCase,
    private readonly policyService: OneToOnePolicyService
  ) {}

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

      const userId = user.userId.toNumber();

      // PASO 1: Ejecutar revocación automática 1:1 ANTES de persistir
      // Esto revoca dispositivos conflictivos según política 1:1:
      // - Otro usuario con el mismo deviceFingerprint → desenrolar
      // - Este usuario con otros dispositivos → desenrolar
      let revokeResult: RevokeResult | undefined;
      try {
        revokeResult = await this.policyService.revokeViolations(userId, deviceFingerprint);
        
        if (revokeResult.previousUserUnlinked || revokeResult.ownDevicesRevoked > 0) {
          logger.info('[FinishEnrollmentController] Revocación automática 1:1 ejecutada', {
            userId,
            deviceFingerprint: deviceFingerprint.substring(0, 8) + '...',
            previousUserUnlinked: revokeResult.previousUserUnlinked?.userId,
            ownDevicesRevoked: revokeResult.ownDevicesRevoked,
          });
        }
      } catch (revokeError) {
        logger.error('[FinishEnrollmentController] Error en revocación automática:', {
          error: revokeError instanceof Error ? revokeError.message : revokeError,
          userId,
        });
        // Continuar con enrollment - la revocación es best-effort
      }

      // PASO 2: Preparar input para el use case
      const input: FinishEnrollmentInput = {
        userId,
        credential,
        deviceFingerprint,
      };

      // PASO 3: Ejecutar use case (verificar WebAuthn + persistir nuevo dispositivo)
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
      // Log del error para debugging
      logger.error('[FinishEnrollmentController] Error en finish:', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        userId: request.user?.userId?.toNumber()
      });

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
