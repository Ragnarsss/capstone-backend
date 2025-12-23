/**
 * Tests para ActiveSessionRepository
 *
 * @description Tests para repositorio de sesión activa en Valkey
 * @coverage Target: ~95%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ActiveSessionRepository,
  type ActiveSessionInfo,
} from "../active-session.repository";
import { ValkeyClient } from "../valkey-client";

// Mock de logger
vi.mock("../../logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock de ValkeyClient
class MockValkeyClient {
  private store: Map<string, { value: string; ttl?: number }>;

  constructor() {
    this.store = new Map();
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, { value, ttl: seconds });
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    const data = this.store.get(key);
    return data ? data.value : null;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const data = this.store.get(key);
    if (!data) {
      return 0;
    }
    data.ttl = seconds;
    return 1;
  }

  reset() {
    this.store.clear();
  }

  // Helper methods for testing
  getStore() {
    return this.store;
  }

  getTTL(key: string): number | undefined {
    const data = this.store.get(key);
    return data?.ttl;
  }
}

describe("ActiveSessionRepository", () => {
  let repository: ActiveSessionRepository;
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

    repository = new ActiveSessionRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockClient.reset();
  });

  describe("setActiveSession()", () => {
    it("debe registrar una sesión como activa", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      const active = await repository.getActiveSession();
      expect(active).toEqual(sessionInfo);
    });

    it("debe establecer TTL de 2 horas (7200 segundos)", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      const ttl = mockClient.getTTL("active:session");
      expect(ttl).toBe(7200);
    });

    it("debe reemplazar sesión anterior", async () => {
      const session1: ActiveSessionInfo = {
        sessionId: "session-old",
        hostUserId: 11111,
        hostUsername: "profesor.lopez",
        startedAt: Date.now() - 10000,
      };

      const session2: ActiveSessionInfo = {
        sessionId: "session-new",
        hostUserId: 22222,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(session1);
      await repository.setActiveSession(session2);

      const active = await repository.getActiveSession();
      expect(active?.sessionId).toBe("session-new");
      expect(active?.hostUserId).toBe(22222);
    });

    it("debe serializar correctamente todos los campos", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-abc-123-xyz-789",
        hostUserId: 999999,
        hostUsername: "profesor.martinez@universidad.cl",
        startedAt: 1734567890123,
      };

      await repository.setActiveSession(sessionInfo);

      const active = await repository.getActiveSession();
      expect(active?.sessionId).toBe("session-abc-123-xyz-789");
      expect(active?.hostUserId).toBe(999999);
      expect(active?.hostUsername).toBe("profesor.martinez@universidad.cl");
      expect(active?.startedAt).toBe(1734567890123);
    });
  });

  describe("getActiveSession()", () => {
    it("debe retornar null si no hay sesión activa", async () => {
      const active = await repository.getActiveSession();
      expect(active).toBeNull();
    });

    it("debe retornar la sesión activa registrada", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      const active = await repository.getActiveSession();
      expect(active).not.toBeNull();
      expect(active?.sessionId).toBe("session-123");
      expect(active?.hostUserId).toBe(12345);
    });

    it("debe parsear JSON correctamente", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-456",
        hostUserId: 67890,
        hostUsername: "profesor.rodriguez",
        startedAt: 1234567890,
      };

      await repository.setActiveSession(sessionInfo);

      const active = await repository.getActiveSession();
      expect(active).toBeInstanceOf(Object);
      expect(typeof active?.sessionId).toBe("string");
      expect(typeof active?.hostUserId).toBe("number");
      expect(typeof active?.hostUsername).toBe("string");
      expect(typeof active?.startedAt).toBe("number");
    });

    it("debe retornar null si hay JSON inválido en Valkey", async () => {
      // Insertar JSON inválido directamente
      await mockClient.setex("active:session", 7200, "invalid-json-{{{");

      const active = await repository.getActiveSession();
      expect(active).toBeNull();
    });

    it("debe retornar null si el valor no es JSON", async () => {
      // Insertar texto plano
      await mockClient.setex("active:session", 7200, "not a json object");

      const active = await repository.getActiveSession();
      expect(active).toBeNull();
    });
  });

  describe("clearActiveSession()", () => {
    it("debe limpiar la sesión activa si el sessionId coincide", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);
      const cleared = await repository.clearActiveSession("session-123");

      expect(cleared).toBe(true);
      const active = await repository.getActiveSession();
      expect(active).toBeNull();
    });

    it("debe retornar false si no hay sesión activa", async () => {
      const cleared = await repository.clearActiveSession("session-123");

      expect(cleared).toBe(false);
    });

    it("debe retornar false si el sessionId no coincide", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);
      const cleared = await repository.clearActiveSession("session-999");

      expect(cleared).toBe(false);
      // Sesión original debe seguir activa
      const active = await repository.getActiveSession();
      expect(active?.sessionId).toBe("session-123");
    });

    it("debe ser seguro para evitar limpiar sesión de otro host", async () => {
      // Host 1 inicia sesión
      const session1: ActiveSessionInfo = {
        sessionId: "session-host-1",
        hostUserId: 11111,
        hostUsername: "profesor.lopez",
        startedAt: Date.now(),
      };
      await repository.setActiveSession(session1);

      // Host 2 intenta limpiar sesión de Host 1
      const cleared = await repository.clearActiveSession("session-host-2");

      expect(cleared).toBe(false);
      const active = await repository.getActiveSession();
      expect(active?.sessionId).toBe("session-host-1"); // Sigue activa
    });

    it("debe ser idempotente (llamar múltiples veces)", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      const cleared1 = await repository.clearActiveSession("session-123");
      const cleared2 = await repository.clearActiveSession("session-123");
      const cleared3 = await repository.clearActiveSession("session-123");

      expect(cleared1).toBe(true);
      expect(cleared2).toBe(false); // Ya no existe
      expect(cleared3).toBe(false); // Ya no existe
    });
  });

  describe("refreshTTL()", () => {
    it("debe renovar TTL de sesión activa", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      // Simular que pasó tiempo (en producción el TTL se reduciría)
      // Aquí solo verificamos que expire se llama correctamente
      const refreshed = await repository.refreshTTL();

      expect(refreshed).toBe(true);
      const ttl = mockClient.getTTL("active:session");
      expect(ttl).toBe(7200); // TTL renovado a 2 horas
    });

    it("debe retornar false si no hay sesión activa", async () => {
      const refreshed = await repository.refreshTTL();
      expect(refreshed).toBe(false);
    });

    it("debe mantener los datos de la sesión al renovar TTL", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);
      await repository.refreshTTL();

      const active = await repository.getActiveSession();
      expect(active).toEqual(sessionInfo); // Datos intactos
    });

    it("debe poder renovar TTL múltiples veces", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      const refresh1 = await repository.refreshTTL();
      const refresh2 = await repository.refreshTTL();
      const refresh3 = await repository.refreshTTL();

      expect(refresh1).toBe(true);
      expect(refresh2).toBe(true);
      expect(refresh3).toBe(true);
    });
  });

  describe("Flujos completos", () => {
    it("debe manejar ciclo completo: set -> get -> refresh -> clear", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-complete-test",
        hostUserId: 12345,
        hostUsername: "profesor.test",
        startedAt: Date.now(),
      };

      // 1. Registrar sesión
      await repository.setActiveSession(sessionInfo);
      expect(mockClient.getTTL("active:session")).toBe(7200);

      // 2. Obtener sesión activa
      let active = await repository.getActiveSession();
      expect(active).toEqual(sessionInfo);

      // 3. Renovar TTL
      const refreshed = await repository.refreshTTL();
      expect(refreshed).toBe(true);

      // 4. Verificar que sigue activa
      active = await repository.getActiveSession();
      expect(active).toEqual(sessionInfo);

      // 5. Limpiar sesión
      const cleared = await repository.clearActiveSession(
        "session-complete-test"
      );
      expect(cleared).toBe(true);

      // 6. Verificar que ya no existe
      active = await repository.getActiveSession();
      expect(active).toBeNull();
    });

    it("debe manejar reemplazo de sesión por otro host", async () => {
      // Host 1 inicia sesión
      const session1: ActiveSessionInfo = {
        sessionId: "session-host-1",
        hostUserId: 11111,
        hostUsername: "profesor.lopez",
        startedAt: Date.now() - 5000,
      };
      await repository.setActiveSession(session1);

      let active = await repository.getActiveSession();
      expect(active?.sessionId).toBe("session-host-1");

      // Host 2 inicia sesión (reemplaza a Host 1)
      const session2: ActiveSessionInfo = {
        sessionId: "session-host-2",
        hostUserId: 22222,
        hostUsername: "profesor.garcia",
        startedAt: Date.now(),
      };
      await repository.setActiveSession(session2);

      active = await repository.getActiveSession();
      expect(active?.sessionId).toBe("session-host-2");
      expect(active?.hostUserId).toBe(22222);

      // Host 1 intenta limpiar su sesión antigua
      const cleared = await repository.clearActiveSession("session-host-1");
      expect(cleared).toBe(false); // No debería poder limpiar

      // Sesión de Host 2 sigue activa
      active = await repository.getActiveSession();
      expect(active?.sessionId).toBe("session-host-2");
    });

    it("debe manejar error de JSON y recuperación", async () => {
      // Insertar JSON inválido
      await mockClient.setex("active:session", 7200, "invalid-json");

      // Debe retornar null
      let active = await repository.getActiveSession();
      expect(active).toBeNull();

      // Registrar sesión válida
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-recovery",
        hostUserId: 12345,
        hostUsername: "profesor.recovery",
        startedAt: Date.now(),
      };
      await repository.setActiveSession(sessionInfo);

      // Ahora debe funcionar correctamente
      active = await repository.getActiveSession();
      expect(active).toEqual(sessionInfo);
    });

    it("debe permitir solo una sesión activa a la vez (MVP constraint)", async () => {
      const sessions: ActiveSessionInfo[] = [
        {
          sessionId: "session-1",
          hostUserId: 1001,
          hostUsername: "profesor.uno",
          startedAt: Date.now(),
        },
        {
          sessionId: "session-2",
          hostUserId: 1002,
          hostUsername: "profesor.dos",
          startedAt: Date.now() + 1000,
        },
        {
          sessionId: "session-3",
          hostUserId: 1003,
          hostUsername: "profesor.tres",
          startedAt: Date.now() + 2000,
        },
      ];

      // Registrar múltiples sesiones (cada una reemplaza la anterior)
      for (const session of sessions) {
        await repository.setActiveSession(session);
      }

      // Solo la última debe estar activa
      const active = await repository.getActiveSession();
      expect(active?.sessionId).toBe("session-3");
      expect(active?.hostUserId).toBe(1003);
    });
  });

  describe("Edge cases", () => {
    it("debe manejar sessionId muy largo", async () => {
      const longSessionId = "a".repeat(1000);
      const sessionInfo: ActiveSessionInfo = {
        sessionId: longSessionId,
        hostUserId: 12345,
        hostUsername: "profesor.test",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      const active = await repository.getActiveSession();
      expect(active?.sessionId).toBe(longSessionId);
    });

    it("debe manejar caracteres especiales en username", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.garcía-lópez@universidad.cl 🎓",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      const active = await repository.getActiveSession();
      expect(active?.hostUsername).toBe(
        "profesor.garcía-lópez@universidad.cl 🎓"
      );
    });

    it("debe manejar timestamps muy grandes", async () => {
      const futureTimestamp = 9999999999999; // Far future
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 12345,
        hostUsername: "profesor.test",
        startedAt: futureTimestamp,
      };

      await repository.setActiveSession(sessionInfo);

      const active = await repository.getActiveSession();
      expect(active?.startedAt).toBe(futureTimestamp);
    });

    it("debe manejar userId = 0", async () => {
      const sessionInfo: ActiveSessionInfo = {
        sessionId: "session-123",
        hostUserId: 0, // Edge case
        hostUsername: "admin",
        startedAt: Date.now(),
      };

      await repository.setActiveSession(sessionInfo);

      const active = await repository.getActiveSession();
      expect(active?.hostUserId).toBe(0);
    });
  });
});
