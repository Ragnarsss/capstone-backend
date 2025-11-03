import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { QRProjectionService } from '../application/qr-projection.service';
import type { CountdownMessageDTO, QRUpdateMessageDTO } from './types';

/**
 * WebSocket Controller para QR Projection
 * Responsabilidad: Manejo de conexiones WebSocket y comunicación con clientes
 */
export class WebSocketController {
  private service: QRProjectionService;

  constructor() {
    this.service = new QRProjectionService();
  }

  async register(fastify: FastifyInstance): Promise<void> {
    fastify.get('/ws', { websocket: true }, this.handleConnection.bind(this));
  }

  private async handleConnection(socket: WebSocket, req: any): Promise<void> {
    const sessionId = this.service.generateSessionId();
    let isClosed = false;

    console.log(`[WebSocket] Nueva conexion: ${sessionId}`);

    socket.on('close', () => {
      isClosed = true;
      console.log(`[WebSocket] Conexion cerrada: ${sessionId}`);
    });

    socket.on('error', (error) => {
      console.error(`[WebSocket] Error en socket ${sessionId}:`, error);
      isClosed = true;
    });

    try {
      await this.runCountdownPhase(socket, sessionId, () => isClosed);

      if (!isClosed && socket.readyState === 1) {
        await this.startQRGenerationPhase(socket, sessionId);
      }
    } catch (error) {
      if (!isClosed) {
        console.error(`[WebSocket] Error en sesion ${sessionId}:`, error);
        if (socket.readyState === 1) {
          socket.close();
        }
      }
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
