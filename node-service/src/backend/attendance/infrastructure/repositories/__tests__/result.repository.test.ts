/**
 * Tests: ResultRepository
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResultRepository, type CreateResultDTO } from "../result.repository";
import type { PostgresPool } from "../../../../../shared/infrastructure/database/postgres-pool";

const createMockDb = () =>
  ({
    query: vi.fn(),
  } as unknown as PostgresPool);

describe("ResultRepository", () => {
  let repository: ResultRepository;
  let mockDb: PostgresPool;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new ResultRepository(mockDb);
  });

  describe("create()", () => {
    it("debe crear un resultado completo con todas las métricas", async () => {
      const dto: CreateResultDTO = {
        registrationId: 1,
        totalRounds: 3,
        successfulRounds: 3,
        failedRounds: 0,
        avgResponseTimeMs: 2500,
        stdDevResponseTime: 300,
        minResponseTimeMs: 2000,
        maxResponseTimeMs: 3000,
        medianResponseTimeMs: 2500,
        certaintyScore: 85,
        finalStatus: "PRESENT",
      };

      const mockRow = {
        result_id: 1,
        registration_id: 1,
        total_rounds: 3,
        successful_rounds: 3,
        failed_rounds: 0,
        avg_response_time_ms: 2500,
        std_dev_response_time: 300,
        min_response_time_ms: 2000,
        max_response_time_ms: 3000,
        median_response_time_ms: 2500,
        certainty_score: 85,
        final_status: "PRESENT",
        calculated_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.create(dto);

      expect(result.resultId).toBe(1);
      expect(result.finalStatus).toBe("PRESENT");
      expect(result.certaintyScore).toBe(85);
    });

    it("debe crear resultado con valores por defecto", async () => {
      const dto: CreateResultDTO = {
        registrationId: 1,
        totalRounds: 3,
        successfulRounds: 0,
        certaintyScore: 0,
        finalStatus: "ABSENT",
      };

      const mockRow = {
        result_id: 2,
        registration_id: 1,
        total_rounds: 3,
        successful_rounds: 0,
        failed_rounds: 0,
        avg_response_time_ms: null,
        std_dev_response_time: null,
        min_response_time_ms: null,
        max_response_time_ms: null,
        median_response_time_ms: null,
        certainty_score: 0,
        final_status: "ABSENT",
        calculated_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.create(dto);

      expect(result.finalStatus).toBe("ABSENT");
      expect(result.avgResponseTimeMs).toBeNull();
    });
  });

  describe("getByRegistration()", () => {
    it("debe retornar resultado por registrationId", async () => {
      const mockRow = {
        result_id: 1,
        registration_id: 1,
        total_rounds: 3,
        successful_rounds: 3,
        failed_rounds: 0,
        avg_response_time_ms: 2500,
        std_dev_response_time: 300,
        min_response_time_ms: 2000,
        max_response_time_ms: 3000,
        median_response_time_ms: 2500,
        certainty_score: 85,
        final_status: "PRESENT",
        calculated_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getByRegistration(1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE registration_id = $1"),
        [1]
      );
      expect(result?.registrationId).toBe(1);
    });

    it("debe retornar null si no existe", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.getByRegistration(999);

      expect(result).toBeNull();
    });
  });

  describe("listBySession()", () => {
    it("debe listar resultados de una sesión", async () => {
      const mockRows = [
        {
          result_id: 1,
          registration_id: 1,
          total_rounds: 3,
          successful_rounds: 3,
          failed_rounds: 0,
          avg_response_time_ms: 2500,
          std_dev_response_time: 300,
          min_response_time_ms: 2000,
          max_response_time_ms: 3000,
          median_response_time_ms: 2500,
          certainty_score: 85,
          final_status: "PRESENT",
          calculated_at: new Date(),
        },
        {
          result_id: 2,
          registration_id: 2,
          total_rounds: 3,
          successful_rounds: 0,
          failed_rounds: 3,
          avg_response_time_ms: null,
          std_dev_response_time: null,
          min_response_time_ms: null,
          max_response_time_ms: null,
          median_response_time_ms: null,
          certainty_score: 0,
          final_status: "ABSENT",
          calculated_at: new Date(),
        },
      ];

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: mockRows } as any);

      const result = await repository.listBySession(1);

      expect(result).toHaveLength(2);
      expect(result[0].finalStatus).toBe("PRESENT");
      expect(result[1].finalStatus).toBe("ABSENT");
    });
  });

  describe("getSessionStats()", () => {
    it("debe retornar estadísticas de una sesión", async () => {
      const mockRow = {
        total: "50",
        present: "45",
        absent: "3",
        doubtful: "2",
        error: "0",
        avg_certainty: "82.5",
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getSessionStats(1);

      expect(result.totalStudents).toBe(50);
      expect(result.present).toBe(45);
      expect(result.avgCertainty).toBe(82.5);
    });
  });

  describe("exists()", () => {
    it("debe verificar si existe resultado para un registro", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [{ 1: 1 }] } as any);

      const result = await repository.exists(1);

      expect(result).toBe(true);
    });

    it("debe retornar false si no existe", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.exists(999);

      expect(result).toBe(false);
    });
  });
});
