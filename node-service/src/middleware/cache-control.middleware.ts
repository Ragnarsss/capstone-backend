import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Cache Control Middleware
 * Responsabilidad: Configurar headers de control de cache HTTP
 *
 * Políticas de cache:
 * - no-cache: Para HTML y recursos que cambian frecuentemente
 * - public: Para assets estáticos (JS, CSS, imágenes)
 * - private: Para respuestas de API con datos de usuario
 */

export type CachePolicy = 'no-cache' | 'public' | 'private' | 'custom';

interface CacheControlConfig {
  defaultPolicy?: CachePolicy;
  maxAge?: number;
  customRules?: Map<RegExp, CachePolicy>;
}

export function cacheControlMiddleware(
  fastify: FastifyInstance,
  config: CacheControlConfig = {}
): void {
  const {
    defaultPolicy = 'private',
    maxAge = 0,
    customRules = new Map(),
  } = config;

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url;
    let policy: CachePolicy = defaultPolicy;

    for (const [pattern, rulePolicy] of customRules.entries()) {
      if (pattern.test(path)) {
        policy = rulePolicy;
        break;
      }
    }

    applyCacheHeaders(reply, policy, maxAge);
  });
}

function applyCacheHeaders(reply: FastifyReply, policy: CachePolicy, maxAge: number): void {
  switch (policy) {
    case 'no-cache':
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
      break;

    case 'public':
      reply.header('Cache-Control', `public, max-age=${maxAge}`);
      break;

    case 'private':
      reply.header('Cache-Control', `private, max-age=${maxAge}`);
      break;

    case 'custom':
      break;
  }
}

export function noCacheHeaders(reply: FastifyReply): void {
  applyCacheHeaders(reply, 'no-cache', 0);
}
