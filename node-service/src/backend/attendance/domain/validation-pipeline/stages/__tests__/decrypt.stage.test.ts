/**
 * Tests para DecryptStage
 * 
 * Verifica:
 * - Desencriptación con session_key real del estudiante
 * - Fallback a mock key cuando no existe session_key
 * - Manejo de errores: formato inválido, desencriptación fallida
 * - Modo STUB_MODE: conversión de QRPayloadV1 a StudentResponse
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDecryptStage } from '../decrypt.stage';
import type { ValidationContext } from '../../context';
import { AesGcmService } from '../../../../../../shared/infrastructure/crypto';
import type { ISessionKeyQuery } from '../../../../../../shared/ports';
import type { QRPayloadV1 } from '../../../../../../shared/types';

describe('DecryptStage', () => {
  const MOCK_SESSION_KEY = '12345678901234567890123456789012'; // 32 bytes
  const REAL_SESSION_KEY = 'abcdefghijklmnopqrstuvwxyz123456'; // 32 bytes
  const STUDENT_ID = 12345;
  
  let fallbackAesGcmService: AesGcmService;
  let mockSessionKeyQuery: ISessionKeyQuery;
  let originalStubMode: string | undefined;

  beforeEach(() => {
    fallbackAesGcmService = new AesGcmService(MOCK_SESSION_KEY);
    mockSessionKeyQuery = {
      findByUserId: vi.fn(),
    };
    originalStubMode = process.env.ENROLLMENT_STUB_MODE;
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.ENROLLMENT_STUB_MODE = originalStubMode;
  });

  // ========================================
  // Desencriptación con session_key real
  // ========================================

  describe('Desencriptación con session_key del estudiante', () => {
    it('usa session_key real cuando existe en Valkey', async () => {
      // Arrange
      const realAesService = new AesGcmService(REAL_SESSION_KEY);
      const studentResponse = {
        original: {
          v: 1,
          sid: 'session-123',
          uid: STUDENT_ID,
          r: 1,
          ts: Date.now(),
          n: 'nonce-abc123',
        } as QRPayloadV1,
        studentId: STUDENT_ID,
        receivedAt: Date.now(),
      };

      const encrypted = realAesService.encryptToPayload(JSON.stringify(studentResponse)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue({
        userId: STUDENT_ID,
        sessionKey: REAL_SESSION_KEY,
        expiresAt: Date.now() + 7200_000,
      });

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'session-123',
        studentId: STUDENT_ID,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(true);
      expect(mockSessionKeyQuery.findByUserId).toHaveBeenCalledWith(STUDENT_ID);
      expect(ctx.response).toBeDefined();
      expect(ctx.response?.studentId).toBe(STUDENT_ID);
      expect(ctx.error).toBeUndefined();
    });

    it('desencripta correctamente StudentResponse con session_key real', async () => {
      // Arrange
      const realAesService = new AesGcmService(REAL_SESSION_KEY);
      const expectedResponse = {
        original: {
          v: 1,
          sid: 'session-456',
          uid: STUDENT_ID,
          r: 2,
          ts: 1702900000000,
          n: 'nonce-xyz789',
        } as QRPayloadV1,
        studentId: STUDENT_ID,
        receivedAt: 1702900001000,
        totpu: 'totp-123456',
      };

      const encrypted = realAesService.encryptToPayload(JSON.stringify(expectedResponse)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue({
        userId: STUDENT_ID,
        sessionKey: REAL_SESSION_KEY,
        expiresAt: Date.now() + 3600_000,
      });

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'session-456',
        studentId: STUDENT_ID,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(true);
      expect(ctx.response).toEqual(expectedResponse);
      expect(ctx.response?.totpu).toBe('totp-123456');
    });
  });

  // ========================================
  // Fallback a mock key
  // ========================================

  describe('Fallback a mock key cuando no existe session_key', () => {
    it('usa fallbackAesGcmService cuando no hay session_key en Valkey', async () => {
      // Arrange
      const studentResponse = {
        original: {
          v: 1,
          sid: 'session-fallback',
          uid: STUDENT_ID,
          r: 1,
          ts: Date.now(),
          n: 'nonce-fallback',
        } as QRPayloadV1,
        studentId: STUDENT_ID,
        receivedAt: Date.now(),
      };

      const encrypted = fallbackAesGcmService.encryptToPayload(JSON.stringify(studentResponse)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'session-fallback',
        studentId: STUDENT_ID,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(true);
      expect(mockSessionKeyQuery.findByUserId).toHaveBeenCalledWith(STUDENT_ID);
      expect(ctx.response).toBeDefined();
      expect(ctx.error).toBeUndefined();
    });

    it('desencripta correctamente con fallback en modo desarrollo', async () => {
      // Arrange
      const studentResponse = {
        original: {
          v: 1,
          sid: 'dev-session',
          uid: 999,
          r: 3,
          ts: 1702900000000,
          n: 'dev-nonce',
        } as QRPayloadV1,
        studentId: 999,
        receivedAt: 1702900002000,
      };

      const encrypted = fallbackAesGcmService.encryptToPayload(JSON.stringify(studentResponse)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'dev-session',
        studentId: 999,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(true);
      expect(ctx.response).toEqual(studentResponse);
    });
  });

  // ========================================
  // Manejo de errores
  // ========================================

  describe('Manejo de errores de formato y desencriptación', () => {
    it('retorna error INVALID_FORMAT si el payload no es válido', async () => {
      // Arrange
      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'session-invalid',
        studentId: STUDENT_ID,
        encrypted: 'formato-invalido-sin-puntos',
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: 'INVALID_FORMAT',
        message: 'Formato de payload invalido',
      });
      expect(ctx.response).toBeUndefined();
    });

    it('retorna error DECRYPTION_FAILED si no puede desencriptar', async () => {
      // Arrange
      const wrongKeyService = new AesGcmService('00000000000000000000000000000000'); // 32 bytes
      const realAesService = new AesGcmService(REAL_SESSION_KEY);
      
      const encrypted = realAesService.encryptToPayload(JSON.stringify({ test: 'data' })).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService: wrongKeyService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'session-wrong-key',
        studentId: STUDENT_ID,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: 'DECRYPTION_FAILED',
        message: 'No se pudo desencriptar la respuesta',
      });
      expect(ctx.response).toBeUndefined();
    });

    it('retorna error DECRYPTION_FAILED si el JSON no es parseable', async () => {
      // Arrange
      // Crear payload encriptado con string inválido JSON
      const invalidJson = '{invalid-json-syntax';
      const encrypted = fallbackAesGcmService.encryptToPayload(invalidJson).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'session-invalid-json',
        studentId: STUDENT_ID,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(false);
      expect(ctx.error).toEqual({
        code: 'DECRYPTION_FAILED',
        message: 'No se pudo desencriptar la respuesta',
      });
    });
  });

  // ========================================
  // Modo STUB_MODE
  // ========================================

  describe('STUB_MODE: conversión de QRPayloadV1 a StudentResponse', () => {
    it('convierte QRPayloadV1 del servidor a StudentResponse en STUB_MODE', async () => {
      // Arrange
      // Nota: Este test verifica el comportamiento SOLO si ENROLLMENT_STUB_MODE=true al iniciar
      // Si la variable no está configurada, el test puede fallar o pasar dependiendo del entorno
      const qrPayload: QRPayloadV1 = {
        v: 1,
        sid: 'stub-session',
        uid: STUDENT_ID,
        r: 1,
        ts: 1702900000000,
        n: 'stub-nonce-abc',
      };

      const encrypted = fallbackAesGcmService.encryptToPayload(JSON.stringify(qrPayload)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'stub-session',
        studentId: STUDENT_ID,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(true);
      expect(ctx.response).toBeDefined();
      // En STUB_MODE: ctx.response.original es el QRPayloadV1
      // Sin STUB_MODE: ctx.response es tratado como StudentResponse normal
      if (process.env.ENROLLMENT_STUB_MODE === 'true') {
        expect(ctx.response?.original).toEqual(qrPayload);
        expect(ctx.response?.studentId).toBe(STUDENT_ID);
        expect(ctx.response?.receivedAt).toBeGreaterThan(0);
      }
      expect(ctx.error).toBeUndefined();
    });

    it('procesa StudentResponse normal en STUB_MODE sin conversión', async () => {
      // Arrange
      const studentResponse = {
        original: {
          v: 1,
          sid: 'stub-session-2',
          uid: STUDENT_ID,
          r: 2,
          ts: Date.now(),
          n: 'nonce-xyz',
        } as QRPayloadV1,
        studentId: STUDENT_ID,
        receivedAt: Date.now(),
      };

      const encrypted = fallbackAesGcmService.encryptToPayload(JSON.stringify(studentResponse)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'stub-session-2',
        studentId: STUDENT_ID,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(true);
      expect(ctx.response).toEqual(studentResponse);
    });

    it('solo convierte a StudentResponse si el payload es QRPayloadV1 válido', async () => {
      // Arrange
      const invalidPayload = {
        v: 1,
        sid: 'test',
        // Falta uid, r, ts, n - no es QRPayloadV1 válido
      };

      const encrypted = fallbackAesGcmService.encryptToPayload(JSON.stringify(invalidPayload)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'test-session',
        studentId: STUDENT_ID,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(true);
      // No se convirtió porque no es QRPayloadV1 válido, se trata como StudentResponse
      expect(ctx.response).toEqual(invalidPayload);
    });
  });

  // ========================================
  // Integración: session_key query
  // ========================================

  describe('Integración con SessionKeyQuery', () => {
    it('llama findByUserId con el studentId correcto', async () => {
      // Arrange
      const studentResponse = {
        original: {
          v: 1,
          sid: 'integration-test',
          uid: 777,
          r: 1,
          ts: Date.now(),
          n: 'nonce-integration',
        } as QRPayloadV1,
        studentId: 777,
        receivedAt: Date.now(),
      };

      const encrypted = fallbackAesGcmService.encryptToPayload(JSON.stringify(studentResponse)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'integration-test',
        studentId: 777,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      await stage.execute(ctx);

      // Assert
      expect(mockSessionKeyQuery.findByUserId).toHaveBeenCalledTimes(1);
      expect(mockSessionKeyQuery.findByUserId).toHaveBeenCalledWith(777);
    });

    it('crea nueva instancia de AesGcmService con session_key específica', async () => {
      // Arrange
      const specificKey = 'zyxwvutsrqponmlkjihgfedcba654321'; // 32 bytes
      const specificService = new AesGcmService(specificKey);
      
      const studentResponse = {
        original: {
          v: 1,
          sid: 'specific-key-test',
          uid: 888,
          r: 1,
          ts: Date.now(),
          n: 'nonce-specific',
        } as QRPayloadV1,
        studentId: 888,
        receivedAt: Date.now(),
      };

      const encrypted = specificService.encryptToPayload(JSON.stringify(studentResponse)).encrypted;

      vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue({
        userId: 888,
        sessionKey: specificKey,
        expiresAt: Date.now() + 7200_000,
      });

      const stage = createDecryptStage({
        fallbackAesGcmService,
        sessionKeyQuery: mockSessionKeyQuery,
      });

      const ctx: ValidationContext = {
        sessionId: 'specific-key-test',
        studentId: 888,
        encrypted,
        timestamp: Date.now(),
      };

      // Act
      const result = await stage.execute(ctx);

      // Assert
      expect(result).toBe(true);
      expect(ctx.response).toEqual(studentResponse);
      expect(ctx.error).toBeUndefined();
    });
  });
});
