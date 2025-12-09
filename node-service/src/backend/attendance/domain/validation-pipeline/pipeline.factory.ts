/**
 * Pipeline Factory
 * 
 * Crea configuraciones de pipeline predefinidas para diferentes casos de uso.
 * Centraliza la composicion de stages permitiendo:
 * - Configuraciones predeterminadas (default, minimal)
 * - Configuraciones personalizadas
 * - Facil extension para A/B testing o feature flags
 */

import type { Stage } from './stage.interface';
import { toAsyncStage } from './stage.interface';
import {
  createDecryptStage,
  validateStructureStage,
  validateOwnershipStage,
  createLoadQRStateStage,
  validateQRNotExpiredStage,
  validateQRNotConsumedStage,
  createLoadStudentStateStage,
  validateStudentRegisteredStage,
  validateStudentActiveStage,
  validateStudentOwnsQRStage,
  validateRoundMatchStage,
} from './stages';
import type { QRStateLoader } from './stages/load-qr-state.stage';
import type { StudentStateLoader } from './stages/load-student-state.stage';
import type { AesGcmService } from '../../../../shared/infrastructure/crypto';

/**
 * Dependencias requeridas para construir pipelines
 */
export interface PipelineDependencies {
  aesGcmService: AesGcmService;
  qrStateLoader: QRStateLoader;
  studentStateLoader: StudentStateLoader;
}

/**
 * Crea el pipeline completo con todos los stages de validacion
 * 
 * Stages incluidos:
 * 1. Decrypt - desencripta payload AES-GCM
 * 2. ValidateStructure - verifica estructura QRPayloadV1
 * 3. ValidateOwnership - verifica que studentId coincida
 * 4. LoadQRState - carga estado del QR desde Valkey
 * 5. ValidateQRNotExpired - verifica TTL
 * 6. ValidateQRNotConsumed - verifica no usado previamente
 * 7. LoadStudentState - carga estado del estudiante
 * 8. ValidateStudentRegistered - verifica registro
 * 9. ValidateStudentActive - verifica estado activo
 * 10. ValidateStudentOwnsQR - verifica propiedad del QR
 * 11. ValidateRoundMatch - verifica round correcto
 */
export function createDefaultPipeline(deps: PipelineDependencies): Stage[] {
  return [
    // 1. Decrypt
    createDecryptStage(deps.aesGcmService),
    
    // 2. Pure validations (sync wrapped as async)
    toAsyncStage(validateStructureStage),
    toAsyncStage(validateOwnershipStage),
    
    // 3. Load QR state
    createLoadQRStateStage(deps.qrStateLoader),
    
    // 4. QR validations (pure)
    toAsyncStage(validateQRNotExpiredStage),
    toAsyncStage(validateQRNotConsumedStage),
    
    // 5. Load student state
    createLoadStudentStateStage(deps.studentStateLoader),
    
    // 6. Student validations (pure)
    toAsyncStage(validateStudentRegisteredStage),
    toAsyncStage(validateStudentActiveStage),
    toAsyncStage(validateStudentOwnsQRStage),
    toAsyncStage(validateRoundMatchStage),
  ];
}

/**
 * Crea un pipeline minimo para testing o validacion rapida
 * 
 * Solo incluye:
 * 1. Decrypt
 * 2. ValidateStructure
 * 3. ValidateOwnership
 * 
 * No requiere loaders de estado (qrStateLoader, studentStateLoader)
 */
export function createMinimalPipeline(aesGcmService: AesGcmService): Stage[] {
  return [
    createDecryptStage(aesGcmService),
    toAsyncStage(validateStructureStage),
    toAsyncStage(validateOwnershipStage),
  ];
}

/**
 * Tipo para stages opcionales que pueden habilitarse/deshabilitarse
 */
export type OptionalStage = 
  | 'validateQRNotExpired'
  | 'validateQRNotConsumed'
  | 'validateStudentActive'
  | 'validateStudentOwnsQR'
  | 'validateRoundMatch';

/**
 * Opciones para pipeline personalizado
 */
export interface CustomPipelineOptions {
  /** Stages opcionales a excluir */
  exclude?: OptionalStage[];
}

/**
 * Crea un pipeline personalizado excluyendo stages especificos
 * 
 * Util para:
 * - Testing con subsets de validacion
 * - Feature flags para habilitar/deshabilitar validaciones
 * - A/B testing de reglas de negocio
 */
export function createCustomPipeline(
  deps: PipelineDependencies,
  options: CustomPipelineOptions = {}
): Stage[] {
  const exclude = new Set(options.exclude ?? []);
  
  const stages: Stage[] = [
    // Siempre incluidos - core validation
    createDecryptStage(deps.aesGcmService),
    toAsyncStage(validateStructureStage),
    toAsyncStage(validateOwnershipStage),
    createLoadQRStateStage(deps.qrStateLoader),
  ];

  // QR validations - opcionales
  if (!exclude.has('validateQRNotExpired')) {
    stages.push(toAsyncStage(validateQRNotExpiredStage));
  }
  if (!exclude.has('validateQRNotConsumed')) {
    stages.push(toAsyncStage(validateQRNotConsumedStage));
  }

  // Student state - siempre cargamos si hay loaders
  stages.push(createLoadStudentStateStage(deps.studentStateLoader));
  stages.push(toAsyncStage(validateStudentRegisteredStage));

  // Student validations - opcionales
  if (!exclude.has('validateStudentActive')) {
    stages.push(toAsyncStage(validateStudentActiveStage));
  }
  if (!exclude.has('validateStudentOwnsQR')) {
    stages.push(toAsyncStage(validateStudentOwnsQRStage));
  }
  if (!exclude.has('validateRoundMatch')) {
    stages.push(toAsyncStage(validateRoundMatchStage));
  }

  return stages;
}
