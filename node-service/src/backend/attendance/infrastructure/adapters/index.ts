/**
 * Adapters para conectar infraestructura con dominio
 * 
 * Implementan las interfaces definidas en domain/validation-pipeline/stages
 * para inversión de dependencias.
 */

export { QRStateAdapter } from './qr-state.adapter';
export { StudentStateAdapter } from './student-state.adapter';
export { SessionKeyQueryAdapter } from './session-key-query.adapter';
export {
  createCompleteScanDependencies,
  createCompleteScanDepsWithPersistence,
  type CompleteScanDepsResult,
} from './complete-scan-deps.factory';
