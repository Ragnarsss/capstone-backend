/**
 * Tests: Pool Balancer Adapter
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PoolBalancerAdapter } from "../pool-balancer.adapter";
import type { AesGcmService } from "../../../../../shared/infrastructure/crypto";
import type { ProjectionPoolRepository } from "../../../../../shared/infrastructure/valkey";
import type { PoolBalancerConfig } from "../../../../../shared/ports";

describe("PoolBalancerAdapter", () => {
  let adapter: PoolBalancerAdapter;
  let mockAesService: AesGcmService;
  let mockPoolRepo: ProjectionPoolRepository;

  beforeEach(() => {
    mockAesService = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      encryptToPayload: vi
        .fn()
        .mockReturnValue({ encrypted: "data", iv: "iv" }),
    } as unknown as AesGcmService;

    mockPoolRepo = {
      getNextEntry: vi.fn(),
      addEntry: vi.fn(),
      upsertEntry: vi.fn(),
      getPoolStats: vi.fn().mockResolvedValue({
        total: 0,
        real: 0,
        fake: 0,
        students: 0,
      }),
      addFakeQRs: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProjectionPoolRepository;

    adapter = new PoolBalancerAdapter(mockAesService, mockPoolRepo);
  });

  describe("balance()", () => {
    it("debe delegar al pool balancer", async () => {
      const sessionId = "session-123";

      await adapter.balance(sessionId);

      expect(mockPoolRepo.getPoolStats).toHaveBeenCalledWith(sessionId);
    });
  });

  describe("injectFakes()", () => {
    it("debe delegar al pool balancer", async () => {
      const sessionId = "session-123";

      await adapter.injectFakes(sessionId, 5);

      expect(mockPoolRepo.addFakeQRs).toHaveBeenCalled();
    });
  });

  describe("getPoolStats()", () => {
    it("debe delegar al pool balancer", async () => {
      const sessionId = "session-123";

      await adapter.getPoolStats(sessionId);

      expect(mockPoolRepo.getPoolStats).toHaveBeenCalledWith(sessionId);
    });
  });

  describe("calculateFakesNeeded()", () => {
    it("debe calcular fakes necesarios", () => {
      const result = adapter.calculateFakesNeeded(3);

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("debe manejar cero QRs reales", () => {
      const result = adapter.calculateFakesNeeded(0);

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("debe manejar muchos QRs reales", () => {
      const result = adapter.calculateFakesNeeded(100);

      expect(typeof result).toBe("number");
    });
  });

  describe("getConfig()", () => {
    it("debe retornar configuración actual", () => {
      const config = adapter.getConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty("minPoolSize");
      expect(typeof config.minPoolSize).toBe("number");
    });

    it("debe retornar valores válidos", () => {
      const config = adapter.getConfig();

      expect(config.minPoolSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe("updateConfig()", () => {
    it("debe actualizar minPoolSize", () => {
      const newConfig: Partial<PoolBalancerConfig> = {
        minPoolSize: 50,
      };

      adapter.updateConfig(newConfig);

      const config = adapter.getConfig();
      expect(config.minPoolSize).toBe(50);
    });

    it("debe manejar config vacío", () => {
      const originalConfig = adapter.getConfig();

      adapter.updateConfig({});

      const newConfig = adapter.getConfig();
      expect(newConfig).toEqual(originalConfig);
    });
  });
});
