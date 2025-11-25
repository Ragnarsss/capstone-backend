import type { FastifyRequest, FastifyReply } from 'fastify';
import { StartEnrollmentUseCase } from '../../application/use-cases';
import type { StartEnrollmentInput } from '../../application/use-cases';

/**
 * DTO para request de start enrollment
 */
interface StartEnrollmentRequestDTO {
  displayName?: string;
}

/**
 * Controller para POST /api/enrollment/start
 * Responsabilidad: Iniciar proceso de enrollment FIDO2
 */
export class StartEnrollmentController {
  constructor(private readonly useCase: StartEnrollmentUseCase) {}

  async handle(
    request: FastifyRequest<{ Body: StartEnrollmentRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Extraer usuario del JWT (agregado por AuthMiddleware)
      const user = request.user;
      if (!user) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }

      // Preparar input para el use case
      const input: StartEnrollmentInput = {
        userId: user.userId.toNumber(),
        username: user.username,
        displayName: request.body?.displayName || user.nombreCompleto || user.username,
      };

      // Ejecutar use case
      const output = await this.useCase.execute(input);

      // Retornar opciones WebAuthn al cliente
      reply.code(200).send({
        success: true,
        options: output.options,
      });
    } catch (error) {
      // Manejo de errores específicos
      if (error instanceof Error) {
        if (error.message.startsWith('MAX_DEVICES_REACHED')) {
          reply.code(400).send({
            error: 'MAX_DEVICES_REACHED',
            message: 'El usuario ya tiene el máximo de dispositivos enrolados (5)',
          });
          return;
        }
      }

      // Error genérico
      console.error('[StartEnrollmentController] Error:', error);
      reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error al iniciar enrollment',
      });
    }
  }
}
