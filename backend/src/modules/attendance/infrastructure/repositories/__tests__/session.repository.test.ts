/**
 * Tests: SessionRepository
 *
 * Prueba el repositorio de sesiones de asistencia con PostgreSQL
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SessionRepository,
  type CreateSessionDTO,
  type UpdateSessionDTO,
  type SessionEntity,
} from "../session.repository";
import type { PostgresPool } from "../../../../../shared/infrastructure/database/postgres-pool";

// Mock de PostgresPool
const createMockDb = () => {
  return {
    query: vi.fn(),
  } as unknown as PostgresPool;
};

describe("SessionRepository", () => {
  let repository: SessionRepository;
  let mockDb: PostgresPool;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new SessionRepository(mockDb);
  });

  describe("create()", () => {
    it("debe crear una sesión con todos los campos", async () => {
      const dto: CreateSessionDTO = {
        professorId: 123,
        professorName: "Dr. Smith",
        courseCode: "CS101",
        courseName: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        maxRounds: 5,
      };

      const mockRow = {
        session_id: 1,
        professor_id: 123,
        professor_name: "Dr. Smith",
        course_code: "CS101",
        course_name: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        start_time: new Date("2024-01-15T10:00:00Z"),
        end_time: null,
        max_rounds: 5,
        status: "active",
        created_at: new Date("2024-01-15T10:00:00Z"),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.create(dto);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO attendance.sessions"),
        [123, "Dr. Smith", "CS101", "Intro to CS", "A-301", "2024-1", 5]
      );
      expect(result.sessionId).toBe(1);
      expect(result.professorId).toBe(123);
      expect(result.status).toBe("active");
    });

    it("debe usar maxRounds por defecto de 3", async () => {
      const dto: CreateSessionDTO = {
        professorId: 123,
        professorName: "Dr. Smith",
        courseCode: "CS101",
        courseName: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
      };

      const mockRow = {
        session_id: 1,
        professor_id: 123,
        professor_name: "Dr. Smith",
        course_code: "CS101",
        course_name: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        start_time: new Date(),
        end_time: null,
        max_rounds: 3,
        status: "active",
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      await repository.create(dto);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([3]) // maxRounds por defecto
      );
    });
  });

  describe("getById()", () => {
    it("debe retornar una sesión por ID", async () => {
      const mockRow = {
        session_id: 1,
        professor_id: 123,
        professor_name: "Dr. Smith",
        course_code: "CS101",
        course_name: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        start_time: new Date(),
        end_time: null,
        max_rounds: 3,
        status: "active",
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getById(1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE session_id = $1"),
        [1]
      );
      expect(result).toBeDefined();
      expect(result?.sessionId).toBe(1);
    });

    it("debe retornar null si no existe", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.getById(999);

      expect(result).toBeNull();
    });
  });

  describe("getActiveByProfessor()", () => {
    it("debe retornar la sesión activa más reciente del profesor", async () => {
      const mockRow = {
        session_id: 1,
        professor_id: 123,
        professor_name: "Dr. Smith",
        course_code: "CS101",
        course_name: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        start_time: new Date(),
        end_time: null,
        max_rounds: 3,
        status: "active",
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getActiveByProfessor(123);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE professor_id = $1 AND status = 'active'"
        ),
        [123]
      );
      expect(result).toBeDefined();
      expect(result?.status).toBe("active");
    });

    it("debe retornar null si no hay sesión activa", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.getActiveByProfessor(123);

      expect(result).toBeNull();
    });
  });

  describe("getActiveByRoom()", () => {
    it("debe retornar la sesión activa de una sala", async () => {
      const mockRow = {
        session_id: 1,
        professor_id: 123,
        professor_name: "Dr. Smith",
        course_code: "CS101",
        course_name: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        start_time: new Date(),
        end_time: null,
        max_rounds: 3,
        status: "active",
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getActiveByRoom("A-301");

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE room = $1 AND status = 'active'"),
        ["A-301"]
      );
      expect(result?.room).toBe("A-301");
    });
  });

  describe("update()", () => {
    it("debe actualizar una sesión", async () => {
      const updateDto: UpdateSessionDTO = {
        status: "closed",
        endTime: new Date("2024-01-15T12:00:00Z"),
      };

      const mockRow = {
        session_id: 1,
        professor_id: 123,
        professor_name: "Dr. Smith",
        course_code: "CS101",
        course_name: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        start_time: new Date("2024-01-15T10:00:00Z"),
        end_time: new Date("2024-01-15T12:00:00Z"),
        max_rounds: 3,
        status: "closed",
        created_at: new Date("2024-01-15T10:00:00Z"),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.update(1, updateDto);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE attendance.sessions"),
        expect.arrayContaining([1])
      );
      expect(result?.status).toBe("closed");
    });

    it("debe retornar null si la sesión no existe", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.update(999, { status: "closed" });

      expect(result).toBeNull();
    });
  });

  describe("close()", () => {
    it("debe cerrar una sesión", async () => {
      const mockRow = {
        session_id: 1,
        professor_id: 123,
        professor_name: "Dr. Smith",
        course_code: "CS101",
        course_name: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        start_time: new Date(),
        end_time: new Date(),
        max_rounds: 3,
        status: "closed",
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.close(1);

      expect(result?.status).toBe("closed");
      expect(result?.endTime).toBeDefined();
    });
  });

  describe("cancel()", () => {
    it("debe cancelar una sesión", async () => {
      const mockRow = {
        session_id: 1,
        professor_id: 123,
        professor_name: "Dr. Smith",
        course_code: "CS101",
        course_name: "Intro to CS",
        room: "A-301",
        semester: "2024-1",
        start_time: new Date(),
        end_time: new Date(),
        max_rounds: 3,
        status: "cancelled",
        created_at: new Date(),
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.cancel(1);

      expect(result?.status).toBe("cancelled");
    });
  });

  describe("listByProfessor()", () => {
    it("debe listar sesiones de un profesor con paginación", async () => {
      const mockRows = [
        {
          session_id: 1,
          professor_id: 123,
          professor_name: "Dr. Smith",
          course_code: "CS101",
          course_name: "Intro to CS",
          room: "A-301",
          semester: "2024-1",
          start_time: new Date(),
          end_time: null,
          max_rounds: 3,
          status: "active",
          created_at: new Date(),
        },
        {
          session_id: 2,
          professor_id: 123,
          professor_name: "Dr. Smith",
          course_code: "CS102",
          course_name: "Advanced CS",
          room: "A-302",
          semester: "2024-1",
          start_time: new Date(),
          end_time: null,
          max_rounds: 3,
          status: "active",
          created_at: new Date(),
        },
      ];

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: mockRows } as any);

      const result = await repository.listByProfessor(123, 10, 0);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT $2 OFFSET $3"),
        [123, 10, 0]
      );
      expect(result).toHaveLength(2);
    });

    it("debe usar valores por defecto de paginación", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      await repository.listByProfessor(123);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        [123, 10, 0] // defaults: limit=10, offset=0
      );
    });
  });

  describe("countByProfessor()", () => {
    it("debe contar sesiones de un profesor", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({
        rows: [{ count: "42" }],
      } as any);

      const result = await repository.countByProfessor(123);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("COUNT(*)"),
        [123]
      );
      expect(result).toBe(42);
    });

    it("debe retornar 0 si no hay sesiones", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({
        rows: [{ count: "0" }],
      } as any);

      const result = await repository.countByProfessor(999);

      expect(result).toBe(0);
    });
  });
});
