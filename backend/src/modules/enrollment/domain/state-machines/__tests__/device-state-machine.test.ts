/**
 * Unit Tests: DeviceStateMachine
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
import { DeviceStateMachine } from '../device-state-machine';
import { ENROLLMENT_STATES } from '../../models';

describe('DeviceStateMachine', () => {
  describe('canTransition', () => {
    describe('desde not_enrolled', () => {
      it('permite transicion a pending (startEnrollment)', () => {
        expect(DeviceStateMachine.canTransition('not_enrolled', 'pending')).toBe(true);
      });

      it('NO permite transicion directa a enrolled', () => {
        expect(DeviceStateMachine.canTransition('not_enrolled', 'enrolled')).toBe(false);
      });

      it('NO permite transicion a revoked', () => {
        expect(DeviceStateMachine.canTransition('not_enrolled', 'revoked')).toBe(false);
      });

      it('NO permite quedarse en not_enrolled', () => {
        expect(DeviceStateMachine.canTransition('not_enrolled', 'not_enrolled')).toBe(false);
      });
    });

    describe('desde pending', () => {
      it('permite transicion a enrolled (finishEnrollment OK)', () => {
        expect(DeviceStateMachine.canTransition('pending', 'enrolled')).toBe(true);
      });

      it('permite transicion a not_enrolled (TTL expira)', () => {
        expect(DeviceStateMachine.canTransition('pending', 'not_enrolled')).toBe(true);
      });

      it('permite transicion a pending (reintento de enrollment)', () => {
        expect(DeviceStateMachine.canTransition('pending', 'pending')).toBe(true);
      });

      it('NO permite transicion directa a revoked', () => {
        expect(DeviceStateMachine.canTransition('pending', 'revoked')).toBe(false);
      });
    });

    describe('desde enrolled', () => {
      it('permite transicion a revoked (revoke manual)', () => {
        expect(DeviceStateMachine.canTransition('enrolled', 'revoked')).toBe(true);
      });

      it('permite transicion a pending (re-enrollment)', () => {
        expect(DeviceStateMachine.canTransition('enrolled', 'pending')).toBe(true);
      });

      it('NO permite transicion a not_enrolled', () => {
        expect(DeviceStateMachine.canTransition('enrolled', 'not_enrolled')).toBe(false);
      });

      it('NO permite quedarse en enrolled', () => {
        expect(DeviceStateMachine.canTransition('enrolled', 'enrolled')).toBe(false);
      });
    });

    describe('desde revoked', () => {
      it('permite transicion a pending (nuevo enrollment)', () => {
        expect(DeviceStateMachine.canTransition('revoked', 'pending')).toBe(true);
      });

      it('NO permite transicion directa a enrolled', () => {
        expect(DeviceStateMachine.canTransition('revoked', 'enrolled')).toBe(false);
      });

      it('NO permite transicion a not_enrolled', () => {
        expect(DeviceStateMachine.canTransition('revoked', 'not_enrolled')).toBe(false);
      });

      it('NO permite quedarse en revoked', () => {
        expect(DeviceStateMachine.canTransition('revoked', 'revoked')).toBe(false);
      });
    });

    describe('desde estado invalido', () => {
      it('retorna false para estado origen inexistente', () => {
        // @ts-expect-error - testing invalid state
        expect(DeviceStateMachine.canTransition('invalid_state', 'pending')).toBe(false);
      });

      it('retorna false cuando origen es invalido sin importar destino', () => {
        // @ts-expect-error - testing invalid state
        expect(DeviceStateMachine.canTransition('unknown', 'enrolled')).toBe(false);
      });
    });
  });

  describe('getValidTransitions', () => {
    it('retorna [pending] desde not_enrolled', () => {
      expect(DeviceStateMachine.getValidTransitions('not_enrolled')).toEqual(['pending']);
    });

    it('retorna [enrolled, not_enrolled, pending] desde pending', () => {
      expect(DeviceStateMachine.getValidTransitions('pending')).toEqual([
        'enrolled',
        'not_enrolled',
        'pending',
      ]);
    });

    it('retorna [revoked, pending] desde enrolled', () => {
      expect(DeviceStateMachine.getValidTransitions('enrolled')).toEqual(['revoked', 'pending']);
    });

    it('retorna [pending] desde revoked', () => {
      expect(DeviceStateMachine.getValidTransitions('revoked')).toEqual(['pending']);
    });

    it('retorna array vacio para estado invalido', () => {
      // @ts-expect-error - testing invalid state
      expect(DeviceStateMachine.getValidTransitions('invalid_state')).toEqual([]);
    });
  });

  describe('assertTransition', () => {
    it('no lanza error para transicion valida', () => {
      expect(() => {
        DeviceStateMachine.assertTransition('not_enrolled', 'pending');
      }).not.toThrow();
    });

    it('lanza INVALID_TRANSITION para transicion invalida', () => {
      expect(() => DeviceStateMachine.assertTransition('not_enrolled', 'enrolled')).toThrow(
        /INVALID_TRANSITION/
      );
    });

    it('incluye transiciones validas en mensaje de error', () => {
      expect(() => DeviceStateMachine.assertTransition('not_enrolled', 'enrolled')).toThrow(
        /pending/
      );
    });
  });

  describe('inferState', () => {
    it('retorna PENDING si hay challenge pendiente', () => {
      const state = DeviceStateMachine.inferState({
        hasActiveDevice: false,
        hasRevokedDevice: false,
        hasPendingChallenge: true,
      });
      expect(state).toBe(ENROLLMENT_STATES.PENDING);
    });

    it('retorna ENROLLED si hay dispositivo activo', () => {
      const state = DeviceStateMachine.inferState({
        hasActiveDevice: true,
        hasRevokedDevice: false,
        hasPendingChallenge: false,
      });
      expect(state).toBe(ENROLLMENT_STATES.ENROLLED);
    });

    it('retorna REVOKED si hay dispositivo revocado sin activo', () => {
      const state = DeviceStateMachine.inferState({
        hasActiveDevice: false,
        hasRevokedDevice: true,
        hasPendingChallenge: false,
      });
      expect(state).toBe(ENROLLMENT_STATES.REVOKED);
    });

    it('retorna NOT_ENROLLED si no hay nada', () => {
      const state = DeviceStateMachine.inferState({
        hasActiveDevice: false,
        hasRevokedDevice: false,
        hasPendingChallenge: false,
      });
      expect(state).toBe(ENROLLMENT_STATES.NOT_ENROLLED);
    });

    it('prioriza PENDING sobre ENROLLED (challenge en curso)', () => {
      const state = DeviceStateMachine.inferState({
        hasActiveDevice: true,
        hasRevokedDevice: false,
        hasPendingChallenge: true,
      });
      expect(state).toBe(ENROLLMENT_STATES.PENDING);
    });

    it('prioriza ENROLLED sobre REVOKED', () => {
      const state = DeviceStateMachine.inferState({
        hasActiveDevice: true,
        hasRevokedDevice: true,
        hasPendingChallenge: false,
      });
      expect(state).toBe(ENROLLMENT_STATES.ENROLLED);
    });
  });

  describe('flujos completos', () => {
    it('flujo happy path: not_enrolled -> pending -> enrolled', () => {
      expect(DeviceStateMachine.canTransition('not_enrolled', 'pending')).toBe(true);
      expect(DeviceStateMachine.canTransition('pending', 'enrolled')).toBe(true);
    });

    it('flujo enrollment fallido: not_enrolled -> pending -> not_enrolled', () => {
      expect(DeviceStateMachine.canTransition('not_enrolled', 'pending')).toBe(true);
      expect(DeviceStateMachine.canTransition('pending', 'not_enrolled')).toBe(true);
    });

    it('flujo revoke y re-enrollment', () => {
      expect(DeviceStateMachine.canTransition('enrolled', 'revoked')).toBe(true);
      expect(DeviceStateMachine.canTransition('revoked', 'pending')).toBe(true);
      expect(DeviceStateMachine.canTransition('pending', 'enrolled')).toBe(true);
    });
  });
});
