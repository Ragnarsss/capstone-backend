/**
 * StudentSession Entity
 * 
 * Entidad de dominio rica que encapsula la logica de negocio
 * para el estado de un estudiante en una sesion de asistencia.
 * 
 * Patron: Entidad inmutable - los metodos retornan nuevas instancias
 * 
 * Responsabilidades:
 * - Transiciones de estado (avanzar round, fallar intento)
 * - Validaciones de negocio (puede reintentar, esta completo)
 * - Calculos derivados (progreso, intentos restantes)
 */

import {
  DEFAULT_MAX_ROUNDS,
  DEFAULT_MAX_ATTEMPTS,
} from '../../../shared/config';

/**
 * Resultado de un round completado
 */
export interface RoundResult {
  round: number;
  responseTime: number;
  validatedAt: number;
  nonce: string;
}

/**
 * Estado posible de la sesion del estudiante
 */
export type StudentSessionStatus = 'active' | 'completed' | 'failed';

/**
 * Datos de estado de la sesion (plain object para persistencia)
 */
export interface StudentSessionData {
  studentId: number;
  sessionId: string;
  currentRound: number;
  maxRounds: number;
  roundsCompleted: RoundResult[];
  currentAttempt: number;
  maxAttempts: number;
  activeQRNonce: string | null;
  qrGeneratedAt: number | null;
  status: StudentSessionStatus;
  registeredAt: number;
  updatedAt: number;
}

/**
 * Resultado de completar un round
 */
export interface CompleteRoundResult {
  session: StudentSession;
  isComplete: boolean;
}

/**
 * Resultado de fallar un round
 */
export interface FailRoundResult {
  session: StudentSession;
  canRetry: boolean;
}

/**
 * StudentSession Entity
 * 
 * Inmutable: todos los metodos que modifican estado retornan una nueva instancia
 */
export class StudentSession {
  private constructor(private readonly data: StudentSessionData) {
    // Constructor privado - usar factory methods
  }

  // ============================================
  // Factory Methods
  // ============================================

  /**
   * Crea una nueva sesion para un estudiante
   */
  static create(
    studentId: number,
    sessionId: string,
    options?: { maxRounds?: number; maxAttempts?: number }
  ): StudentSession {
    const now = Date.now();
    return new StudentSession({
      studentId,
      sessionId,
      currentRound: 1,
      maxRounds: options?.maxRounds ?? DEFAULT_MAX_ROUNDS,
      roundsCompleted: [],
      currentAttempt: 1,
      maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      activeQRNonce: null,
      qrGeneratedAt: null,
      status: 'active',
      registeredAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstruye una entidad desde datos persistidos
   */
  static fromData(data: StudentSessionData): StudentSession {
    return new StudentSession({ ...data });
  }

  // ============================================
  // Getters (acceso a datos)
  // ============================================

  get studentId(): number { return this.data.studentId; }
  get sessionId(): string { return this.data.sessionId; }
  get currentRound(): number { return this.data.currentRound; }
  get maxRounds(): number { return this.data.maxRounds; }
  get roundsCompleted(): readonly RoundResult[] { return this.data.roundsCompleted; }
  get currentAttempt(): number { return this.data.currentAttempt; }
  get maxAttempts(): number { return this.data.maxAttempts; }
  get activeQRNonce(): string | null { return this.data.activeQRNonce; }
  get qrGeneratedAt(): number | null { return this.data.qrGeneratedAt; }
  get status(): StudentSessionStatus { return this.data.status; }
  get registeredAt(): number { return this.data.registeredAt; }
  get updatedAt(): number { return this.data.updatedAt; }

  // ============================================
  // Queries (calculos derivados)
  // ============================================

  /** Verifica si la sesion esta activa */
  isActive(): boolean {
    return this.data.status === 'active';
  }

  /** Verifica si completo todos los rounds */
  isComplete(): boolean {
    return this.data.status === 'completed';
  }

  /** Verifica si fallo permanentemente */
  isFailed(): boolean {
    return this.data.status === 'failed';
  }

  /** Verifica si puede reintentar despues de un fallo */
  canRetry(): boolean {
    return this.data.currentAttempt < this.data.maxAttempts;
  }

  /** Calcula intentos restantes */
  attemptsRemaining(): number {
    return Math.max(0, this.data.maxAttempts - this.data.currentAttempt);
  }

  /** Calcula rounds restantes para completar */
  roundsRemaining(): number {
    return Math.max(0, this.data.maxRounds - this.data.currentRound + 1);
  }

  /** Calcula porcentaje de progreso */
  progressPercentage(): number {
    return (this.data.roundsCompleted.length / this.data.maxRounds) * 100;
  }

  /** Verifica si tiene QR activo */
  hasActiveQR(): boolean {
    return this.data.activeQRNonce !== null;
  }

  /** Verifica si un nonce corresponde al QR activo */
  ownsQR(nonce: string): boolean {
    return this.data.activeQRNonce === nonce;
  }

  // ============================================
  // Commands (transiciones de estado - retornan nueva instancia)
  // ============================================

  /**
   * Establece un QR activo para el estudiante
   */
  withActiveQR(nonce: string): StudentSession {
    return new StudentSession({
      ...this.data,
      activeQRNonce: nonce,
      qrGeneratedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  /**
   * Limpia el QR activo
   */
  withoutActiveQR(): StudentSession {
    return new StudentSession({
      ...this.data,
      activeQRNonce: null,
      qrGeneratedAt: null,
      updatedAt: Date.now(),
    });
  }

  /**
   * Completa el round actual exitosamente
   * 
   * Logica de negocio:
   * - Registra el resultado del round
   * - Si era el ultimo round, marca como 'completed'
   * - Si no, avanza al siguiente round
   * - Limpia el QR activo
   */
  completeRound(result: Omit<RoundResult, 'round'>): CompleteRoundResult {
    const roundResult: RoundResult = {
      round: this.data.currentRound,
      ...result,
    };

    const newRoundsCompleted = [...this.data.roundsCompleted, roundResult];
    const isComplete = this.data.currentRound >= this.data.maxRounds;

    const newSession = new StudentSession({
      ...this.data,
      roundsCompleted: newRoundsCompleted,
      activeQRNonce: null,
      qrGeneratedAt: null,
      currentRound: isComplete ? this.data.currentRound : this.data.currentRound + 1,
      status: isComplete ? 'completed' : 'active',
      updatedAt: Date.now(),
    });

    return { session: newSession, isComplete };
  }

  /**
   * Registra un fallo en el round actual
   * 
   * Logica de negocio:
   * - Si quedan intentos: reinicia desde round 1 con nuevo intento
   * - Si no quedan intentos: marca como 'failed'
   * - Limpia el QR activo y los rounds completados
   */
  failRound(): FailRoundResult {
    const canRetry = this.canRetry();

    const newSession = new StudentSession({
      ...this.data,
      activeQRNonce: null,
      qrGeneratedAt: null,
      // Si puede reintentar: incrementar intento, resetear round
      // Si no: mantener estado pero marcar como failed
      currentAttempt: canRetry ? this.data.currentAttempt + 1 : this.data.currentAttempt,
      currentRound: canRetry ? 1 : this.data.currentRound,
      roundsCompleted: canRetry ? [] : this.data.roundsCompleted,
      status: canRetry ? 'active' : 'failed',
      updatedAt: Date.now(),
    });

    return { session: newSession, canRetry };
  }

  // ============================================
  // Serialization
  // ============================================

  /**
   * Convierte a plain object para persistencia
   */
  toData(): StudentSessionData {
    return { ...this.data };
  }

  /**
   * Convierte a JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.data);
  }
}
