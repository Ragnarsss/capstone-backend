/**
 * Interfaces de Puertos (Ports)
 * 
 * Siguiendo el patrón Ports & Adapters (Arquitectura Hexagonal):
 * - Los puertos definen las interfaces que el dominio necesita
 * - Los adaptadores implementan esas interfaces
 * 
 * Esto permite:
 * - Desacoplamiento entre módulos
 * - Testing con mocks
 * - Preparación para microservicios
 */

export * from './qr-generator.port';
export * from './pool-balancer.port';
export * from './qr-payload-repository.port';
export * from './session-key-query.interface';
