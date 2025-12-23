/**
 * Tests para StudentSession Entity
 *
 * @description Tests para entidad de dominio rica con lógica de negocio
 * @coverage Target: 100%
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  StudentSession,
  type StudentSessionData,
  type RoundResult,
  type StudentSessionStatus,
} from "../student-session.entity";

describe("StudentSession Entity", () => {
  let mockNow: number;

  beforeEach(() => {
    mockNow = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Factory Methods", () => {
    describe("create()", () => {
      it("debe crear una nueva sesión con valores por defecto", () => {
        const session = StudentSession.create(12345, "session-123");

        expect(session.studentId).toBe(12345);
        expect(session.sessionId).toBe("session-123");
        expect(session.currentRound).toBe(1);
        expect(session.maxRounds).toBe(3); // DEFAULT_MAX_ROUNDS
        expect(session.roundsCompleted).toEqual([]);
        expect(session.currentAttempt).toBe(1);
        expect(session.maxAttempts).toBe(3); // DEFAULT_MAX_ATTEMPTS
        expect(session.activeQRNonce).toBeNull();
        expect(session.qrGeneratedAt).toBeNull();
        expect(session.status).toBe("active");
        expect(session.registeredAt).toBe(mockNow);
        expect(session.updatedAt).toBe(mockNow);
      });

      it("debe crear sesión con maxRounds personalizado", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxRounds: 3,
        });

        expect(session.maxRounds).toBe(3);
      });

      it("debe crear sesión con maxAttempts personalizado", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxAttempts: 5,
        });

        expect(session.maxAttempts).toBe(5);
      });

      it("debe crear sesión con ambas opciones personalizadas", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxRounds: 4,
          maxAttempts: 2,
        });

        expect(session.maxRounds).toBe(4);
        expect(session.maxAttempts).toBe(2);
      });
    });

    describe("fromData()", () => {
      it("debe reconstruir entidad desde datos persistidos", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 3,
          maxRounds: 5,
          roundsCompleted: [
            {
              round: 1,
              responseTime: 1000,
              validatedAt: mockNow - 10000,
              nonce: "nonce1",
            },
            {
              round: 2,
              responseTime: 1200,
              validatedAt: mockNow - 5000,
              nonce: "nonce2",
            },
          ],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: "active-nonce",
          qrGeneratedAt: mockNow - 1000,
          status: "active",
          registeredAt: mockNow - 20000,
          updatedAt: mockNow - 1000,
        };

        const session = StudentSession.fromData(data);

        expect(session.studentId).toBe(12345);
        expect(session.sessionId).toBe("session-123");
        expect(session.currentRound).toBe(3);
        expect(session.maxRounds).toBe(5);
        expect(session.roundsCompleted).toHaveLength(2);
        expect(session.currentAttempt).toBe(1);
        expect(session.maxAttempts).toBe(3);
        expect(session.activeQRNonce).toBe("active-nonce");
        expect(session.qrGeneratedAt).toBe(mockNow - 1000);
        expect(session.status).toBe("active");
        expect(session.registeredAt).toBe(mockNow - 20000);
        expect(session.updatedAt).toBe(mockNow - 1000);
      });

      it("debe mantener inmutabilidad de datos originales", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 1,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };

        const session = StudentSession.fromData(data);

        // Modificar objeto original no debe afectar entidad
        data.currentRound = 999;

        expect(session.currentRound).toBe(1);
      });
    });
  });

  describe("Getters", () => {
    let session: StudentSession;

    beforeEach(() => {
      session = StudentSession.create(12345, "session-123");
    });

    it("debe exponer studentId", () => {
      expect(session.studentId).toBe(12345);
    });

    it("debe exponer sessionId", () => {
      expect(session.sessionId).toBe("session-123");
    });

    it("debe exponer currentRound", () => {
      expect(session.currentRound).toBe(1);
    });

    it("debe exponer roundsCompleted como readonly", () => {
      expect(session.roundsCompleted).toEqual([]);
      expect(Array.isArray(session.roundsCompleted)).toBe(true);
    });

    it("debe exponer status", () => {
      expect(session.status).toBe("active");
    });
  });

  describe("Queries (Cálculos derivados)", () => {
    describe("isActive()", () => {
      it("debe retornar true si status es active", () => {
        const session = StudentSession.create(12345, "session-123");
        expect(session.isActive()).toBe(true);
      });

      it("debe retornar false si status es completed", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 5,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "completed",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.isActive()).toBe(false);
      });

      it("debe retornar false si status es failed", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 3,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 3,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "failed",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.isActive()).toBe(false);
      });
    });

    describe("isComplete()", () => {
      it("debe retornar true si status es completed", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 5,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "completed",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.isComplete()).toBe(true);
      });

      it("debe retornar false si status no es completed", () => {
        const session = StudentSession.create(12345, "session-123");
        expect(session.isComplete()).toBe(false);
      });
    });

    describe("isFailed()", () => {
      it("debe retornar true si status es failed", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 3,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 3,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "failed",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.isFailed()).toBe(true);
      });

      it("debe retornar false si status no es failed", () => {
        const session = StudentSession.create(12345, "session-123");
        expect(session.isFailed()).toBe(false);
      });
    });

    describe("canRetry()", () => {
      it("debe retornar true si hay intentos disponibles", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxAttempts: 3,
        });
        expect(session.canRetry()).toBe(true);
      });

      it("debe retornar false si ya usó todos los intentos", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 1,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 3,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.canRetry()).toBe(false);
      });

      it("debe retornar true en el primer intento", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxAttempts: 3,
        });
        expect(session.currentAttempt).toBe(1);
        expect(session.canRetry()).toBe(true);
      });

      it("debe retornar true en el segundo intento de 3", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 1,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 2,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.canRetry()).toBe(true);
      });
    });

    describe("attemptsRemaining()", () => {
      it("debe calcular intentos restantes correctamente", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxAttempts: 3,
        });
        expect(session.attemptsRemaining()).toBe(2); // 3 - 1
      });

      it("debe retornar 0 si no quedan intentos", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 1,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 3,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.attemptsRemaining()).toBe(0);
      });

      it("debe retornar maxAttempts - 1 en el primer intento", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxAttempts: 5,
        });
        expect(session.attemptsRemaining()).toBe(4);
      });
    });

    describe("roundsRemaining()", () => {
      it("debe calcular rounds restantes correctamente", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxRounds: 5,
        });
        expect(session.roundsRemaining()).toBe(5); // 5 - 1 + 1
      });

      it("debe retornar 1 en el último round", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 5,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.roundsRemaining()).toBe(1);
      });

      it("debe retornar 3 en el round 3 de 5", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 3,
          maxRounds: 5,
          roundsCompleted: [],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.roundsRemaining()).toBe(3);
      });
    });

    describe("progressPercentage()", () => {
      it("debe retornar 0% al inicio", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxRounds: 5,
        });
        expect(session.progressPercentage()).toBe(0);
      });

      it("debe retornar 20% después de completar 1 de 5 rounds", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 2,
          maxRounds: 5,
          roundsCompleted: [
            {
              round: 1,
              responseTime: 1000,
              validatedAt: mockNow,
              nonce: "nonce1",
            },
          ],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.progressPercentage()).toBe(20);
      });

      it("debe retornar 100% al completar todos los rounds", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 5,
          maxRounds: 5,
          roundsCompleted: [
            {
              round: 1,
              responseTime: 1000,
              validatedAt: mockNow,
              nonce: "nonce1",
            },
            {
              round: 2,
              responseTime: 1200,
              validatedAt: mockNow,
              nonce: "nonce2",
            },
            {
              round: 3,
              responseTime: 1100,
              validatedAt: mockNow,
              nonce: "nonce3",
            },
            {
              round: 4,
              responseTime: 1300,
              validatedAt: mockNow,
              nonce: "nonce4",
            },
            {
              round: 5,
              responseTime: 1150,
              validatedAt: mockNow,
              nonce: "nonce5",
            },
          ],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "completed",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.progressPercentage()).toBe(100);
      });

      it("debe calcular porcentaje con 3 rounds", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 2,
          maxRounds: 3,
          roundsCompleted: [
            {
              round: 1,
              responseTime: 1000,
              validatedAt: mockNow,
              nonce: "nonce1",
            },
          ],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        expect(session.progressPercentage()).toBeCloseTo(33.33, 1);
      });
    });

    describe("hasActiveQR()", () => {
      it("debe retornar false si no hay QR activo", () => {
        const session = StudentSession.create(12345, "session-123");
        expect(session.hasActiveQR()).toBe(false);
      });

      it("debe retornar true si hay QR activo", () => {
        const session = StudentSession.create(
          12345,
          "session-123"
        ).withActiveQR("nonce-123");
        expect(session.hasActiveQR()).toBe(true);
      });
    });

    describe("ownsQR()", () => {
      it("debe retornar true si el nonce coincide con el QR activo", () => {
        const session = StudentSession.create(
          12345,
          "session-123"
        ).withActiveQR("nonce-123");
        expect(session.ownsQR("nonce-123")).toBe(true);
      });

      it("debe retornar false si el nonce no coincide", () => {
        const session = StudentSession.create(
          12345,
          "session-123"
        ).withActiveQR("nonce-123");
        expect(session.ownsQR("nonce-456")).toBe(false);
      });

      it("debe retornar false si no hay QR activo", () => {
        const session = StudentSession.create(12345, "session-123");
        expect(session.ownsQR("nonce-123")).toBe(false);
      });
    });
  });

  describe("Commands (Transiciones de estado)", () => {
    describe("withActiveQR()", () => {
      it("debe establecer QR activo", () => {
        const session = StudentSession.create(12345, "session-123");
        const updatedSession = session.withActiveQR("nonce-123");

        expect(updatedSession.activeQRNonce).toBe("nonce-123");
        expect(updatedSession.qrGeneratedAt).toBe(mockNow);
        expect(updatedSession.updatedAt).toBe(mockNow);
      });

      it("debe retornar nueva instancia (inmutabilidad)", () => {
        const session = StudentSession.create(12345, "session-123");
        const updatedSession = session.withActiveQR("nonce-123");

        expect(updatedSession).not.toBe(session);
        expect(session.activeQRNonce).toBeNull();
        expect(updatedSession.activeQRNonce).toBe("nonce-123");
      });

      it("debe actualizar timestamp de generación", () => {
        const session = StudentSession.create(12345, "session-123");

        vi.advanceTimersByTime(5000);
        const updatedSession = session.withActiveQR("nonce-123");

        expect(updatedSession.qrGeneratedAt).toBe(mockNow + 5000);
      });
    });

    describe("withoutActiveQR()", () => {
      it("debe limpiar QR activo", () => {
        const session = StudentSession.create(
          12345,
          "session-123"
        ).withActiveQR("nonce-123");

        const updatedSession = session.withoutActiveQR();

        expect(updatedSession.activeQRNonce).toBeNull();
        expect(updatedSession.qrGeneratedAt).toBeNull();
      });

      it("debe retornar nueva instancia (inmutabilidad)", () => {
        const session = StudentSession.create(
          12345,
          "session-123"
        ).withActiveQR("nonce-123");

        const updatedSession = session.withoutActiveQR();

        expect(updatedSession).not.toBe(session);
        expect(session.activeQRNonce).toBe("nonce-123");
        expect(updatedSession.activeQRNonce).toBeNull();
      });

      it("debe actualizar timestamp", () => {
        const session = StudentSession.create(
          12345,
          "session-123"
        ).withActiveQR("nonce-123");

        vi.advanceTimersByTime(3000);
        const updatedSession = session.withoutActiveQR();

        expect(updatedSession.updatedAt).toBe(mockNow + 3000);
      });
    });

    describe("completeRound()", () => {
      it("debe completar round y avanzar al siguiente", () => {
        const session = StudentSession.create(12345, "session-123", {
          maxRounds: 5,
        });

        const { session: updatedSession, isComplete } = session.completeRound({
          responseTime: 1200,
          validatedAt: mockNow,
          nonce: "nonce-1",
        });

        expect(updatedSession.currentRound).toBe(2);
        expect(updatedSession.roundsCompleted).toHaveLength(1);
        expect(updatedSession.roundsCompleted[0]).toEqual({
          round: 1,
          responseTime: 1200,
          validatedAt: mockNow,
          nonce: "nonce-1",
        });
        expect(updatedSession.status).toBe("active");
        expect(isComplete).toBe(false);
      });

      it("debe marcar como completed al terminar último round", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 5,
          maxRounds: 5,
          roundsCompleted: [
            {
              round: 1,
              responseTime: 1000,
              validatedAt: mockNow,
              nonce: "nonce1",
            },
            {
              round: 2,
              responseTime: 1200,
              validatedAt: mockNow,
              nonce: "nonce2",
            },
            {
              round: 3,
              responseTime: 1100,
              validatedAt: mockNow,
              nonce: "nonce3",
            },
            {
              round: 4,
              responseTime: 1300,
              validatedAt: mockNow,
              nonce: "nonce4",
            },
          ],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: "nonce-5",
          qrGeneratedAt: mockNow,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        const { session: updatedSession, isComplete } = session.completeRound({
          responseTime: 1150,
          validatedAt: mockNow,
          nonce: "nonce-5",
        });

        expect(updatedSession.currentRound).toBe(5);
        expect(updatedSession.roundsCompleted).toHaveLength(5);
        expect(updatedSession.status).toBe("completed");
        expect(isComplete).toBe(true);
      });

      it("debe limpiar QR activo al completar", () => {
        const session = StudentSession.create(
          12345,
          "session-123"
        ).withActiveQR("nonce-1");

        const { session: updatedSession } = session.completeRound({
          responseTime: 1200,
          validatedAt: mockNow,
          nonce: "nonce-1",
        });

        expect(updatedSession.activeQRNonce).toBeNull();
        expect(updatedSession.qrGeneratedAt).toBeNull();
      });

      it("debe retornar nueva instancia (inmutabilidad)", () => {
        const session = StudentSession.create(12345, "session-123");

        const { session: updatedSession } = session.completeRound({
          responseTime: 1200,
          validatedAt: mockNow,
          nonce: "nonce-1",
        });

        expect(updatedSession).not.toBe(session);
        expect(session.currentRound).toBe(1);
        expect(updatedSession.currentRound).toBe(2);
      });

      it("debe actualizar timestamp", () => {
        const session = StudentSession.create(12345, "session-123");

        vi.advanceTimersByTime(2000);
        const { session: updatedSession } = session.completeRound({
          responseTime: 1200,
          validatedAt: mockNow + 2000,
          nonce: "nonce-1",
        });

        expect(updatedSession.updatedAt).toBe(mockNow + 2000);
      });
    });

    describe("failRound()", () => {
      it("debe incrementar intento y resetear round si puede reintentar", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 3,
          maxRounds: 5,
          roundsCompleted: [
            {
              round: 1,
              responseTime: 1000,
              validatedAt: mockNow,
              nonce: "nonce1",
            },
            {
              round: 2,
              responseTime: 1200,
              validatedAt: mockNow,
              nonce: "nonce2",
            },
          ],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: "nonce-3",
          qrGeneratedAt: mockNow,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        const { session: updatedSession, canRetry } = session.failRound();

        expect(updatedSession.currentAttempt).toBe(2);
        expect(updatedSession.currentRound).toBe(1); // Reset
        expect(updatedSession.roundsCompleted).toEqual([]); // Limpiado
        expect(updatedSession.status).toBe("active");
        expect(canRetry).toBe(true);
      });

      it("debe marcar como failed si no quedan intentos", () => {
        const data: StudentSessionData = {
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 3,
          maxRounds: 5,
          roundsCompleted: [
            {
              round: 1,
              responseTime: 1000,
              validatedAt: mockNow,
              nonce: "nonce1",
            },
            {
              round: 2,
              responseTime: 1200,
              validatedAt: mockNow,
              nonce: "nonce2",
            },
          ],
          currentAttempt: 3,
          maxAttempts: 3,
          activeQRNonce: "nonce-3",
          qrGeneratedAt: mockNow,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        };
        const session = StudentSession.fromData(data);

        const { session: updatedSession, canRetry } = session.failRound();

        expect(updatedSession.currentAttempt).toBe(3); // No cambia
        expect(updatedSession.currentRound).toBe(3); // No cambia
        expect(updatedSession.roundsCompleted).toHaveLength(2); // No se limpia
        expect(updatedSession.status).toBe("failed");
        expect(canRetry).toBe(false);
      });

      it("debe limpiar QR activo", () => {
        const session = StudentSession.create(
          12345,
          "session-123"
        ).withActiveQR("nonce-1");

        const { session: updatedSession } = session.failRound();

        expect(updatedSession.activeQRNonce).toBeNull();
        expect(updatedSession.qrGeneratedAt).toBeNull();
      });

      it("debe retornar nueva instancia (inmutabilidad)", () => {
        const session = StudentSession.create(12345, "session-123");

        const { session: updatedSession } = session.failRound();

        expect(updatedSession).not.toBe(session);
        expect(session.currentAttempt).toBe(1);
        expect(updatedSession.currentAttempt).toBe(2);
      });

      it("debe actualizar timestamp", () => {
        const session = StudentSession.create(12345, "session-123");

        vi.advanceTimersByTime(1500);
        const { session: updatedSession } = session.failRound();

        expect(updatedSession.updatedAt).toBe(mockNow + 1500);
      });
    });
  });

  describe("Serialization", () => {
    describe("toData()", () => {
      it("debe convertir a plain object", () => {
        const session = StudentSession.create(12345, "session-123");
        const data = session.toData();

        expect(data).toEqual({
          studentId: 12345,
          sessionId: "session-123",
          currentRound: 1,
          maxRounds: 3,
          roundsCompleted: [],
          currentAttempt: 1,
          maxAttempts: 3,
          activeQRNonce: null,
          qrGeneratedAt: null,
          status: "active",
          registeredAt: mockNow,
          updatedAt: mockNow,
        });
      });

      it("debe ser un nuevo objeto (no referencia)", () => {
        const session = StudentSession.create(12345, "session-123");
        const data1 = session.toData();
        const data2 = session.toData();

        expect(data1).not.toBe(data2);
        expect(data1).toEqual(data2);
      });
    });

    describe("toJSON()", () => {
      it("debe convertir a JSON string", () => {
        const session = StudentSession.create(12345, "session-123");
        const json = session.toJSON();

        expect(typeof json).toBe("string");
        const parsed = JSON.parse(json);
        expect(parsed.studentId).toBe(12345);
        expect(parsed.sessionId).toBe("session-123");
      });

      it("debe ser parseable de vuelta a objeto", () => {
        const session = StudentSession.create(12345, "session-123");
        const json = session.toJSON();
        const parsed = JSON.parse(json) as StudentSessionData;
        const reconstructed = StudentSession.fromData(parsed);

        expect(reconstructed.studentId).toBe(session.studentId);
        expect(reconstructed.sessionId).toBe(session.sessionId);
        expect(reconstructed.currentRound).toBe(session.currentRound);
      });
    });
  });

  describe("Flujos completos", () => {
    it("debe completar sesión exitosamente con 3 rounds", () => {
      let session = StudentSession.create(12345, "session-123", {
        maxRounds: 3,
      });

      // Round 1
      session = session.withActiveQR("nonce-1");
      const result1 = session.completeRound({
        responseTime: 1000,
        validatedAt: mockNow,
        nonce: "nonce-1",
      });
      session = result1.session;
      expect(result1.isComplete).toBe(false);
      expect(session.currentRound).toBe(2);

      // Round 2
      session = session.withActiveQR("nonce-2");
      const result2 = session.completeRound({
        responseTime: 1200,
        validatedAt: mockNow,
        nonce: "nonce-2",
      });
      session = result2.session;
      expect(result2.isComplete).toBe(false);
      expect(session.currentRound).toBe(3);

      // Round 3 (último)
      session = session.withActiveQR("nonce-3");
      const result3 = session.completeRound({
        responseTime: 1100,
        validatedAt: mockNow,
        nonce: "nonce-3",
      });
      session = result3.session;
      expect(result3.isComplete).toBe(true);
      expect(session.status).toBe("completed");
      expect(session.roundsCompleted).toHaveLength(3);
    });

    it("debe fallar después de 3 intentos", () => {
      let session = StudentSession.create(12345, "session-123", {
        maxRounds: 5,
        maxAttempts: 3,
      });

      // Primer fallo - puede reintentar
      const fail1 = session.failRound();
      expect(fail1.canRetry).toBe(true);
      session = fail1.session;
      expect(session.currentAttempt).toBe(2);
      expect(session.status).toBe("active");

      // Segundo fallo - puede reintentar
      const fail2 = session.failRound();
      expect(fail2.canRetry).toBe(true);
      session = fail2.session;
      expect(session.currentAttempt).toBe(3);
      expect(session.status).toBe("active");

      // Tercer fallo - no puede reintentar
      const fail3 = session.failRound();
      expect(fail3.canRetry).toBe(false);
      session = fail3.session;
      expect(session.currentAttempt).toBe(3);
      expect(session.status).toBe("failed");
    });

    it("debe reiniciar progreso al fallar en round intermedio", () => {
      let session = StudentSession.create(12345, "session-123", {
        maxRounds: 5,
      });

      // Completar rounds 1 y 2
      session = session.withActiveQR("nonce-1");
      session = session.completeRound({
        responseTime: 1000,
        validatedAt: mockNow,
        nonce: "nonce-1",
      }).session;

      session = session.withActiveQR("nonce-2");
      session = session.completeRound({
        responseTime: 1200,
        validatedAt: mockNow,
        nonce: "nonce-2",
      }).session;

      expect(session.currentRound).toBe(3);
      expect(session.roundsCompleted).toHaveLength(2);

      // Fallar en round 3
      const { session: failedSession, canRetry } = session.failRound();

      expect(canRetry).toBe(true);
      expect(failedSession.currentRound).toBe(1); // Reset a round 1
      expect(failedSession.roundsCompleted).toEqual([]); // Progreso limpiado
      expect(failedSession.currentAttempt).toBe(2); // Incrementado
      expect(failedSession.status).toBe("active");
    });
  });
});
