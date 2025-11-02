import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { QRGenerator } from './qr-generator';
import { config } from '../config';
import type { CountdownMessage, QRUpdateMessage } from '../types';

// Slice vertical: manejo de conexiones WebSocket
export class WebSocketHandler {
  private qrGenerator: QRGenerator;

  constructor() {
    this.qrGenerator = new QRGenerator();
  }

  // Registra las rutas de WebSocket en Fastify
  async register(fastify: FastifyInstance): Promise<void> {
    fastify.get('/ws', { websocket: true }, this.handleConnection.bind(this));
  }

  // Maneja una conexion WebSocket individual
  private async handleConnection(socket: WebSocket, req: any): Promise<void> {
    const sessionId = this.generateSessionId();
    let isClosed = false;

    console.log(`[WebSocket] Nueva conexion: ${sessionId}`);

    // Marcar cuando el socket se cierra
    socket.on('close', () => {
      isClosed = true;
      console.log(`[WebSocket] Conexion cerrada: ${sessionId}`);
    });

    socket.on('error', (error) => {
      console.error(`[WebSocket] Error en socket ${sessionId}:`, error);
      isClosed = true;
    });

    try {
      // Fase 1: Countdown de 5 segundos
      await this.runCountdown(socket, sessionId, () => isClosed);

      // Solo continuar si el socket sigue abierto
      if (!isClosed && socket.readyState === 1) {
        // Fase 2: Generacion continua de QR cada 3 segundos
        await this.startQRGeneration(socket, sessionId);
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

  // Ejecuta el countdown inicial
  private async runCountdown(
    socket: WebSocket,
    sessionId: string,
    isClosedFn: () => boolean
  ): Promise<void> {
    for (let i = config.qr.countdownSeconds; i > 0; i--) {
      // Verificar si el socket se cerro antes de enviar
      if (isClosedFn() || socket.readyState !== 1) {
        console.log(`[WebSocket] Countdown cancelado para ${sessionId}, socket cerrado`);
        return;
      }

      try {
        const message: CountdownMessage = {
          type: 'countdown',
          payload: { seconds: i },
        };

        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[WebSocket] Error enviando countdown para ${sessionId}:`, error);
        return;
      }

      await this.sleep(1000);
    }
  }

  // Inicia la generacion periodica de QR
  private async startQRGeneration(
    socket: WebSocket,
    sessionId: string
  ): Promise<void> {
    const interval = setInterval(async () => {
      // Si el socket se cerro, limpiar el intervalo
      if (socket.readyState !== 1) {
        console.log(`[WebSocket] Limpiando intervalo para ${sessionId}, socket cerrado`);
        clearInterval(interval);
        return;
      }

      try {
        const qrMessage = await this.qrGenerator.createQRMessage(sessionId);

        const message: QRUpdateMessage = {
          type: 'qr-update',
          payload: qrMessage,
        };

        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[QR] Error generando QR para ${sessionId}:`, error);
        clearInterval(interval);
      }
    }, config.qr.regenerationInterval);

    // Limpieza cuando se cierra la conexion
    socket.on('close', () => {
      clearInterval(interval);
      console.log(`[WebSocket] Intervalo QR limpiado para ${sessionId}`);
    });

    socket.on('error', () => {
      clearInterval(interval);
      console.log(`[WebSocket] Intervalo QR limpiado por error en ${sessionId}`);
    });
  }

  // Genera un ID de sesion unico
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  // Helper para delays
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
