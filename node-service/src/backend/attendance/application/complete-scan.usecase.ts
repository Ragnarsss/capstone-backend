/**
 * CompleteScan UseCase
 * 
 * Orquesta el proceso completo de validación y registro de asistencia.
 * 
 * Flujo:
 * 1. Validar usando ValidateScanUseCase (pipeline)
 * 2. Si válido: marcar QR como consumido
 * 3. Registrar round completado
 * 4. Si no completó todos los rounds: generar siguiente QR
 * 5. Si completó: calcular estadísticas
 */

import { ValidateScanUseCase, type ValidateScanDependencies } from './validate-scan.usecase';
import { calculateStats } from '../domain/stats-calculator';
import type { QRPayloadV1 } from '../../qr-projection/domain/models';

/**
 * Dependencias adicionales para side effects
 */
export interface CompleteScanDependencies extends ValidateScanDependencies {
  /** Marca un QR como consumido */
  markQRConsumed: (nonce: string, studentId: number) => Promise<boolean>;
  /** Completa un round para el estudiante */
  completeRound: (sessionId: string, studentId: number, result: {
    responseTime: number;
    validatedAt: number;
    nonce: string;
  }) => Promise<{ currentRound: number; isComplete: boolean; roundsCompleted: Array<{ responseTime: number }> }>;
  /** Genera el siguiente QR */
  generateNextQR: (sessionId: string, studentId: number, round: number) => Promise<{
    encrypted: string;
    nonce: string;
  }>;
  /** Guarda el QR activo del estudiante */
  setActiveQR: (sessionId: string, studentId: number, nonce: string) => Promise<void>;
  /** Actualiza el QR en el pool de proyección */
  updatePoolQR: (sessionId: string, studentId: number, encrypted: string, round: number) => Promise<void>;
}

/**
 * Resultado del UseCase
 */
export interface CompleteScanResult {
  valid: boolean;
  
  // Si es válido y completó
  isComplete?: boolean;
  sessionId?: string;
  validatedAt?: number;
  
  // Stats si completó todos los rounds
  stats?: {
    roundsCompleted: number;
    avgResponseTime: number;
    certainty: number;
  };
  
  // Siguiente round si no completó
  nextRound?: {
    round: number;
    qrPayload: string;
    qrTTL: number;
  };
  
  // Error si no es válido
  error?: {
    code: string;
    message: string;
  };
  errorCode?: string;
  reason?: string;
  
  // Debug
  trace?: string;
}

/**
 * Configuración
 */
interface Config {
  qrTTL: number;
}

const DEFAULT_CONFIG: Config = {
  qrTTL: 30,
};

/**
 * UseCase: Completar escaneo de QR
 * 
 * Ejecuta validación + side effects (marcar consumido, avanzar estado)
 */
export class CompleteScanUseCase {
  private readonly validateUseCase: ValidateScanUseCase;
  private readonly config: Config;

  constructor(
    private readonly deps: CompleteScanDependencies,
    config?: Partial<Config>
  ) {
    this.validateUseCase = new ValidateScanUseCase(deps);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Ejecuta el proceso completo
   */
  async execute(encrypted: string, studentId: number): Promise<CompleteScanResult> {
    const validatedAt = Date.now();

    // 1. Validar usando el pipeline
    const validationResult = await this.validateUseCase.execute(encrypted, studentId);

    if (!validationResult.valid || !validationResult.context?.response) {
      return {
        valid: false,
        error: validationResult.error,
        errorCode: validationResult.error?.code,
        reason: validationResult.error?.message,
        trace: validationResult.trace,
      };
    }

    const payload = validationResult.context.response.original;
    const sessionId = payload.sid;

    // 2. Marcar QR como consumido
    const consumed = await this.deps.markQRConsumed(payload.n, studentId);
    
    if (!consumed) {
      return {
        valid: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'No se pudo registrar el escaneo',
        },
        errorCode: 'INTERNAL_ERROR',
        reason: 'No se pudo registrar el escaneo',
      };
    }

    // 3. Calcular Response Time y completar round
    const responseTime = validatedAt - payload.ts;
    
    const roundResult = await this.deps.completeRound(sessionId, studentId, {
      responseTime,
      validatedAt,
      nonce: payload.n,
    });

    console.log(`[CompleteScan] Payload válido: student=${studentId}, session=${sessionId}, round=${payload.r}, RT=${responseTime}ms`);

    // 4. Si completó todos los rounds
    if (roundResult.isComplete) {
      const responseTimes = roundResult.roundsCompleted.map(r => r.responseTime);
      const stats = calculateStats(responseTimes);
      
      console.log(`[CompleteScan] Asistencia completada para student=${studentId}, session=${sessionId}`);

      return {
        valid: true,
        isComplete: true,
        sessionId,
        validatedAt,
        stats: {
          roundsCompleted: roundResult.roundsCompleted.length,
          avgResponseTime: stats.avg,
          certainty: stats.certainty,
        },
      };
    }

    // 5. Generar siguiente QR
    const nextQR = await this.deps.generateNextQR(sessionId, studentId, roundResult.currentRound);
    
    // Guardar como QR activo
    await this.deps.setActiveQR(sessionId, studentId, nextQR.nonce);
    
    // Actualizar en pool de proyección
    await this.deps.updatePoolQR(sessionId, studentId, nextQR.encrypted, roundResult.currentRound);

    return {
      valid: true,
      isComplete: false,
      sessionId,
      validatedAt,
      nextRound: {
        round: roundResult.currentRound,
        qrPayload: nextQR.encrypted,
        qrTTL: this.config.qrTTL,
      },
    };
  }
}
