import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AccessGatewayService } from '../../application/services';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * Query params para GET /api/access/state
 */
interface AccessStateQuery {
  deviceFingerprint?: string;
}

/**
 * Controller para GET /api/access/state
 * Responsabilidad: Obtener estado agregado de acceso del usuario
 *
 * Query params:
 * - deviceFingerprint (requerido): Huella del dispositivo para validacion 1:1
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

      // Extraer deviceFingerprint de query params
      const query = request.query as AccessStateQuery;
      const deviceFingerprint = query.deviceFingerprint;
      
      if (!deviceFingerprint) {
        reply.code(400).send({
          error: 'BAD_REQUEST',
          message: 'deviceFingerprint query param es requerido',
        });
        return;
      }

      // Obtener estado agregado (delegando logica al orchestrator)
      const state = await this.accessGatewayService.getState(
        user.userId.toNumber(),
        deviceFingerprint
      );

      logger.debug(
        `[AccessStateController] Usuario ${user.userId} (device: ${deviceFingerprint.substring(0, 8)}...): ` +
        `state=${state.state}, action=${state.action}`
      );

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
