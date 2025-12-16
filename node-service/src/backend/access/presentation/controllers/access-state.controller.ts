import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AccessGatewayService } from '../../application/services';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * Controller para GET /api/access/state
 * Responsabilidad: Obtener estado agregado de acceso del usuario
 *
 * Retorna estado sin wrappers (diferente de endpoints legacy)
 */
export class AccessStateController {
  constructor(private readonly accessGatewayService: AccessGatewayService) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Extraer usuario del JWT
      const user = request.user;
      if (!user) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }

      // Obtener estado agregado
      const state = await this.accessGatewayService.getState(user.userId.toNumber());

      logger.debug(`[AccessStateController] Usuario ${user.userId}: state=${state.state}, action=${state.action}`);

      // Retornar estado SIN wrappers (diseño nuevo)
      reply.code(200).send(state);
    } catch (error) {
      logger.error('[AccessStateController] Error:', error);
      reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error al obtener estado de acceso',
      });
    }
  }
}
