import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../application/auth.service';
import type { AuthenticatedUser } from '../domain/models';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Middleware de autenticación JWT
 * Responsabilidad: Validar tokens y adjuntar usuario a request
 */
export class AuthMiddleware {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  authenticate() {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const user = this.authService.authenticateFromHeader(request.headers.authorization);
        request.user = user;

        request.log.info({
          userId: user.userId,
          username: user.username,
          endpoint: request.url,
        }, 'Usuario autenticado via JWT');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error de autenticación';

        request.log.warn({
          error: errorMessage,
          endpoint: request.url,
          ip: request.ip,
        }, 'Fallo de autenticación JWT');

        return reply.status(401).send({
          success: false,
          error: 'UNAUTHORIZED',
          message: errorMessage,
        });
      }
    };
  }

  optionalAuthenticate() {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const authHeader = request.headers.authorization;
        if (authHeader) {
          const user = this.authService.authenticateFromHeader(authHeader);
          request.user = user;
        }
      } catch (error) {
        request.log.debug({ error }, 'Token JWT opcional no válido');
      }
    };
  }
}
