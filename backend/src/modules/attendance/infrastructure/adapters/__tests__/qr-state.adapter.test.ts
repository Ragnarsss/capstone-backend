/**
 * Tests: QR State Adapter
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QRStateAdapter, createQRStateAdapter } from "../qr-state.adapter";
import type { ProjectionPoolRepository } from "../../../../../shared/infrastructure/valkey";

describe("QRStateAdapter", () => {
  let adapter: QRStateAdapter;
  let mockPoolRepo: ProjectionPoolRepository;

  beforeEach(() => {
    mockPoolRepo = {
      getNextEntry: vi.fn(),
      addEntry: vi.fn(),
      removeEntry: vi.fn(),
      upsertEntry: vi.fn(),
      getPoolStats: vi.fn(),
    } as unknown as ProjectionPoolRepository;
    adapter = new QRStateAdapter(mockPoolRepo);
  });

  describe("getState()", () => {
    it("debe retornar estado genérico para QR existente", async () => {
      const nonce = "test-nonce-abc123";

      const state = await adapter.getState(nonce);

      expect(state).toBeDefined();
      expect(state?.exists).toBe(true);
      expect(state?.consumed).toBe(false);
    });

    it("debe retornar mismo estado para diferentes nonces", async () => {
      const state1 = await adapter.getState("nonce-1");
      const state2 = await adapter.getState("nonce-2");

      expect(state1).toEqual(state2);
      expect(state1?.exists).toBe(true);
      expect(state1?.consumed).toBe(false);
    });

    it("debe funcionar sin interactuar con pool repository", async () => {
      const state = await adapter.getState("any-nonce");

      expect(state).toBeDefined();
      expect(mockPoolRepo.getNextEntry).not.toHaveBeenCalled();
    });
  });

  describe("createQRStateAdapter()", () => {
    it("debe crear adapter con dependencies por defecto", () => {
      const adapter = createQRStateAdapter();

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(QRStateAdapter);
    });

    it("debe crear adapter con pool repository custom", () => {
      const adapter = createQRStateAdapter(mockPoolRepo);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(QRStateAdapter);
    });

    it("debe crear adapter con TTL custom", () => {
      const adapter = createQRStateAdapter(mockPoolRepo, 120);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(QRStateAdapter);
    });
  });

  describe("constructor con TTL custom", () => {
    it("debe aceptar TTL personalizado", () => {
      const customAdapter = new QRStateAdapter(mockPoolRepo, 300);

      expect(customAdapter).toBeDefined();
    });

    it("debe funcionar con TTL cero", () => {
      const customAdapter = new QRStateAdapter(mockPoolRepo, 0);

      expect(customAdapter).toBeDefined();
    });
  });
});
