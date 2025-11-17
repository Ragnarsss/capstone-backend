import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * CORS Middleware
 * Responsabilidad: Configurar Cross-Origin Resource Sharing
 *
 * Configuración adaptada al contexto:
 * - Desarrollo: Permite localhost y puertos de dev (Vite, etc)
 * - Producción: Restringe a origins específicos
 */

interface CORSConfig {
  isDevelopment: boolean;
  allowedOrigins?: string[];
}

export function corsMiddleware(
  fastify: FastifyInstance,
  config: CORSConfig
): void {
  const { isDevelopment, allowedOrigins = [] } = config;
  const allowedMethods = 'GET, POST, PUT, DELETE, OPTIONS';
  const allowedHeaders = 'Content-Type, Authorization';
  const exposedHeaders = 'Content-Length, X-Request-Id';

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin;

    if (isDevelopment) {
      reply.header('Access-Control-Allow-Origin', origin || '*');
      reply.header('Access-Control-Allow-Credentials', 'true');
    } else {
      const origins = allowedOrigins.length > 0
        ? allowedOrigins
        : [process.env.FRONTEND_URL || 'http://localhost'];

      if (origin && origins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
      }
    }

    reply.header('Access-Control-Allow-Methods', allowedMethods);
    reply.header('Access-Control-Allow-Headers', allowedHeaders);
    reply.header('Access-Control-Expose-Headers', exposedHeaders);

    if (request.method === 'OPTIONS') {
      reply.status(204).send();
    }
  });

  if (isDevelopment) {
    fastify.log.info('[CORS] Modo desarrollo: permitiendo todos los origins');
  } else {
    const origins = allowedOrigins.length > 0
      ? allowedOrigins
      : [process.env.FRONTEND_URL || 'http://localhost'];
    fastify.log.info({ origins }, '[CORS] Modo producción configurado');
  }
}
