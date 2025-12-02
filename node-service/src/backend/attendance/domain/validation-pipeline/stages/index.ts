/**
 * Stages - Public API
 */

// I/O Stages (requieren dependencias)
export { createDecryptStage } from './decrypt.stage';
export { createLoadQRStateStage } from './load-qr-state.stage';
export type { QRStateLoader } from './load-qr-state.stage';
export { createLoadStudentStateStage } from './load-student-state.stage';
export type { StudentStateLoader } from './load-student-state.stage';

// Pure Stages - Estructura
export { validateStructureStage } from './validate-structure.stage';
export { validateOwnershipStage } from './validate-ownership.stage';

// Pure Stages - QR
export { 
  validateQRNotExpiredStage, 
  validateQRNotConsumedStage,
} from './validate-qr.stage';

// Pure Stages - Estudiante
export {
  validateStudentRegisteredStage,
  validateStudentActiveStage,
  validateStudentOwnsQRStage,
  validateRoundMatchStage,
} from './validate-student.stage';
