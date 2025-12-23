/**
 * Tests: Validate QR Stage
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  validateQRNotExpiredStage,
  validateQRNotConsumedStage,
} from "../validate-qr.stage";
import type { ValidationContext, QRState } from "../../context";

describe("validateQRNotExpiredStage", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      qrState: undefined,
      error: undefined,
    } as ValidationContext;
  });

  describe("execute()", () => {
    it("debe fallar si no hay qrState en contexto", () => {
      const result = validateQRNotExpiredStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: "INTERNAL_ERROR",
        message: "No hay estado QR cargado",
      });
    });

    it("debe validar QR que existe", () => {
      const qrState: QRState = {
        exists: true,
        consumed: false,
      };

      ctx.qrState = qrState;

      const result = validateQRNotExpiredStage.execute(ctx);

      expect(result).toBe(true);
      expect(ctx.error).toBeUndefined();
    });

    it("debe fallar si QR no existe (expirado)", () => {
      const qrState: QRState = {
        exists: false,
        consumed: false,
      };

      ctx.qrState = qrState;

      const result = validateQRNotExpiredStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: "PAYLOAD_EXPIRED",
        message: "El codigo QR ha expirado o no es valido",
      });
    });

    it("debe permitir QR que existe aunque esté consumido", () => {
      const qrState: QRState = {
        exists: true,
        consumed: true, // El stage solo valida existencia
      };

      ctx.qrState = qrState;

      const result = validateQRNotExpiredStage.execute(ctx);

      expect(result).toBe(true);
    });
  });
});

describe("validateQRNotConsumedStage", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      qrState: undefined,
      error: undefined,
    } as ValidationContext;
  });

  describe("execute()", () => {
    it("debe fallar si no hay qrState en contexto", () => {
      const result = validateQRNotConsumedStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: "INTERNAL_ERROR",
        message: "No hay estado QR cargado",
      });
    });

    it("debe validar QR no consumido", () => {
      const qrState: QRState = {
        exists: true,
        consumed: false,
      };

      ctx.qrState = qrState;

      const result = validateQRNotConsumedStage.execute(ctx);

      expect(result).toBe(true);
      expect(ctx.error).toBeUndefined();
    });

    it("debe fallar si QR ya fue consumido", () => {
      const qrState: QRState = {
        exists: true,
        consumed: true,
      };

      ctx.qrState = qrState;

      const result = validateQRNotConsumedStage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: "PAYLOAD_ALREADY_CONSUMED",
        message: "Este codigo QR ya fue escaneado",
      });
    });

    it("debe validar QR no consumido aunque no exista", () => {
      const qrState: QRState = {
        exists: false,
        consumed: false, // El stage solo valida consumo
      };

      ctx.qrState = qrState;

      const result = validateQRNotConsumedStage.execute(ctx);

      expect(result).toBe(true);
    });
  });
});
