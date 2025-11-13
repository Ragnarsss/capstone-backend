import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { QRProjectionService } from '../application/qr-projection.service';
import type { CountdownMessageDTO, QRUpdateMessageDTO } from './types';
import { JWTUtils } from '../../auth/domain/jwt-utils';
import type { AuthenticatedUser } from '../../auth/domain/models';

/**
 * WebSocket Controller para QR Projection
 * Responsabilidad: Manejo de conexiones WebSocket con autenticación JWT y comunicación con clientes
 */
export class WebSocketController {
  private service: QRProjectionService;
  private jwtUtils: JWTUtils;

  constructor(service: QRProjectionService, jwtUtils: JWTUtils) {
    this.service = service;
    this.jwtUtils = jwtUtils;
  }

  async register(fastify: FastifyInstance): Promise<void> {
    fastify.get('/ws', { websocket: true }, this.handleConnection.bind(this));
  }

  private async handleConnection(socket: WebSocket, req: any): Promise<void> {
    let isAuthenticated = false;
    let user: AuthenticatedUser | null = null;
    let authTimeout: NodeJS.Timeout;
    let isClosed = false;

    console.log('[WebSocket] Nueva conexión, esperando autenticación...');

    // Timeout de autenticación: 5 segundos
    authTimeout = setTimeout(() => {
      if (!isAuthenticated) {
        console.log('[WebSocket] Timeout de autenticación');
        this.sendMessage(socket, {
          type: 'error',
          message: 'Timeout de autenticación. Debe enviar mensaje AUTH en 5 segundos.'
        });
        socket.close(4408, 'Auth timeout');
      }
    }, 5000);

    socket.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // FASE 1: Autenticación (primer mensaje debe ser AUTH)
        if (!isAuthenticated) {
          if (msg.type !== 'AUTH') {
            console.log('[WebSocket] Primer mensaje no es AUTH:', msg.type);
            this.sendMessage(socket, {
              type: 'error',
              message: 'Debe autenticar primero. Envíe mensaje tipo AUTH con token.'
            });
            socket.close(4401, 'No autenticado');
            return;
          }

          if (!msg.token) {
            console.log('[WebSocket] Mensaje AUTH sin token');
            this.sendMessage(socket, {
              type: 'error',
              message: 'Token JWT requerido en mensaje AUTH'
            });
            socket.close(4401, 'Token faltante');
            return;
          }

          try {
            const payload = this.jwtUtils.verify(msg.token);
            user = {
              userId: payload.userId,
              username: payload.username,
              nombreCompleto: payload.nombreCompleto,
              rol: payload.rol
            };
            isAuthenticated = true;
            clearTimeout(authTimeout);

            console.log(`[WebSocket] Usuario autenticado: ${user.username} (ID: ${user.userId})`);

            this.sendMessage(socket, {
              type: 'auth-ok',
              username: user.username
            });

            // Iniciar proyección de QR
            const sessionId = this.service.generateSessionId();
            console.log(`[WebSocket] Iniciando proyección para sesión: ${sessionId}`);
            
            await this.runCountdownPhase(socket, sessionId, () => isClosed);

            if (!isClosed && socket.readyState === 1) {
              await this.startQRGenerationPhase(socket, sessionId);
            }

          } catch (error) {
            console.error('[WebSocket] Error validando token:', error);
            this.sendMessage(socket, {
              type: 'error',
              message: error instanceof Error ? error.message : 'Token inválido o expirado'
            });
            socket.close(4403, 'Token inválido');
          }
          return;
        }

        // FASE 2: Mensajes post-autenticación
        // Por ahora la proyección es unidireccional (servidor → cliente)
        // Pero aquí se pueden manejar comandos futuros como 'pause', 'resume', etc.
        console.log(`[WebSocket] Mensaje de ${user?.username}:`, msg.type);

      } catch (error) {
        console.error('[WebSocket] Error procesando mensaje:', error);
      }
    });

    socket.on('close', () => {
      isClosed = true;
      clearTimeout(authTimeout);
      if (user) {
        console.log(`[WebSocket] Conexión cerrada: ${user.username}`);
      } else {
        console.log('[WebSocket] Conexión cerrada antes de autenticar');
      }
    });

    socket.on('error', (error) => {
      isClosed = true;
      clearTimeout(authTimeout);
      console.error('[WebSocket] Error en socket:', error);
    });
  }

  private sendMessage(socket: WebSocket, message: any): void {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(message));
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
