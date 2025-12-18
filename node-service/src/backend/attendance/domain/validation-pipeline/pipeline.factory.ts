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
  createTOTPValidationStage,
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
import type { ISessionKeyQuery } from '../../../../shared/ports';

/**
 * Dependencias requeridas para construir pipelines
 */
export interface PipelineDependencies {
  aesGcmService: AesGcmService;
  qrStateLoader: QRStateLoader;
  studentStateLoader: StudentStateLoader;
  /** Query para obtener session_key (inyectada para SoC) */
  sessionKeyQuery: ISessionKeyQuery;
}

/**
 * Crea el pipeline completo con todos los stages de validacion
 * 
 * Stages incluidos:
 * 1. Decrypt - desencripta payload AES-GCM
 * 2. TOTPValidation - valida TOTPu derivado de session_key
 * 3. ValidateStructure - verifica estructura QRPayloadV1
 * 4. ValidateOwnership - verifica que studentId coincida
 * 5. LoadQRState - carga estado del QR desde Valkey
 * 6. ValidateQRNotExpired - verifica TTL
 * 7. ValidateQRNotConsumed - verifica no usado previamente
 * 8. LoadStudentState - carga estado del estudiante
 * 9. ValidateStudentRegistered - verifica registro
 * 10. ValidateStudentActive - verifica estado activo
 * 11. ValidateStudentOwnsQR - verifica propiedad del QR
 * 12. ValidateRoundMatch - verifica round correcto
 */
export function createDefaultPipeline(deps: PipelineDependencies): Stage[] {
  return [
    // 1. Decrypt (usa sessionKeyQuery para obtener clave)
    createDecryptStage({
      fallbackAesGcmService: deps.aesGcmService,
      sessionKeyQuery: deps.sessionKeyQuery,
    }),

    // 2. TOTP validation (usa sessionKeyQuery para verificar)
    createTOTPValidationStage({ sessionKeyQuery: deps.sessionKeyQuery }),
    
    // 3. Pure validations (sync wrapped as async)
    toAsyncStage(validateStructureStage),
    toAsyncStage(validateOwnershipStage),
    
    // 4. Load QR state
    createLoadQRStateStage(deps.qrStateLoader),
    
    // 5. QR validations (pure)
    toAsyncStage(validateQRNotExpiredStage),
    toAsyncStage(validateQRNotConsumedStage),
    
    // 6. Load student state
    createLoadStudentStateStage(deps.studentStateLoader),
    
    // 7. Student validations (pure)
    toAsyncStage(validateStudentRegisteredStage),
    toAsyncStage(validateStudentActiveStage),
    toAsyncStage(validateStudentOwnsQRStage),
    toAsyncStage(validateRoundMatchStage),
  ];
}

/**
 * Dependencias minimas para pipeline de testing
 */
export interface MinimalPipelineDependencies {
  aesGcmService: AesGcmService;
  sessionKeyQuery: ISessionKeyQuery;
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
export function createMinimalPipeline(deps: MinimalPipelineDependencies): Stage[] {
  return [
    createDecryptStage({
      fallbackAesGcmService: deps.aesGcmService,
      sessionKeyQuery: deps.sessionKeyQuery,
    }),
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
    createDecryptStage({
      fallbackAesGcmService: deps.aesGcmService,
      sessionKeyQuery: deps.sessionKeyQuery,
    }),
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
