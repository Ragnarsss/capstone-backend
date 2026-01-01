/**
 * Shared Valkey Infrastructure
 * 
 * Repositorios compartidos entre módulos que usan Valkey (Redis) como storage.
 * 
 * Estos repositorios viven aquí porque son usados por múltiples módulos:
 * - qr-projection
 * - attendance
 */

// Cliente base
export { ValkeyClient } from './valkey-client';

// Repositorios compartidos
export { 
  ProjectionPoolRepository, 
  type PoolEntry 
} from './projection-pool.repository';

export { 
  ActiveSessionRepository, 
  type ActiveSessionInfo 
} from './active-session.repository';
