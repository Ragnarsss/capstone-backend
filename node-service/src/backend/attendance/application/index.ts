/**
 * Application Layer - Attendance Module
 * 
 * Exporta servicios y use cases del módulo.
 */

// Services
export { ParticipationService } from './participation.service';

// Use cases (pipeline pattern)
export { 
  ValidateScanUseCase, 
  createValidateScanUseCase,
  type ValidateScanResult,
  type ValidateScanDependencies,
} from './validate-scan.usecase';

export {
  CompleteScanUseCase,
  type CompleteScanDependencies,
  type CompleteScanResult,
} from './complete-scan.usecase';
