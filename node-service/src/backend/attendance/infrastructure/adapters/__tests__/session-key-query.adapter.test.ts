/**
 * Tests: Session Key Query Adapter
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionKeyQueryAdapter } from "../session-key-query.adapter";
import type { SessionKeyRepository } from "../../../../session/infrastructure/repositories/session-key.repository";
import type { SessionKeyData } from "../../../../../shared/ports";

describe("SessionKeyQueryAdapter", () => {
  let adapter: SessionKeyQueryAdapter;
  let mockRepository: SessionKeyRepository;

  beforeEach(() => {
    mockRepository = {
      findByUserId: vi.fn(),
    } as unknown as SessionKeyRepository;
    adapter = new SessionKeyQueryAdapter(mockRepository);
  });

  describe("findByUserId()", () => {
    it("debe delegar al repository", async () => {
      const mockSessionKey: SessionKeyData = {
        userId: 123,
        sessionKey: "test-session-key-abc123",
      };

      vi.spyOn(mockRepository, "findByUserId").mockResolvedValue(
        mockSessionKey
      );

      const result = await adapter.findByUserId(123);

      expect(mockRepository.findByUserId).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockSessionKey);
    });

    it("debe retornar null si el usuario no existe", async () => {
      vi.spyOn(mockRepository, "findByUserId").mockResolvedValue(null);

      const result = await adapter.findByUserId(999);

      expect(result).toBeNull();
    });

    it("debe propagar errores del repository", async () => {
      vi.spyOn(mockRepository, "findByUserId").mockRejectedValue(
        new Error("Database error")
      );

      await expect(adapter.findByUserId(123)).rejects.toThrow("Database error");
    });
  });
});
