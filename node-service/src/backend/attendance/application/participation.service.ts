import type { RegisterParticipationResult, GetStatusResult } from '../domain/models';
import { StudentSessionRepository } from '../infrastructure/student-session.repository';
import { ProjectionPoolRepository } from '../../../shared/infrastructure/valkey';
import type { IQRGenerator, IPoolBalancer, IQRPayloadRepository } from '../../../shared/ports';
import {
  DEFAULT_MAX_ROUNDS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_QR_TTL_SECONDS,
  DEFAULT_MIN_POOL_SIZE,
} from '../../../shared/config';
import { logger } from '../../../shared/infrastructure/logger';

/**
 * Configuración del servicio
 */
interface ParticipationServiceConfig {
  maxRounds: number;
  maxAttempts: number;
  qrTTL: number;
  /** ID del host (mock por ahora) */
  mockHostUserId: number;
  /** Habilitar balanceo automatico de QRs falsos */
  enableFakeQRBalancing: boolean;
  /** Tamano minimo del pool (para PoolBalancer) */
  minPoolSize: number;
}

const DEFAULT_CONFIG: ParticipationServiceConfig = {
  maxRounds: DEFAULT_MAX_ROUNDS,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  qrTTL: DEFAULT_QR_TTL_SECONDS,
  mockHostUserId: 1,
  enableFakeQRBalancing: true,
  minPoolSize: DEFAULT_MIN_POOL_SIZE,
};

/**
 * Application Service para gestión de participación en sesiones
 * 
 * Responsabilidad: Orquestar el registro de estudiantes y generación de QRs
 * 
 * Flujo:
 * 1. Estudiante solicita participar (POST /participation/register)
 * 2. Se crea/recupera estado del estudiante
 * 3. Se genera QR para el round actual
 * 4. Se agrega QR al pool de proyección
 * 5. Se retorna el estado al estudiante
 */
export class ParticipationService {
  private readonly studentRepo: StudentSessionRepository;
  private readonly poolRepo: ProjectionPoolRepository;
  private readonly payloadRepo: IQRPayloadRepository;
  private readonly qrGenerator: IQRGenerator;
  private readonly poolBalancer: IPoolBalancer | null;
  private readonly config: ParticipationServiceConfig;

