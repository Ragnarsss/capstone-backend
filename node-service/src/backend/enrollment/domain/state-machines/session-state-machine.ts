/**
 * Session State Machine
 * Automata de estados para sesiones ECDH
 * 
 * SUBORDINADO a Enrollment: Solo permite transiciones si enrollment === 'enrolled'
 * 
 * Estados:
 * - no_session: Sin session_key activa
 * - session_active: session_key valida, puede usar servicio
 * - session_expired: session_key expirada, debe re-login
 * 
 * Transiciones validas:
 * - no_session -> session_active (loginEcdh)
 * - session_active -> session_expired (TTL 2h)
 * - session_expired -> no_session (auto-cleanup)
 */

import { SessionState, EnrollmentState, SESSION_STATES, ENROLLMENT_STATES } from '../models';

/**
 * Tabla de transiciones validas
 */
const VALID_TRANSITIONS: Map<SessionState, SessionState[]> = new Map([
  ['no_session', ['session_active']],
  ['session_active', ['session_expired', 'no_session']],
  ['session_expired', ['no_session']],
]);

/**
 * Session State Machine
 * Gestiona transiciones de estado de sesiones ECDH
 */
export class SessionStateMachine {
  /**
   * Verifica si el enrollment permite operaciones de session
   */
  static isEnabled(enrollmentState: EnrollmentState): boolean {
    return enrollmentState === ENROLLMENT_STATES.ENROLLED;
  }

  /**
   * Verifica si una transicion es valida
   * Requiere que enrollment sea 'enrolled' para cualquier transicion activa
   */
  static canTransition(
    from: SessionState,
    to: SessionState,
    enrollmentState: EnrollmentState
  ): boolean {
    // Session solo funciona si enrollment esta activo
    if (!this.isEnabled(enrollmentState)) {
      // Solo permitimos transiciones a no_session si enrollment no esta activo
      return to === SESSION_STATES.NO_SESSION;
    }

    const validTargets = VALID_TRANSITIONS.get(from);
    if (!validTargets) {
      return false;
    }
    return validTargets.includes(to);
  }

  /**
   * Obtiene las transiciones validas desde un estado
   */
  static getValidTransitions(
    from: SessionState,
    enrollmentState: EnrollmentState
  ): SessionState[] {
    if (!this.isEnabled(enrollmentState)) {
      // Si enrollment no esta activo, solo puede ir a no_session
      return from !== SESSION_STATES.NO_SESSION ? [SESSION_STATES.NO_SESSION] : [];
    }

    return VALID_TRANSITIONS.get(from) || [];
  }

  /**
   * Afirma que una transicion es valida, lanza error si no
   */
  static assertTransition(
    from: SessionState,
    to: SessionState,
    enrollmentState: EnrollmentState
  ): void {
    if (!this.isEnabled(enrollmentState) && to !== SESSION_STATES.NO_SESSION) {
      throw new Error(
        `SESSION_BLOCKED: No se puede iniciar session porque enrollment esta en estado '${enrollmentState}'. ` +
        `Debe estar en estado 'enrolled'.`
      );
    }

    if (!this.canTransition(from, to, enrollmentState)) {
      throw new Error(
        `INVALID_SESSION_TRANSITION: No se puede transicionar de '${from}' a '${to}'. ` +
        `Transiciones validas: [${this.getValidTransitions(from, enrollmentState).join(', ')}]`
      );
    }
  }

  /**
   * Determina el estado de session basado en datos
   */
  static inferState(params: {
    hasSessionKey: boolean;
    sessionKeyExpired: boolean;
  }): SessionState {
    const { hasSessionKey, sessionKeyExpired } = params;

    if (!hasSessionKey) {
      return SESSION_STATES.NO_SESSION;
    }

    if (sessionKeyExpired) {
      return SESSION_STATES.SESSION_EXPIRED;
    }

    return SESSION_STATES.SESSION_ACTIVE;
  }
}
