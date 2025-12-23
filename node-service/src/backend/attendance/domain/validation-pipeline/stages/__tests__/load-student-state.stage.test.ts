/**
 * Tests: Load Student State Stage
 */
import { describe, it, expect, vi } from "vitest";
import {
  createLoadStudentStateStage,
  type StudentStateLoader,
} from "../load-student-state.stage";
import type { ValidationContext, StudentState } from "../../context";

describe("Load Student State Stage", () => {
  const createMockLoader = (): StudentStateLoader => ({
    getState: vi.fn(),
  });

  const createContext = (): ValidationContext => ({
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
  });

  describe("createLoadStudentStateStage()", () => {
    it("debe crear stage con nombre correcto", () => {
      const loader = createMockLoader();
      const stage = createLoadStudentStateStage(loader);

      expect(stage.name).toBe("loadStudentState");
    });

    it("debe tener función execute", () => {
      const loader = createMockLoader();
      const stage = createLoadStudentStateStage(loader);

      expect(typeof stage.execute).toBe("function");
    });
  });

  describe("execute() - estudiante registrado", () => {
    it("debe cargar estado de estudiante existente", async () => {
      const loader = createMockLoader();
      const studentState: StudentState = {
        status: "active",
        currentRound: 2,
        activeNonce: "nonce-123",
        roundsCompleted: [1],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      };
      vi.mocked(loader.getState).mockResolvedValue(studentState);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();

      const result = await stage.execute(ctx);

      expect(result).toBe(true);
      expect(ctx.studentState).toEqual({
        ...studentState,
        registered: true,
      });
      expect(loader.getState).toHaveBeenCalledWith("session-123", 123);
    });

    it("debe agregar flag registered=true", async () => {
      const loader = createMockLoader();
      const studentState: StudentState = {
        status: "active",
        currentRound: 1,
        activeNonce: null,
        roundsCompleted: [],
        currentAttempt: 0,
        maxAttempts: 3,
        maxRounds: 3,
      };
      vi.mocked(loader.getState).mockResolvedValue(studentState);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();

      await stage.execute(ctx);

      expect(ctx.studentState?.registered).toBe(true);
    });

    it("debe preservar todos los campos del estado", async () => {
      const loader = createMockLoader();
      const studentState: StudentState = {
        status: "active",
        currentRound: 3,
        activeNonce: "active-nonce",
        roundsCompleted: [1, 2],
        currentAttempt: 2,
        maxAttempts: 3,
        maxRounds: 3,
      };
      vi.mocked(loader.getState).mockResolvedValue(studentState);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();

      await stage.execute(ctx);

      expect(ctx.studentState?.currentRound).toBe(3);
      expect(ctx.studentState?.activeNonce).toBe("active-nonce");
      expect(ctx.studentState?.roundsCompleted).toEqual([1, 2]);
      expect(ctx.studentState?.currentAttempt).toBe(2);
    });
  });

  describe("execute() - estudiante no registrado", () => {
    it("debe crear estado vacío si estudiante no existe", async () => {
      const loader = createMockLoader();
      vi.mocked(loader.getState).mockResolvedValue(null);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();

      const result = await stage.execute(ctx);

      expect(result).toBe(true);
      expect(ctx.studentState).toEqual({
        registered: false,
        status: "active",
        currentRound: 0,
        activeNonce: null,
        roundsCompleted: [],
        currentAttempt: 0,
        maxAttempts: 0,
        maxRounds: 0,
      });
    });

    it("debe marcar registered=false para estudiante no existente", async () => {
      const loader = createMockLoader();
      vi.mocked(loader.getState).mockResolvedValue(null);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();

      await stage.execute(ctx);

      expect(ctx.studentState?.registered).toBe(false);
    });

    it("debe crear estado con valores por defecto", async () => {
      const loader = createMockLoader();
      vi.mocked(loader.getState).mockResolvedValue(null);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();

      await stage.execute(ctx);

      expect(ctx.studentState?.currentRound).toBe(0);
      expect(ctx.studentState?.activeNonce).toBeNull();
      expect(ctx.studentState?.roundsCompleted).toEqual([]);
      expect(ctx.studentState?.currentAttempt).toBe(0);
      expect(ctx.studentState?.maxAttempts).toBe(0);
      expect(ctx.studentState?.maxRounds).toBe(0);
    });
  });

  describe("execute() - validaciones", () => {
    it("debe fallar si no hay response", async () => {
      const loader = createMockLoader();
      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();
      ctx.response = undefined;

      const result = await stage.execute(ctx);

      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: "INTERNAL_ERROR",
        message: "No hay respuesta para cargar estado estudiante",
      });
    });

    it("debe usar sessionId correcto del payload", async () => {
      const loader = createMockLoader();
      vi.mocked(loader.getState).mockResolvedValue(null);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();
      ctx.response!.original.sid = "custom-session-456";

      await stage.execute(ctx);

      expect(loader.getState).toHaveBeenCalledWith("custom-session-456", 123);
    });

    it("debe usar studentId del contexto", async () => {
      const loader = createMockLoader();
      vi.mocked(loader.getState).mockResolvedValue(null);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();
      ctx.studentId = 999;

      await stage.execute(ctx);

      expect(loader.getState).toHaveBeenCalledWith("session-123", 999);
    });
  });

  describe("execute() - diferentes estados", () => {
    it("debe manejar estudiante en ronda final", async () => {
      const loader = createMockLoader();
      const studentState: StudentState = {
        status: "active",
        currentRound: 3,
        activeNonce: "nonce-final",
        roundsCompleted: [1, 2],
        currentAttempt: 3,
        maxAttempts: 3,
        maxRounds: 3,
      };
      vi.mocked(loader.getState).mockResolvedValue(studentState);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();

      await stage.execute(ctx);

      expect(ctx.studentState?.currentRound).toBe(3);
      expect(ctx.studentState?.roundsCompleted).toEqual([1, 2]);
    });

    it("debe manejar estudiante con estado completed", async () => {
      const loader = createMockLoader();
      const studentState: StudentState = {
        status: "completed",
        currentRound: 3,
        activeNonce: null,
        roundsCompleted: [1, 2, 3],
        currentAttempt: 3,
        maxAttempts: 3,
        maxRounds: 3,
      };
      vi.mocked(loader.getState).mockResolvedValue(studentState);

      const stage = createLoadStudentStateStage(loader);
      const ctx = createContext();

      await stage.execute(ctx);

      expect(ctx.studentState?.status).toBe("completed");
      expect(ctx.studentState?.roundsCompleted).toEqual([1, 2, 3]);
    });

    it("debe permitir cargar múltiples estudiantes", async () => {
      const loader = createMockLoader();
      const stage = createLoadStudentStateStage(loader);

      // Estudiante 1
      vi.mocked(loader.getState).mockResolvedValue({
        status: "active",
        currentRound: 1,
        activeNonce: "nonce-1",
        roundsCompleted: [],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      });
      const ctx1 = createContext();
      await stage.execute(ctx1);

      // Estudiante 2
      vi.mocked(loader.getState).mockResolvedValue(null);
      const ctx2 = createContext();
      await stage.execute(ctx2);

      expect(ctx1.studentState?.registered).toBe(true);
      expect(ctx2.studentState?.registered).toBe(false);
    });
  });
});
