import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';
import {
  DEFAULT_MAX_ROUNDS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_QR_TTL_SECONDS,
} from '../../../shared/config';
import {
  StudentSession,
  type StudentSessionData,
  type RoundResult,
} from '../domain/student-session.entity';
import { logger } from '../../../shared/infrastructure/logger';

// Re-export types for backward compatibility
export type { RoundResult, StudentSessionData };

/**
 * Configuración de sesión
 */
export interface SessionConfig {
  maxRounds: number;
  maxAttempts: number;
  qrTTL: number;
}

/** Configuracion por defecto - usa constantes centralizadas */
const DEFAULT_CONFIG: SessionConfig = {
  maxRounds: DEFAULT_MAX_ROUNDS,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  qrTTL: DEFAULT_QR_TTL_SECONDS,
};

/**
 * Repository para estado de estudiantes en sesiones
 * 
 * Responsabilidad: Gestionar el estado de rounds e intentos por estudiante
 * 
 * Claves en Valkey:
 * - student:session:{sessionId}:{studentId} → StudentSessionData
 * - session:{sessionId}:config → SessionConfig
 * - session:{sessionId}:students → SET de studentIds participando
 * 
 * TTL Strategy:
 * - El TTL se RENUEVA en cada operación (registro, setActiveQR, completeRound)
 * - Esto asegura que el estado no expire durante una sesión activa
 * - Cada round tiene su propio "tiempo de vida" desde que se genera el QR
 */
export class StudentSessionRepository {
  private client = ValkeyClient.getInstance().getClient();
  
  /** TTL para estado de estudiante (2 horas) - se renueva en cada operación */
  private readonly stateTTL = 7200;
  
  /** Prefijos de claves */
  private static readonly STUDENT_PREFIX = 'student:session:';
  private static readonly SESSION_CONFIG_PREFIX = 'session:config:';
  private static readonly SESSION_STUDENTS_PREFIX = 'session:students:';

  /**
   * Registra un estudiante en una sesión
   * Crea el estado inicial si no existe
   * 
   * @returns Estado del estudiante (nuevo o existente)
   */
  async registerStudent(
    sessionId: string,
    studentId: number,
    config?: Partial<SessionConfig>
  ): Promise<StudentSessionData> {
    // Verificar si ya existe
    const existing = await this.getState(sessionId, studentId);
    if (existing) {
      return existing;
    }

    // Obtener o crear config de sesión
    const sessionConfig = await this.getOrCreateSessionConfig(sessionId, config);

    // Crear estado inicial
    const now = Date.now();
    const state: StudentSessionData = {
      studentId,
      sessionId,
      currentRound: 1,
      maxRounds: sessionConfig.maxRounds,
      roundsCompleted: [],
      currentAttempt: 1,
      maxAttempts: sessionConfig.maxAttempts,
      activeQRNonce: null,
      qrGeneratedAt: null,
      status: 'active',
      registeredAt: now,
      updatedAt: now,
    };

    await this.saveState(state);
    await this.addStudentToSession(sessionId, studentId);

    logger.debug(`[StudentSession] Registered student=${studentId} in session=${sessionId.substring(0, 8)}...`);
    return state;
  }

  /**
   * Obtiene el estado de un estudiante en una sesión
   */
  async getState(sessionId: string, studentId: number): Promise<StudentSessionData | null> {
    const key = this.buildStudentKey(sessionId, studentId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as StudentSessionData;
    } catch (error) {
      logger.error('[StudentSession] Error parsing state:', error);
      return null;
    }
  }

  /**
   * Guarda el estado de un estudiante
   */
  async saveState(state: StudentSessionData): Promise<void> {
    const key = this.buildStudentKey(state.sessionId, state.studentId);
    state.updatedAt = Date.now();
    
    await this.client.setex(key, this.stateTTL, JSON.stringify(state));
  }

  /**
   * Actualiza el QR activo para un estudiante
   * IMPORTANTE: Renueva el TTL del estado al generar nuevo QR
   */
  async setActiveQR(
    sessionId: string,
    studentId: number,
    nonce: string
  ): Promise<StudentSessionData | null> {
    const state = await this.getState(sessionId, studentId);
    if (!state) {
      return null;
    }

    state.activeQRNonce = nonce;
    state.qrGeneratedAt = Date.now();
    
    // saveState ya renueva el TTL automáticamente
    await this.saveState(state);
    logger.debug(`[StudentSession] QR activo renovado para student=${studentId}, TTL reset a ${this.stateTTL}s`);
    return state;
  }

