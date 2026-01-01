/**
 * Tests: QR Generator Adapter
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QRGeneratorAdapter } from "../qr-generator.adapter";
import type { AesGcmService } from "../../../../../shared/infrastructure/crypto";
import type {
  GenerateStudentQROptions,
  GenerateQRResult,
} from "../../../../../shared/ports";
import type { QRPayloadV1 } from "../../../../../shared/types";

describe("QRGeneratorAdapter", () => {
  let adapter: QRGeneratorAdapter;
  let mockAesService: AesGcmService;

  beforeEach(() => {
    mockAesService = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      encryptToPayload: vi
        .fn()
        .mockReturnValue({
          encrypted: "encrypted-payload-data",
          iv: "iv-data",
        }),
      encryptWithRandomKey: vi
        .fn()
        .mockImplementation(
          () => `encrypted-${Math.random().toString(36).substring(7)}`
        ),
    } as unknown as AesGcmService;
    adapter = new QRGeneratorAdapter(mockAesService);
  });

  describe("generateForStudent()", () => {
    it("debe generar QR para estudiante con todas las opciones", () => {
      const options: GenerateStudentQROptions = {
        sessionId: "session-123",
        userId: 456,
        round: 1,
        hostUserId: 789,
      };

      const result = adapter.generateForStudent(options);

      expect(result).toHaveProperty("payload");
      expect(result).toHaveProperty("encrypted");
      expect(typeof result.encrypted).toBe("string");
      expect(result.payload).toHaveProperty("v");
      expect(result.payload).toHaveProperty("sid");
      expect(result.payload).toHaveProperty("uid");
      expect(result.payload.sid).toBe("session-123");
      expect(result.payload.uid).toBe(456); // userId es el estudiante
    });

    it("debe generar nonce único por cada llamada", () => {
      const options: GenerateStudentQROptions = {
        sessionId: "session-123",
        userId: 456,
        round: 1,
        hostUserId: 789,
      };

      const result1 = adapter.generateForStudent(options);
      const result2 = adapter.generateForStudent(options);

      expect(result1.payload.n).not.toBe(result2.payload.n);
    });

    it("debe manejar diferentes rounds", () => {
      const options1: GenerateStudentQROptions = {
        sessionId: "session-123",
        userId: 456,
        round: 0,
        hostUserId: 789,
      };

      const options2: GenerateStudentQROptions = {
        ...options1,
        round: 2,
      };

      const result1 = adapter.generateForStudent(options1);
      const result2 = adapter.generateForStudent(options2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.payload.r).toBe(0);
      expect(result2.payload.r).toBe(2);
      expect(result1.payload.n).not.toBe(result2.payload.n);
    });
  });

  describe("generateNonce()", () => {
    it("debe generar nonce aleatorio", () => {
      const nonce1 = adapter.generateNonce();
      const nonce2 = adapter.generateNonce();

      expect(typeof nonce1).toBe("string");
      expect(typeof nonce2).toBe("string");
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBeGreaterThan(0);
    });

    it("debe generar nonces únicos en múltiples llamadas", () => {
      const nonces = new Set<string>();

      for (let i = 0; i < 100; i++) {
        nonces.add(adapter.generateNonce());
      }

      expect(nonces.size).toBe(100);
    });
  });

  describe("encryptPayloadWithRandomKey()", () => {
    it("debe encriptar payload", () => {
      const payload: QRPayloadV1 = {
        v: 1,
        sid: "session-123",
        uid: 456,
        rnd: 1,
        ts: Date.now(),
        exp: Date.now() + 60000,
        nonce: "test-nonce-123",
      };

      const encrypted = adapter.encryptPayloadWithRandomKey(payload);

      expect(typeof encrypted).toBe("string");
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it("debe generar salidas diferentes para el mismo payload", () => {
      const payload: QRPayloadV1 = {
        v: 1,
        sid: "session-123",
        uid: 456,
        rnd: 1,
        ts: Date.now(),
        exp: Date.now() + 60000,
        nonce: "test-nonce-123",
      };

      const encrypted1 = adapter.encryptPayloadWithRandomKey(payload);
      const encrypted2 = adapter.encryptPayloadWithRandomKey(payload);

      // Debe ser diferente porque usa random key
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("debe manejar payload con diferentes campos", () => {
      const payload: QRPayloadV1 = {
        v: 1,
        sid: "different-session",
        uid: 999,
        rnd: 5,
        ts: Date.now(),
        exp: Date.now() + 120000,
        nonce: "different-nonce",
      };

      const encrypted = adapter.encryptPayloadWithRandomKey(payload);

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
    });
  });
});
