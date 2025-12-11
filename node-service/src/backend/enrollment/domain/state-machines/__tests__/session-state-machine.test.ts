/**
 * Unit Tests: SessionStateMachine
 *
 * Estados: no_session, session_active, session_expired
 *
 * IMPORTANTE: Session esta SUBORDINADA a Enrollment
 * Solo permite transiciones activas si enrollmentState === 'enrolled'
 */

import { describe, it, expect } from 'vitest';
import { SessionStateMachine } from '../session-state-machine';

describe('SessionStateMachine', () => {
  describe('isEnabled', () => {
    it('retorna true solo para enrollment enrolled', () => {
      expect(SessionStateMachine.isEnabled('enrolled')).toBe(true);
    });

    it('retorna false para enrollment not_enrolled', () => {
      expect(SessionStateMachine.isEnabled('not_enrolled')).toBe(false);
    });

    it('retorna false para enrollment pending', () => {
      expect(SessionStateMachine.isEnabled('pending')).toBe(false);
    });

    it('retorna false para enrollment revoked', () => {
      expect(SessionStateMachine.isEnabled('revoked')).toBe(false);
    });
  });

  describe('canTransition (con enrollment enrolled)', () => {
    const enrolled = 'enrolled' as const;

    describe('desde no_session', () => {
      it('permite transicion a session_active (login)', () => {
        expect(SessionStateMachine.canTransition('no_session', 'session_active', enrolled)).toBe(
          true
        );
      });

      it('NO permite transicion directa a session_expired', () => {
        expect(SessionStateMachine.canTransition('no_session', 'session_expired', enrolled)).toBe(
          false
        );
      });

      it('NO permite quedarse en no_session', () => {
        expect(SessionStateMachine.canTransition('no_session', 'no_session', enrolled)).toBe(false);
      });
    });

    describe('desde session_active', () => {
      it('permite transicion a session_expired (TTL)', () => {
        expect(
          SessionStateMachine.canTransition('session_active', 'session_expired', enrolled)
        ).toBe(true);
      });

      it('permite transicion a no_session (logout)', () => {
        expect(SessionStateMachine.canTransition('session_active', 'no_session', enrolled)).toBe(
          true
        );
      });

      it('NO permite quedarse en session_active', () => {
        expect(
          SessionStateMachine.canTransition('session_active', 'session_active', enrolled)
        ).toBe(false);
      });
    });

    describe('desde session_expired', () => {
      it('permite transicion a no_session (cleanup)', () => {
        expect(SessionStateMachine.canTransition('session_expired', 'no_session', enrolled)).toBe(
          true
        );
      });

      it('NO permite transicion directa a session_active', () => {
        expect(
          SessionStateMachine.canTransition('session_expired', 'session_active', enrolled)
        ).toBe(false);
      });

      it('NO permite quedarse en session_expired', () => {
        expect(
          SessionStateMachine.canTransition('session_expired', 'session_expired', enrolled)
        ).toBe(false);
      });
    });
  });

  describe('canTransition (con enrollment NO enrolled)', () => {
    describe('cuando enrollment es not_enrolled', () => {
      const notEnrolled = 'not_enrolled' as const;

      it('NO permite transicion de no_session a session_active', () => {
        expect(
          SessionStateMachine.canTransition('no_session', 'session_active', notEnrolled)
        ).toBe(false);
      });

      it('permite transicion de session_active a no_session (cleanup)', () => {
        expect(
          SessionStateMachine.canTransition('session_active', 'no_session', notEnrolled)
        ).toBe(true);
      });

      it('permite transicion de session_expired a no_session', () => {
        expect(
          SessionStateMachine.canTransition('session_expired', 'no_session', notEnrolled)
        ).toBe(true);
      });
    });

    describe('cuando enrollment es pending', () => {
      it('NO permite iniciar sesion', () => {
        expect(SessionStateMachine.canTransition('no_session', 'session_active', 'pending')).toBe(
          false
        );
      });
    });

    describe('cuando enrollment es revoked', () => {
      it('NO permite iniciar sesion', () => {
        expect(SessionStateMachine.canTransition('no_session', 'session_active', 'revoked')).toBe(
          false
        );
      });

      it('permite limpiar sesion activa', () => {
        expect(SessionStateMachine.canTransition('session_active', 'no_session', 'revoked')).toBe(
          true
        );
      });
    });
  });

  describe('getValidTransitions', () => {
    describe('con enrollment enrolled', () => {
      const enrolled = 'enrolled' as const;

      it('retorna [session_active] desde no_session', () => {
        expect(SessionStateMachine.getValidTransitions('no_session', enrolled)).toEqual([
          'session_active',
        ]);
      });

      it('retorna [session_expired, no_session] desde session_active', () => {
        expect(SessionStateMachine.getValidTransitions('session_active', enrolled)).toEqual([
          'session_expired',
          'no_session',
        ]);
      });

      it('retorna [no_session] desde session_expired', () => {
        expect(SessionStateMachine.getValidTransitions('session_expired', enrolled)).toEqual([
          'no_session',
        ]);
      });
    });

    describe('con enrollment NOT enrolled', () => {
      const notEnrolled = 'not_enrolled' as const;

      it('retorna [] desde no_session (no puede iniciar)', () => {
        expect(SessionStateMachine.getValidTransitions('no_session', notEnrolled)).toEqual([]);
      });

      it('retorna [no_session] desde session_active (solo cleanup)', () => {
        expect(SessionStateMachine.getValidTransitions('session_active', notEnrolled)).toEqual([
          'no_session',
        ]);
      });

      it('retorna [no_session] desde session_expired', () => {
        expect(SessionStateMachine.getValidTransitions('session_expired', notEnrolled)).toEqual([
          'no_session',
        ]);
      });
    });
  });

  describe('assertTransition', () => {
    const enrolled = 'enrolled' as const;

    it('no lanza error para transicion valida', () => {
      expect(() => {
        SessionStateMachine.assertTransition('no_session', 'session_active', enrolled);
      }).not.toThrow();
    });

    it('lanza INVALID_SESSION_TRANSITION para transicion invalida', () => {
      expect(() =>
        SessionStateMachine.assertTransition('no_session', 'session_expired', enrolled)
      ).toThrow(/INVALID_SESSION_TRANSITION/);
    });

    it('lanza SESSION_BLOCKED cuando enrollment no esta activo', () => {
      expect(() =>
        SessionStateMachine.assertTransition('no_session', 'session_active', 'not_enrolled')
      ).toThrow(/SESSION_BLOCKED/);
    });

    it('mensaje de SESSION_BLOCKED incluye estado de enrollment', () => {
      expect(() =>
        SessionStateMachine.assertTransition('no_session', 'session_active', 'revoked')
      ).toThrow(/revoked/);
    });

    it('permite ir a no_session incluso con enrollment inactivo', () => {
      expect(() => {
        SessionStateMachine.assertTransition('session_active', 'no_session', 'revoked');
      }).not.toThrow();
    });
  });

  describe('flujos completos', () => {
    it('flujo happy path: login -> logout', () => {
      const enrolled = 'enrolled' as const;
      expect(SessionStateMachine.canTransition('no_session', 'session_active', enrolled)).toBe(
        true
      );
      expect(SessionStateMachine.canTransition('session_active', 'no_session', enrolled)).toBe(
        true
      );
    });

    it('flujo expiracion: login -> expired -> cleanup', () => {
      const enrolled = 'enrolled' as const;
      expect(SessionStateMachine.canTransition('no_session', 'session_active', enrolled)).toBe(
        true
      );
      expect(SessionStateMachine.canTransition('session_active', 'session_expired', enrolled)).toBe(
        true
      );
      expect(SessionStateMachine.canTransition('session_expired', 'no_session', enrolled)).toBe(
        true
      );
    });

    it('flujo revoke durante sesion activa', () => {
      expect(SessionStateMachine.isEnabled('enrolled')).toBe(true);
      expect(SessionStateMachine.canTransition('session_active', 'no_session', 'revoked')).toBe(
        true
      );
      expect(SessionStateMachine.canTransition('no_session', 'session_active', 'revoked')).toBe(
        false
      );
    });

    it('intento de login sin enrollment completo', () => {
      expect(SessionStateMachine.isEnabled('pending')).toBe(false);
      expect(() =>
        SessionStateMachine.assertTransition('no_session', 'session_active', 'pending')
      ).toThrow(/SESSION_BLOCKED/);
    });
  });

  describe('integracion con EnrollmentStateMachine', () => {
    it('solo enrolled permite iniciar sesion', () => {
      const states = ['not_enrolled', 'pending', 'enrolled', 'revoked'] as const;

      for (const enrollmentState of states) {
        const canStart = SessionStateMachine.canTransition(
          'no_session',
          'session_active',
          enrollmentState
        );

        if (enrollmentState === 'enrolled') {
          expect(canStart).toBe(true);
        } else {
          expect(canStart).toBe(false);
        }
      }
    });
  });
});
