/**
 * Tests: RegistrationRepository
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RegistrationRepository,
  type CreateRegistrationDTO,
  type RegistrationEntity,
} from "../registration.repository";
import type { PostgresPool } from "../../../../../shared/infrastructure/database/postgres-pool";

const createMockDb = () =>
  ({
    query: vi.fn(),
  } as unknown as PostgresPool);

describe("RegistrationRepository", () => {
  let repository: RegistrationRepository;
  let mockDb: PostgresPool;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new RegistrationRepository(mockDb);
  });

  describe("create()", () => {
    it("debe crear un registro con deviceId", async () => {
      const dto: CreateRegistrationDTO = {
        sessionId: 1,
        userId: 100,
        deviceId: 50,
      };

      const mockRow = {
        registration_id: 1,
        session_id: 1,
        user_id: 100,
        device_id: 50,
        queue_position: 1,
        registered_at: new Date(),
        status: "active",
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.create(dto);

      expect(result.registrationId).toBe(1);
      expect(result.deviceId).toBe(50);
      expect(result.status).toBe("active");
    });

    it("debe crear registro sin deviceId (null)", async () => {
      const dto: CreateRegistrationDTO = {
        sessionId: 1,
        userId: 100,
      };

      const mockRow = {
        registration_id: 2,
        session_id: 1,
        user_id: 100,
        device_id: null,
        queue_position: 2,
        registered_at: new Date(),
        status: "active",
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.create(dto);

      expect(result.deviceId).toBeNull();
      expect(mockDb.query).toHaveBeenCalledWith(expect.any(String), [
        1,
        100,
        null,
      ]);
    });
  });

  describe("getById()", () => {
    it("debe retornar un registro por ID", async () => {
      const mockRow = {
        registration_id: 1,
        session_id: 1,
        user_id: 100,
        device_id: 50,
        queue_position: 1,
        registered_at: new Date(),
        status: "active",
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getById(1);

      expect(result?.registrationId).toBe(1);
    });

    it("debe retornar null si no existe", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.getById(999);

      expect(result).toBeNull();
    });
  });

  describe("getBySessionAndUser()", () => {
    it("debe retornar registro por sesión y usuario", async () => {
      const mockRow = {
        registration_id: 1,
        session_id: 1,
        user_id: 100,
        device_id: 50,
        queue_position: 1,
        registered_at: new Date(),
        status: "active",
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.getBySessionAndUser(1, 100);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE session_id = $1 AND user_id = $2"),
        [1, 100]
      );
      expect(result?.userId).toBe(100);
    });
  });

  describe("updateStatus()", () => {
    it("debe actualizar el estado de un registro", async () => {
      const mockRow = {
        registration_id: 1,
        session_id: 1,
        user_id: 100,
        device_id: 50,
        queue_position: 1,
        registered_at: new Date(),
        status: "completed",
      };

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [mockRow] } as any);

      const result = await repository.updateStatus(1, { status: "completed" });

      expect(result?.status).toBe("completed");
    });
  });

  describe("listBySession()", () => {
    it("debe listar registros de una sesión", async () => {
      const mockRows = [
        {
          registration_id: 1,
          session_id: 1,
          user_id: 100,
          device_id: 50,
          queue_position: 1,
          registered_at: new Date(),
          status: "active",
        },
        {
          registration_id: 2,
          session_id: 1,
          user_id: 101,
          device_id: 51,
          queue_position: 2,
          registered_at: new Date(),
          status: "active",
        },
      ];

      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: mockRows } as any);

      const result = await repository.listBySession(1);

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe(1);
    });
  });

  describe("countByStatusInSession()", () => {
    it("debe contar registros por estado en una sesión", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({
        rows: [
          { status: "active", count: "10" },
          { status: "completed", count: "15" },
        ],
      } as any);

      const result = await repository.countByStatusInSession(1);

      expect(result.active).toBe(10);
      expect(result.completed).toBe(15);
      expect(result.processing).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe("exists()", () => {
    it("debe verificar si usuario está registrado", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [{ 1: 1 }] } as any);

      const result = await repository.exists(1, 100);

      expect(result).toBe(true);
    });

    it("debe retornar false si no está registrado", async () => {
      vi.spyOn(mockDb, "query").mockResolvedValue({ rows: [] } as any);

      const result = await repository.exists(1, 999);

      expect(result).toBe(false);
    });
  });
});
