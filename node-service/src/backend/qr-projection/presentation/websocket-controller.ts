import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { QRProjectionService, type ProjectionCallbacks, type ProjectionContext } from '../application/qr-projection.service';
import type { CountdownMessageDTO, QRUpdateMessageDTO } from './types';
import { WebSocketAuthMiddleware } from '../../../middleware';
import type { AuthenticatedUser } from '../../auth/domain/models';
import { ActiveSessionRepository } from '../../../shared/infrastructure/valkey';
import { logger } from '../../../shared/infrastructure/logger';

/**
 * WebSocket Controller para QR Projection
 * Responsabilidad: Manejo de conexiones WebSocket y serialización de mensajes
 */
export class WebSocketController {
  private service: QRProjectionService;
  private authMiddleware: WebSocketAuthMiddleware;
  private activeSessionRepo: ActiveSessionRepository;

  constructor(service: QRProjectionService, authMiddleware: WebSocketAuthMiddleware) {
    this.service = service;
    this.authMiddleware = authMiddleware;
    this.activeSessionRepo = new ActiveSessionRepository();
  }

  async register(fastify: FastifyInstance): Promise<void> {
    // Registrar en /asistencia/ws porque Apache preserve el prefijo
    fastify.get('/asistencia/ws', { websocket: true }, this.handleConnection.bind(this));
  }

  private async handleConnection(socket: WebSocket, req: any): Promise<void> {
    let isClosed = false;

    logger.debug('[WebSocket] Nueva conexión, esperando autenticación...');

    // Autenticar usando el middleware
    const authResult = await this.authMiddleware.authenticate(socket);

    // Si la autenticación falla, el middleware ya cerró la conexión
    if (!authResult.success || !authResult.user) {
      logger.debug('[WebSocket] Autenticación fallida, conexión terminada');
      return;
    }

    const user: AuthenticatedUser = authResult.user;

    // Crear contexto de proyección
    const context: ProjectionContext = {
      userId: user.userId.toNumber(),
      username: user.username,
    };

    // Generar sessionId
    const sessionId = this.service.generateSessionId();
    const sessionIdStr = sessionId.toString();
    logger.debug(`[WebSocket] Iniciando proyección para sesión: ${sessionIdStr}, usuario: ${user.username} (ID: ${user.userId})`);

    // Registrar como sesión activa global
    await this.activeSessionRepo.setActiveSession({
      sessionId: sessionIdStr,
      hostUserId: user.userId.toNumber(),
      hostUsername: user.username,
      startedAt: Date.now(),
    });

    // Configurar handlers de cleanup
    socket.on('close', () => {
      isClosed = true;
      this.service.stopProjection(sessionId);
      // Limpiar sesión activa
      this.activeSessionRepo.clearActiveSession(sessionIdStr);
      logger.debug(`[WebSocket] Conexión cerrada: ${user.username}`);
    });

    socket.on('error', (error) => {
      isClosed = true;
      this.service.stopProjection(sessionId);
      // Limpiar sesión activa
      this.activeSessionRepo.clearActiveSession(sessionIdStr);
      logger.error('[WebSocket] Error en socket:', error);
    });

    // Handler para mensajes post-autenticación
    socket.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Por ahora la proyección es unidireccional (servidor → cliente)
        // Pero aquí se pueden manejar comandos futuros como 'pause', 'resume', etc.
        logger.debug(`[WebSocket] Mensaje de ${user.username}:`, msg.type);
      } catch (error) {
        logger.error('[WebSocket] Error procesando mensaje:', error);
      }
    });

    // Definir callbacks para el servicio (V1)
    const callbacks: ProjectionCallbacks = {
      onCountdown: async (seconds: number) => {
        const message: CountdownMessageDTO = {
          type: 'countdown',
          payload: { seconds },
        };
        socket.send(JSON.stringify(message));
      },

      onQRUpdate: async (envelope) => {
        const message: QRUpdateMessageDTO = {
          type: 'qr-update',
          payload: {
            data: envelope.payload,
            qrContent: envelope.payloadString,
            sessionId: envelope.sessionId.toString(),
          },
        };
        socket.send(JSON.stringify(message));
      },

      shouldStop: () => isClosed || socket.readyState !== 1,
    };

    // Delegar orquestación completa al servicio con contexto
    await this.service.startProjection(sessionId, callbacks, context);
  }
}
