/**
 * Shared - Barrel file
 * 
 * Exporta todos los módulos compartidos entre diferentes partes del sistema.
 * Incluye puertos (interfaces), tipos, configuración e infraestructura.
 */

// Puertos (Ports & Adapters pattern)
export * from './ports';

// Tipos compartidos
export * from './types';

// Configuración
export * from './config';

// Infraestructura compartida (Valkey, etc.)
export * from './infrastructure/valkey';
