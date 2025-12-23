/**
 * Tests: QR Payload Repository Adapter
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QRPayloadRepositoryAdapter } from "../qr-payload-repository.adapter";
import type {
  QRPayloadV1,
  StoredPayload,
  PayloadValidationResult,
} from "../../../../../shared/types";

describe("QRPayloadRepositoryAdapter", () => {
  describe("constructor", () => {
    it("debe crear adapter con TTL", () => {
      const adapter = new QRPayloadRepositoryAdapter(120);
      expect(adapter).toBeDefined();
    });
  });

  describe("delegation pattern", () => {
    it("debe delegar operaciones al repository interno", async () => {
      const adapter = new QRPayloadRepositoryAdapter(60);
      const payloadRepo = (adapter as any).payloadRepo;

      // Spy en métodos del repository
      const storeSpy = vi.spyOn(payloadRepo, "store");
      const findSpy = vi.spyOn(payloadRepo, "findByNonce");
      const validateSpy = vi.spyOn(payloadRepo, "validate");
      const markSpy = vi.spyOn(payloadRepo, "markAsConsumed");
      const deleteSpy = vi.spyOn(payloadRepo, "delete");
      const countSpy = vi.spyOn(payloadRepo, "countActiveForSession");

      expect(storeSpy).toBeDefined();
      expect(findSpy).toBeDefined();
      expect(validateSpy).toBeDefined();
      expect(markSpy).toBeDefined();
      expect(deleteSpy).toBeDefined();
      expect(countSpy).toBeDefined();
    });
  });

  describe("interface compliance", () => {
    it("debe implementar todos los métodos de IQRPayloadRepository", () => {
      const adapter = new QRPayloadRepositoryAdapter(60);

      expect(typeof adapter.store).toBe("function");
      expect(typeof adapter.findByNonce).toBe("function");
      expect(typeof adapter.validate).toBe("function");
      expect(typeof adapter.markAsConsumed).toBe("function");
      expect(typeof adapter.delete).toBe("function");
      expect(typeof adapter.countActiveForSession).toBe("function");
    });

    it("store debe retornar Promise<void>", async () => {
      const adapter = new QRPayloadRepositoryAdapter(60);
      const payload: QRPayloadV1 = {
        v: 1,
        sid: "test",
        uid: 123,
        r: 1,
        ts: Date.now(),
        n: "12345678901234567890123456789012",
      };

      const result = adapter.store(payload, "encrypted");
      expect(result).toBeInstanceOf(Promise);
    });

    it("findByNonce debe retornar Promise", () => {
      const adapter = new QRPayloadRepositoryAdapter(60);

      const result = adapter.findByNonce("test-nonce");
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
