import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Request Logger Middleware
 * Responsabilidad: Logging estructurado y consistente de requests HTTP
 *
 * Información capturada:
 * - Método y URL
 * - Usuario autenticado (si existe)
 * - Status code de respuesta
 * - Tiempo de respuesta
 * - IP del cliente
 */

interface RequestLogContext {
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userId?: number;
  username?: string;
  ip?: string;
  userAgent?: string;
}

export function requestLoggerMiddleware(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = Date.now() - (request.startTime || Date.now());

    const logContext: RequestLogContext = {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    if (request.user) {
      logContext.userId = request.user.userId.toNumber();
      logContext.username = request.user.username;
    }

    if (reply.statusCode >= 500) {
      request.log.error(logContext, 'Request completado con error');
    } else if (reply.statusCode >= 400) {
      request.log.warn(logContext, 'Request con error de cliente');
    } else {
      request.log.info(logContext, 'Request completado');
    }
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}
