/**
 * Unit Tests: EnrollmentStateMachine
 *
 * Estados: not_enrolled, pending, enrolled, revoked
 *
 * Diagrama:
 *   not_enrolled -> pending -> enrolled -> revoked
 *        |            |           |           |
 *        |            v           |           |
 *        |       not_enrolled <---+           |
 *        |       (TTL expira)                 |
 *        +------------------------------------+
 *                  (nuevo enrollment)
 */

import { describe, it, expect } from 'vitest';
import { EnrollmentStateMachine } from '../enrollment-state-machine';
import { ENROLLMENT_STATES } from '../../models';

describe('EnrollmentStateMachine', () => {
  describe('canTransition', () => {
    describe('desde not_enrolled', () => {
      it('permite transicion a pending (startEnrollment)', () => {
        expect(EnrollmentStateMachine.canTransition('not_enrolled', 'pending')).toBe(true);
      });

      it('NO permite transicion directa a enrolled', () => {
        expect(EnrollmentStateMachine.canTransition('not_enrolled', 'enrolled')).toBe(false);
      });

      it('NO permite transicion a revoked', () => {
        expect(EnrollmentStateMachine.canTransition('not_enrolled', 'revoked')).toBe(false);
      });

      it('NO permite quedarse en not_enrolled', () => {
        expect(EnrollmentStateMachine.canTransition('not_enrolled', 'not_enrolled')).toBe(false);
      });
    });

    describe('desde pending', () => {
      it('permite transicion a enrolled (finishEnrollment OK)', () => {
        expect(EnrollmentStateMachine.canTransition('pending', 'enrolled')).toBe(true);
      });

      it('permite transicion a not_enrolled (TTL expira)', () => {
        expect(EnrollmentStateMachine.canTransition('pending', 'not_enrolled')).toBe(true);
      });

      it('permite transicion a pending (reintento de enrollment)', () => {
        expect(EnrollmentStateMachine.canTransition('pending', 'pending')).toBe(true);
      });

      it('NO permite transicion directa a revoked', () => {
        expect(EnrollmentStateMachine.canTransition('pending', 'revoked')).toBe(false);
      });
    });

    describe('desde enrolled', () => {
      it('permite transicion a revoked (revoke manual)', () => {
        expect(EnrollmentStateMachine.canTransition('enrolled', 'revoked')).toBe(true);
      });

      it('permite transicion a pending (re-enrollment)', () => {
        expect(EnrollmentStateMachine.canTransition('enrolled', 'pending')).toBe(true);
      });

      it('NO permite transicion a not_enrolled', () => {
        expect(EnrollmentStateMachine.canTransition('enrolled', 'not_enrolled')).toBe(false);
      });

      it('NO permite quedarse en enrolled', () => {
        expect(EnrollmentStateMachine.canTransition('enrolled', 'enrolled')).toBe(false);
      });
    });

    describe('desde revoked', () => {
      it('permite transicion a pending (nuevo enrollment)', () => {
        expect(EnrollmentStateMachine.canTransition('revoked', 'pending')).toBe(true);
      });

      it('NO permite transicion directa a enrolled', () => {
        expect(EnrollmentStateMachine.canTransition('revoked', 'enrolled')).toBe(false);
      });

      it('NO permite transicion a not_enrolled', () => {
        expect(EnrollmentStateMachine.canTransition('revoked', 'not_enrolled')).toBe(false);
      });

      it('NO permite quedarse en revoked', () => {
        expect(EnrollmentStateMachine.canTransition('revoked', 'revoked')).toBe(false);
      });
    });
  });

  describe('getValidTransitions', () => {
    it('retorna [pending] desde not_enrolled', () => {
      expect(EnrollmentStateMachine.getValidTransitions('not_enrolled')).toEqual(['pending']);
    });

    it('retorna [enrolled, not_enrolled, pending] desde pending', () => {
      expect(EnrollmentStateMachine.getValidTransitions('pending')).toEqual([
        'enrolled',
        'not_enrolled',
        'pending',
      ]);
    });

    it('retorna [revoked, pending] desde enrolled', () => {
      expect(EnrollmentStateMachine.getValidTransitions('enrolled')).toEqual(['revoked', 'pending']);
    });

    it('retorna [pending] desde revoked', () => {
      expect(EnrollmentStateMachine.getValidTransitions('revoked')).toEqual(['pending']);
    });

    it('retorna array vacio para estado invalido', () => {
      // @ts-expect-error - testing invalid state
      expect(EnrollmentStateMachine.getValidTransitions('invalid_state')).toEqual([]);
    });
  });

  describe('assertTransition', () => {
    it('no lanza error para transicion valida', () => {
      expect(() => {
        EnrollmentStateMachine.assertTransition('not_enrolled', 'pending');
      }).not.toThrow();
    });

    it('lanza INVALID_TRANSITION para transicion invalida', () => {
      expect(() => EnrollmentStateMachine.assertTransition('not_enrolled', 'enrolled')).toThrow(
        /INVALID_TRANSITION/
      );
    });

    it('incluye transiciones validas en mensaje de error', () => {
      expect(() => EnrollmentStateMachine.assertTransition('not_enrolled', 'enrolled')).toThrow(
        /pending/
      );
    });
  });

  describe('inferState', () => {
    it('retorna PENDING si hay challenge pendiente', () => {
      const state = EnrollmentStateMachine.inferState({
        hasActiveDevice: false,
        hasRevokedDevice: false,
        hasPendingChallenge: true,
      });
      expect(state).toBe(ENROLLMENT_STATES.PENDING);
    });

    it('retorna ENROLLED si hay dispositivo activo', () => {
      const state = EnrollmentStateMachine.inferState({
        hasActiveDevice: true,
        hasRevokedDevice: false,
        hasPendingChallenge: false,
      });
      expect(state).toBe(ENROLLMENT_STATES.ENROLLED);
    });

    it('retorna REVOKED si hay dispositivo revocado sin activo', () => {
      const state = EnrollmentStateMachine.inferState({
        hasActiveDevice: false,
        hasRevokedDevice: true,
        hasPendingChallenge: false,
      });
      expect(state).toBe(ENROLLMENT_STATES.REVOKED);
    });

    it('retorna NOT_ENROLLED si no hay nada', () => {
      const state = EnrollmentStateMachine.inferState({
        hasActiveDevice: false,
        hasRevokedDevice: false,
        hasPendingChallenge: false,
      });
      expect(state).toBe(ENROLLMENT_STATES.NOT_ENROLLED);
    });

    it('prioriza PENDING sobre ENROLLED (challenge en curso)', () => {
      const state = EnrollmentStateMachine.inferState({
        hasActiveDevice: true,
        hasRevokedDevice: false,
        hasPendingChallenge: true,
      });
      expect(state).toBe(ENROLLMENT_STATES.PENDING);
    });

    it('prioriza ENROLLED sobre REVOKED', () => {
      const state = EnrollmentStateMachine.inferState({
        hasActiveDevice: true,
        hasRevokedDevice: true,
        hasPendingChallenge: false,
      });
      expect(state).toBe(ENROLLMENT_STATES.ENROLLED);
    });
  });

  describe('canStartSession', () => {
    it('retorna true solo para estado enrolled', () => {
      expect(EnrollmentStateMachine.canStartSession('enrolled')).toBe(true);
    });

    it('retorna false para not_enrolled', () => {
      expect(EnrollmentStateMachine.canStartSession('not_enrolled')).toBe(false);
    });

    it('retorna false para pending', () => {
      expect(EnrollmentStateMachine.canStartSession('pending')).toBe(false);
    });

    it('retorna false para revoked', () => {
      expect(EnrollmentStateMachine.canStartSession('revoked')).toBe(false);
    });
  });

  describe('flujos completos', () => {
    it('flujo happy path: not_enrolled -> pending -> enrolled', () => {
      expect(EnrollmentStateMachine.canTransition('not_enrolled', 'pending')).toBe(true);
      expect(EnrollmentStateMachine.canTransition('pending', 'enrolled')).toBe(true);
      expect(EnrollmentStateMachine.canStartSession('enrolled')).toBe(true);
    });

    it('flujo enrollment fallido: not_enrolled -> pending -> not_enrolled', () => {
      expect(EnrollmentStateMachine.canTransition('not_enrolled', 'pending')).toBe(true);
      expect(EnrollmentStateMachine.canTransition('pending', 'not_enrolled')).toBe(true);
    });

    it('flujo revoke y re-enrollment', () => {
      expect(EnrollmentStateMachine.canStartSession('enrolled')).toBe(true);
      expect(EnrollmentStateMachine.canTransition('enrolled', 'revoked')).toBe(true);
      expect(EnrollmentStateMachine.canStartSession('revoked')).toBe(false);
      expect(EnrollmentStateMachine.canTransition('revoked', 'pending')).toBe(true);
      expect(EnrollmentStateMachine.canTransition('pending', 'enrolled')).toBe(true);
    });
  });
});
