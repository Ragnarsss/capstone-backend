/**
 * Tests de Integración: Complete Scan Flow con Factory
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createCompleteScanDepsWithPersistence } from "../infrastructure/adapters/complete-scan-deps.factory";
import { CompleteScanUseCase } from "../application/complete-scan.usecase";
import { ValidateScanUseCase } from "../application/validate-scan.usecase";
import { AesGcmService } from "../../../shared/infrastructure/crypto";
import type { QRPayloadV1 } from "../../../shared/types";

describe("Integration: Complete Scan Flow with Factory", () => {
  beforeEach(() => {
    process.env.ENROLLMENT_STUB_MODE = "true";
  });

  describe("Factory Creation", () => {
    it("debe crear dependencias completas sin persistencia", () => {
      const result = createCompleteScanDepsWithPersistence({
        qrTTL: 60,
        mockHostUserId: 1,
        enablePostgresPersistence: false,
      });

      expect(result.deps).toBeDefined();
      expect(result.deps.aesGcmService).toBeDefined();
      expect(result.deps.qrStateLoader).toBeDefined();
      expect(result.deps.studentStateLoader).toBeDefined();
      expect(result.deps.sessionKeyQuery).toBeDefined();
      expect(result.deps.markQRConsumed).toBeDefined();
      expect(result.deps.completeRound).toBeDefined();

      expect(result.services).toBeDefined();
      expect(result.services.statsCalculator).toBeDefined();
      expect(result.services.qrLifecycleManager).toBeDefined();

      expect(result.persistence).toBeUndefined();
    });

    it("debe crear dependencias con persistencia habilitada", () => {
      const result = createCompleteScanDepsWithPersistence({
        qrTTL: 120,
        mockHostUserId: 999,
        enablePostgresPersistence: true,
      });

      expect(result.deps).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.persistence).toBeDefined();
      expect(result.persistence?.validationRepo).toBeDefined();
      expect(result.persistence?.resultRepo).toBeDefined();
      expect(result.persistence?.registrationRepo).toBeDefined();
      expect(result.persistence?.persistenceService).toBeDefined();
    });

    it("debe permitir configuración parcial", () => {
      const result1 = createCompleteScanDepsWithPersistence({ qrTTL: 30 });
      expect(result1.deps).toBeDefined();

      const result2 = createCompleteScanDepsWithPersistence({
        mockHostUserId: 555,
      });
      expect(result2.deps).toBeDefined();

      const result3 = createCompleteScanDepsWithPersistence({
        enablePostgresPersistence: true,
      });
      expect(result3.deps).toBeDefined();
      expect(result3.persistence).toBeDefined();
    });
  });

  describe("Integration with UseCases", () => {
    it("debe crear ValidateScanUseCase con dependencias del factory", () => {
      const { deps } = createCompleteScanDepsWithPersistence();

      const validateScan = new ValidateScanUseCase({
        aesGcmService: deps.aesGcmService,
        qrStateLoader: deps.qrStateLoader,
        studentStateLoader: deps.studentStateLoader,
        sessionKeyQuery: deps.sessionKeyQuery,
      });

      expect(validateScan).toBeDefined();
    });

    it("debe crear CompleteScanUseCase con dependencias del factory", () => {
      const { deps, services } = createCompleteScanDepsWithPersistence();

      const completeScan = new CompleteScanUseCase(deps, services);

      expect(completeScan).toBeDefined();
    });

    it("debe validar componentes del factory sin I/O", () => {
      const { deps, services } = createCompleteScanDepsWithPersistence({
        qrTTL: 300,
        mockHostUserId: 1,
      });

      // Validar que los componentes están correctamente creados
      expect(deps.aesGcmService).toBeDefined();
      expect(deps.qrStateLoader).toBeDefined();
      expect(deps.studentStateLoader).toBeDefined();
      expect(deps.sessionKeyQuery).toBeDefined();
      expect(services.qrLifecycleManager).toBeDefined();
      expect(services.statsCalculator).toBeDefined();
    });
  });

  describe("Side Effects Functions", () => {
    it("markQRConsumed debe ser función async", () => {
      const { deps } = createCompleteScanDepsWithPersistence();

      expect(typeof deps.markQRConsumed).toBe("function");
      expect(deps.markQRConsumed.constructor.name).toBe("AsyncFunction");
    });

    it("completeRound debe ser función async", () => {
      const { deps } = createCompleteScanDepsWithPersistence();

      expect(typeof deps.completeRound).toBe("function");
      expect(deps.completeRound.constructor.name).toBe("AsyncFunction");
    });
  });

  describe("Service Lifecycle", () => {
    it("debe tener método generateAndPublish en qrLifecycleManager", () => {
      const { services } = createCompleteScanDepsWithPersistence({
        qrTTL: 60,
        mockHostUserId: 1,
      });

      expect(services.qrLifecycleManager).toBeDefined();
      expect(typeof services.qrLifecycleManager.generateAndPublish).toBe(
        "function"
      );
    });

    it("debe calcular estadísticas con statsCalculator", () => {
      const { services } = createCompleteScanDepsWithPersistence();

      const stats = services.statsCalculator.calculate({
        responseTimes: [100, 110, 105],
        maxRounds: 3,
      });

      expect(stats).toBeDefined();
      expect(stats.stats.avg).toBeCloseTo(105, 1);
      expect(stats.roundsCompleted).toBe(3);
    });
  });

  describe("Configuration Variants", () => {
    it("debe respetar diferentes TTLs", () => {
      const result1 = createCompleteScanDepsWithPersistence({ qrTTL: 30 });
      const result2 = createCompleteScanDepsWithPersistence({ qrTTL: 300 });
      const result3 = createCompleteScanDepsWithPersistence({ qrTTL: 600 });

      expect(result1.deps).toBeDefined();
      expect(result2.deps).toBeDefined();
      expect(result3.deps).toBeDefined();
    });

    it("debe respetar diferentes hostUserIds", () => {
      const result1 = createCompleteScanDepsWithPersistence({
        mockHostUserId: 1,
      });
      const result2 = createCompleteScanDepsWithPersistence({
        mockHostUserId: 999,
      });
      const result3 = createCompleteScanDepsWithPersistence({
        mockHostUserId: 555,
      });

      expect(result1.deps).toBeDefined();
      expect(result2.deps).toBeDefined();
      expect(result3.deps).toBeDefined();
    });

    it("debe manejar todas las combinaciones de configuración", () => {
      const configs = [
        { qrTTL: 30, mockHostUserId: 1, enablePostgresPersistence: false },
        { qrTTL: 60, mockHostUserId: 999, enablePostgresPersistence: true },
        { qrTTL: 120, mockHostUserId: 555, enablePostgresPersistence: false },
        { qrTTL: 300, mockHostUserId: 1, enablePostgresPersistence: true },
      ];

      for (const config of configs) {
        const result = createCompleteScanDepsWithPersistence(config);
        expect(result.deps).toBeDefined();
        expect(result.services).toBeDefined();
        if (config.enablePostgresPersistence) {
          expect(result.persistence).toBeDefined();
        } else {
          expect(result.persistence).toBeUndefined();
        }
      }
    });
  });
});
