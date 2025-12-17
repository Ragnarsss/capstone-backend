/**
 * ValidateScan UseCase
 * 
 * Orquesta la validacion de un scan usando el pipeline.
 * Este UseCase encapsula la composicion del pipeline y la ejecucion.
 * 
 * Responsabilidades:
 * - Crear el contexto
 * - Delegar construccion del pipeline al factory
 * - Ejecutar el pipeline
 * - Transformar el resultado para la capa de presentacion
 */

import { 
  createContext, 
  isValid, 
  type ValidationContext,
  type ValidationError,
} from '../domain/validation-pipeline/context';
import { runPipeline, formatTrace } from '../domain/validation-pipeline/runner';
import type { Stage } from '../domain/validation-pipeline/stage.interface';
import { createDefaultPipeline, type PipelineDependencies } from '../domain/validation-pipeline';
import type { QRStateLoader } from '../domain/validation-pipeline/stages/load-qr-state.stage';
import type { StudentStateLoader } from '../domain/validation-pipeline/stages/load-student-state.stage';
import { AesGcmService } from '../../../shared/infrastructure/crypto';
import type { ISessionKeyQuery } from '../../../shared/ports';

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
  aesGcmService: AesGcmService;
  qrStateLoader: QRStateLoader;
  studentStateLoader: StudentStateLoader;
  sessionKeyQuery: ISessionKeyQuery;
}

/**
 * UseCase: Validar escaneo de QR
 * 
 * Ejecuta el pipeline completo de validacion y retorna el resultado.
 * No tiene efectos secundarios (no marca como consumido, no avanza rounds).
 * 
 * Para completar la transaccion, el caller debe usar otro UseCase/Service
 * que consuma el QR y avance el estado del estudiante.
 */
export class ValidateScanUseCase {
  private readonly stages: Stage[];

  constructor(private readonly deps: ValidateScanDependencies) {
    // Delegar construccion del pipeline al factory
    this.stages = createDefaultPipeline(deps);
  }

  /**
   * Ejecuta la validacion
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
}

/**
 * Factory para crear el UseCase con dependencias por defecto
 */
export function createValidateScanUseCase(
  deps?: Partial<ValidateScanDependencies>
): ValidateScanUseCase {
  // Las dependencias reales se inyectan desde la capa de infraestructura
  // Aquí solo proveemos defaults para desarrollo/testing

  const aesGcmService = deps?.aesGcmService ?? new AesGcmService();

  // Los loaders y sessionKeyQuery deben ser provistos - no hay defaults seguros
  if (!deps?.qrStateLoader || !deps?.studentStateLoader || !deps?.sessionKeyQuery) {
    throw new Error(
      'ValidateScanUseCase requires qrStateLoader, studentStateLoader, and sessionKeyQuery. ' +
      'Use the adapters from infrastructure/adapters.'
    );
  }

  return new ValidateScanUseCase({
    aesGcmService,
    qrStateLoader: deps.qrStateLoader,
    studentStateLoader: deps.studentStateLoader,
    sessionKeyQuery: deps.sessionKeyQuery,
  });
}
