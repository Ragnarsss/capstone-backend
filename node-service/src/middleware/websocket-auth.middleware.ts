import type { WebSocket } from 'ws';
import { JWTUtils } from '../backend/auth/domain/jwt-utils';
import { UserId } from '../backend/auth/domain/user-id';
import type { AuthenticatedUser } from '../backend/auth/domain/models';

/**
 * Resultado de la autenticación WebSocket
 */
export interface WebSocketAuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

/**
 * Mensaje de autenticación esperado del cliente
 */
interface AuthMessage {
  type: string;
  token?: string;
}

/**
 * WebSocket Auth Middleware
 * Responsabilidad: Manejar el proceso de autenticación JWT en conexiones WebSocket
 *
 * Cross-cutting concern compartido entre todos los módulos que usen WebSocket
 */
export class WebSocketAuthMiddleware {
  private readonly jwtUtils: JWTUtils;
  private readonly authTimeoutMs: number;

  constructor(jwtUtils: JWTUtils, authTimeoutMs: number = 5000) {
    this.jwtUtils = jwtUtils;
    this.authTimeoutMs = authTimeoutMs;
  }

  /**
   * Autentica una conexión WebSocket
   * @param socket Socket WebSocket
   * @returns Promise que resuelve con el resultado de autenticación
   */
  async authenticate(socket: WebSocket): Promise<WebSocketAuthResult> {
    return new Promise((resolve) => {
      let authTimeout: NodeJS.Timeout;
      let messageHandler: ((data: any) => void) | null = null;

      authTimeout = setTimeout(() => {
        this.cleanupListeners(socket, messageHandler);
        console.log('[WebSocket Auth] Timeout de autenticación');

        this.sendMessage(socket, {
          type: 'error',
          message: 'Timeout de autenticación. Debe enviar mensaje AUTH en 5 segundos.'
        });

        socket.close(4408, 'Auth timeout');
        resolve({ success: false, error: 'Auth timeout' });
      }, this.authTimeoutMs);

      messageHandler = async (data: any) => {
        try {
          const msg: AuthMessage = JSON.parse(data.toString());

          if (msg.type !== 'AUTH') {
            this.cleanupListeners(socket, messageHandler);
            clearTimeout(authTimeout);

            console.log('[WebSocket Auth] Primer mensaje no es AUTH:', msg.type);
            this.sendMessage(socket, {
              type: 'error',
              message: 'Debe autenticar primero. Envíe mensaje tipo AUTH con token.'
            });

            socket.close(4401, 'No autenticado');
            resolve({ success: false, error: 'No autenticado' });
            return;
          }

          if (!msg.token) {
            this.cleanupListeners(socket, messageHandler);
            clearTimeout(authTimeout);

            console.log('[WebSocket Auth] Mensaje AUTH sin token');
            this.sendMessage(socket, {
              type: 'error',
              message: 'Token JWT requerido en mensaje AUTH'
            });

            socket.close(4401, 'Token faltante');
            resolve({ success: false, error: 'Token faltante' });
            return;
          }

          try {
            const payload = this.jwtUtils.verify(msg.token);
            const user: AuthenticatedUser = {
              userId: UserId.create(payload.userId),
              username: payload.username,
              nombreCompleto: payload.nombreCompleto,
              rol: payload.rol
            };

            this.cleanupListeners(socket, messageHandler);
            clearTimeout(authTimeout);

            console.log(`[WebSocket Auth] Usuario autenticado: ${user.username} (ID: ${user.userId.toNumber()})`);

            this.sendMessage(socket, {
              type: 'auth-ok',
              username: user.username
            });

            resolve({ success: true, user });

          } catch (error) {
            this.cleanupListeners(socket, messageHandler);
            clearTimeout(authTimeout);

            console.error('[WebSocket Auth] Error validando token:', error);
            this.sendMessage(socket, {
              type: 'error',
              message: error instanceof Error ? error.message : 'Token inválido o expirado'
            });

            socket.close(4403, 'Token inválido');
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Token inválido'
            });
          }

        } catch (error) {
          this.cleanupListeners(socket, messageHandler);
          clearTimeout(authTimeout);

          console.error('[WebSocket Auth] Error procesando mensaje:', error);
          socket.close(4400, 'Bad request');
          resolve({ success: false, error: 'Bad request' });
        }
      };

      socket.on('message', messageHandler);

      socket.once('close', () => {
        this.cleanupListeners(socket, messageHandler);
        clearTimeout(authTimeout);
        resolve({ success: false, error: 'Connection closed' });
      });

      socket.once('error', () => {
        this.cleanupListeners(socket, messageHandler);
        clearTimeout(authTimeout);
        resolve({ success: false, error: 'Socket error' });
      });
    });
  }

  private cleanupListeners(socket: WebSocket, messageHandler: ((data: any) => void) | null): void {
    if (messageHandler) {
      socket.removeListener('message', messageHandler);
    }
  }

  private sendMessage(socket: WebSocket, message: any): void {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }
}
