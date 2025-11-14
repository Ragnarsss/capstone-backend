import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Security Headers Middleware
 * Responsabilidad: Configurar headers HTTP de seguridad
 *
 * Headers aplicados:
 * - X-Frame-Options: Previene clickjacking
 * - X-Content-Type-Options: Previene MIME sniffing
 * - X-XSS-Protection: Activa protección XSS en navegadores legacy
 * - Referrer-Policy: Control de información de referrer
 * - Permissions-Policy: Control de features del navegador
 */

interface SecurityHeadersConfig {
  xFrameOptions?: 'DENY' | 'SAMEORIGIN';
  contentTypeNosniff?: boolean;
  xssProtection?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  // Por defecto usar SAMEORIGIN para permitir que Apache (mismo origin) embeba contenido
  // Si se desea bloquear embedding completamente, puede sobreescribirse a 'DENY'
  xFrameOptions: 'SAMEORIGIN',
  contentTypeNosniff: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=(self)',
};

export function securityHeadersMiddleware(
  fastify: FastifyInstance,
  config: SecurityHeadersConfig = DEFAULT_CONFIG
): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (finalConfig.xFrameOptions) {
      reply.header('X-Frame-Options', finalConfig.xFrameOptions);
    }

    if (finalConfig.contentTypeNosniff) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    if (finalConfig.xssProtection) {
      reply.header('X-XSS-Protection', '1; mode=block');
    }

    if (finalConfig.referrerPolicy) {
      reply.header('Referrer-Policy', finalConfig.referrerPolicy);
    }

    if (finalConfig.permissionsPolicy) {
      reply.header('Permissions-Policy', finalConfig.permissionsPolicy);
    }
  });
}
