import type { FastifyInstance } from 'fastify';

/**
 * Restriction Module
 * 
 * Responsabilidad: Verificar restricciones de acceso (stub para integración futura con PHP)
 * 
 * Estado actual: Stub que siempre retorna { blocked: false }
 * Futuro: Integrará con PHP para restricciones de horario, suspensiones, bloqueos
 */
export async function registerRestrictionModule(fastify: FastifyInstance): Promise<void> {
  // No hay rutas HTTP propias
  // RestrictionService es usado internamente por Access Gateway vía adapter
  fastify.log.info('Restriction module registered (stub mode)');
}
