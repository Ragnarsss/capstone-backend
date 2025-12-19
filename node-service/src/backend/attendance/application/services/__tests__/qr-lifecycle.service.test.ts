/**
 * Tests para QRLifecycleService
 * 
 * Verifica la implementación de IQRLifecycleManager,
 * especialmente el método generateAndPublish.
 */
import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { QRLifecycleService } from '../qr-lifecycle.service';
import type { 
  IQRGenerator, 
  IQRPayloadRepository, 
  NextQROptions 
} from '../../../../shared/ports';
import type { QRPayloadV1 } from '../../../../shared/types';
import { ProjectionPoolRepository } from '../../../../shared/infrastructure/valkey';

describe('QRLifecycleService', () => {
  // Mocks
  let mockQRGenerator: IQRGenerator;
  let mockPayloadRepo: IQRPayloadRepository;
  let mockPoolRepo: Partial<ProjectionPoolRepository>;
  let mockEncryptionService: { encryptForStudent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Mock QRGenerator - ahora retorna plaintext además de encrypted
    mockQRGenerator = {
      generateForStudent: vi.fn().mockReturnValue({
        payload: {
          v: 1,
          s: 'test-session',
          u: 123,
          r: 2,
          t: Date.now(),
          n: 'mock-nonce-12345678',
          h: 1,
        } as QRPayloadV1,
        plaintext: '{"v":1,"s":"test-session","u":123,"r":2,"t":1234567890,"n":"mock-nonce-12345678","h":1}',
        encrypted: 'mock-encrypted-fallback',
      }),
    };

    // Mock PayloadRepository
    mockPayloadRepo = {
      store: vi.fn().mockResolvedValue(undefined),
      findByNonce: vi.fn().mockResolvedValue(null),
      markAsConsumed: vi.fn().mockResolvedValue(true),
    };

    // Mock PoolRepository
    mockPoolRepo = {
      upsertStudentQR: vi.fn().mockResolvedValue(undefined),
    };

    // Mock StudentEncryptionService
    mockEncryptionService = {
      encryptForStudent: vi.fn().mockResolvedValue({
        encrypted: 'encrypted-with-real-key',
        usedRealKey: true,
      }),
    };
  });

  describe('generateAndPublish (implementa IQRLifecycleManager)', () => {
    it('debe generar QR y retornar resultado correcto con encryptionService', async () => {
      // Arrange
      const service = new QRLifecycleService(
        mockQRGenerator,
        mockPayloadRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        1,
        mockEncryptionService as any
      );

      const options: NextQROptions = {
        sessionId: 'test-session',
        studentId: 123,
        round: 2,
        qrTTL: 60,
      };

      // Act
      const result = await service.generateAndPublish(options);

      // Assert - usa encrypted del encryptionService
      expect(result.encrypted).toBe('encrypted-with-real-key');
      expect(result.nonce).toBe('mock-nonce-12345678');
      expect(result.round).toBe(2);
      expect(result.qrTTL).toBe(60);
    });

    it('debe usar mock encrypted cuando no hay encryptionService', async () => {
      // Arrange - sin encryptionService
      const service = new QRLifecycleService(
        mockQRGenerator,
        mockPayloadRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        1
        // Sin encryptionService
      );

      const options: NextQROptions = {
        sessionId: 'test-session',
        studentId: 123,
        round: 2,
        qrTTL: 60,
      };

      // Act
      const result = await service.generateAndPublish(options);

      // Assert - usa encrypted fallback del generator
      expect(result.encrypted).toBe('mock-encrypted-fallback');
    });

    it('debe llamar a generateForStudent con parámetros correctos', async () => {
      // Arrange
      const hostUserId = 5;
      const service = new QRLifecycleService(
        mockQRGenerator,
        mockPayloadRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        hostUserId
      );

      const options: NextQROptions = {
        sessionId: 'session-abc',
        studentId: 456,
        round: 3,
        qrTTL: 120,
      };

      // Act
      await service.generateAndPublish(options);

      // Assert
      expect(mockQRGenerator.generateForStudent).toHaveBeenCalledWith({
        sessionId: 'session-abc',
        userId: 456,
        round: 3,
        hostUserId: 5,
      });
    });

    it('debe almacenar payload en repositorio', async () => {
      // Arrange
      const service = new QRLifecycleService(
        mockQRGenerator,
        mockPayloadRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        1
      );

      const options: NextQROptions = {
        sessionId: 'test-session',
        studentId: 123,
        round: 2,
        qrTTL: 90,
      };

      // Act
      await service.generateAndPublish(options);

      // Assert
      expect(mockPayloadRepo.store).toHaveBeenCalledWith(
        expect.objectContaining({ n: 'mock-nonce-12345678' }),
        'mock-encrypted-fallback',
        90
      );
    });

    it('debe actualizar pool de proyección', async () => {
      // Arrange
      const service = new QRLifecycleService(
        mockQRGenerator,
        mockPayloadRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        1
      );

      const options: NextQROptions = {
        sessionId: 'test-session',
        studentId: 789,
        round: 1,
        qrTTL: 60,
      };

      // Act
      await service.generateAndPublish(options);

      // Assert
      expect(mockPoolRepo.upsertStudentQR).toHaveBeenCalledWith(
        'test-session',
        789,
        'mock-encrypted-fallback',
        1
      );
    });

    it('debe propagar errores del generador', async () => {
      // Arrange
      const errorGenerator: IQRGenerator = {
        generateForStudent: vi.fn().mockImplementation(() => {
          throw new Error('Generation failed');
        }),
      };

      const service = new QRLifecycleService(
        errorGenerator,
        mockPayloadRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        1
      );

      const options: NextQROptions = {
        sessionId: 'test-session',
        studentId: 123,
        round: 2,
        qrTTL: 60,
      };

      // Act & Assert
      await expect(service.generateAndPublish(options)).rejects.toThrow('Generation failed');
    });

    it('debe propagar errores del repositorio de payloads', async () => {
      // Arrange
      const errorRepo: IQRPayloadRepository = {
        store: vi.fn().mockRejectedValue(new Error('Storage failed')),
        findByNonce: vi.fn().mockResolvedValue(null),
        markAsConsumed: vi.fn().mockResolvedValue(true),
      };

      const service = new QRLifecycleService(
        mockQRGenerator,
        errorRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        1
      );

      const options: NextQROptions = {
        sessionId: 'test-session',
        studentId: 123,
        round: 2,
        qrTTL: 60,
      };

      // Act & Assert
      await expect(service.generateAndPublish(options)).rejects.toThrow('Storage failed');
    });
  });

  describe('generateAndProject', () => {
    it('debe generar QR con hostUserId custom', async () => {
      // Arrange
      const service = new QRLifecycleService(
        mockQRGenerator,
        mockPayloadRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        99 // Este es el default, pero pasamos hostUserId explícito
      );

      // Act
      await service.generateAndProject({
        sessionId: 'test-session',
        studentId: 123,
        round: 1,
        hostUserId: 42, // Explicit hostUserId
        ttl: 60,
      });

      // Assert
      expect(mockQRGenerator.generateForStudent).toHaveBeenCalledWith({
        sessionId: 'test-session',
        userId: 123,
        round: 1,
        hostUserId: 42,
      });
    });

    it('debe retornar payload y encrypted', async () => {
      // Arrange
      const service = new QRLifecycleService(
        mockQRGenerator,
        mockPayloadRepo,
        mockPoolRepo as ProjectionPoolRepository,
        null,
        1
      );

      // Act
      const result = await service.generateAndProject({
        sessionId: 'test-session',
        studentId: 123,
        round: 1,
        hostUserId: 1,
        ttl: 60,
      });

      // Assert
      expect(result.payload.n).toBe('mock-nonce-12345678');
      expect(result.encrypted).toBe('mock-encrypted-fallback');
    });
  });
});
