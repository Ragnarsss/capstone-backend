/**
 * CompleteScan UseCase
 * 
 * Orquesta el proceso completo de validación y registro de asistencia.
 * 
 * Flujo:
 * 1. Validar usando ValidateScanUseCase (pipeline)
 * 2. Si inválido: registrar intento en métricas de fraude
 * 3. Si válido: marcar QR como consumido
 * 4. Registrar round completado
 * 5. Si no completó todos los rounds: generar siguiente QR
 * 6. Si completó: calcular estadísticas
 * 7. Persistir en PostgreSQL (si repositorios están configurados)
 */

import { ValidateScanUseCase, type ValidateScanDependencies } from './validate-scan.usecase';
import { calculateStats } from '../domain/stats-calculator';
import type { QRPayloadV1 } from '../../../shared/types';
import type { ValidationRepository, ResultRepository, RegistrationRepository } from '../infrastructure/repositories';
import { FraudMetricsRepository, type FraudType } from '../infrastructure/fraud-metrics.repository';
import { DEFAULT_QR_TTL_SECONDS, DEFAULT_MAX_ROUNDS } from '../../../shared/config';
import { logger } from '../../../shared/infrastructure/logger';

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
 * Dependencias opcionales para persistencia PostgreSQL
 */
export interface PersistenceDependencies {
  validationRepo?: ValidationRepository;
  resultRepo?: ResultRepository;
  registrationRepo?: RegistrationRepository;
}

/**
 * Dependencias opcionales para métricas de fraude
 */
export interface FraudMetricsDependencies {
  fraudMetricsRepo?: FraudMetricsRepository;
  /** ID de sesión para métricas (extraído del contexto o request) */
  sessionIdForMetrics?: string;
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
  maxRounds: number;
}

const DEFAULT_CONFIG: Config = {
  qrTTL: DEFAULT_QR_TTL_SECONDS,
  maxRounds: DEFAULT_MAX_ROUNDS,
};

/**
 * UseCase: Completar escaneo de QR
 * 
 * Ejecuta validación + side effects (marcar consumido, avanzar estado)
 * Opcionalmente persiste en PostgreSQL si se proveen repositorios
 * Opcionalmente registra métricas de fraude si se provee repositorio
 */
export class CompleteScanUseCase {
  private readonly validateUseCase: ValidateScanUseCase;
  private readonly config: Config;
  private readonly persistence: PersistenceDependencies;
  private readonly fraudMetrics: FraudMetricsDependencies;

  constructor(
    private readonly deps: CompleteScanDependencies,
    config?: Partial<Config>,
    persistence?: PersistenceDependencies,
    fraudMetrics?: FraudMetricsDependencies
  ) {
    this.validateUseCase = new ValidateScanUseCase(deps);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.persistence = persistence ?? {};
    this.fraudMetrics = fraudMetrics ?? {};
  }

