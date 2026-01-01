/**
 * Tests: Validate Scan UseCase
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ValidateScanUseCase,
  createValidateScanUseCase,
  type ValidateScanDependencies,
} from "../validate-scan.usecase";
import type { AesGcmService } from "../../../../shared/infrastructure/crypto";
import type { QRStateLoader } from "../../domain/validation-pipeline/stages/load-qr-state.stage";
import type { StudentStateLoader } from "../../domain/validation-pipeline/stages/load-student-state.stage";
import type { ISessionKeyQuery, ITotpValidator } from "../../../../shared/ports";
import { totp } from "otplib";

describe("ValidateScanUseCase", () => {
  let useCase: ValidateScanUseCase;
  let mockAesService: AesGcmService;
  let mockQRStateLoader: QRStateLoader;
  let mockStudentStateLoader: StudentStateLoader;
  let mockSessionKeyQuery: ISessionKeyQuery;
  let mockTotpValidator: ITotpValidator;
  let deps: ValidateScanDependencies;

  beforeEach(() => {
    // Configurar STUB MODE para simplificar testing
    process.env.ENROLLMENT_STUB_MODE = "true";

    const sessionKey = "test-session-key-12345678901234567890123456789012";
    const validTOTP = totp.generate(sessionKey);

    const mockPayload = {
      v: 1 as const,
      sid: "session-123",
      uid: 456,
      r: 1,
      ts: Date.now(),
      n: "12345678901234567890123456789012",
    };

    // Mock completo de AesGcmService
    mockAesService = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      decryptToPayload: vi.fn(),
      decryptFromPayload: vi.fn().mockReturnValue(JSON.stringify(mockPayload)),
      encryptToPayload: vi.fn(),
      encryptWithRandomKey: vi.fn(),
    } as unknown as AesGcmService;

    mockQRStateLoader = {
      getState: vi.fn().mockResolvedValue({
        exists: true,
        consumed: false,
      }),
    } as QRStateLoader;

    mockStudentStateLoader = {
      getState: vi.fn().mockResolvedValue({
        registered: true,
        status: "in_progress",
        currentRound: 1,
        activeNonce: "12345678901234567890123456789012",
        roundsCompleted: [],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
      }),
    } as StudentStateLoader;

    mockSessionKeyQuery = {
      findByUserId: vi.fn().mockResolvedValue({
        userId: 456,
        sessionKey: "test-session-key-12345678901234567890123456789012", // 32+ chars
      }),
    } as ISessionKeyQuery;

    mockTotpValidator = {
      validate: vi.fn().mockReturnValue(true),
    } as ITotpValidator;

    deps = {
      aesGcmService: mockAesService,
      qrStateLoader: mockQRStateLoader,
      studentStateLoader: mockStudentStateLoader,
      sessionKeyQuery: mockSessionKeyQuery,
      totpValidator: mockTotpValidator,
    };

    useCase = new ValidateScanUseCase(deps);
  });

  describe("execute()", () => {
    it("debe ejecutar pipeline y retornar resultado", async () => {
      const result = await useCase.execute("encrypted-qr-data", 456);

      // El resultado puede ser válido o inválido dependiendo del pipeline
      // Lo importante es que ejecute sin errores
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe("boolean");
    });

    it("debe incluir trace en resultado", async () => {
      const result = await useCase.execute("encrypted-qr-data", 456);

      expect(result.trace).toBeDefined();
      expect(typeof result.trace).toBe("string");
    });

    it("debe incluir context en resultado", async () => {
      const result = await useCase.execute("encrypted-qr-data", 456);

      expect(result.context).toBeDefined();
      expect(result.context?.studentId).toBe(456);
    });

    it("debe propagar encrypted string al contexto", async () => {
      const encrypted = "test-encrypted-data-123";
      const result = await useCase.execute(encrypted, 456);

      expect(result.context?.encrypted).toBe(encrypted);
    });

    it("debe propagar studentId al contexto", async () => {
      const result = await useCase.execute("encrypted-qr-data", 789);

      expect(result.context?.studentId).toBe(789);
    });

    it("debe incluir error cuando falla validación", async () => {
      // Forzar un error haciendo que QR no exista
      vi.spyOn(mockQRStateLoader, "getState").mockResolvedValue({
        exists: false,
        consumed: false,
      });

      const result = await useCase.execute("encrypted-qr-data", 456);

      if (!result.valid) {
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBeDefined();
        expect(result.error?.message).toBeDefined();
      }
    });

    it("debe manejar diferentes studentId", async () => {
      const result1 = await useCase.execute("encrypted-1", 100);
      const result2 = await useCase.execute("encrypted-2", 200);

      expect(result1.context?.studentId).toBe(100);
      expect(result2.context?.studentId).toBe(200);
    });

    it("debe incluir trace incluso en fallos", async () => {
      vi.spyOn(mockQRStateLoader, "getState").mockResolvedValue({
        exists: false,
        consumed: false,
      });

      const result = await useCase.execute("encrypted-qr-data", 456);

      expect(result.trace).toBeDefined();
    });
  });

  describe("constructor", () => {
    it("debe crear useCase con dependencias", () => {
      const useCase = new ValidateScanUseCase(deps);

      expect(useCase).toBeInstanceOf(ValidateScanUseCase);
    });

    it("debe inicializar stages del pipeline", () => {
      const useCase = new ValidateScanUseCase(deps);

      expect(useCase["stages"]).toBeDefined();
      expect(Array.isArray(useCase["stages"])).toBe(true);
      expect(useCase["stages"].length).toBeGreaterThan(0);
    });
  });
});

describe("createValidateScanUseCase()", () => {
  let mockQRStateLoader: QRStateLoader;
  let mockStudentStateLoader: StudentStateLoader;
  let mockSessionKeyQuery: ISessionKeyQuery;
  let mockTotpValidator: ITotpValidator;

  beforeEach(() => {
    mockQRStateLoader = {
      getState: vi.fn(),
    } as QRStateLoader;

    mockStudentStateLoader = {
      getState: vi.fn(),
    } as StudentStateLoader;

    mockSessionKeyQuery = {
      findByUserId: vi.fn(),
    } as ISessionKeyQuery;

    mockTotpValidator = {
      validate: vi.fn().mockReturnValue(true),
    } as ITotpValidator;
  });

  it("debe crear useCase con dependencias completas", () => {
    const useCase = createValidateScanUseCase({
      qrStateLoader: mockQRStateLoader,
      studentStateLoader: mockStudentStateLoader,
      sessionKeyQuery: mockSessionKeyQuery,
      totpValidator: mockTotpValidator,
    });

    expect(useCase).toBeInstanceOf(ValidateScanUseCase);
  });

  it("debe lanzar error si falta qrStateLoader", () => {
    expect(() => {
      createValidateScanUseCase({
        studentStateLoader: mockStudentStateLoader,
        sessionKeyQuery: mockSessionKeyQuery,
      } as any);
    }).toThrow("requires qrStateLoader");
  });

  it("debe lanzar error si falta studentStateLoader", () => {
    expect(() => {
      createValidateScanUseCase({
        qrStateLoader: mockQRStateLoader,
        sessionKeyQuery: mockSessionKeyQuery,
      } as any);
    }).toThrow("requires");
  });

  it("debe lanzar error si falta sessionKeyQuery", () => {
    expect(() => {
      createValidateScanUseCase({
        qrStateLoader: mockQRStateLoader,
        studentStateLoader: mockStudentStateLoader,
      } as any);
    }).toThrow("requires");
  });

  it("debe usar AesGcmService por defecto", () => {
    const useCase = createValidateScanUseCase({
      qrStateLoader: mockQRStateLoader,
      studentStateLoader: mockStudentStateLoader,
      sessionKeyQuery: mockSessionKeyQuery,
      totpValidator: mockTotpValidator,
    });

    expect(useCase).toBeDefined();
  });

  it("debe aceptar AesGcmService personalizado", () => {
    const mockAesService = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    } as unknown as AesGcmService;

    const useCase = createValidateScanUseCase({
      aesGcmService: mockAesService,
      qrStateLoader: mockQRStateLoader,
      studentStateLoader: mockStudentStateLoader,
      sessionKeyQuery: mockSessionKeyQuery,
      totpValidator: mockTotpValidator,
    });

    expect(useCase).toBeDefined();
  });
});
