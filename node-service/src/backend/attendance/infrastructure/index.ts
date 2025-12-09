/**
 * Infrastructure Layer - Attendance Module
 * 
 * Exporta repositorios y adapters del módulo.
 */

// Repositories compartidos (Valkey) - re-exportar desde shared
export { 
  ActiveSessionRepository, 
  ProjectionPoolRepository, 
  type PoolEntry 
} from '../../../shared/infrastructure/valkey';

// Repositories locales (Valkey)
export { 
  StudentSessionRepository, 
  type StudentSessionData,
  type RoundResult, 
  type SessionConfig 
} from './student-session.repository';
export {
  FraudMetricsRepository,
  type FraudType,
  type FraudAttempt,
  type FraudStats,
} from './fraud-metrics.repository';

// Repositories (PostgreSQL)
export {
  SessionRepository,
  type SessionEntity,
  type CreateSessionDTO,
  type UpdateSessionDTO,
  RegistrationRepository,
  type RegistrationEntity,
  type CreateRegistrationDTO,
  type UpdateRegistrationStatusDTO,
  ValidationRepository,
  type ValidationEntity,
  type CreateValidationDTO,
  type CompleteValidationDTO,
  ResultRepository,
  type ResultEntity,
  type CreateResultDTO,
} from './repositories';

// Adapters (para inversión de dependencias)
export {
  QRStateAdapter,
  StudentStateAdapter,
} from './adapters';