  constructor(
    qrGenerator: IQRGenerator,
    payloadRepo: IQRPayloadRepository,
    poolBalancer: IPoolBalancer | null,
    studentRepo?: StudentSessionRepository,
    poolRepo?: ProjectionPoolRepository,
    config?: Partial<ParticipationServiceConfig>
  ) {
    this.qrGenerator = qrGenerator;
    this.payloadRepo = payloadRepo;
    this.poolBalancer = poolBalancer;
    this.studentRepo = studentRepo ?? new StudentSessionRepository();
    this.poolRepo = poolRepo ?? new ProjectionPoolRepository();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Balancea el pool de QRs falsos para una sesion
   * Llamado automaticamente despues de registrar un estudiante
   */
  private async balanceFakeQRs(sessionId: string): Promise<void> {
    if (!this.poolBalancer) return;
    
    try {
      await this.poolBalancer.balance(sessionId);
    } catch (error) {
      // No fallar el registro si el balanceo falla
      logger.error('[Participation] Error balancing fake QRs:', error);
    }
  }

  /**
   * Registra la participación de un estudiante en una sesión
   * Genera el QR para su round actual
   */
  async registerParticipation(
    sessionId: string,
    studentId: number
  ): Promise<RegisterParticipationResult> {
    try {
      // 1. Obtener o crear estado del estudiante
      const state = await this.studentRepo.registerStudent(sessionId, studentId, {
        maxRounds: this.config.maxRounds,
        maxAttempts: this.config.maxAttempts,
        qrTTL: this.config.qrTTL,
      });

      // 2. Verificar si ya completó o falló
      if (state.status === 'completed') {
        return {
          success: false,
          reason: 'Ya completaste la asistencia para esta sesión',
          errorCode: 'ALREADY_COMPLETED',
        };
      }

      if (state.status === 'failed') {
        return {
          success: false,
          reason: 'Sin intentos restantes para esta sesión',
          errorCode: 'NO_ATTEMPTS_LEFT',
        };
      }

      // 3. Generar QR para el round actual
      const { payload, encrypted } = this.qrGenerator.generateForStudent({
        sessionId,
        userId: studentId,
        round: state.currentRound,
        hostUserId: this.config.mockHostUserId,
      });

      // 4. Almacenar payload para validación posterior
      await this.payloadRepo.store(payload, encrypted, this.config.qrTTL);

      // 5. Actualizar estado con QR activo
      await this.studentRepo.setActiveQR(sessionId, studentId, payload.n);

      // 6. Agregar QR al pool de proyección
      await this.poolRepo.upsertStudentQR(sessionId, studentId, encrypted, state.currentRound);

      // 7. Balancear QRs falsos en el pool
      await this.balanceFakeQRs(sessionId);

      logger.debug(`[Participation] Registered student=${studentId} session=${sessionId.substring(0, 8)}... round=${state.currentRound}`);

      return {
        success: true,
        data: {
          currentRound: state.currentRound,
          totalRounds: state.maxRounds,
          currentAttempt: state.currentAttempt,
          maxAttempts: state.maxAttempts,
          qrPayload: encrypted,
          qrTTL: this.config.qrTTL,
        },
      };
    } catch (error) {
      logger.error('[Participation] Error registering:', error);
      return {
        success: false,
        reason: 'Error interno al registrar participación',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Solicita un nuevo QR para el estudiante
   * Usado cuando el QR anterior expiró
   */
  async requestNewQR(
    sessionId: string,
    studentId: number
  ): Promise<RegisterParticipationResult> {
    try {
      const state = await this.studentRepo.getState(sessionId, studentId);

      if (!state) {
        return {
          success: false,
          reason: 'No estás registrado en esta sesión',
          errorCode: 'NOT_REGISTERED',
        };
      }

      if (state.status !== 'active') {
        return {
          success: false,
          reason: state.status === 'completed' 
            ? 'Ya completaste la asistencia' 
            : 'Sin intentos restantes',
          errorCode: state.status === 'completed' ? 'ALREADY_COMPLETED' : 'NO_ATTEMPTS_LEFT',
        };
      }

      // Verificar si el QR anterior sigue válido
      if (state.activeQRNonce) {
        const existing = await this.payloadRepo.findByNonce(state.activeQRNonce);
        if (existing && !existing.consumed) {
          // QR aún válido, retornarlo
          return {
            success: true,
            data: {
              currentRound: state.currentRound,
              totalRounds: state.maxRounds,
              currentAttempt: state.currentAttempt,
              maxAttempts: state.maxAttempts,
              qrPayload: existing.encrypted,
              qrTTL: this.config.qrTTL, // Aproximado, el real depende del TTL restante
            },
          };
        }
      }

      // QR expiró o no existe - esto cuenta como fallo del round
      const { state: newState, canRetry } = await this.studentRepo.failRound(
        sessionId,
        studentId,
        'QR_EXPIRED'
      );

      if (!canRetry) {
        return {
          success: false,
          reason: 'Sin intentos restantes',
          errorCode: 'NO_ATTEMPTS_LEFT',
        };
      }

      // Generar nuevo QR para round 1 del nuevo intento
      const { payload, encrypted } = this.qrGenerator.generateForStudent({
        sessionId,
        userId: studentId,
        round: newState.currentRound,
        hostUserId: this.config.mockHostUserId,
      });

      await this.payloadRepo.store(payload, encrypted, this.config.qrTTL);
      await this.studentRepo.setActiveQR(sessionId, studentId, payload.n);
      
      // Actualizar QR en el pool de proyección
      await this.poolRepo.upsertStudentQR(sessionId, studentId, encrypted, newState.currentRound);

      return {
        success: true,
        data: {
          currentRound: newState.currentRound,
          totalRounds: newState.maxRounds,
          currentAttempt: newState.currentAttempt,
          maxAttempts: newState.maxAttempts,
        qrPayload: encrypted,
        qrTTL: this.config.qrTTL,
      },
    };
  } catch (error) {
    logger.error('[Participation] Error requesting new QR:', error);
    return {
      success: false,
      reason: 'Error interno al solicitar nuevo QR',
      errorCode: 'INTERNAL_ERROR',
    };
  }
}  /**
   * Consulta el estado actual del estudiante en la sesión
   */
  async getStatus(sessionId: string, studentId: number): Promise<GetStatusResult> {
    const state = await this.studentRepo.getState(sessionId, studentId);

    if (!state) {
      return { registered: false };
    }

    let qrPayload: string | undefined;
    let qrTTLRemaining: number | undefined;

    if (state.activeQRNonce) {
      const stored = await this.payloadRepo.findByNonce(state.activeQRNonce);
      if (stored && !stored.consumed) {
        qrPayload = stored.encrypted;
        // Calcular TTL restante aproximado
        const elapsed = Date.now() - stored.createdAt;
        qrTTLRemaining = Math.max(0, this.config.qrTTL - Math.floor(elapsed / 1000));
      }
    }

    return {
      registered: true,
      status: state.status,
      currentRound: state.currentRound,
      totalRounds: state.maxRounds,
      currentAttempt: state.currentAttempt,
      maxAttempts: state.maxAttempts,
      roundsCompleted: state.roundsCompleted.length,
      hasActiveQR: !!qrPayload,
      qrPayload,
      qrTTLRemaining,
    };
  }
}
