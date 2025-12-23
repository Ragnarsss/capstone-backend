import { describe, it, expect, beforeEach, vi } from "vitest";
import { PoolFeeder } from "../pool-feeder.service";
import type { FeedStudentInput } from "../pool-feeder.service";
import { AesGcmService } from "../../../../../shared/infrastructure/crypto";
import { ProjectionPoolRepository } from "../../../../../shared/infrastructure/valkey";
import { QRPayloadRepository } from "../../../infrastructure/qr-payload.repository";
import { SessionKeyRepository } from "../../../../session/infrastructure/repositories/session-key.repository";
import { PayloadBuilder } from "../../../domain/services";

describe("PoolFeeder", () => {
  let poolFeeder: PoolFeeder;
  let mockAesService: AesGcmService;
  let mockPoolRepo: ProjectionPoolRepository;
  let mockPayloadRepo: QRPayloadRepository;
  let mockSessionKeyRepo: SessionKeyRepository;

  const baseInput: FeedStudentInput = {
    sessionId: "session-123",
    studentId: 12345,
    roundNumber: 1,
    hostUserId: 99,
  };

  beforeEach(() => {
    // Crear mocks (AesGcmService espera 32 bytes, no 64 hex chars)
    mockAesService = new AesGcmService("0".repeat(32));
    mockPoolRepo = {} as ProjectionPoolRepository;
    mockPayloadRepo = {} as QRPayloadRepository;
    mockSessionKeyRepo = {} as SessionKeyRepository;

    // Mock de los métodos
    mockPoolRepo.upsertStudentQR = vi.fn();
    mockPayloadRepo.store = vi.fn();
    mockSessionKeyRepo.findByUserId = vi.fn();

    poolFeeder = new PoolFeeder(
      mockAesService,
      mockPoolRepo,
      mockPayloadRepo,
      60,
      mockSessionKeyRepo
    );
  });

  describe("feedStudentQR", () => {
    describe("flujo exitoso", () => {
      it("debe alimentar un QR de estudiante exitosamente con session_key real", async () => {
        // Arrange
        const realSessionKey = "1".repeat(32); // 32 bytes
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue({
          userId: 12345,
          sessionKey: realSessionKey,
          createdAt: new Date(),
        });
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-123"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        // Act
        const result = await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(result.success).toBe(true);
        expect(result.payload).toBeDefined();
        expect(result.encrypted).toBeDefined();
        expect(result.poolEntryId).toBe("pool-entry-123");
        expect(result.error).toBeUndefined();

        // Verificar que se usó session_key real
        expect(mockSessionKeyRepo.findByUserId).toHaveBeenCalledWith(12345);
      });

      it("debe usar fallback key cuando no hay session_key", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-456"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        // Act
        const result = await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(result.success).toBe(true);
        expect(result.payload).toBeDefined();
        expect(result.encrypted).toBeDefined();
        expect(mockSessionKeyRepo.findByUserId).toHaveBeenCalledWith(12345);
      });

      it("debe generar payload con los datos correctos", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-789"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        // Act
        const result = await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(result.payload).toMatchObject({
          v: 1,
          sid: "session-123",
          uid: 99,
          r: 1,
        });
        expect(result.payload?.ts).toBeGreaterThan(0);
        expect(result.payload?.n).toHaveLength(32); // MD5 hash format
      });

      it("debe encriptar el payload correctamente", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-111"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        // Act
        const result = await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(result.encrypted).toBeDefined();
        // Formato: iv.ciphertext.authTag (base64 strings separated by dots)
        expect(result.encrypted?.split(".")).toHaveLength(3);

        // Verificar que se puede desencriptar con la misma clave
        const decrypted = mockAesService.decryptFromPayload(result.encrypted!);
        const parsed = JSON.parse(decrypted);
        expect(parsed).toMatchObject({
          v: 1,
          sid: "session-123",
        });
      });

      it("debe almacenar el payload con el TTL correcto", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-222"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        const inputWithTTL: FeedStudentInput = {
          ...baseInput,
          payloadTTL: 120,
        };

        // Act
        await poolFeeder.feedStudentQR(inputWithTTL);

        // Assert
        expect(mockPayloadRepo.store).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(String),
          120
        );
      });

      it("debe usar TTL por defecto cuando no se especifica", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-333"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        // Act
        await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(mockPayloadRepo.store).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(String),
          60 // TTL por defecto
        );
      });

      it("debe insertar el QR en el pool con los parámetros correctos", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-444"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        // Act
        await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(mockPoolRepo.upsertStudentQR).toHaveBeenCalledWith(
          "session-123",
          12345,
          expect.any(String),
          1
        );
      });
    });

    describe("manejo de errores", () => {
      it("debe retornar error cuando sessionKeyRepo falla", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockRejectedValue(
          new Error("Database connection failed")
        );

        // Act
        const result = await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Database connection failed");
        expect(result.payload).toBeUndefined();
        expect(result.encrypted).toBeUndefined();
      });

      it("debe retornar error cuando payloadRepo.store falla", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPayloadRepo.store).mockRejectedValue(
          new Error("Valkey write failed")
        );

        // Act
        const result = await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Valkey write failed");
      });

      it("debe retornar error cuando poolRepo.upsertStudentQR falla", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();
        vi.mocked(mockPoolRepo.upsertStudentQR).mockRejectedValue(
          new Error("Pool insertion failed")
        );

        // Act
        const result = await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Pool insertion failed");
      });

      it("debe manejar errores no-Error correctamente", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockRejectedValue(
          "String error"
        );

        // Act
        const result = await poolFeeder.feedStudentQR(baseInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Unknown error");
      });
    });

    describe("casos edge", () => {
      it("debe manejar roundNumber = 0", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-555"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        const input: FeedStudentInput = {
          ...baseInput,
          roundNumber: 0,
        };

        // Act
        const result = await poolFeeder.feedStudentQR(input);

        // Assert
        expect(result.success).toBe(true);
        expect(result.payload?.r).toBe(0);
      });

      it("debe manejar roundNumber muy grande", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-666"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        const input: FeedStudentInput = {
          ...baseInput,
          roundNumber: 999999,
        };

        // Act
        const result = await poolFeeder.feedStudentQR(input);

        // Assert
        expect(result.success).toBe(true);
        expect(result.payload?.r).toBe(999999);
      });

      it("debe manejar sessionId muy largo", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-777"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        const input: FeedStudentInput = {
          ...baseInput,
          sessionId: "x".repeat(1000),
        };

        // Act
        const result = await poolFeeder.feedStudentQR(input);

        // Assert
        expect(result.success).toBe(true);
        expect(result.payload?.sid).toHaveLength(1000);
      });

      it("debe manejar TTL = 0", async () => {
        // Arrange
        vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
        vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
          "pool-entry-888"
        );
        vi.mocked(mockPayloadRepo.store).mockResolvedValue();

        const input: FeedStudentInput = {
          ...baseInput,
          payloadTTL: 0,
        };

        // Act
        await poolFeeder.feedStudentQR(input);

        // Assert
        expect(mockPayloadRepo.store).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(String),
          0
        );
      });
    });
  });

  describe("feedMultiple", () => {
    it("debe alimentar múltiples QRs exitosamente", async () => {
      // Arrange
      vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
      vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
        "pool-entry-multi"
      );
      vi.mocked(mockPayloadRepo.store).mockResolvedValue();

      const inputs: FeedStudentInput[] = [
        { ...baseInput, studentId: 1, roundNumber: 1 },
        { ...baseInput, studentId: 2, roundNumber: 1 },
        { ...baseInput, studentId: 3, roundNumber: 1 },
      ];

      // Act
      const results = await poolFeeder.feedMultiple(inputs);

      // Assert
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockSessionKeyRepo.findByUserId).toHaveBeenCalledTimes(3);
      expect(mockPayloadRepo.store).toHaveBeenCalledTimes(3);
      expect(mockPoolRepo.upsertStudentQR).toHaveBeenCalledTimes(3);
    });

    it("debe retornar array vacío para input vacío", async () => {
      // Act
      const results = await poolFeeder.feedMultiple([]);

      // Assert
      expect(results).toEqual([]);
    });

    it("debe manejar fallos parciales", async () => {
      // Arrange
      vi.mocked(mockSessionKeyRepo.findByUserId).mockImplementation(
        async (studentId) => {
          if (studentId === 2) {
            throw new Error("Failed for student 2");
          }
          return null;
        }
      );
      vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
        "pool-entry-partial"
      );
      vi.mocked(mockPayloadRepo.store).mockResolvedValue();

      const inputs: FeedStudentInput[] = [
        { ...baseInput, studentId: 1, roundNumber: 1 },
        { ...baseInput, studentId: 2, roundNumber: 1 },
        { ...baseInput, studentId: 3, roundNumber: 1 },
      ];

      // Act
      const results = await poolFeeder.feedMultiple(inputs);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe("Failed for student 2");
      expect(results[2].success).toBe(true);
    });

    it("debe procesar múltiples estudiantes secuencialmente", async () => {
      // Arrange
      vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);
      vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
        "pool-entry-seq"
      );
      vi.mocked(mockPayloadRepo.store).mockResolvedValue();

      const callOrder: number[] = [];
      vi.mocked(mockPoolRepo.upsertStudentQR).mockImplementation(
        async (sessionId, studentId) => {
          callOrder.push(studentId);
          return "pool-entry-seq";
        }
      );

      const inputs: FeedStudentInput[] = [
        { ...baseInput, studentId: 10, roundNumber: 1 },
        { ...baseInput, studentId: 20, roundNumber: 1 },
        { ...baseInput, studentId: 30, roundNumber: 1 },
      ];

      // Act
      await poolFeeder.feedMultiple(inputs);

      // Assert
      expect(callOrder).toEqual([10, 20, 30]);
    });
  });

  describe("getNonce", () => {
    it("debe retornar el nonce del payload", () => {
      // Arrange
      const payload = PayloadBuilder.buildStudentPayload({
        sessionId: "session-test",
        hostUserId: 123,
        roundNumber: 1,
      });

      // Act
      const nonce = PoolFeeder.getNonce(payload);

      // Assert
      expect(nonce).toBe(payload.n);
      expect(nonce).toHaveLength(32); // MD5 hash format
    });

    it("debe retornar nonces únicos para diferentes payloads", () => {
      // Arrange
      const payload1 = PayloadBuilder.buildStudentPayload({
        sessionId: "session-1",
        hostUserId: 123,
        roundNumber: 1,
      });
      const payload2 = PayloadBuilder.buildStudentPayload({
        sessionId: "session-2",
        hostUserId: 123,
        roundNumber: 1,
      });

      // Act
      const nonce1 = PoolFeeder.getNonce(payload1);
      const nonce2 = PoolFeeder.getNonce(payload2);

      // Assert
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe("constructor", () => {
    it("debe usar valores por defecto cuando no se proporcionan", () => {
      // Act
      const feeder = new PoolFeeder();

      // Assert
      expect(feeder).toBeDefined();
      // No lanza error y puede ejecutar operaciones
    });

    it("debe aceptar dependencias personalizadas", () => {
      // Arrange
      const customAesService = new AesGcmService("A".repeat(32)); // 32 bytes
      const customTTL = 300;

      // Act
      const feeder = new PoolFeeder(
        customAesService,
        mockPoolRepo,
        mockPayloadRepo,
        customTTL,
        mockSessionKeyRepo
      );

      // Assert
      expect(feeder).toBeDefined();
    });
  });

  describe("integración con session_key", () => {
    it("debe crear nueva instancia de AesGcmService con session_key específica", async () => {
      // Arrange
      const specificKey = "B".repeat(32); // 32 bytes
      vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue({
        userId: 12345,
        sessionKey: specificKey,
        createdAt: new Date(),
      });
      vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
        "pool-entry-specific"
      );
      vi.mocked(mockPayloadRepo.store).mockResolvedValue();

      // Act
      const result = await poolFeeder.feedStudentQR(baseInput);

      // Assert
      expect(result.success).toBe(true);

      // Verificar que el payload se encriptó con la clave específica
      // Intentar desencriptar con otra clave debe fallar
      const wrongAesService = new AesGcmService("C".repeat(32)); // 32 bytes
      expect(() => {
        wrongAesService.decryptFromPayload(result.encrypted!);
      }).toThrow();
    });

    it("debe usar diferentes session_keys para diferentes estudiantes", async () => {
      // Arrange
      vi.mocked(mockSessionKeyRepo.findByUserId).mockImplementation(
        async (studentId) => {
          return {
            userId: studentId,
            sessionKey: studentId.toString().repeat(32).slice(0, 32), // 32 bytes
            createdAt: new Date(),
          };
        }
      );
      vi.mocked(mockPoolRepo.upsertStudentQR).mockResolvedValue(
        "pool-entry-diff"
      );
      vi.mocked(mockPayloadRepo.store).mockResolvedValue();

      // Act
      const result1 = await poolFeeder.feedStudentQR({
        ...baseInput,
        studentId: 100,
      });
      const result2 = await poolFeeder.feedStudentQR({
        ...baseInput,
        studentId: 200,
      });

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.encrypted).not.toBe(result2.encrypted);
    });
  });
});
