/**
 * Tests: Validation Pipeline Context
 */
import { describe, it, expect } from "vitest";
import {
  createContext,
  hasError,
  isValid,
  type ValidationContext,
  type ValidationError,
  type StudentResponse,
} from "../context";

describe("Validation Pipeline Context", () => {
  describe("createContext()", () => {
    it("debe crear contexto con valores iniciales", () => {
      const ctx = createContext("encrypted-data", 456);

      expect(ctx.encrypted).toBe("encrypted-data");
      expect(ctx.studentId).toBe(456);
      expect(ctx.startedAt).toBeGreaterThan(0);
      expect(ctx.trace).toEqual([]);
    });

    it("debe generar timestamp actual", () => {
      const before = Date.now();
      const ctx = createContext("data", 123);
      const after = Date.now();

      expect(ctx.startedAt).toBeGreaterThanOrEqual(before);
      expect(ctx.startedAt).toBeLessThanOrEqual(after);
    });

    it("debe crear trace vacío", () => {
      const ctx = createContext("data", 123);

      expect(Array.isArray(ctx.trace)).toBe(true);
      expect(ctx.trace.length).toBe(0);
    });

    it("no debe incluir response inicialmente", () => {
      const ctx = createContext("data", 123);

      expect(ctx.response).toBeUndefined();
    });

    it("no debe incluir error inicialmente", () => {
      const ctx = createContext("data", 123);

      expect(ctx.error).toBeUndefined();
    });

    it("no debe incluir qrState inicialmente", () => {
      const ctx = createContext("data", 123);

      expect(ctx.qrState).toBeUndefined();
    });

    it("no debe incluir studentState inicialmente", () => {
      const ctx = createContext("data", 123);

      expect(ctx.studentState).toBeUndefined();
    });

    it("debe manejar diferentes encrypted strings", () => {
      const ctx1 = createContext("encrypted-1", 123);
      const ctx2 = createContext("encrypted-2", 123);

      expect(ctx1.encrypted).not.toBe(ctx2.encrypted);
    });

    it("debe manejar diferentes studentIds", () => {
      const ctx1 = createContext("data", 100);
      const ctx2 = createContext("data", 200);

      expect(ctx1.studentId).toBe(100);
      expect(ctx2.studentId).toBe(200);
    });
  });

  describe("hasError()", () => {
    it("debe retornar false para contexto sin error", () => {
      const ctx = createContext("data", 123);

      expect(hasError(ctx)).toBe(false);
    });

    it("debe retornar true para contexto con error", () => {
      const ctx = createContext("data", 123);
      ctx.error = {
        code: "TEST_ERROR",
        message: "Test error message",
      };

      expect(hasError(ctx)).toBe(true);
    });

    it("debe detectar cualquier error", () => {
      const ctx = createContext("data", 123);
      ctx.error = {
        code: "PAYLOAD_EXPIRED",
        message: "QR expirado",
      };

      expect(hasError(ctx)).toBe(true);
    });

    it("debe retornar false si error es undefined", () => {
      const ctx: ValidationContext = {
        encrypted: "data",
        studentId: 123,
        startedAt: Date.now(),
        trace: [],
        error: undefined,
      };

      expect(hasError(ctx)).toBe(false);
    });
  });

  describe("isValid()", () => {
    it("debe retornar false para contexto recién creado", () => {
      const ctx = createContext("data", 123);

      expect(isValid(ctx)).toBe(false);
    });

    it("debe retornar false si tiene error", () => {
      const ctx = createContext("data", 123);
      ctx.error = {
        code: "TEST_ERROR",
        message: "Error de prueba",
      };

      expect(isValid(ctx)).toBe(false);
    });

    it("debe retornar false si no tiene response", () => {
      const ctx = createContext("data", 123);
      // Sin error pero sin response

      expect(isValid(ctx)).toBe(false);
    });

    it("debe retornar true si tiene response y no tiene error", () => {
      const ctx = createContext("data", 123);
      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: 123,
        receivedAt: Date.now(),
      };

      expect(isValid(ctx)).toBe(true);
    });

    it("debe retornar false si tiene response pero también error", () => {
      const ctx = createContext("data", 123);
      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: 123,
        receivedAt: Date.now(),
      };
      ctx.error = {
        code: "TEST_ERROR",
        message: "Error después de response",
      };

      expect(isValid(ctx)).toBe(false);
    });
  });

  describe("Context mutability", () => {
    it("debe permitir agregar response", () => {
      const ctx = createContext("data", 123);

      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: 123,
        receivedAt: Date.now(),
      };

      expect(ctx.response).toBeDefined();
    });

    it("debe permitir agregar qrState", () => {
      const ctx = createContext("data", 123);

      ctx.qrState = {
        exists: true,
        consumed: false,
      };

      expect(ctx.qrState).toBeDefined();
      expect(ctx.qrState?.exists).toBe(true);
    });

    it("debe permitir agregar studentState", () => {
      const ctx = createContext("data", 123);

      ctx.studentState = {
        registered: true,
        status: "active",
        currentRound: 1,
        activeNonce: "nonce-123",
        roundsCompleted: [],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      };

      expect(ctx.studentState).toBeDefined();
    });

    it("debe permitir agregar entradas al trace", () => {
      const ctx = createContext("data", 123);

      ctx.trace.push({
        stage: "test-stage",
        passed: true,
        durationMs: 5,
      });

      expect(ctx.trace.length).toBe(1);
      expect(ctx.trace[0].stage).toBe("test-stage");
    });

    it("debe permitir agregar error", () => {
      const ctx = createContext("data", 123);

      ctx.error = {
        code: "VALIDATION_FAILED",
        message: "Validación falló",
      };

      expect(ctx.error).toBeDefined();
      expect(ctx.error?.code).toBe("VALIDATION_FAILED");
    });

    it("debe permitir agregar failedAt", () => {
      const ctx = createContext("data", 123);

      ctx.failedAt = "decrypt";

      expect(ctx.failedAt).toBe("decrypt");
    });
  });
});
