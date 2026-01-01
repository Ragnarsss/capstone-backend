/**
 * Tests: Validate Structure Stage
 */
import { describe, it, expect, beforeEach } from "vitest";
import { validateStructureStage } from "../validate-structure.stage";
import type { ValidationContext, StudentResponse } from "../../context";

describe("validateStructureStage", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      response: undefined,
      error: undefined,
    } as ValidationContext;
  });

  describe("execute()", () => {
    it("debe fallar si no hay respuesta en contexto", () => {
      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: "INTERNAL_ERROR",
        message: "No hay respuesta para validar",
      });
    });

    it("debe validar respuesta con estructura correcta", () => {
      const response: StudentResponse = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012", // 32 chars hex
        },
        studentId: 456,
        receivedAt: Date.now(),
      };

      ctx.response = response;

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(true);
      expect(ctx.error).toBeUndefined();
    });

    it("debe fallar si response no es objeto", () => {
      ctx.response = "string-invalid" as any;

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INVALID_FORMAT");
      expect(ctx.error?.message).toBe("Estructura de respuesta invalida");
    });

    it("debe fallar si response es null", () => {
      ctx.response = null as any;

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INTERNAL_ERROR"); // null es tratado como "no hay respuesta"
    });

    it("debe fallar si falta original", () => {
      ctx.response = {
        studentId: 456,
        receivedAt: Date.now(),
      } as any;

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INVALID_FORMAT");
    });

    it("debe fallar si falta studentId", () => {
      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        receivedAt: Date.now(),
      } as any;

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INVALID_FORMAT");
    });

    it("debe fallar si studentId no es número", () => {
      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: "456" as any,
        receivedAt: Date.now(),
      } as any;

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INVALID_FORMAT");
    });

    it("debe fallar si falta receivedAt", () => {
      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        },
        studentId: 456,
      } as any;

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INVALID_FORMAT");
    });

    it("debe fallar si payload original no tiene versión", () => {
      ctx.response = {
        original: {
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012",
        } as any,
        studentId: 456,
        receivedAt: Date.now(),
      };

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INVALID_FORMAT");
      expect(ctx.error?.message).toBe(
        "Estructura de payload original invalida"
      );
    });

    it("debe fallar si payload original tiene campos faltantes", () => {
      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          // Falta uid, r, ts, n
        } as any,
        studentId: 456,
        receivedAt: Date.now(),
      };

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INVALID_FORMAT");
    });

    it("debe validar payload con campos válidos", () => {
      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "12345678901234567890123456789012", // 32 chars
        },
        studentId: 456,
        receivedAt: Date.now(),
      };

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(true);
    });

    it("debe fallar si nonce tiene longitud incorrecta", () => {
      ctx.response = {
        original: {
          v: 1,
          sid: "session-123",
          uid: 456,
          r: 1,
          ts: Date.now(),
          n: "short-nonce", // Menos de 32 chars
        } as any,
        studentId: 456,
        receivedAt: Date.now(),
      };

      const result = validateStructureStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error?.code).toBe("INVALID_FORMAT");
    });
  });
});
