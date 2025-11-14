import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { QRProjectionService, type ProjectionCallbacks } from '../application/qr-projection.service';
import type { CountdownMessageDTO, QRUpdateMessageDTO } from './types';
import { WebSocketAuthGuard } from './websocket-auth.guard';
import type { AuthenticatedUser } from '../../auth/domain/models';

/**
 * WebSocket Controller para QR Projection
 * Responsabilidad: Manejo de conexiones WebSocket y serialización de mensajes
 */
export class WebSocketController {
  private service: QRProjectionService;
  private authGuard: WebSocketAuthGuard;

  constructor(service: QRProjectionService, authGuard: WebSocketAuthGuard) {
    this.service = service;
    this.authGuard = authGuard;
  }

  async register(fastify: FastifyInstance): Promise<void> {
    fastify.get('/ws', { websocket: true }, this.handleConnection.bind(this));
  }

  private async handleConnection(socket: WebSocket, req: any): Promise<void> {
    let isClosed = false;

    console.log('[WebSocket] Nueva conexión, esperando autenticación...');

    // Autenticar usando el guard
    const authResult = await this.authGuard.authenticate(socket);

    // Si la autenticación falla, el guard ya cerró la conexión
    if (!authResult.success || !authResult.user) {
      console.log('[WebSocket] Autenticación fallida, conexión terminada');
      return;
    }

    const user: AuthenticatedUser = authResult.user;

    // Generar sessionId
    const sessionId = this.service.generateSessionId();
    console.log(`[WebSocket] Iniciando proyección para sesión: ${sessionId}`);

    // Configurar handlers de cleanup
    socket.on('close', () => {
      isClosed = true;
      this.service.stopProjection(sessionId);
      console.log(`[WebSocket] Conexión cerrada: ${user.username}`);
    });

    socket.on('error', (error) => {
      isClosed = true;
      this.service.stopProjection(sessionId);
      console.error('[WebSocket] Error en socket:', error);
    });

    // Handler para mensajes post-autenticación
    socket.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Por ahora la proyección es unidireccional (servidor → cliente)
        // Pero aquí se pueden manejar comandos futuros como 'pause', 'resume', etc.
        console.log(`[WebSocket] Mensaje de ${user.username}:`, msg.type);
      } catch (error) {
        console.error('[WebSocket] Error procesando mensaje:', error);
      }
    });

    // Definir callbacks para el servicio
    const callbacks: ProjectionCallbacks = {
      onCountdown: async (seconds: number) => {
        const message: CountdownMessageDTO = {
          type: 'countdown',
          payload: { seconds },
        };
        socket.send(JSON.stringify(message));
      },

      onQRUpdate: async (qrPayload) => {
        const message: QRUpdateMessageDTO = {
          type: 'qr-update',
          payload: {
            message: qrPayload.message,
            timestamp: qrPayload.timestamp,
            sessionId: qrPayload.sessionId.toString(),
          },
        };
        socket.send(JSON.stringify(message));
      },

      shouldStop: () => isClosed || socket.readyState !== 1,
    };

    // Delegar orquestación completa al servicio
    await this.service.startProjection(sessionId, callbacks);
  }
}
