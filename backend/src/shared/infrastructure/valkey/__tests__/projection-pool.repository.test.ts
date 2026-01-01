/**
 * Tests para ProjectionPoolRepository
 *
 * @description Tests para repositorio de pool de proyección en Valkey
 * @coverage Target: ~95%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ProjectionPoolRepository,
  type PoolEntry,
} from "../projection-pool.repository";
import { ValkeyClient } from "../valkey-client";

// Mock de logger
vi.mock("../../logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock de ValkeyClient
class MockValkeyClient {
  private store: Map<string, string | string[]>;
  private expirations: Map<string, number>;

  constructor() {
    this.store = new Map();
    this.expirations = new Map();
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }
    const list = this.store.get(key) as string[];
    list.push(...values);
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.store.get(key);
    if (!list || !Array.isArray(list)) {
      return [];
    }
    if (stop === -1) {
      return list.slice(start);
    }
    return list.slice(start, stop + 1);
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.expirations.set(key, seconds);
    return 1;
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, value);
    this.expirations.set(key, seconds);
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    const value = this.store.get(key);
    if (typeof value === "string") {
      return value;
    }
    return null;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted++;
      }
      this.expirations.delete(key);
    }
    return deleted;
  }

  reset() {
    this.store.clear();
    this.expirations.clear();
  }

  // Helper methods for testing
  getStore() {
    return this.store;
  }

  getExpirations() {
    return this.expirations;
  }
}

describe("ProjectionPoolRepository", () => {
  let repository: ProjectionPoolRepository;
  let mockClient: MockValkeyClient;
  let mockValkeyClientInstance: any;

  beforeEach(() => {
    mockClient = new MockValkeyClient();

    // Mock ValkeyClient.getInstance()
    mockValkeyClientInstance = {
      getClient: () => mockClient as any,
    };

    vi.spyOn(ValkeyClient, "getInstance").mockReturnValue(
      mockValkeyClientInstance
    );

    repository = new ProjectionPoolRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockClient.reset();
  });

  describe("addToPool()", () => {
    it("debe agregar entrada al pool", async () => {
      const entry: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-payload",
        studentId: 12345,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry);

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(entry);
    });

    it("debe establecer TTL de 2 horas en el pool", async () => {
      const entry: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-payload",
        studentId: 12345,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry);

      const expirations = mockClient.getExpirations();
      expect(expirations.get("pool:session:session-123")).toBe(7200);
    });

    it("debe agregar múltiples entradas secuencialmente", async () => {
      const entry1: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-1",
        studentId: 1001,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      const entry2: PoolEntry = {
        id: "entry-2",
        encrypted: "encrypted-2",
        studentId: 1002,
        round: 2,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry1);
      await repository.addToPool("session-123", entry2);

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe("entry-1");
      expect(entries[1].id).toBe("entry-2");
    });

    it("debe agregar QR falso correctamente", async () => {
      const fakeEntry: PoolEntry = {
        id: "fake-1",
        encrypted: "fake-encrypted",
        studentId: 0,
        round: 2,
        createdAt: Date.now(),
        isFake: true,
      };

      await repository.addToPool("session-123", fakeEntry);

      const entries = await repository.getAllEntries("session-123");
      expect(entries[0].isFake).toBe(true);
      expect(entries[0].studentId).toBe(0);
    });
  });

  describe("getAllEntries()", () => {
    it("debe retornar array vacío si no hay entradas", async () => {
      const entries = await repository.getAllEntries("session-123");
      expect(entries).toEqual([]);
    });

    it("debe retornar todas las entradas del pool", async () => {
      const entry1: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-1",
        studentId: 1001,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      const entry2: PoolEntry = {
        id: "entry-2",
        encrypted: "encrypted-2",
        studentId: 1002,
        round: 2,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry1);
      await repository.addToPool("session-123", entry2);

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(2);
    });

    it("debe filtrar entradas con JSON inválido", async () => {
      // Insertar JSON inválido directamente
      const mockClientInstance = mockClient as any;
      await mockClientInstance.rpush(
        "pool:session:session-123",
        "invalid-json"
      );
      await mockClientInstance.rpush(
        "pool:session:session-123",
        JSON.stringify({
          id: "entry-1",
          encrypted: "encrypted-1",
          studentId: 1001,
          round: 1,
          createdAt: Date.now(),
          isFake: false,
        })
      );

      const entries = await repository.getAllEntries("session-123");

      // Solo debe retornar la entrada válida
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("entry-1");
    });
  });

  describe("removeFromPool()", () => {
    it("debe remover entrada por ID", async () => {
      const entry1: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-1",
        studentId: 1001,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      const entry2: PoolEntry = {
        id: "entry-2",
        encrypted: "encrypted-2",
        studentId: 1002,
        round: 2,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry1);
      await repository.addToPool("session-123", entry2);

      const removed = await repository.removeFromPool("session-123", "entry-1");

      expect(removed).toBe(true);
      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("entry-2");
    });

    it("debe retornar false si no se encuentra la entrada", async () => {
      const entry: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-1",
        studentId: 1001,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry);

      const removed = await repository.removeFromPool(
        "session-123",
        "nonexistent"
      );

      expect(removed).toBe(false);
      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(1);
    });

    it("debe mantener TTL después de remover", async () => {
      const entry1: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-1",
        studentId: 1001,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      const entry2: PoolEntry = {
        id: "entry-2",
        encrypted: "encrypted-2",
        studentId: 1002,
        round: 2,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry1);
      await repository.addToPool("session-123", entry2);
      await repository.removeFromPool("session-123", "entry-1");

      const expirations = mockClient.getExpirations();
      expect(expirations.get("pool:session:session-123")).toBe(7200);
    });
  });

  describe("upsertStudentQR()", () => {
    it("debe agregar nuevo QR de estudiante", async () => {
      const entryId = await repository.upsertStudentQR(
        "session-123",
        12345,
        "encrypted-data",
        1
      );

      expect(entryId).toContain("student-12345");
      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(1);
      expect(entries[0].studentId).toBe(12345);
      expect(entries[0].encrypted).toBe("encrypted-data");
      expect(entries[0].round).toBe(1);
      expect(entries[0].isFake).toBe(false);
    });

    it("debe reemplazar QR existente del estudiante", async () => {
      // Agregar primera versión
      await repository.upsertStudentQR("session-123", 12345, "encrypted-v1", 1);

      // Actualizar con nueva versión
      const newEntryId = await repository.upsertStudentQR(
        "session-123",
        12345,
        "encrypted-v2",
        2
      );

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(1); // Solo debe haber una entrada
      expect(entries[0].encrypted).toBe("encrypted-v2");
      expect(entries[0].round).toBe(2);
      expect(entries[0].id).toBe(newEntryId);
    });

    it("debe mantener QRs de diferentes estudiantes", async () => {
      await repository.upsertStudentQR("session-123", 1001, "encrypted-1", 1);
      await repository.upsertStudentQR("session-123", 1002, "encrypted-2", 2);

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(2);
      expect(entries[0].studentId).toBe(1001);
      expect(entries[1].studentId).toBe(1002);
    });

    it("no debe reemplazar QR falso al hacer upsert de estudiante", async () => {
      // Agregar QR falso
      const fakeEntry: PoolEntry = {
        id: "fake-1",
        encrypted: "fake-encrypted",
        studentId: 0,
        round: 1,
        createdAt: Date.now(),
        isFake: true,
      };
      await repository.addToPool("session-123", fakeEntry);

      // Agregar QR de estudiante
      await repository.upsertStudentQR(
        "session-123",
        12345,
        "student-encrypted",
        1
      );

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(2);
      expect(entries.some((e) => e.isFake)).toBe(true);
      expect(entries.some((e) => e.studentId === 12345)).toBe(true);
    });
  });

  describe("getNextEntry()", () => {
    it("debe retornar null si el pool está vacío", async () => {
      const entry = await repository.getNextEntry("session-123");
      expect(entry).toBeNull();
    });

    it("debe retornar la primera entrada en el primer ciclo", async () => {
      const entry1: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-1",
        studentId: 1001,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry1);

      const nextEntry = await repository.getNextEntry("session-123");
      expect(nextEntry?.id).toBe("entry-1");
    });

    it("debe ciclar entre entradas (round-robin)", async () => {
      const entry1: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-1",
        studentId: 1001,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      const entry2: PoolEntry = {
        id: "entry-2",
        encrypted: "encrypted-2",
        studentId: 1002,
        round: 2,
        createdAt: Date.now(),
        isFake: false,
      };

      const entry3: PoolEntry = {
        id: "entry-3",
        encrypted: "encrypted-3",
        studentId: 1003,
        round: 3,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry1);
      await repository.addToPool("session-123", entry2);
      await repository.addToPool("session-123", entry3);

      // Ciclo 1
      const next1 = await repository.getNextEntry("session-123");
      expect(next1?.id).toBe("entry-1");

      // Ciclo 2
      const next2 = await repository.getNextEntry("session-123");
      expect(next2?.id).toBe("entry-2");

      // Ciclo 3
      const next3 = await repository.getNextEntry("session-123");
      expect(next3?.id).toBe("entry-3");

      // Ciclo 4 - debe volver al inicio
      const next4 = await repository.getNextEntry("session-123");
      expect(next4?.id).toBe("entry-1");
    });

    it("debe establecer TTL en el índice", async () => {
      const entry: PoolEntry = {
        id: "entry-1",
        encrypted: "encrypted-1",
        studentId: 1001,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      await repository.addToPool("session-123", entry);
      await repository.getNextEntry("session-123");

      const expirations = mockClient.getExpirations();
      expect(expirations.get("pool:index:session-123")).toBe(7200);
    });
  });

  describe("getPoolStats()", () => {
    it("debe retornar stats vacías para pool vacío", async () => {
      const stats = await repository.getPoolStats("session-123");

      expect(stats).toEqual({
        total: 0,
        students: 0,
        fakes: 0,
      });
    });

    it("debe contar correctamente entradas de estudiantes y falsas", async () => {
      const studentEntry: PoolEntry = {
        id: "student-1",
        encrypted: "encrypted-1",
        studentId: 12345,
        round: 1,
        createdAt: Date.now(),
        isFake: false,
      };

      const fakeEntry: PoolEntry = {
        id: "fake-1",
        encrypted: "fake-encrypted",
        studentId: 0,
        round: 2,
        createdAt: Date.now(),
        isFake: true,
      };

      await repository.addToPool("session-123", studentEntry);
      await repository.addToPool("session-123", fakeEntry);

      const stats = await repository.getPoolStats("session-123");

      expect(stats.total).toBe(2);
      expect(stats.students).toBe(1);
      expect(stats.fakes).toBe(1);
    });

    it("debe contar múltiples entradas correctamente", async () => {
      // 3 estudiantes + 2 falsos
      await repository.upsertStudentQR("session-123", 1001, "enc-1", 1);
      await repository.upsertStudentQR("session-123", 1002, "enc-2", 2);
      await repository.upsertStudentQR("session-123", 1003, "enc-3", 3);

      await repository.addFakeQRs("session-123", 2, () => "fake-encrypted");

      const stats = await repository.getPoolStats("session-123");

      expect(stats.total).toBe(5);
      expect(stats.students).toBe(3);
      expect(stats.fakes).toBe(2);
    });
  });

  describe("addFakeQRs()", () => {
    it("debe agregar cantidad especificada de QRs falsos", async () => {
      const generateFake = () => "fake-encrypted-" + Math.random();

      await repository.addFakeQRs("session-123", 3, generateFake);

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(3);
      expect(entries.every((e) => e.isFake)).toBe(true);
      expect(entries.every((e) => e.studentId === 0)).toBe(true);
    });

    it("debe generar IDs únicos para cada falso", async () => {
      const generateFake = () => "fake-encrypted";

      await repository.addFakeQRs("session-123", 5, generateFake);

      const entries = await repository.getAllEntries("session-123");
      const ids = entries.map((e) => e.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(5); // Todos diferentes
    });

    it("debe asignar rounds aleatorios entre 1-3", async () => {
      const generateFake = () => "fake-encrypted";

      await repository.addFakeQRs("session-123", 10, generateFake);

      const entries = await repository.getAllEntries("session-123");
      const rounds = entries.map((e) => e.round);

      expect(rounds.every((r) => r >= 1 && r <= 3)).toBe(true);
    });

    it("debe llamar a generateFake para cada QR", async () => {
      const generateFake = vi.fn(() => "fake-encrypted");

      await repository.addFakeQRs("session-123", 4, generateFake);

      expect(generateFake).toHaveBeenCalledTimes(4);
    });
  });

  describe("removeFakeQRs()", () => {
    it("debe remover cantidad especificada de QRs falsos", async () => {
      await repository.addFakeQRs("session-123", 5, () => "fake-encrypted");

      const removed = await repository.removeFakeQRs("session-123", 3);

      expect(removed).toBe(3);
      const stats = await repository.getPoolStats("session-123");
      expect(stats.fakes).toBe(2);
    });

    it("debe retornar 0 si no hay QRs falsos", async () => {
      await repository.upsertStudentQR("session-123", 12345, "encrypted", 1);

      const removed = await repository.removeFakeQRs("session-123", 3);

      expect(removed).toBe(0);
    });

    it("debe remover solo la cantidad disponible si se pide más", async () => {
      await repository.addFakeQRs("session-123", 2, () => "fake-encrypted");

      const removed = await repository.removeFakeQRs("session-123", 5);

      expect(removed).toBe(2);
      const stats = await repository.getPoolStats("session-123");
      expect(stats.fakes).toBe(0);
    });

    it("debe mantener QRs de estudiantes al remover falsos", async () => {
      await repository.upsertStudentQR("session-123", 1001, "student-1", 1);
      await repository.upsertStudentQR("session-123", 1002, "student-2", 2);
      await repository.addFakeQRs("session-123", 3, () => "fake-encrypted");

      await repository.removeFakeQRs("session-123", 3);

      const stats = await repository.getPoolStats("session-123");
      expect(stats.students).toBe(2);
      expect(stats.fakes).toBe(0);
    });

    it("debe mantener TTL después de remover falsos", async () => {
      await repository.addFakeQRs("session-123", 3, () => "fake-encrypted");
      await repository.removeFakeQRs("session-123", 2);

      const expirations = mockClient.getExpirations();
      expect(expirations.get("pool:session:session-123")).toBe(7200);
    });
  });

  describe("clearPool()", () => {
    it("debe limpiar todo el pool y el índice", async () => {
      await repository.upsertStudentQR("session-123", 1001, "encrypted-1", 1);
      await repository.upsertStudentQR("session-123", 1002, "encrypted-2", 2);
      await repository.addFakeQRs("session-123", 2, () => "fake-encrypted");
      await repository.getNextEntry("session-123"); // Crear índice

      await repository.clearPool("session-123");

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(0);

      const store = mockClient.getStore();
      expect(store.has("pool:session:session-123")).toBe(false);
      expect(store.has("pool:index:session-123")).toBe(false);
    });

    it("debe ser idempotente (llamar múltiples veces)", async () => {
      await repository.upsertStudentQR("session-123", 1001, "encrypted-1", 1);

      await repository.clearPool("session-123");
      await repository.clearPool("session-123"); // Segunda llamada
      await repository.clearPool("session-123"); // Tercera llamada

      const entries = await repository.getAllEntries("session-123");
      expect(entries).toHaveLength(0);
    });
  });

  describe("Flujos completos", () => {
    it("debe manejar flujo completo: agregar estudiantes, falsos, ciclar, remover", async () => {
      // 1. Agregar 3 estudiantes
      await repository.upsertStudentQR("session-123", 1001, "enc-1", 1);
      await repository.upsertStudentQR("session-123", 1002, "enc-2", 2);
      await repository.upsertStudentQR("session-123", 1003, "enc-3", 3);

      // 2. Agregar 2 falsos
      await repository.addFakeQRs("session-123", 2, () => "fake-enc");

      // 3. Verificar stats
      let stats = await repository.getPoolStats("session-123");
      expect(stats.total).toBe(5);
      expect(stats.students).toBe(3);
      expect(stats.fakes).toBe(2);

      // 4. Ciclar por el pool
      const entry1 = await repository.getNextEntry("session-123");
      const entry2 = await repository.getNextEntry("session-123");
      const entry3 = await repository.getNextEntry("session-123");

      expect(entry1).not.toBeNull();
      expect(entry2).not.toBeNull();
      expect(entry3).not.toBeNull();

      // 5. Remover falsos
      const removed = await repository.removeFakeQRs("session-123", 2);
      expect(removed).toBe(2);

      // 6. Verificar stats finales
      stats = await repository.getPoolStats("session-123");
      expect(stats.total).toBe(3);
      expect(stats.students).toBe(3);
      expect(stats.fakes).toBe(0);
    });

    it("debe manejar actualización de QR de estudiante durante ciclo", async () => {
      // Agregar estudiante con QR inicial
      await repository.upsertStudentQR("session-123", 12345, "qr-round-1", 1);
      await repository.addFakeQRs("session-123", 2, () => "fake");

      // Obtener primera entrada
      const first = await repository.getNextEntry("session-123");

      // Actualizar QR del estudiante a round 2
      await repository.upsertStudentQR("session-123", 12345, "qr-round-2", 2);

      // Verificar que sigue habiendo 3 entradas (1 estudiante + 2 falsos)
      const stats = await repository.getPoolStats("session-123");
      expect(stats.total).toBe(3);
      expect(stats.students).toBe(1);

      // Verificar que el QR del estudiante fue actualizado
      const entries = await repository.getAllEntries("session-123");
      const studentEntry = entries.find((e) => !e.isFake);
      expect(studentEntry?.encrypted).toBe("qr-round-2");
      expect(studentEntry?.round).toBe(2);
    });
  });
});
