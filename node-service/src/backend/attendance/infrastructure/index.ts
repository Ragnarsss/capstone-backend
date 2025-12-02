/**
 * Infrastructure Layer - Attendance Module
 * 
 * Exporta repositorios y adapters del módulo.
 */

// Repositories
export { ActiveSessionRepository } from './active-session.repository';
export { ProjectionPoolRepository, type PoolEntry } from './projection-pool.repository';
export { 
  StudentSessionRepository, 
  type StudentSessionState, 
  type RoundResult, 
  type SessionConfig 
} from './student-session.repository';

// Adapters (para inversión de dependencias)
export {
  QRStateAdapter,
  StudentStateAdapter,
} from './adapters';
