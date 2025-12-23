/**
 * Tests: Student State Service
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StudentStateService } from "../student-state.service";
import type { StudentSessionRepository } from "../../../infrastructure/student-session.repository";
import type { StudentSessionData } from "../../../domain/student-session.entity";

describe("StudentStateService", () => {
  let service: StudentStateService;
  let mockRepo: StudentSessionRepository;

  beforeEach(() => {
    mockRepo = {
      registerStudent: vi.fn(),
      getState: vi.fn(),
      setActiveQR: vi.fn(),
      failRound: vi.fn(),
      completeRound: vi.fn(),
      deleteState: vi.fn(),
      updateState: vi.fn(),
    } as unknown as StudentSessionRepository;

    service = new StudentStateService(mockRepo);
  });

  describe("registerStudent()", () => {
    it("debe registrar estudiante con configuración", async () => {
      const mockData: StudentSessionData = {
        status: "pending",
        currentRound: 0,
        activeQRNonce: null,
        roundsCompleted: [],
        currentAttempt: 0,
        maxAttempts: 3,
        maxRounds: 3,
      };

      vi.spyOn(mockRepo, "registerStudent").mockResolvedValue(mockData);

      const result = await service.registerStudent("session-123", 456, {
        maxRounds: 3,
        maxAttempts: 3,
        qrTTL: 60,
      });

      expect(mockRepo.registerStudent).toHaveBeenCalledWith(
        "session-123",
        456,
        {
          maxRounds: 3,
          maxAttempts: 3,
          qrTTL: 60,
        }
      );
      expect(result).toEqual(mockData);
    });

    it("debe propagar errores del repositorio", async () => {
      vi.spyOn(mockRepo, "registerStudent").mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        service.registerStudent("session-123", 456, {
          maxRounds: 3,
          maxAttempts: 3,
          qrTTL: 60,
        })
      ).rejects.toThrow("Database error");
    });
  });

  describe("getState()", () => {
    it("debe obtener estado del estudiante", async () => {
      const mockState: StudentSessionData = {
        status: "in_progress",
        currentRound: 1,
        activeQRNonce: "nonce-123",
        roundsCompleted: [],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      };

      vi.spyOn(mockRepo, "getState").mockResolvedValue(mockState);

      const result = await service.getState("session-123", 456);

      expect(mockRepo.getState).toHaveBeenCalledWith("session-123", 456);
      expect(result).toEqual(mockState);
    });

    it("debe retornar null si no existe estado", async () => {
      vi.spyOn(mockRepo, "getState").mockResolvedValue(null);

      const result = await service.getState("session-999", 999);

      expect(result).toBeNull();
    });
  });

  describe("setActiveQR()", () => {
    it("debe establecer nonce activo para estudiante", async () => {
      vi.spyOn(mockRepo, "setActiveQR").mockResolvedValue(undefined);

      await service.setActiveQR("session-123", 456, "nonce-abc");

      expect(mockRepo.setActiveQR).toHaveBeenCalledWith(
        "session-123",
        456,
        "nonce-abc"
      );
    });

    it("debe propagar errores del repositorio", async () => {
      vi.spyOn(mockRepo, "setActiveQR").mockRejectedValue(
        new Error("Redis error")
      );

      await expect(
        service.setActiveQR("session-123", 456, "nonce-abc")
      ).rejects.toThrow("Redis error");
    });
  });

  describe("failRound()", () => {
    it("debe marcar round como fallido y retornar estado", async () => {
      const mockResult = {
        state: {
          status: "in_progress" as const,
          currentRound: 1,
          activeQRNonce: null,
          roundsCompleted: [],
          currentAttempt: 2,
          maxAttempts: 3,
          maxRounds: 3,
        },
        canRetry: true,
      };

      vi.spyOn(mockRepo, "failRound").mockResolvedValue(mockResult);

      const result = await service.failRound("session-123", 456, "QR_EXPIRED");

      expect(mockRepo.failRound).toHaveBeenCalledWith(
        "session-123",
        456,
        "QR_EXPIRED"
      );
      expect(result).toEqual(mockResult);
      expect(result.canRetry).toBe(true);
    });

    it("debe indicar cuando no quedan intentos", async () => {
      const mockResult = {
        state: {
          status: "failed" as const,
          currentRound: 1,
          activeQRNonce: null,
          roundsCompleted: [],
          currentAttempt: 3,
          maxAttempts: 3,
          maxRounds: 3,
        },
        canRetry: false,
      };

      vi.spyOn(mockRepo, "failRound").mockResolvedValue(mockResult);

      const result = await service.failRound(
        "session-123",
        456,
        "MAX_ATTEMPTS"
      );

      expect(result.canRetry).toBe(false);
      expect(result.state.status).toBe("failed");
    });
  });

  describe("constructor", () => {
    it("debe crear servicio con repositorio por defecto", () => {
      const service = new StudentStateService();

      expect(service).toBeInstanceOf(StudentStateService);
    });

    it("debe aceptar repositorio inyectado", () => {
      const service = new StudentStateService(mockRepo);

      expect(service).toBeInstanceOf(StudentStateService);
    });
  });
});