  /**
   * Registra un round completado exitosamente
   * Avanza al siguiente round o marca como completado
   * IMPORTANTE: Renueva el TTL del estado
   * 
   * Delega logica de negocio a StudentSession entity
   */
  async completeRound(
    sessionId: string,
    studentId: number,
    result: Omit<RoundResult, 'round'>
  ): Promise<{ state: StudentSessionData; isComplete: boolean }> {
    const stateData = await this.getState(sessionId, studentId);
    if (!stateData) {
      const key = this.buildStudentKey(sessionId, studentId);
      const ttl = await this.client.ttl(key);
      logger.error(`[StudentSession] State not found: student=${studentId}, session=${sessionId.substring(0, 20)}..., key TTL=${ttl}`);
      throw new Error(`No state found for student=${studentId} session=${sessionId} (TTL was ${ttl})`);
    }

    // Usar entidad de dominio para logica de negocio
    const session = StudentSession.fromData(stateData);
    const { session: newSession, isComplete } = session.completeRound(result);

    if (isComplete) {
      logger.debug(`[StudentSession] Student=${studentId} completed all ${newSession.maxRounds} rounds`);
    } else {
      logger.debug(`[StudentSession] Student=${studentId} advanced to round ${newSession.currentRound}`);
    }

    // Persistir nuevo estado
    const newState = newSession.toData();
    await this.saveState(newState);
    return { state: newState, isComplete };
  }

  /**
   * Registra un fallo en el round actual
   * Consume un intento o marca como fallido si no quedan intentos
   * 
   * Delega logica de negocio a StudentSession entity
   */
  async failRound(
    sessionId: string,
    studentId: number,
    reason: string
  ): Promise<{ state: StudentSessionData; canRetry: boolean }> {
    const stateData = await this.getState(sessionId, studentId);
    if (!stateData) {
      throw new Error(`No state found for student=${studentId} session=${sessionId}`);
    }

    // Usar entidad de dominio para logica de negocio
    const session = StudentSession.fromData(stateData);
    const { session: newSession, canRetry } = session.failRound();

    if (canRetry) {
      logger.debug(`[StudentSession] Student=${studentId} failed (${reason}), attempt ${newSession.currentAttempt}/${newSession.maxAttempts}`);
    } else {
      logger.debug(`[StudentSession] Student=${studentId} failed permanently, no attempts left`);
    }

    // Persistir nuevo estado
    const newState = newSession.toData();
    await this.saveState(newState);
    return { state: newState, canRetry };
  }

  /**
   * Verifica si un QR corresponde al round actual del estudiante
   */
  async validateRoundMatch(
    sessionId: string,
    studentId: number,
    payloadRound: number,
    payloadNonce: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const state = await this.getState(sessionId, studentId);
    
    if (!state) {
      return { valid: false, reason: 'STUDENT_NOT_REGISTERED' };
    }

    if (state.status !== 'active') {
      return { valid: false, reason: `STUDENT_STATUS_${state.status.toUpperCase()}` };
    }

    if (state.activeQRNonce !== payloadNonce) {
      return { valid: false, reason: 'QR_NONCE_MISMATCH' };
    }

    if (state.currentRound !== payloadRound) {
      if (payloadRound < state.currentRound) {
        return { valid: false, reason: 'ROUND_ALREADY_COMPLETED' };
      }
      return { valid: false, reason: 'ROUND_NOT_REACHED' };
    }

    return { valid: true };
  }

  /**
   * Obtiene la lista de estudiantes activos en una sesión
   */
  async getActiveStudents(sessionId: string): Promise<number[]> {
    const key = this.buildSessionStudentsKey(sessionId);
    const members = await this.client.smembers(key);
    return members.map(Number);
  }

  /**
   * Cuenta estudiantes por estado en una sesión
   */
  async countByStatus(sessionId: string): Promise<Record<string, number>> {
    const studentIds = await this.getActiveStudents(sessionId);
    const counts: Record<string, number> = {
      active: 0,
      completed: 0,
      failed: 0,
    };

    for (const studentId of studentIds) {
      const state = await this.getState(sessionId, studentId);
      if (state) {
        counts[state.status]++;
      }
    }

    return counts;
  }

  /**
   * Obtiene o crea la configuración de una sesión
   */
  async getOrCreateSessionConfig(
    sessionId: string,
    config?: Partial<SessionConfig>
  ): Promise<SessionConfig> {
    const key = this.buildSessionConfigKey(sessionId);
    const existing = await this.client.get(key);

    if (existing) {
      return JSON.parse(existing) as SessionConfig;
    }

    const newConfig: SessionConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    await this.client.setex(key, this.stateTTL, JSON.stringify(newConfig));
    return newConfig;
  }

  /**
   * Agrega un estudiante al set de la sesión
   */
  private async addStudentToSession(sessionId: string, studentId: number): Promise<void> {
    const key = this.buildSessionStudentsKey(sessionId);
    await this.client.sadd(key, String(studentId));
    await this.client.expire(key, this.stateTTL);
  }

  private buildStudentKey(sessionId: string, studentId: number): string {
    return `${StudentSessionRepository.STUDENT_PREFIX}${sessionId}:${studentId}`;
  }

  private buildSessionConfigKey(sessionId: string): string {
    return `${StudentSessionRepository.SESSION_CONFIG_PREFIX}${sessionId}`;
  }

  private buildSessionStudentsKey(sessionId: string): string {
    return `${StudentSessionRepository.SESSION_STUDENTS_PREFIX}${sessionId}`;
  }
}
