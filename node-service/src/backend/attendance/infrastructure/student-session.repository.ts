import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';

/**
 * Resultado de un round completado
 */
export interface RoundResult {
  /** Número de round */
  round: number;
  /** Response Time en milisegundos */
  responseTime: number;
  /** Timestamp de validación */
  validatedAt: number;
  /** Nonce del QR usado */
  nonce: string;
}

/**
 * Estado de un estudiante en una sesión de asistencia
 */
export interface StudentSessionState {
  /** ID del estudiante */
  studentId: number;
  /** ID de la sesión */
  sessionId: string;
  
  /** Round actual (1-based) */
  currentRound: number;
  /** Número máximo de rounds a completar */
  maxRounds: number;
  /** Rounds completados exitosamente */
  roundsCompleted: RoundResult[];
  
  /** Intento actual (1-based) */
  currentAttempt: number;
  /** Número máximo de intentos */
  maxAttempts: number;
  
  /** Nonce del QR activo (null si no hay QR pendiente) */
  activeQRNonce: string | null;
  /** Timestamp de generación del QR activo */
  qrGeneratedAt: number | null;
  
  /** Estado general */
  status: 'active' | 'completed' | 'failed';
  
  /** Timestamp de registro inicial */
  registeredAt: number;
  /** Timestamp de última actualización */
  updatedAt: number;
}

/**
 * Configuración de sesión
 */
export interface SessionConfig {
  maxRounds: number;
  maxAttempts: number;
  qrTTL: number;
}

/** Configuración por defecto */
const DEFAULT_CONFIG: SessionConfig = {
  maxRounds: 3,
  maxAttempts: 3,
  qrTTL: 30,
};

/**
 * Repository para estado de estudiantes en sesiones
 * 
 * Responsabilidad: Gestionar el estado de rounds e intentos por estudiante
 * 
 * Claves en Valkey:
 * - student:session:{sessionId}:{studentId} → StudentSessionState
 * - session:{sessionId}:config → SessionConfig
 * - session:{sessionId}:students → SET de studentIds participando
 */
export class StudentSessionRepository {
  private client = ValkeyClient.getInstance().getClient();
  
  /** TTL para estado de estudiante (2 horas) */
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
  ): Promise<StudentSessionState> {
    // Verificar si ya existe
    const existing = await this.getState(sessionId, studentId);
    if (existing) {
      return existing;
    }

    // Obtener o crear config de sesión
    const sessionConfig = await this.getOrCreateSessionConfig(sessionId, config);

    // Crear estado inicial
    const now = Date.now();
    const state: StudentSessionState = {
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

    console.log(`[StudentSession] Registered student=${studentId} in session=${sessionId.substring(0, 8)}...`);
    return state;
  }

  /**
   * Obtiene el estado de un estudiante en una sesión
   */
  async getState(sessionId: string, studentId: number): Promise<StudentSessionState | null> {
    const key = this.buildStudentKey(sessionId, studentId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as StudentSessionState;
    } catch (error) {
      console.error('[StudentSession] Error parsing state:', error);
      return null;
    }
  }

  /**
   * Guarda el estado de un estudiante
   */
  async saveState(state: StudentSessionState): Promise<void> {
    const key = this.buildStudentKey(state.sessionId, state.studentId);
    state.updatedAt = Date.now();
    
    await this.client.setex(key, this.stateTTL, JSON.stringify(state));
  }

  /**
   * Actualiza el QR activo para un estudiante
   */
  async setActiveQR(
    sessionId: string,
    studentId: number,
    nonce: string
  ): Promise<StudentSessionState | null> {
    const state = await this.getState(sessionId, studentId);
    if (!state) {
      return null;
    }

    state.activeQRNonce = nonce;
    state.qrGeneratedAt = Date.now();
    
    await this.saveState(state);
    return state;
  }

  /**
   * Registra un round completado exitosamente
   * Avanza al siguiente round o marca como completado
   */
  async completeRound(
    sessionId: string,
    studentId: number,
    result: Omit<RoundResult, 'round'>
  ): Promise<{ state: StudentSessionState; isComplete: boolean }> {
    const state = await this.getState(sessionId, studentId);
    if (!state) {
      throw new Error(`No state found for student=${studentId} session=${sessionId}`);
    }

    // Registrar round completado
    const roundResult: RoundResult = {
      round: state.currentRound,
      ...result,
    };
    state.roundsCompleted.push(roundResult);

    // Limpiar QR activo
    state.activeQRNonce = null;
    state.qrGeneratedAt = null;

    // Verificar si completó todos los rounds
    const isComplete = state.currentRound >= state.maxRounds;

    if (isComplete) {
      state.status = 'completed';
      console.log(`[StudentSession] Student=${studentId} completed all ${state.maxRounds} rounds`);
    } else {
      state.currentRound++;
      console.log(`[StudentSession] Student=${studentId} advanced to round ${state.currentRound}`);
    }

    await this.saveState(state);
    return { state, isComplete };
  }

  /**
   * Registra un fallo en el round actual
   * Consume un intento o marca como fallido si no quedan intentos
   */
  async failRound(
    sessionId: string,
    studentId: number,
    reason: string
  ): Promise<{ state: StudentSessionState; canRetry: boolean }> {
    const state = await this.getState(sessionId, studentId);
    if (!state) {
      throw new Error(`No state found for student=${studentId} session=${sessionId}`);
    }

    // Limpiar QR activo
    state.activeQRNonce = null;
    state.qrGeneratedAt = null;

    // Verificar si quedan intentos
    const canRetry = state.currentAttempt < state.maxAttempts;

    if (canRetry) {
      // Reiniciar desde round 1 con nuevo intento
      state.currentAttempt++;
      state.currentRound = 1;
      state.roundsCompleted = [];
      console.log(`[StudentSession] Student=${studentId} failed (${reason}), attempt ${state.currentAttempt}/${state.maxAttempts}`);
    } else {
      // Sin intentos restantes
      state.status = 'failed';
      console.log(`[StudentSession] Student=${studentId} failed permanently, no attempts left`);
    }

    await this.saveState(state);
    return { state, canRetry };
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
