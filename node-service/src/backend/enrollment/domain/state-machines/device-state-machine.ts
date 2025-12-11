/**
 * Device State Machine
 * Automata de estados para dispositivos FIDO2
 * 
 * Estados:
 * - not_enrolled: Usuario sin credential activa
 * - pending: Challenge generado, esperando finishEnrollment
 * - enrolled: Credential activa, puede usar el servicio
 * - revoked: Credential revocada, debe re-enrollar
 * 
 * Transiciones validas:
 * - not_enrolled -> pending (startEnrollment)
 * - pending -> enrolled (finishEnrollment OK)
 * - pending -> not_enrolled (TTL expira)
 * - enrolled -> revoked (revoke manual o auto-1:1)
 * - enrolled -> pending (re-enrollment)
 * - revoked -> pending (nuevo enrollment)
 */

import { EnrollmentState, ENROLLMENT_STATES } from '../models';

/**
 * Tabla de transiciones validas
 * Key: estado origen
 * Value: array de estados destino permitidos
 */
const VALID_TRANSITIONS: Map<EnrollmentState, EnrollmentState[]> = new Map([
  ['not_enrolled', ['pending']],
  ['pending', ['enrolled', 'not_enrolled', 'pending']],
  ['enrolled', ['revoked', 'pending']],
  ['revoked', ['pending']],
]);

/**
 * Device State Machine
 * Gestiona transiciones de estado del dispositivo FIDO2
 */
export class DeviceStateMachine {
  /**
   * Verifica si una transicion es valida
   */
  static canTransition(from: EnrollmentState, to: EnrollmentState): boolean {
    const validTargets = VALID_TRANSITIONS.get(from);
    if (!validTargets) {
      return false;
    }
    return validTargets.includes(to);
  }

  /**
   * Obtiene las transiciones validas desde un estado
   */
  static getValidTransitions(from: EnrollmentState): EnrollmentState[] {
    return VALID_TRANSITIONS.get(from) || [];
  }

  /**
   * Afirma que una transicion es valida, lanza error si no
   */
  static assertTransition(from: EnrollmentState, to: EnrollmentState): void {
    if (!this.canTransition(from, to)) {
      throw new Error(
        `INVALID_TRANSITION: No se puede transicionar de '${from}' a '${to}'. ` +
        `Transiciones validas: [${this.getValidTransitions(from).join(', ')}]`
      );
    }
  }

  /**
   * Determina el estado de enrollment basado en datos
   * Usado para inferir estado cuando no hay campo status en DB
   */
  static inferState(params: {
    hasActiveDevice: boolean;
    hasRevokedDevice: boolean;
    hasPendingChallenge: boolean;
  }): EnrollmentState {
    const { hasActiveDevice, hasRevokedDevice, hasPendingChallenge } = params;

    if (hasPendingChallenge) {
      return ENROLLMENT_STATES.PENDING;
    }

    if (hasActiveDevice) {
      return ENROLLMENT_STATES.ENROLLED;
    }

    if (hasRevokedDevice) {
      return ENROLLMENT_STATES.REVOKED;
    }

    return ENROLLMENT_STATES.NOT_ENROLLED;
  }

  /**
   * Verifica si el estado permite operaciones de session
   */
  static canStartSession(state: EnrollmentState): boolean {
    return state === ENROLLMENT_STATES.ENROLLED;
  }
}
