/**
 * Application Layer - Attendance Module
 * 
 * Exporta servicios y use cases del módulo.
 */

// Legacy service (transitorio, sera reemplazado)
export { AttendanceValidationService } from './attendance-validation.service';
export { ParticipationService } from './participation.service';

// New use cases (pipeline pattern)
export { 
  ValidateScanUseCase, 
  createValidateScanUseCase,
  type ValidateScanResult,
  type ValidateScanDependencies,
} from './validate-scan.usecase';
