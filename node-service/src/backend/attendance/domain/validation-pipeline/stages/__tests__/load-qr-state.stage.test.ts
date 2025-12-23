/**
 * Tests: Load QR State Stage
 *
 * Tests del stage de carga de estado QR desde Valkey/Redis.
 * Verifica la correcta carga de estados QR existentes, manejo de QRs inexistentes,
 * y propagación de errores de infraestructura.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLoadQRStateStage,
  type QRStateLoader,
} from "../load-qr-state.stage";
import type { ValidationContext, QRState } from "../../context";

describe("Load QR State Stage", () => {
  const createMockLoader = (): QRStateLoader => ({
    getState: vi.fn(),
  });

  const createContext = (
    overrides?: Partial<ValidationContext>
  ): ValidationContext => ({
    encrypted: "encrypted-data",
    studentId: 123,
    startedAt: Date.now(),
    trace: [],
    response: {
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
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLoadQRStateStage()", () => {
    it("debe crear stage con nombre correcto", () => {
      const loader = createMockLoader();
      const stage = createLoadQRStateStage(loader);

      expect(stage.name).toBe("loadQRState");
    });

    it("debe tener función execute", () => {
      const loader = createMockLoader();
      const stage = createLoadQRStateStage(loader);

      expect(typeof stage.execute).toBe("function");
    });
  });

  describe("execute()", () => {
    describe("Escenarios Exitosos", () => {
      it("debe cargar estado QR existente y no consumido", async () => {
        const loader = createMockLoader();
        const qrState: QRState = { exists: true, consumed: false };
        vi.mocked(loader.getState).mockResolvedValue(qrState);

        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();

        const result = await stage.execute(ctx);

        expect(result).toBe(true);
        expect(ctx.qrState).toEqual(qrState);
        expect(loader.getState).toHaveBeenCalledWith(
          "12345678901234567890123456789012"
        );
        expect(loader.getState).toHaveBeenCalledTimes(1);
      });

      it("debe cargar estado QR existente pero consumido", async () => {
        const loader = createMockLoader();
        const qrState: QRState = { exists: true, consumed: true };
        vi.mocked(loader.getState).mockResolvedValue(qrState);

        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();

        const result = await stage.execute(ctx);

        expect(result).toBe(true);
        expect(ctx.qrState).toEqual(qrState);
        expect(ctx.qrState?.consumed).toBe(true);
      });

      it('debe crear estado "no existe" si QR no encontrado', async () => {
        const loader = createMockLoader();
        vi.mocked(loader.getState).mockResolvedValue(null);

        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();

        const result = await stage.execute(ctx);

        expect(result).toBe(true);
        expect(ctx.qrState).toEqual({ exists: false, consumed: false });
        expect(loader.getState).toHaveBeenCalledTimes(1);
      });
    });

    describe("Casos Edge y Validaciones", () => {
      it("debe fallar si no hay response", async () => {
        const loader = createMockLoader();
        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();
        ctx.response = undefined;

        const result = await stage.execute(ctx);

        expect(result).toBe(false);
        expect(ctx.error).toEqual({
          code: "INTERNAL_ERROR",
          message: "No hay respuesta para cargar estado QR",
        });
      });

      it("debe usar nonce correcto del payload", async () => {
        const loader = createMockLoader();
        vi.mocked(loader.getState).mockResolvedValue({
          exists: true,
          consumed: false,
        });

        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();
        ctx.response!.original.n = "custom-nonce-1234567890123456789";

        await stage.execute(ctx);

        expect(loader.getState).toHaveBeenCalledWith(
          "custom-nonce-1234567890123456789"
        );
      });

      it("debe manejar estados con metadatos adicionales", async () => {
        const loader = createMockLoader();
        const qrState: QRState = {
          exists: true,
          consumed: true,
          consumedAt: Date.now(),
        };
        vi.mocked(loader.getState).mockResolvedValue(qrState);

        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();

        const result = await stage.execute(ctx);

        expect(result).toBe(true);
        expect(ctx.qrState).toEqual(qrState);
        expect(ctx.qrState?.consumedAt).toBeDefined();
      });

      it("debe permitir cargar múltiples QRs con estados diferentes", async () => {
        const loader = createMockLoader();
        const stage = createLoadQRStateStage(loader);

        vi.mocked(loader.getState).mockResolvedValue({
          exists: true,
          consumed: false,
        });
        const ctx1 = createContext();
        await stage.execute(ctx1);

        vi.mocked(loader.getState).mockResolvedValue({
          exists: true,
          consumed: true,
        });
        const ctx2 = createContext();
        await stage.execute(ctx2);

        expect(ctx1.qrState?.consumed).toBe(false);
        expect(ctx2.qrState?.consumed).toBe(true);
      });
    });

    describe("Manejo de Errores de Infraestructura", () => {
      it("debe propagar errores de conexión", async () => {
        const loader = createMockLoader();
        vi.mocked(loader.getState).mockRejectedValue(
          new Error("Connection refused")
        );

        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();

        await expect(stage.execute(ctx)).rejects.toThrow("Connection refused");
      });

      it("debe manejar timeout del loader", async () => {
        const loader = createMockLoader();
        vi.mocked(loader.getState).mockRejectedValue(new Error("Timeout"));

        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();

        await expect(stage.execute(ctx)).rejects.toThrow("Timeout");
      });
    });

    describe("Escenarios de Producción", () => {
      it("debe manejar QR recién generado", async () => {
        const loader = createMockLoader();
        const qrState: QRState = { exists: true, consumed: false };
        vi.mocked(loader.getState).mockResolvedValue(qrState);

        const stage = createLoadQRStateStage(loader);
        const ctx = createContext();
        ctx.response!.original.ts = Date.now() - 1000; // 1 segundo atrás

        const result = await stage.execute(ctx);

        expect(result).toBe(true);
        expect(ctx.qrState?.exists).toBe(true);
        expect(ctx.qrState?.consumed).toBe(false);
      });

      it("debe manejar carga concurrente del mismo nonce", async () => {
        const loader = createMockLoader();
        const qrState: QRState = { exists: true, consumed: false };
        vi.mocked(loader.getState).mockResolvedValue(qrState);

        const stage = createLoadQRStateStage(loader);
        const nonce = "concurrent-test-nonce-12345678901";

        const ctx1 = createContext();
        const ctx2 = createContext();
        ctx1.response!.original.n = nonce;
        ctx2.response!.original.n = nonce;

        // Ejecutar concurrentemente
        await Promise.all([stage.execute(ctx1), stage.execute(ctx2)]);

        expect(loader.getState).toHaveBeenCalledTimes(2);
        expect(loader.getState).toHaveBeenCalledWith(nonce);
      });
    });
  });
});
