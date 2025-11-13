import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { QRProjectionService } from '../application/qr-projection.service';
import type { CountdownMessageDTO, QRUpdateMessageDTO } from './types';
import { WebSocketAuthGuard } from './websocket-auth.guard';
import type { AuthenticatedUser } from '../../auth/domain/models';

/**
 * WebSocket Controller para QR Projection
 * Responsabilidad: Manejo de conexiones WebSocket y comunicación de proyección de QR
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

    // Configurar handlers de cleanup
    socket.on('close', () => {
      isClosed = true;
      console.log(`[WebSocket] Conexión cerrada: ${user.username}`);
    });

    socket.on('error', (error) => {
      isClosed = true;
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

    // Iniciar proyección de QR
    const sessionId = this.service.generateSessionId();
    console.log(`[WebSocket] Iniciando proyección para sesión: ${sessionId}`);

    await this.runCountdownPhase(socket, sessionId, () => isClosed);

    if (!isClosed && socket.readyState === 1) {
      await this.startQRGenerationPhase(socket, sessionId);
    }
  }

  private async runCountdownPhase(
    socket: WebSocket,
    sessionId: string,
    isClosedFn: () => boolean
  ): Promise<void> {
    const duration = this.service.getCountdownDuration();

    for (let i = duration; i > 0; i--) {
      if (isClosedFn() || socket.readyState !== 1) {
        console.log(`[WebSocket] Countdown cancelado para ${sessionId}, socket cerrado`);
        return;
      }

      try {
        const countdownState = await this.service.createCountdownState(i);
        const message: CountdownMessageDTO = {
          type: 'countdown',
          payload: { seconds: countdownState.secondsRemaining },
        };

        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[WebSocket] Error enviando countdown para ${sessionId}:`, error);
        return;
      }

      await this.sleep(1000);
    }
  }

  private async startQRGenerationPhase(
    socket: WebSocket,
    sessionId: string
  ): Promise<void> {
    const interval = setInterval(async () => {
      if (socket.readyState !== 1) {
        console.log(`[WebSocket] Limpiando intervalo para ${sessionId}, socket cerrado`);
        clearInterval(interval);
        return;
      }

      try {
        const qrCode = await this.service.generateQRCode(sessionId);

        const message: QRUpdateMessageDTO = {
          type: 'qr-update',
          payload: {
            qrData: qrCode.data,
            timestamp: qrCode.timestamp,
            sessionId: qrCode.sessionId,
          },
        };

        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[QR] Error generando QR para ${sessionId}:`, error);
        clearInterval(interval);
      }
    }, this.service.getRegenerationInterval());

    socket.on('close', () => {
      clearInterval(interval);
      console.log(`[WebSocket] Intervalo QR limpiado para ${sessionId}`);
    });

    socket.on('error', () => {
      clearInterval(interval);
      console.log(`[WebSocket] Intervalo QR limpiado por error en ${sessionId}`);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
