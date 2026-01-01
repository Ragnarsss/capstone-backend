import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QRLifecycleService } from '../qr-lifecycle.service';
import type { IQRGenerator, IQRPayloadRepository, IPoolBalancer } from '../../../../../shared/ports';
import type { ProjectionPoolRepository } from '../../../../../shared/infrastructure/valkey';
import type { StudentEncryptionService } from '../student-encryption.service';
import type { StudentStateService } from '../student-state.service';

describe('QRLifecycleService', () => {
    let service: QRLifecycleService;
    let mockQRGenerator: IQRGenerator;
    let mockPayloadRepo: IQRPayloadRepository;
    let mockPoolRepo: ProjectionPoolRepository;
    let mockPoolBalancer: IPoolBalancer;
    let mockEncryptionService: StudentEncryptionService;
    let mockStudentStateService: StudentStateService;

    beforeEach(() => {
        // Mock QRGenerator
        mockQRGenerator = {
            generateForStudent: vi.fn().mockReturnValue({
                payload: {
                    v: 1,
                    sid: 'session-123',
                    uid: 1001,
                    r: 1,
                    ts: Date.now(),
                    n: 'test-nonce-12345678901234567890',
                },
                plaintext: 'plaintext-data',
                encrypted: 'mock-encrypted-data',
            }),
            generateFake: vi.fn(),
        } as any;

        // Mock PayloadRepository
        mockPayloadRepo = {
            store: vi.fn().mockResolvedValue(undefined),
            consume: vi.fn(),
            findByNonce: vi.fn(),
            cleanup: vi.fn(),
        } as any;

        // Mock PoolRepository
        mockPoolRepo = {
            upsertStudentQR: vi.fn().mockResolvedValue('pool-entry-123'),
            removeStudent: vi.fn().mockResolvedValue(undefined),
            getStudentQR: vi.fn(),
            listStudents: vi.fn(),
        } as any;

        // Mock PoolBalancer
        mockPoolBalancer = {
            balance: vi.fn().mockResolvedValue(undefined),
        } as any;

        // Mock EncryptionService
        mockEncryptionService = {
            encryptForStudent: vi.fn().mockResolvedValue({
                encrypted: 'real-encrypted-data',
                usedRealKey: true
            }),
        } as any;

        // Mock StudentStateService
        mockStudentStateService = {
            setActiveQR: vi.fn().mockResolvedValue(undefined),
            getState: vi.fn(),
            registerStudent: vi.fn(),
            failRound: vi.fn(),
        } as any;

        service = new QRLifecycleService(
            mockQRGenerator,
            mockPayloadRepo,
            mockPoolRepo,
            mockPoolBalancer,
            1, // defaultHostUserId
            mockEncryptionService,
            mockStudentStateService
        );
    });

    describe('generateAndPublish()', () => {
        it('debería generar QR y actualizar nonce activo del estudiante', async () => {
            // Arrange
            const options = {
                sessionId: 'session-123',
                studentId: 1001,
                round: 1,
                qrTTL: 60,
            };

            // Act
            const result = await service.generateAndPublish(options);

            // Assert
            expect(result).toBeDefined();
            expect(result.encrypted).toBeDefined();
            expect(result.nonce).toBe('test-nonce-12345678901234567890');
            expect(result.round).toBe(1);
            expect(result.qrTTL).toBe(60);

            // Verificar que se llamó a setActiveQR
            expect(mockStudentStateService.setActiveQR).toHaveBeenCalledWith(
                'session-123',
                1001,
                'test-nonce-12345678901234567890'
            );
        });

        it('debería funcionar sin StudentStateService', async () => {
            // Arrange - Crear servicio sin StudentStateService
            const serviceWithoutState = new QRLifecycleService(
                mockQRGenerator,
                mockPayloadRepo,
                mockPoolRepo,
                mockPoolBalancer,
                1,
                mockEncryptionService,
                undefined // Sin StudentStateService
            );

            const options = {
                sessionId: 'session-123',
                studentId: 1001,
                round: 1,
                qrTTL: 60,
            };

            // Act
            const result = await serviceWithoutState.generateAndPublish(options);

            // Assert
            expect(result).toBeDefined();
            expect(result.nonce).toBe('test-nonce-12345678901234567890');
        });
    });

    describe('generateAndProject()', () => {
        it('debería generar QR y proyectarlo al pool con encriptación', async () => {
            // Arrange
            const options = {
                sessionId: 'session-123',
                studentId: 1001,
                round: 1,
                hostUserId: 5000,
                ttl: 60,
            };

            // Act
            const result = await service.generateAndProject(options);

            // Assert
            expect(result.payload).toBeDefined();
            expect(result.payload.sid).toBe('session-123');
            expect(result.payload.uid).toBe(1001);
            expect(result.payload.r).toBe(1);
            expect(result.encrypted).toBe('real-encrypted-data'); // Con encriptación

            // Verificar que se guardó en repositorio
            expect(mockPayloadRepo.store).toHaveBeenCalled();

            // Verificar que se proyectó al pool
            expect(mockPoolRepo.upsertStudentQR).toHaveBeenCalledWith(
                'session-123',
                1001,
                'real-encrypted-data',
                1
            );
        });

        it('debería usar encriptación real si EncryptionService está disponible', async () => {
            // Arrange
            const options = {
                sessionId: 'session-123',
                studentId: 1001,
                round: 1,
                hostUserId: 5000,
                ttl: 60,
            };

            // Act
            const result = await service.generateAndProject(options);

            // Assert
            expect(mockEncryptionService.encryptForStudent).toHaveBeenCalledWith(
                1001,
                'plaintext-data'
            );
            expect(result.encrypted).toBe('real-encrypted-data');
            expect(result.payload).toBeDefined();
        });

        it('debería funcionar sin EncryptionService (usar mock encryption)', async () => {
            // Arrange - Crear servicio sin EncryptionService
            const serviceWithoutEncryption = new QRLifecycleService(
                mockQRGenerator,
                mockPayloadRepo,
                mockPoolRepo,
                mockPoolBalancer,
                1,
                undefined // Sin EncryptionService
            );

            const options = {
                sessionId: 'session-123',
                studentId: 1001,
                round: 1,
                hostUserId: 5000,
                ttl: 60,
            };

            // Act
            const result = await serviceWithoutEncryption.generateAndProject(options);

            // Assert
            expect(result.encrypted).toBe('mock-encrypted-data');
        });
    });

    describe('balancePool()', () => {
        it('debería balancear el pool si PoolBalancer está disponible', async () => {
            // Act
            await service.balancePool('session-123');

            // Assert
            expect(mockPoolBalancer.balance).toHaveBeenCalledWith('session-123');
        });

        it('debería no fallar si PoolBalancer no está disponible', async () => {
            // Arrange - Crear servicio sin PoolBalancer
            const serviceWithoutBalancer = new QRLifecycleService(
                mockQRGenerator,
                mockPayloadRepo,
                mockPoolRepo,
                null, // Sin PoolBalancer
                1
            );

            // Act & Assert - No debería lanzar error
            await expect(serviceWithoutBalancer.balancePool('session-123')).resolves.toBeUndefined();
        });
    });

    describe('removeFromPool()', () => {
        it('debería remover estudiante del pool', async () => {
            // Act
            await service.removeFromPool('session-123', 1001);

            // Assert
            expect(mockPoolRepo.removeStudent).toHaveBeenCalledWith('session-123', 1001);
        });
    });

    describe('getStoredPayload()', () => {
        it('debería recuperar payload almacenado', async () => {
            // Arrange
            const mockPayload = {
                nonce: 'test-nonce',
                encrypted: 'encrypted-data',
                consumed: false,
                createdAt: Date.now(),
            };
            vi.mocked(mockPayloadRepo.findByNonce).mockResolvedValue(mockPayload);

            // Act
            const result = await service.getStoredPayload('test-nonce');

            // Assert
            expect(result).toEqual(mockPayload);
            expect(mockPayloadRepo.findByNonce).toHaveBeenCalledWith('test-nonce');
        });

        it('debería retornar null si payload no existe', async () => {
            // Arrange
            vi.mocked(mockPayloadRepo.findByNonce).mockResolvedValue(null);

            // Act
            const result = await service.getStoredPayload('non-existent-nonce');

            // Assert
            expect(result).toBeNull();
        });
    });
});