  /**
   * Ejecuta el proceso completo
   */
  async execute(encrypted: string, studentId: number, sessionIdHint?: string): Promise<CompleteScanResult> {
    const validatedAt = Date.now();

    // 1. Validar usando el pipeline
    const validationResult = await this.validateUseCase.execute(encrypted, studentId);

    if (!validationResult.valid || !validationResult.context?.response) {
      // 2. Registrar intento fallido en métricas de fraude
      await this.recordFraudAttempt(
        sessionIdHint,
        validationResult.error?.code,
        studentId,
        encrypted
      );

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
    let consumed: boolean;
    try {
      consumed = await this.deps.markQRConsumed(payload.n, studentId);
    } catch (error) {
      logger.error('[CompleteScan] Error marcando QR como consumido:', error);
      return {
        valid: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno al procesar el escaneo',
        },
        errorCode: 'INTERNAL_ERROR',
        reason: 'Error interno al procesar el escaneo',
      };
    }
    
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
    
    let roundResult;
    try {
      roundResult = await this.deps.completeRound(sessionId, studentId, {
        responseTime,
        validatedAt,
        nonce: payload.n,
      });
    } catch (error) {
      logger.error('[CompleteScan] Error completando round:', error);
      return {
        valid: false,
        error: {
          code: 'SESSION_STATE_ERROR',
          message: 'Estado de sesión no encontrado. Por favor, vuelve a registrarte.',
        },
        errorCode: 'SESSION_STATE_ERROR',
        reason: 'Estado de sesión no encontrado',
      };
    }

    logger.debug(`[CompleteScan] Payload válido: student=${studentId}, session=${sessionId}, round=${payload.r}, RT=${responseTime}ms`);

    // 4. Si completó todos los rounds
    if (roundResult.isComplete) {
      const responseTimes = roundResult.roundsCompleted.map(r => r.responseTime);
      const stats = calculateStats(responseTimes);
      
      logger.debug(`[CompleteScan] Asistencia completada para student=${studentId}, session=${sessionId}`);

      // Persistir resultado en PostgreSQL si hay repositorios
      await this.persistResult(sessionId, studentId, payload.r, responseTime, stats, validatedAt);

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

    // Persistir validación parcial en PostgreSQL
    await this.persistValidation(sessionId, studentId, payload.r, responseTime, validatedAt);

    // 5. Generar siguiente QR
    try {
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
    } catch (error) {
      logger.error('[CompleteScan] Error generando siguiente QR:', error);
      // Round fue completado pero no pudimos generar el siguiente QR
      // Aún así retornamos éxito parcial para que el cliente sepa que avanzó
      return {
        valid: true,
        isComplete: false,
        sessionId,
        validatedAt,
        error: {
          code: 'QR_GENERATION_ERROR',
          message: 'Round completado pero hubo error generando siguiente QR. Intenta refrescar.',
        },
      };
    }
  }

  /**
   * Persiste una validación exitosa en PostgreSQL
   * Solo si registrationRepo y validationRepo están configurados
   */
  private async persistValidation(
    sessionId: string,
    studentId: number,
    roundNumber: number,
    responseTimeMs: number,
    validatedAt: number
  ): Promise<void> {
    const { validationRepo, registrationRepo } = this.persistence;
    
    if (!validationRepo || !registrationRepo) {
      return;
    }

    try {
      // Obtener registrationId desde sessionId y studentId
      const sessionIdNum = parseInt(sessionId, 10);
      if (isNaN(sessionIdNum)) {
        logger.warn(`[CompleteScan] sessionId no es numérico: ${sessionId}, omitiendo persistencia`);
        return;
      }

      const registration = await registrationRepo.getBySessionAndUser(sessionIdNum, studentId);
      
      if (!registration) {
        logger.warn(`[CompleteScan] No se encontró registro para session=${sessionId}, student=${studentId}`);
        return;
      }

      // Verificar si ya existe validación para este round
      const existing = await validationRepo.getByRound(registration.registrationId, roundNumber);
      
      if (existing) {
        // Completar validación existente
        await validationRepo.complete(registration.registrationId, roundNumber, {
          responseReceivedAt: new Date(validatedAt),
          responseTimeMs,
          validationStatus: 'success',
        });
      } else {
        // Crear nueva validación
        const validation = await validationRepo.create({
          registrationId: registration.registrationId,
          roundNumber,
          qrGeneratedAt: new Date(validatedAt - responseTimeMs),
        });
        
        await validationRepo.complete(registration.registrationId, roundNumber, {
          responseReceivedAt: new Date(validatedAt),
          responseTimeMs,
          validationStatus: 'success',
        });
      }

      logger.debug(`[CompleteScan] Validación persistida: registration=${registration.registrationId}, round=${roundNumber}`);
    } catch (error) {
      logger.error('[CompleteScan] Error persistiendo validación:', error);
      // No lanzamos error, la persistencia es opcional
    }
  }

  /**
   * Persiste el resultado final en PostgreSQL
   * Solo si todos los repositorios están configurados
   */
  private async persistResult(
    sessionId: string,
    studentId: number,
    roundNumber: number,
    responseTimeMs: number,
    stats: { avg: number; stdDev: number; min: number; max: number; certainty: number },
    validatedAt: number
  ): Promise<void> {
    const { validationRepo, resultRepo, registrationRepo } = this.persistence;
    
    if (!validationRepo || !resultRepo || !registrationRepo) {
      return;
    }

    try {
      const sessionIdNum = parseInt(sessionId, 10);
      if (isNaN(sessionIdNum)) {
        logger.warn(`[CompleteScan] sessionId no es numérico: ${sessionId}, omitiendo persistencia`);
        return;
      }

      const registration = await registrationRepo.getBySessionAndUser(sessionIdNum, studentId);
      
      if (!registration) {
        logger.warn(`[CompleteScan] No se encontró registro para session=${sessionId}, student=${studentId}`);
        return;
      }

      // Persistir última validación
      await this.persistValidation(sessionId, studentId, roundNumber, responseTimeMs, validatedAt);

      // Verificar si ya existe resultado
      const existingResult = await resultRepo.getByRegistration(registration.registrationId);
      if (existingResult) {
        logger.debug(`[CompleteScan] Resultado ya existe para registration=${registration.registrationId}`);
        return;
      }

      // Obtener estadísticas de response time desde la BD
      const rtStats = await validationRepo.getResponseTimeStats(registration.registrationId);
      const successCount = await validationRepo.countSuccessful(registration.registrationId);

      // Determinar estado final
      const finalStatus = stats.certainty >= 70 ? 'PRESENT' : stats.certainty >= 40 ? 'DOUBTFUL' : 'ABSENT';

      // Crear resultado
      await resultRepo.create({
        registrationId: registration.registrationId,
        totalRounds: this.config.maxRounds,
        successfulRounds: successCount,
        failedRounds: this.config.maxRounds - successCount,
        avgResponseTimeMs: rtStats.avg ?? stats.avg,
        stdDevResponseTime: rtStats.stdDev ?? stats.stdDev,
        minResponseTimeMs: rtStats.min ?? stats.min,
        maxResponseTimeMs: rtStats.max ?? stats.max,
        medianResponseTimeMs: rtStats.median ?? undefined,
        certaintyScore: stats.certainty,
        finalStatus,
      });

      // Actualizar estado del registro a completado
      await registrationRepo.updateStatus(registration.registrationId, { status: 'completed' });

      logger.debug(`[CompleteScan] Resultado persistido: registration=${registration.registrationId}, status=${finalStatus}, certainty=${stats.certainty}`);
    } catch (error) {
      logger.error('[CompleteScan] Error persistiendo resultado:', error);
      // No lanzamos error, la persistencia es opcional
    }
  }

  /**
   * Mapea códigos de error del pipeline a tipos de fraude
   */
  private mapErrorToFraudType(errorCode?: string): FraudType | null {
    if (!errorCode) return null;

    const mapping: Record<string, FraudType> = {
      'DECRYPTION_FAILED': 'DECRYPT_FAILED',
      'INVALID_FORMAT': 'INVALID_FORMAT',
      'QR_NOT_FOUND': 'QR_NOT_FOUND',
      'PAYLOAD_EXPIRED': 'QR_EXPIRED',
      'PAYLOAD_ALREADY_CONSUMED': 'QR_ALREADY_USED',
      'USER_MISMATCH': 'WRONG_OWNER',
      'ROUND_MISMATCH': 'ROUND_MISMATCH',
    };

    return mapping[errorCode] || null;
  }

  /**
   * Registra un intento fallido en métricas de fraude
   * Solo si fraudMetricsRepo está configurado
   */
  private async recordFraudAttempt(
    sessionId: string | undefined,
    errorCode: string | undefined,
    studentId: number,
    encrypted: string
  ): Promise<void> {
    const { fraudMetricsRepo } = this.fraudMetrics;
    
    if (!fraudMetricsRepo) return;

    const fraudType = this.mapErrorToFraudType(errorCode);
    if (!fraudType) return;

    // Usar sessionId del hint o de las métricas
    const sid = sessionId || this.fraudMetrics.sessionIdForMetrics;
    if (!sid) {
      logger.warn('[CompleteScan] No se puede registrar fraude sin sessionId');
      return;
    }

    try {
      await fraudMetricsRepo.recordAttempt(sid, fraudType, studentId, encrypted);
    } catch (error) {
      logger.error('[CompleteScan] Error registrando intento de fraude:', error);
      // No lanzamos error, las métricas son opcionales
    }
  }
}
