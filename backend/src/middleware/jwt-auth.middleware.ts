import type { FastifyRequest, FastifyReply } from 'fastify';
import { JWTUtils } from '../modules/auth/domain/jwt-utils';
import { logger } from '../shared/infrastructure/logger';
import type { AuthenticatedUser } from '../modules/auth/domain/models';
import { UserId } from '../modules/auth/domain/user-id';

/**
 * Middleware HTTP de autenticación JWT
 * 
 * Responsabilidad:
 * - Extraer token JWT desde header Authorization o query string
 * - Validar token con JWTUtils
 * - Inyectar payload decodificado en request.user
 * - Retornar 401 si token inválido/ausente
 * 
 * Uso:
 * ```typescript
 * fastify.get('/api/protected', {
 *   preHandler: jwtAuthMiddleware
 * }, async (request, reply) => {
 *   // request.user está disponible y validado
 *   return { message: `Hola ${request.user.username}` };
 * });
 * ```
 */
export function createJWTAuthMiddleware(jwtUtils: JWTUtils) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            // Intentar extraer token desde header Authorization
            let token: string | undefined;

            const authHeader = request.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }

            // Fallback: intentar desde query string (útil para WebSocket handshake)
            if (!token && request.query && typeof request.query === 'object') {
                const queryToken = (request.query as Record<string, unknown>).token;
                if (typeof queryToken === 'string') {
                    token = queryToken;
                }
            }

            if (!token) {
                logger.warn('[JWTAuthMiddleware] Token ausente', {
                    ip: request.ip,
                    path: request.url,
                });

                return reply.code(401).send({
                    success: false,
                    error: 'NO_TOKEN',
                    message: 'Token JWT requerido. Proporciona token en header Authorization o query string.',
                });
            }

            // Validar token con JWTUtils
            const payload = jwtUtils.verify(token);

            // Convertir a AuthenticatedUser con UserId (Value Object)
            const authenticatedUser: AuthenticatedUser = {
                userId: UserId.create(payload.userId),
                username: payload.username,
                nombreCompleto: payload.nombreCompleto,
                rol: payload.rol,
            };

            // Inyectar usuario en request para uso en handlers
            request.user = authenticatedUser;

            logger.debug('[JWTAuthMiddleware] Token validado exitosamente', {
                userId: payload.userId,
                username: payload.username,
                rol: payload.rol,
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

            logger.warn('[JWTAuthMiddleware] Token inválido', {
                error: errorMessage,
                ip: request.ip,
                path: request.url,
            });

            // Determinar código de error específico
            let errorCode = 'INVALID_TOKEN';
            if (errorMessage.includes('expirado')) {
                errorCode = 'TOKEN_EXPIRED';
            }

            return reply.code(401).send({
                success: false,
                error: errorCode,
                message: errorMessage,
            });
        }
    };
}
