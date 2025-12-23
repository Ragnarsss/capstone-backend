/**
 * Tests: Pipeline Factory
 */
import { describe, it, expect, vi } from "vitest";
import {
  createDefaultPipeline,
  createMinimalPipeline,
  createCustomPipeline,
  type PipelineDependencies,
  type MinimalPipelineDependencies,
} from "../pipeline.factory";
import type { AesGcmService } from "../../../../../shared/infrastructure/crypto";
import type { QRStateLoader } from "../stages/load-qr-state.stage";
import type { StudentStateLoader } from "../stages/load-student-state.stage";
import type { ISessionKeyQuery } from "../../../../../shared/ports";

describe("Pipeline Factory", () => {
  let mockAesService: AesGcmService;
  let mockQRStateLoader: QRStateLoader;
  let mockStudentStateLoader: StudentStateLoader;
  let mockSessionKeyQuery: ISessionKeyQuery;
  let deps: PipelineDependencies;

  beforeEach(() => {
    mockAesService = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      decryptToPayload: vi.fn(),
    } as unknown as AesGcmService;

    mockQRStateLoader = {
      getState: vi.fn(),
    } as QRStateLoader;

    mockStudentStateLoader = {
      getState: vi.fn(),
    } as StudentStateLoader;

    mockSessionKeyQuery = {
      findByUserId: vi.fn(),
    } as ISessionKeyQuery;

    deps = {
      aesGcmService: mockAesService,
      qrStateLoader: mockQRStateLoader,
      studentStateLoader: mockStudentStateLoader,
      sessionKeyQuery: mockSessionKeyQuery,
    };
  });

  describe("createDefaultPipeline()", () => {
    it("debe crear pipeline con todos los stages", () => {
      const pipeline = createDefaultPipeline(deps);

      expect(pipeline).toBeDefined();
      expect(Array.isArray(pipeline)).toBe(true);
      expect(pipeline.length).toBeGreaterThan(0);
    });

    it("debe incluir stages de desencriptación", () => {
      const pipeline = createDefaultPipeline(deps);

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toContain("decrypt");
    });

    it("debe incluir stages de validación de estructura", () => {
      const pipeline = createDefaultPipeline(deps);

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toContain("validateStructure");
      expect(stageNames).toContain("validateOwnership");
    });

    it("debe incluir stages de validación de QR", () => {
      const pipeline = createDefaultPipeline(deps);

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toContain("loadQRState");
      expect(stageNames).toContain("validateQRNotExpired");
      expect(stageNames).toContain("validateQRNotConsumed");
    });

    it("debe incluir stages de validación de estudiante", () => {
      const pipeline = createDefaultPipeline(deps);

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toContain("loadStudentState");
      expect(stageNames).toContain("validateStudentRegistered");
      expect(stageNames).toContain("validateStudentActive");
      expect(stageNames).toContain("validateStudentOwnsQR");
      expect(stageNames).toContain("validateRoundMatch");
    });

    it("debe incluir stage de validación TOTP", () => {
      const pipeline = createDefaultPipeline(deps);

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toContain("totp-validation");
    });

    it("debe tener al menos 12 stages", () => {
      const pipeline = createDefaultPipeline(deps);

      expect(pipeline.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe("createMinimalPipeline()", () => {
    let minimalDeps: MinimalPipelineDependencies;

    beforeEach(() => {
      minimalDeps = {
        aesGcmService: mockAesService,
        sessionKeyQuery: mockSessionKeyQuery,
      };
    });

    it("debe crear pipeline con stages mínimos", () => {
      const pipeline = createMinimalPipeline(minimalDeps);

      expect(pipeline).toBeDefined();
      expect(Array.isArray(pipeline)).toBe(true);
    });

    it("debe tener exactamente 3 stages", () => {
      const pipeline = createMinimalPipeline(minimalDeps);

      expect(pipeline.length).toBe(3);
    });

    it("debe incluir solo decrypt, structure y ownership", () => {
      const pipeline = createMinimalPipeline(minimalDeps);

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toEqual([
        "decrypt",
        "validateStructure",
        "validateOwnership",
      ]);
    });

    it("no debe incluir stages de carga de estado", () => {
      const pipeline = createMinimalPipeline(minimalDeps);

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).not.toContain("loadQRState");
      expect(stageNames).not.toContain("loadStudentState");
    });
  });

  describe("createCustomPipeline()", () => {
    it("debe crear pipeline sin exclusiones por defecto", () => {
      const pipeline = createCustomPipeline(deps);

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toContain("validateQRNotExpired");
      expect(stageNames).toContain("validateQRNotConsumed");
      expect(stageNames).toContain("validateStudentActive");
    });

    it("debe excluir validateQRNotExpired", () => {
      const pipeline = createCustomPipeline(deps, {
        exclude: ["validateQRNotExpired"],
      });

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).not.toContain("validateQRNotExpired");
      expect(stageNames).toContain("validateQRNotConsumed");
    });

    it("debe excluir validateQRNotConsumed", () => {
      const pipeline = createCustomPipeline(deps, {
        exclude: ["validateQRNotConsumed"],
      });

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toContain("validateQRNotExpired");
      expect(stageNames).not.toContain("validateQRNotConsumed");
    });

    it("debe excluir validateStudentActive", () => {
      const pipeline = createCustomPipeline(deps, {
        exclude: ["validateStudentActive"],
      });

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).not.toContain("validateStudentActive");
      expect(stageNames).toContain("validateStudentRegistered");
    });

    it("debe excluir validateStudentOwnsQR", () => {
      const pipeline = createCustomPipeline(deps, {
        exclude: ["validateStudentOwnsQR"],
      });

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).not.toContain("validateStudentOwnsQR");
    });

    it("debe excluir validateRoundMatch", () => {
      const pipeline = createCustomPipeline(deps, {
        exclude: ["validateRoundMatch"],
      });

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).not.toContain("validateRoundMatch");
    });

    it("debe excluir múltiples stages", () => {
      const pipeline = createCustomPipeline(deps, {
        exclude: [
          "validateQRNotExpired",
          "validateStudentActive",
          "validateRoundMatch",
        ],
      });

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).not.toContain("validateQRNotExpired");
      expect(stageNames).not.toContain("validateStudentActive");
      expect(stageNames).not.toContain("validateRoundMatch");
      expect(stageNames).toContain("validateQRNotConsumed");
      expect(stageNames).toContain("validateStudentOwnsQR");
    });

    it("debe mantener stages core siempre", () => {
      const pipeline = createCustomPipeline(deps, {
        exclude: [
          "validateQRNotExpired",
          "validateQRNotConsumed",
          "validateStudentActive",
          "validateStudentOwnsQR",
          "validateRoundMatch",
        ],
      });

      const stageNames = pipeline.map((s) => s.name);
      expect(stageNames).toContain("decrypt");
      expect(stageNames).toContain("validateStructure");
      expect(stageNames).toContain("validateOwnership");
      expect(stageNames).toContain("loadQRState");
      expect(stageNames).toContain("loadStudentState");
      expect(stageNames).toContain("validateStudentRegistered");
    });

    it("debe funcionar con opciones vacías", () => {
      const pipeline = createCustomPipeline(deps, {});

      expect(pipeline).toBeDefined();
      expect(pipeline.length).toBeGreaterThan(0);
    });

    it("debe funcionar sin opciones", () => {
      const pipeline = createCustomPipeline(deps);

      expect(pipeline).toBeDefined();
      expect(pipeline.length).toBeGreaterThan(0);
    });
  });

  describe("Stage ordering", () => {
    it("decrypt debe ser el primer stage en default pipeline", () => {
      const pipeline = createDefaultPipeline(deps);

      expect(pipeline[0].name).toBe("decrypt");
    });

    it("decrypt debe ser el primer stage en minimal pipeline", () => {
      const pipeline = createMinimalPipeline({
        aesGcmService: mockAesService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      expect(pipeline[0].name).toBe("decrypt");
    });

    it("decrypt debe ser el primer stage en custom pipeline", () => {
      const pipeline = createCustomPipeline(deps);

      expect(pipeline[0].name).toBe("decrypt");
    });

    it("loadQRState debe venir antes de validateQRNotExpired", () => {
      const pipeline = createDefaultPipeline(deps);
      const stageNames = pipeline.map((s) => s.name);

      const loadIndex = stageNames.indexOf("loadQRState");
      const validateIndex = stageNames.indexOf("validateQRNotExpired");

      expect(loadIndex).toBeLessThan(validateIndex);
    });

    it("loadStudentState debe venir antes de validateStudentRegistered", () => {
      const pipeline = createDefaultPipeline(deps);
      const stageNames = pipeline.map((s) => s.name);

      const loadIndex = stageNames.indexOf("loadStudentState");
      const validateIndex = stageNames.indexOf("validateStudentRegistered");

      expect(loadIndex).toBeLessThan(validateIndex);
    });
  });
});
