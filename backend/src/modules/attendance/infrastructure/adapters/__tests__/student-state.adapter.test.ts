/**
 * Tests: Student State Adapter
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  StudentStateAdapter,
  createStudentStateAdapter,
} from "../student-state.adapter";
import type { StudentSessionRepository } from "../../student-session.repository";

describe("StudentStateAdapter", () => {
  let adapter: StudentStateAdapter;
  let mockStudentRepo: StudentSessionRepository;

  beforeEach(() => {
    mockStudentRepo = {
      getState: vi.fn(),
      updateState: vi.fn(),
      deleteState: vi.fn(),
    } as unknown as StudentSessionRepository;
    adapter = new StudentStateAdapter(mockStudentRepo);
  });

  describe("getState()", () => {
    it("debe transformar estado de infraestructura a dominio", async () => {
      const infraState = {
        status: "in_progress" as const,
        currentRound: 2,
        activeQRNonce: "nonce-abc-123",
        roundsCompleted: [
          { round: 1, responseTime: 1500 },
          { round: 2, responseTime: 2000 },
        ],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      };

      vi.spyOn(mockStudentRepo, "getState").mockResolvedValue(infraState);

      const result = await adapter.getState("session-123", 456);

      expect(result).toEqual({
        registered: true,
        status: "in_progress",
        currentRound: 2,
        activeNonce: "nonce-abc-123",
        roundsCompleted: [
          { round: 1, responseTime: 1500 },
          { round: 2, responseTime: 2000 },
        ],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      });
    });

    it("debe retornar null si estudiante no existe", async () => {
      vi.spyOn(mockStudentRepo, "getState").mockResolvedValue(null);

      const result = await adapter.getState("session-999", 999);

      expect(result).toBeNull();
      expect(mockStudentRepo.getState).toHaveBeenCalledWith("session-999", 999);
    });

    it("debe manejar estado sin rounds completados", async () => {
      const infraState = {
        status: "pending" as const,
        currentRound: 0,
        activeQRNonce: null,
        roundsCompleted: [],
        currentAttempt: 0,
        maxAttempts: 3,
        maxRounds: 3,
      };

      vi.spyOn(mockStudentRepo, "getState").mockResolvedValue(infraState);

      const result = await adapter.getState("session-123", 456);

      expect(result).toEqual({
        registered: true,
        status: "pending",
        currentRound: 0,
        activeNonce: null,
        roundsCompleted: [],
        currentAttempt: 0,
        maxAttempts: 3,
        maxRounds: 3,
      });
    });

    it("debe manejar estado completado", async () => {
      const infraState = {
        status: "completed" as const,
        currentRound: 3,
        activeQRNonce: null,
        roundsCompleted: [
          { round: 1, responseTime: 1200 },
          { round: 2, responseTime: 1800 },
          { round: 3, responseTime: 1500 },
        ],
        currentAttempt: 3,
        maxAttempts: 3,
        maxRounds: 3,
      };

      vi.spyOn(mockStudentRepo, "getState").mockResolvedValue(infraState);

      const result = await adapter.getState("session-123", 456);

      expect(result?.status).toBe("completed");
      expect(result?.roundsCompleted).toHaveLength(3);
    });

    it("debe propagar errores del repository", async () => {
      vi.spyOn(mockStudentRepo, "getState").mockRejectedValue(
        new Error("Database error")
      );

      await expect(adapter.getState("session-123", 456)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("createStudentStateAdapter()", () => {
    it("debe crear adapter con dependencies por defecto", () => {
      const adapter = createStudentStateAdapter();

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(StudentStateAdapter);
    });

    it("debe crear adapter con repository custom", () => {
      const adapter = createStudentStateAdapter(mockStudentRepo);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(StudentStateAdapter);
    });
  });

  describe("transformación de campos", () => {
    it("debe mapear activeQRNonce a activeNonce", async () => {
      const infraState = {
        status: "in_progress" as const,
        currentRound: 1,
        activeQRNonce: "test-nonce",
        roundsCompleted: [],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      };

      vi.spyOn(mockStudentRepo, "getState").mockResolvedValue(infraState);

      const result = await adapter.getState("session-123", 456);

      expect(result?.activeNonce).toBe("test-nonce");
      expect(result).not.toHaveProperty("activeQRNonce");
    });

    it("debe preservar estructura de roundsCompleted", async () => {
      const infraState = {
        status: "in_progress" as const,
        currentRound: 2,
        activeQRNonce: null,
        roundsCompleted: [{ round: 1, responseTime: 999 }],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      };

      vi.spyOn(mockStudentRepo, "getState").mockResolvedValue(infraState);

      const result = await adapter.getState("session-123", 456);

      expect(result?.roundsCompleted).toEqual([
        { round: 1, responseTime: 999 },
      ]);
    });

    it("debe incluir registered: true en todos los casos", async () => {
      const infraState = {
        status: "pending" as const,
        currentRound: 0,
        activeQRNonce: null,
        roundsCompleted: [],
        currentAttempt: 0,
        maxAttempts: 3,
        maxRounds: 3,
      };

      vi.spyOn(mockStudentRepo, "getState").mockResolvedValue(infraState);

      const result = await adapter.getState("session-123", 456);

      expect(result?.registered).toBe(true);
    });
  });
});
