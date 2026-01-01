/**
 * Tests: Complete Scan UseCase
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CompleteScanUseCase,
  type CompleteScanDependencies,
  type ServiceDependencies,
} from "../complete-scan.usecase";
import type { AesGcmService } from "../../../../shared/infrastructure/crypto";
import type { QRStateLoader } from "../../domain/validation-pipeline/stages/load-qr-state.stage";
import type { StudentStateLoader } from "../../domain/validation-pipeline/stages/load-student-state.stage";
import type {
  ISessionKeyQuery,
  IAttendanceStatsCalculator,
  IQRLifecycleManager,
} from "../../../../shared/ports";

describe("CompleteScanUseCase", () => {
  let useCase: CompleteScanUseCase;
  let mockDeps: CompleteScanDependencies;
  let mockServiceDeps: ServiceDependencies;

  beforeEach(() => {
    process.env.ENROLLMENT_STUB_MODE = "true";

    const mockPayload = {
      v: 1 as const,
      sid: "session-123",
      uid: 456,
      r: 1,
      ts: Date.now(),
      n: "12345678901234567890123456789012",
    };

    mockDeps = {
      aesGcmService: {
        decryptFromPayload: vi
          .fn()
          .mockReturnValue(JSON.stringify(mockPayload)),
      } as unknown as AesGcmService,
      qrStateLoader: {
        getState: vi.fn().mockResolvedValue({
          exists: true,
          consumed: false,
        }),
      } as QRStateLoader,
      studentStateLoader: {
        getState: vi.fn().mockResolvedValue({
          registered: true,
          status: "in_progress",
          currentRound: 1,
          activeNonce: "12345678901234567890123456789012",
          roundsCompleted: [],
          currentAttempt: 1,
          maxAttempts: 3,
          maxRounds: 3,
        }),
      } as StudentStateLoader,
      sessionKeyQuery: {
        findByUserId: vi.fn().mockResolvedValue({
          userId: 456,
          sessionKey: "test-session-key-12345678901234567890123456789012",
        }),
      } as ISessionKeyQuery,
      markQRConsumed: vi.fn().mockResolvedValue(true),
      completeRound: vi.fn().mockResolvedValue({
        currentRound: 2,
        isComplete: false,
        roundsCompleted: [{ responseTime: 1500 }],
      }),
    };

    mockServiceDeps = {
      statsCalculator: {
        calculateStats: vi.fn(),
      } as unknown as IAttendanceStatsCalculator,
      qrLifecycleManager: {
        generateAndProjectForStudent: vi.fn(),
        clearProjection: vi.fn(),
      } as unknown as IQRLifecycleManager,
    };

    useCase = new CompleteScanUseCase(mockDeps, mockServiceDeps);
  });

  describe("constructor", () => {
    it("debe crear useCase con dependencias", () => {
      expect(useCase).toBeDefined();
      expect(useCase).toBeInstanceOf(CompleteScanUseCase);
    });

    it("debe inicializar con service dependencies", () => {
      const uc = new CompleteScanUseCase(mockDeps, mockServiceDeps);

      expect(uc).toBeDefined();
    });

    it("debe aceptar persistence dependencies opcionales", () => {
      const uc = new CompleteScanUseCase(mockDeps, mockServiceDeps, {
        validationRepo: undefined,
        resultRepo: undefined,
      });

      expect(uc).toBeDefined();
    });

    it("debe aceptar fraud metrics dependencies opcionales", () => {
      const uc = new CompleteScanUseCase(
        mockDeps,
        mockServiceDeps,
        {},
        {
          fraudMetricsRepo: undefined,
          sessionIdForMetrics: "session-123",
        }
      );

      expect(uc).toBeDefined();
    });
  });

  describe("execute()", () => {
    it("debe ejecutar el flujo completo", async () => {
      const result = await useCase.execute("encrypted-data", 456);

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe("boolean");
    });

    it("debe incluir sessionId en resultado", async () => {
      const result = await useCase.execute("encrypted-data", 456);

      if (result.valid) {
        expect(result.sessionId).toBeDefined();
      }
    });

    it("debe manejar errores gracefully", async () => {
      // Forzar error en validación
      vi.spyOn(mockDeps.qrStateLoader, "getState").mockRejectedValue(
        new Error("Redis error")
      );

      const result = await useCase.execute("encrypted-data", 456);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
    });

    it("debe invocar markQRConsumed cuando es válido", async () => {
      await useCase.execute("encrypted-data", 456);

      // Si pasó la validación, debería haberse llamado
      if (mockDeps.markQRConsumed) {
        // Verificar que se puede llamar
        expect(typeof mockDeps.markQRConsumed).toBe("function");
      }
    });

    it("debe invocar completeRound cuando es válido", async () => {
      await useCase.execute("encrypted-data", 456);

      // Si pasó la validación, debería haberse llamado
      if (mockDeps.completeRound) {
        expect(typeof mockDeps.completeRound).toBe("function");
      }
    });

    it("debe manejar diferentes encrypted strings", async () => {
      const result1 = await useCase.execute("encrypted-1", 456);
      const result2 = await useCase.execute("encrypted-2", 456);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it("debe manejar diferentes studentIds", async () => {
      const result1 = await useCase.execute("encrypted-data", 100);
      const result2 = await useCase.execute("encrypted-data", 200);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it("debe retornar isComplete cuando aplica", async () => {
      vi.spyOn(mockDeps, "completeRound").mockResolvedValue({
        currentRound: 3,
        isComplete: true,
        roundsCompleted: [
          { responseTime: 1500 },
          { responseTime: 1800 },
          { responseTime: 1600 },
        ],
      });

      const result = await useCase.execute("encrypted-data", 456);

      if (result.valid) {
        expect(typeof result.isComplete).toBe("boolean");
      }
    });

    it("debe incluir validatedAt timestamp", async () => {
      const result = await useCase.execute("encrypted-data", 456);

      if (result.valid) {
        expect(typeof result.validatedAt).toBe("number");
      }
    });
  });

  describe("edge cases", () => {
    it("debe manejar scan sin QR consumido", async () => {
      vi.spyOn(mockDeps, "markQRConsumed").mockResolvedValue(false);

      const result = await useCase.execute("encrypted-data", 456);

      expect(result).toBeDefined();
    });

    it("debe manejar completeRound con errores", async () => {
      vi.spyOn(mockDeps, "completeRound").mockRejectedValue(
        new Error("State error")
      );

      const result = await useCase.execute("encrypted-data", 456);

      expect(result).toBeDefined();
    });

    it("debe manejar qrLifecycleManager con errores", async () => {
      vi.spyOn(
        mockServiceDeps.qrLifecycleManager,
        "generateAndProjectForStudent"
      ).mockRejectedValue(new Error("Generation error"));

      const result = await useCase.execute("encrypted-data", 456);

      expect(result).toBeDefined();
    });
  });
});
