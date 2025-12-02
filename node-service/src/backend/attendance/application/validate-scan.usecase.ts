/**
 * ValidateScan UseCase
 * 
 * Orquesta la validación de un scan usando el pipeline.
 * Este UseCase encapsula la composición del pipeline y la ejecución.
 * 
 * Responsabilidades:
 * - Crear el contexto
 * - Configurar los stages con dependencias
 * - Ejecutar el pipeline
 * - Transformar el resultado para la capa de presentación
 */

import { 
  createContext, 
  isValid, 
  type ValidationContext,
  type ValidationError,
} from '../domain/validation-pipeline/context';
import { runPipeline, formatTrace } from '../domain/validation-pipeline/runner';
import type { Stage } from '../domain/validation-pipeline/stage.interface';
import { toAsyncStage } from '../domain/validation-pipeline/stage.interface';
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
} from '../domain/validation-pipeline/stages';
import type { QRStateLoader } from '../domain/validation-pipeline/stages/load-qr-state.stage';
import type { StudentStateLoader } from '../domain/validation-pipeline/stages/load-student-state.stage';
import { CryptoService } from '../../../shared/infrastructure/crypto';

/**
 * Resultado del UseCase
 */
export interface ValidateScanResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
  trace?: string;
  context?: ValidationContext;
}

/**
 * Dependencias del UseCase
 */
export interface ValidateScanDependencies {
  cryptoService: CryptoService;
  qrStateLoader: QRStateLoader;
  studentStateLoader: StudentStateLoader;
}

/**
 * UseCase: Validar escaneo de QR
 * 
 * Ejecuta el pipeline completo de validación y retorna el resultado.
 * No tiene efectos secundarios (no marca como consumido, no avanza rounds).
 * 
 * Para completar la transacción, el caller debe usar otro UseCase/Service
 * que consuma el QR y avance el estado del estudiante.
 */
export class ValidateScanUseCase {
  private readonly stages: Stage[];

  constructor(private readonly deps: ValidateScanDependencies) {
    // Componer el pipeline una vez
    this.stages = this.buildPipeline();
  }

  /**
   * Ejecuta la validación
   */
  async execute(encrypted: string, studentId: number): Promise<ValidateScanResult> {
    const ctx = createContext(encrypted, studentId);
    
    const result = await runPipeline(ctx, this.stages);
    
    if (!result.success) {
      return {
        valid: false,
        error: result.ctx.error,
        trace: formatTrace(result.ctx),
        context: result.ctx,
      };
    }

    return {
      valid: true,
      trace: formatTrace(result.ctx),
      context: result.ctx,
    };
  }

  /**
   * Construye el pipeline de stages
   */
  private buildPipeline(): Stage[] {
    return [
      // 1. Decrypt
      createDecryptStage(this.deps.cryptoService),
      
      // 2. Pure validations (sync wrapped as async)
      toAsyncStage(validateStructureStage),
      toAsyncStage(validateOwnershipStage),
      
      // 3. Load QR state
      createLoadQRStateStage(this.deps.qrStateLoader),
      
      // 4. QR validations (pure)
      toAsyncStage(validateQRNotExpiredStage),
      toAsyncStage(validateQRNotConsumedStage),
      
      // 5. Load student state
      createLoadStudentStateStage(this.deps.studentStateLoader),
      
      // 6. Student validations (pure)
      toAsyncStage(validateStudentRegisteredStage),
      toAsyncStage(validateStudentActiveStage),
      toAsyncStage(validateStudentOwnsQRStage),
      toAsyncStage(validateRoundMatchStage),
    ];
  }
}

/**
 * Factory para crear el UseCase con dependencias por defecto
 */
export function createValidateScanUseCase(
  deps?: Partial<ValidateScanDependencies>
): ValidateScanUseCase {
  // Las dependencias reales se inyectan desde la capa de infraestructura
  // Aquí solo proveemos defaults para desarrollo/testing
  
  const cryptoService = deps?.cryptoService ?? new CryptoService();
  
  // Los loaders deben ser provistos - no hay defaults seguros
  if (!deps?.qrStateLoader || !deps?.studentStateLoader) {
    throw new Error(
      'ValidateScanUseCase requires qrStateLoader and studentStateLoader. ' +
      'Use the adapters from infrastructure/adapters.'
    );
  }

  return new ValidateScanUseCase({
    cryptoService,
    qrStateLoader: deps.qrStateLoader,
    studentStateLoader: deps.studentStateLoader,
  });
}
