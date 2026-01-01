import type { FastifyInstance } from 'fastify';
import { registerSessionRoutes } from './presentation/routes';

/**
 * Session Module
 * 
 * Responsabilidad: Gestión de sesiones ECDH (login/logout)
 * 
 * Endpoints:
 * - POST /api/session/login - ECDH key exchange
 * - DELETE /api/session - Cerrar sesión (futuro)
 */
export async function registerSessionModule(fastify: FastifyInstance): Promise<void> {
  await registerSessionRoutes(fastify);
}
