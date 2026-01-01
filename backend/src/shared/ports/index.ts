/**
 * Interfaces de Puertos (Ports)
 * 
 * Siguiendo el patrón Ports & Adapters (Arquitectura Hexagonal):
 * - Los puertos definen las interfaces que el dominio necesita
 * - Los adaptadores implementan esas interfaces
 * 
 * Esto permite:
 * - Desacoplamiento entre módulos
 * - Testing con mocks y stubs
 * - Facilita el cambio de implementaciones sin afectar el dominio
 */

export * from './qr-generator.port';
export * from './pool-balancer.port';
export * from './qr-payload-repository.port';
export * from './session-key-query.interface';
export * from './attendance-stats.port';
export * from './qr-lifecycle.port';
export * from './totp-validator.port';
