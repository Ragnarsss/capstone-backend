/**
 * Tests: Validate Ownership Stage
 */
import { describe, it, expect, beforeEach } from "vitest";
import { validateOwnershipStage } from "../validate-ownership.stage";
import type { ValidationContext, StudentResponse } from "../../context";

describe("validateOwnershipStage", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      studentId: 456,
      response: undefined,
      error: undefined,
    } as ValidationContext;
  });

  describe("execute()", () => {
    it("debe fallar si no hay respuesta en contexto", () => {
      const result = validateOwnershipStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: "INTERNAL_ERROR",
        message: "No hay respuesta para validar",
      });
    });

    it("debe validar cuando studentId coincide", () => {
      const response: StudentResponse = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 789,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: 456,
        receivedAt: Date.now(),
      };

      ctx.response = response;

      const result = validateOwnershipStage.execute(ctx);

      expect(result).toBe(true);
      expect(ctx.error).toBeUndefined();
    });

    it("debe fallar cuando studentId no coincide", () => {
      const response: StudentResponse = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 789,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: 999, // Diferente de 456
        receivedAt: Date.now(),
      };

      ctx.response = response;

      const result = validateOwnershipStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: "USER_MISMATCH",
        message: "ID de estudiante no coincide",
      });
    });

    it("debe manejar studentId en cero", () => {
      ctx.studentId = 0;

      const response: StudentResponse = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 789,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: 0,
        receivedAt: Date.now(),
      };

      ctx.response = response;

      const result = validateOwnershipStage.execute(ctx);

      expect(result).toBe(true);
    });

    it("debe ser estricto con comparación de tipos", () => {
      ctx.studentId = 456;

      const response: StudentResponse = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 789,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: 456,
        receivedAt: Date.now(),
      };

      ctx.response = response;

      const result = validateOwnershipStage.execute(ctx);

      expect(result).toBe(true);
    });
  });
});
