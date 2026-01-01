/**
 * Tests: ValidationRepository
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ValidationRepository,
  type CreateValidationDTO,
  type CompleteValidationDTO,
} from "../validation.repository";
import type { PostgresPool } from "../../../../../shared/infrastructure/database/postgres-pool";

const createMockDb = () =>
  ({
    query: vi.fn(),
  } as unknown as PostgresPool);

describe("ValidationRepository", () => {
  let repository: ValidationRepository;
  let mockDb: PostgresPool;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new ValidationRepository(mockDb);
  });

  describe("create()", () => {
    it("debe crear una validación cuando se genera el QR", async () => {
      const dto: CreateValidationDTO = {
        registrationId: 1,
        roundNumber: 1,
        qrGeneratedAt: new Date("2024-01-15T10:00:00Z"),
      };

      const mockRow = {
        validation_id: 1,
        registration_id: 1,
        round_number: 1,
        qr_generated_at: new Date("2024-01-15T10:00:00Z"),
        qr_scanned_at: null,
        response_received_at: null,
        response_time_ms: null,
        totpu_valid: null,
        totps_valid: null,
        rt_valid: null,
        secret_valid: null,
        validation_status: null,
        failed_attempts: 0,
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.create(dto);

      expect(result.validationId).toBe(1);
      expect(result.roundNumber).toBe(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO attendance.validations"),
        [1, 1, dto.qrGeneratedAt]
      );
    });
  });

  describe("complete()", () => {
    it("debe completar una validación exitosa con todos los campos", async () => {
      const dto: CompleteValidationDTO = {
        qrScannedAt: new Date("2024-01-15T10:00:01Z"),
        responseReceivedAt: new Date("2024-01-15T10:00:03Z"),
        responseTimeMs: 2500,
        totpuValid: true,
        totpsValid: true,
        rtValid: true,
        secretValid: true,
        validationStatus: "success",
      };

      const mockRow = {
        validation_id: 1,
        registration_id: 1,
        round_number: 1,
        qr_generated_at: new Date("2024-01-15T10:00:00Z"),
        qr_scanned_at: new Date("2024-01-15T10:00:01Z"),
        response_received_at: new Date("2024-01-15T10:00:03Z"),
        response_time_ms: 2500,
        totpu_valid: true,
        totps_valid: true,
        rt_valid: true,
        secret_valid: true,
        validation_status: "success",
        failed_attempts: 0,
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.complete(1, 1, dto);

      expect(result?.validationStatus).toBe("success");
      expect(result?.totpuValid).toBe(true);
      expect(result?.responseTimeMs).toBe(2500);
    });

    it("debe completar validación fallida", async () => {
      const dto: CompleteValidationDTO = {
        responseReceivedAt: new Date(),
        responseTimeMs: 1000,
        totpuValid: false,
        validationStatus: "failed",
      };

      const mockRow = {
        validation_id: 1,
        registration_id: 1,
        round_number: 1,
        qr_generated_at: new Date(),
        qr_scanned_at: null,
        response_received_at: new Date(),
        response_time_ms: 1000,
        totpu_valid: false,
        totps_valid: null,
        rt_valid: null,
        secret_valid: null,
        validation_status: "failed",
        failed_attempts: 1,
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.complete(1, 1, dto);

      expect(result?.validationStatus).toBe("failed");
      expect(result?.totpuValid).toBe(false);
    });

    it("debe retornar null si la validación no existe", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const dto: CompleteValidationDTO = {
        responseReceivedAt: new Date(),
        responseTimeMs: 1000,
        validationStatus: "failed",
      };

      const result = await repository.complete(999, 1, dto);

      expect(result).toBeNull();
    });
  });

  describe("incrementFailedAttempts()", () => {
    it("debe incrementar contador de intentos fallidos", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({
        rows: [{ failed_attempts: 3 }],
      } as any);

      const result = await repository.incrementFailedAttempts(1, 1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("failed_attempts = failed_attempts + 1"),
        [1, 1]
      );
      expect(result).toBe(3);
    });

    it("debe retornar 0 si la validación no existe", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.incrementFailedAttempts(999, 1);

      expect(result).toBe(0);
    });
  });

  describe("getByRound()", () => {
    it("debe retornar validación por registrationId y round", async () => {
      const mockRow = {
        validation_id: 1,
        registration_id: 1,
        round_number: 2,
        qr_generated_at: new Date(),
        qr_scanned_at: new Date(),
        response_received_at: new Date(),
        response_time_ms: 2500,
        totpu_valid: true,
        totps_valid: true,
        rt_valid: true,
        secret_valid: true,
        validation_status: "success",
        failed_attempts: 0,
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getByRound(1, 2);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE registration_id = $1 AND round_number = $2"
        ),
        [1, 2]
      );
      expect(result?.roundNumber).toBe(2);
    });

    it("debe retornar null si no existe", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.getByRound(999, 1);

      expect(result).toBeNull();
    });
  });

  describe("listByRegistration()", () => {
    it("debe listar todas las validaciones de un registro", async () => {
      const mockRows = [
        {
          validation_id: 1,
          registration_id: 1,
          round_number: 1,
          qr_generated_at: new Date(),
          qr_scanned_at: new Date(),
          response_received_at: new Date(),
          response_time_ms: 2500,
          totpu_valid: true,
          totps_valid: true,
          rt_valid: true,
          secret_valid: true,
          validation_status: "success",
          failed_attempts: 0,
          created_at: new Date(),
        },
        {
          validation_id: 2,
          registration_id: 1,
          round_number: 2,
          qr_generated_at: new Date(),
          qr_scanned_at: null,
          response_received_at: new Date(),
          response_time_ms: 1000,
          totpu_valid: false,
          totps_valid: null,
          rt_valid: null,
          secret_valid: null,
          validation_status: "failed",
          failed_attempts: 1,
          created_at: new Date(),
        },
      ];

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: mockRows } as any);

      const result = await repository.listByRegistration(1);

      expect(result).toHaveLength(2);
      expect(result[0].validationStatus).toBe("success");
      expect(result[1].validationStatus).toBe("failed");
    });
  });

  describe("countSuccessful()", () => {
    it("debe contar validaciones exitosas", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({
        rows: [{ count: "15" }],
      } as any);

      const result = await repository.countSuccessful(1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("validation_status = 'success'"),
        [1]
      );
      expect(result).toBe(15);
    });
  });

  describe("getResponseTimeStats()", () => {
    it("debe retornar estadísticas de response time", async () => {
      const mockRow = {
        avg: "2500.5",
        std_dev: "300.2",
        min: "2000",
        max: "3000",
        median: "2500",
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getResponseTimeStats(1);

      expect(result.avg).toBeCloseTo(2500.5);
      expect(result.stdDev).toBeCloseTo(300.2);
      expect(result.min).toBe(2000);
    });

    it("debe manejar caso sin datos", async () => {
      const mockRow = {
        avg: null,
        std_dev: null,
        min: null,
        max: null,
        median: null,
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getResponseTimeStats(999);

      expect(result.avg).toBeNull();
      expect(result.stdDev).toBeNull();
    });
  });
});
