/**
 * Barrel exports para repositorios PostgreSQL
 */

export { SessionRepository } from './session.repository';
export type { SessionEntity, CreateSessionDTO, UpdateSessionDTO } from './session.repository';

export { RegistrationRepository } from './registration.repository';
export type { RegistrationEntity, CreateRegistrationDTO, UpdateRegistrationStatusDTO } from './registration.repository';

export { ValidationRepository } from './validation.repository';
export type { ValidationEntity, CreateValidationDTO, CompleteValidationDTO } from './validation.repository';

export { ResultRepository } from './result.repository';
export type { ResultEntity, CreateResultDTO } from './result.repository';
