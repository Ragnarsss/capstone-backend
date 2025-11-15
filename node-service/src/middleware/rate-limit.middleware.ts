/**
 * Rate Limit Middleware
 *
 * Implementa rate limiting usando Valkey (Redis) con algoritmo Token Bucket.
 * Protege endpoints de abuso y ataques de fuerza bruta.
 *
 * Características:
 * - Límites configurables por endpoint
 * - Almacenamiento distribuido en Valkey
 * - Headers informativos (X-RateLimit-*)
 * - Respuesta 429 Too Many Requests
 * - Identificación por IP o userId
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import { config } from '../shared/config/index.js';

interface RateLimitConfig {
  /** Número máximo de requests permitidos en la ventana */
  max: number;
  /** Duración de la ventana en segundos */
  windowSeconds: number;
  /** Función para extraer la clave de identificación (por defecto usa IP) */
  keyGenerator?: (request: FastifyRequest) => string;
  /** Mensaje personalizado cuando se excede el límite */
  message?: string;
}

interface RateLimitInfo {
  /** Requests restantes en la ventana actual */
  remaining: number;
  /** Timestamp cuando se resetea el contador */
  resetTime: number;
  /** Total de requests permitidos */
  limit: number;
}

/**
 * Cliente Valkey singleton para rate limiting
 */
class ValkeyRateLimitClient {
  private static instance: ValkeyRateLimitClient;
  private client: Redis | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): ValkeyRateLimitClient {
    if (!ValkeyRateLimitClient.instance) {
      ValkeyRateLimitClient.instance = new ValkeyRateLimitClient();
    }
    return ValkeyRateLimitClient.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      this.client = new Redis({
        host: config.valkey.host,
        port: config.valkey.port,
        lazyConnect: false,
      });

      this.client.on('error', (err: Error) => {
        console.error('[RateLimit] Valkey connection error:', err);
      });

      this.client.on('connect', () => {
        console.log('[RateLimit] Connected to Valkey');
      });

      this.isConnected = true;
    } catch (error) {
      console.error('[RateLimit] Failed to connect to Valkey:', error);
      throw error;
    }
  }

  async checkLimit(key: string, max: number, windowSeconds: number): Promise<RateLimitInfo> {
    if (!this.client || !this.isConnected) {
      throw new Error('Valkey client not connected');
    }

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const resetTime = now + windowMs;

    try {
      // Incrementar contador
      const current = await this.client.incr(key);

      // Si es el primer request, establecer TTL
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, max - current);

      return {
        remaining,
        resetTime,
        limit: max,
      };
    } catch (error) {
      console.error('[RateLimit] Error checking limit:', error);
      // En caso de error con Valkey, permitir el request (fail open)
      return {
        remaining: max,
        resetTime,
        limit: max,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('[RateLimit] Disconnected from Valkey');
    }
  }
}

/**
 * Generador de clave por defecto: usa IP del cliente
 */
const defaultKeyGenerator = (request: FastifyRequest): string => {
  const ip = request.ip || request.socket.remoteAddress || 'unknown';
  return `ratelimit:${ip}`;
};

/**
 * Aplica rate limiting a toda la aplicación
 */
export async function rateLimitMiddleware(
  fastify: FastifyInstance,
  options: RateLimitConfig
): Promise<void> {
  const {
    max,
    windowSeconds,
    keyGenerator = defaultKeyGenerator,
    message = 'Too many requests, please try again later',
  } = options;

  // Conectar a Valkey al inicializar el middleware
  const valkeyClient = ValkeyRateLimitClient.getInstance();
  await valkeyClient.connect();

  // Hook onRequest para verificar límites antes de procesar
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = keyGenerator(request);
    const info = await valkeyClient.checkLimit(key, max, windowSeconds);

    // Agregar headers informativos
    reply.header('X-RateLimit-Limit', info.limit);
    reply.header('X-RateLimit-Remaining', info.remaining);
    reply.header('X-RateLimit-Reset', Math.floor(info.resetTime / 1000));

    // Si excede el límite, responder con 429
    if (info.remaining === 0) {
      reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil((info.resetTime - Date.now()) / 1000),
      });
    }
  });

  // Cleanup al cerrar la aplicación
  fastify.addHook('onClose', async () => {
    await valkeyClient.disconnect();
  });
}

/**
 * Crea un rate limiter específico para un endpoint
 */
export function createEndpointRateLimiter(options: RateLimitConfig) {
  const {
    max,
    windowSeconds,
    keyGenerator = defaultKeyGenerator,
    message = 'Too many requests, please try again later',
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const valkeyClient = ValkeyRateLimitClient.getInstance();
    const key = keyGenerator(request);
    const info = await valkeyClient.checkLimit(key, max, windowSeconds);

    // Agregar headers informativos
    reply.header('X-RateLimit-Limit', info.limit);
    reply.header('X-RateLimit-Remaining', info.remaining);
    reply.header('X-RateLimit-Reset', Math.floor(info.resetTime / 1000));

    // Si excede el límite, responder con 429
    if (info.remaining === 0) {
      reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil((info.resetTime - Date.now()) / 1000),
      });
    }
  };
}

/**
 * Key generator basado en userId (para endpoints autenticados)
 */
export function userIdKeyGenerator(request: FastifyRequest): string {
  // Extraer userId del token JWT si existe
  const userId = (request as any).userId?.toString() || request.ip || 'unknown';
  return `ratelimit:user:${userId}`;
}

/**
 * Key generator combinado: IP + endpoint
 */
export function ipEndpointKeyGenerator(request: FastifyRequest): string {
  const ip = request.ip || request.socket.remoteAddress || 'unknown';
  const endpoint = request.routeOptions.url || request.url;
  return `ratelimit:${ip}:${endpoint}`;
}
