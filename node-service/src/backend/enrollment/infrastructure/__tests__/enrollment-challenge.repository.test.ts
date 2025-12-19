import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrollmentChallengeRepository } from '../enrollment-challenge.repository';
import { ValkeyClient } from '../../../../shared/infrastructure/valkey/valkey-client';
import type { EnrollmentChallenge } from '../../domain/models';
import crypto from 'crypto';

// Mock de ValkeyClient
vi.mock('../../../../shared/infrastructure/valkey/valkey-client', () => ({
    ValkeyClient: {
        getInstance: vi.fn(),
    },
}));

describe('EnrollmentChallengeRepository - Tests de Persistencia de Challenges', () => {
    let challengeRepository: EnrollmentChallengeRepository;
    let mockRedisClient: any;

    // Test data común
    const testUserId = 123;
    const testChallenge = crypto.randomBytes(32).toString('base64url');
    const testCreatedAt = Date.now();
    const testExpiresAt = testCreatedAt + 300000; // 5 minutos

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock del cliente Valkey/Redis
        mockRedisClient = {
            set: vi.fn(),
            get: vi.fn(),
            del: vi.fn(),
        };

        (ValkeyClient.getInstance as any).mockReturnValue({
            getClient: () => mockRedisClient,
        });

        challengeRepository = new EnrollmentChallengeRepository();
    });

    describe('save() - Guardar challenge de enrollment', () => {
        it('Debe guardar challenge en Valkey con TTL por defecto (300s)', async () => {
            // Arrange
            const challenge: EnrollmentChallenge = {
                challenge: testChallenge,
                userId: testUserId,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await challengeRepository.save(challenge);

            // Assert
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                `enrollment:challenge:${testUserId}`,
                expect.any(String), // JSON stringified data
                'EX',
                300 // TTL por defecto
            );

            // Verificar el JSON guardado
            const savedData = JSON.parse(mockRedisClient.set.mock.calls[0][1]);
            expect(savedData.challenge).toBe(testChallenge);
            expect(savedData.userId).toBe(testUserId.toString());
            expect(savedData.createdAt).toBe(testCreatedAt.toString());
            expect(savedData.expiresAt).toBe(testExpiresAt.toString());
        });

        it('Debe guardar challenge con TTL personalizado', async () => {
            // Arrange
            const challenge: EnrollmentChallenge = {
                challenge: testChallenge,
                userId: testUserId,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            const customTtl = 600; // 10 minutos
            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await challengeRepository.save(challenge, customTtl);

            // Assert
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                `enrollment:challenge:${testUserId}`,
                expect.any(String),
                'EX',
                customTtl
            );
        });

        it('Debe serializar todos los campos como strings', async () => {
            // Arrange
            const challenge: EnrollmentChallenge = {
                challenge: testChallenge,
                userId: testUserId,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await challengeRepository.save(challenge);

            // Assert
            const savedData = JSON.parse(mockRedisClient.set.mock.calls[0][1]);

            // Verificar que userId, createdAt y expiresAt son strings
            expect(typeof savedData.userId).toBe('string');
            expect(typeof savedData.createdAt).toBe('string');
            expect(typeof savedData.expiresAt).toBe('string');
            expect(typeof savedData.challenge).toBe('string');
        });

        it('Debe sobrescribir challenge existente (nuevo intento de enrollment)', async () => {
            // Arrange
            const oldChallenge: EnrollmentChallenge = {
                challenge: 'old-challenge',
                userId: testUserId,
                createdAt: testCreatedAt - 1000,
                expiresAt: testExpiresAt - 1000,
            };

            const newChallenge: EnrollmentChallenge = {
                challenge: testChallenge,
                userId: testUserId,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act - Guardar primera vez
            await challengeRepository.save(oldChallenge);

            // Act - Guardar segunda vez (sobrescribe)
            await challengeRepository.save(newChallenge);

            // Assert
            expect(mockRedisClient.set).toHaveBeenCalledTimes(2);

            // Verificar que ambos usan la misma key
            const firstCallKey = mockRedisClient.set.mock.calls[0][0];
            const secondCallKey = mockRedisClient.set.mock.calls[1][0];
            expect(firstCallKey).toBe(secondCallKey);
            expect(firstCallKey).toBe(`enrollment:challenge:${testUserId}`);
        });
    });

    describe('findByUserId() - Buscar challenge por userId', () => {
        it('Debe retornar challenge cuando existe', async () => {
            // Arrange
            const storedData = {
                challenge: testChallenge,
                userId: testUserId.toString(),
                createdAt: testCreatedAt.toString(),
                expiresAt: testExpiresAt.toString(),
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(storedData));

            // Act
            const result = await challengeRepository.findByUserId(testUserId);

            // Assert
            expect(result).not.toBeNull();
            expect(result!.challenge).toBe(testChallenge);
            expect(result!.userId).toBe(testUserId);
            expect(result!.createdAt).toBe(testCreatedAt);
            expect(result!.expiresAt).toBe(testExpiresAt);

            // Verificar que se buscó con la key correcta
            expect(mockRedisClient.get).toHaveBeenCalledWith(
                `enrollment:challenge:${testUserId}`
            );
        });

        it('Debe retornar null cuando no existe challenge', async () => {
            // Arrange
            mockRedisClient.get.mockResolvedValue(null);

            // Act
            const result = await challengeRepository.findByUserId(999);

            // Assert
            expect(result).toBeNull();
            expect(mockRedisClient.get).toHaveBeenCalledWith('enrollment:challenge:999');
        });

        it('Debe deserializar correctamente números desde strings', async () => {
            // Arrange - Simular datos almacenados con strings (como están en Redis)
            const storedData = {
                challenge: testChallenge,
                userId: '12345',
                createdAt: '1234567890',
                expiresAt: '1234867890',
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(storedData));

            // Act
            const result = await challengeRepository.findByUserId(12345);

            // Assert
            expect(result).not.toBeNull();

            // Verificar que los strings se parsearon a números
            expect(typeof result!.userId).toBe('number');
            expect(typeof result!.createdAt).toBe('number');
            expect(typeof result!.expiresAt).toBe('number');

            expect(result!.userId).toBe(12345);
            expect(result!.createdAt).toBe(1234567890);
            expect(result!.expiresAt).toBe(1234867890);
        });

        it('Debe manejar challenge string correctamente (no es número)', async () => {
            // Arrange
            const challengeString = crypto.randomBytes(32).toString('base64url');
            const storedData = {
                challenge: challengeString,
                userId: testUserId.toString(),
                createdAt: testCreatedAt.toString(),
                expiresAt: testExpiresAt.toString(),
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(storedData));

            // Act
            const result = await challengeRepository.findByUserId(testUserId);

            // Assert
            expect(result).not.toBeNull();
            expect(typeof result!.challenge).toBe('string');
            expect(result!.challenge).toBe(challengeString);
        });
    });

    describe('delete() - Eliminar challenge', () => {
        it('Debe eliminar challenge de Valkey', async () => {
            // Arrange
            mockRedisClient.del.mockResolvedValue(1); // 1 key eliminada

            // Act
            await challengeRepository.delete(testUserId);

            // Assert
            expect(mockRedisClient.del).toHaveBeenCalledWith(
                `enrollment:challenge:${testUserId}`
            );
        });

        it('Debe manejar eliminación de challenge inexistente sin error', async () => {
            // Arrange
            mockRedisClient.del.mockResolvedValue(0); // 0 keys eliminadas

            // Act & Assert - No debe lanzar error
            await expect(challengeRepository.delete(999)).resolves.not.toThrow();
            expect(mockRedisClient.del).toHaveBeenCalledWith('enrollment:challenge:999');
        });
    });

    describe('buildKey() - Construcción de keys', () => {
        it('Debe construir key con formato correcto', async () => {
            // Arrange
            const challenge: EnrollmentChallenge = {
                challenge: testChallenge,
                userId: testUserId,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await challengeRepository.save(challenge);

            // Assert - Verificar formato de key
            const usedKey = mockRedisClient.set.mock.calls[0][0];
            expect(usedKey).toBe(`enrollment:challenge:${testUserId}`);
            expect(usedKey).toMatch(/^enrollment:challenge:\d+$/);
        });

        it('Debe generar keys únicas para diferentes usuarios', async () => {
            // Arrange
            const challenge1: EnrollmentChallenge = {
                challenge: 'challenge-1',
                userId: 100,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            const challenge2: EnrollmentChallenge = {
                challenge: 'challenge-2',
                userId: 200,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await challengeRepository.save(challenge1);
            await challengeRepository.save(challenge2);

            // Assert
            const key1 = mockRedisClient.set.mock.calls[0][0];
            const key2 = mockRedisClient.set.mock.calls[1][0];

            expect(key1).not.toBe(key2);
            expect(key1).toBe('enrollment:challenge:100');
            expect(key2).toBe('enrollment:challenge:200');
        });
    });

    describe('Flujo completo: save -> find -> delete', () => {
        it('Debe completar ciclo de vida de challenge', async () => {
            // Arrange
            const challenge: EnrollmentChallenge = {
                challenge: testChallenge,
                userId: testUserId,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');
            mockRedisClient.get.mockResolvedValueOnce(
                JSON.stringify({
                    challenge: testChallenge,
                    userId: testUserId.toString(),
                    createdAt: testCreatedAt.toString(),
                    expiresAt: testExpiresAt.toString(),
                })
            );
            mockRedisClient.get.mockResolvedValueOnce(null); // Después de delete
            mockRedisClient.del.mockResolvedValue(1);

            // Act & Assert
            // 1. Save
            await challengeRepository.save(challenge);
            expect(mockRedisClient.set).toHaveBeenCalledTimes(1);

            // 2. Find (existe)
            const found = await challengeRepository.findByUserId(testUserId);
            expect(found).not.toBeNull();
            expect(found!.challenge).toBe(testChallenge);

            // 3. Delete
            await challengeRepository.delete(testUserId);
            expect(mockRedisClient.del).toHaveBeenCalledTimes(1);

            // 4. Find (ya no existe)
            const notFound = await challengeRepository.findByUserId(testUserId);
            expect(notFound).toBeNull();
        });
    });

    describe('Validación de TTL', () => {
        it('Debe usar TTL de 300s por defecto (5 minutos)', async () => {
            // Arrange
            const challenge: EnrollmentChallenge = {
                challenge: testChallenge,
                userId: testUserId,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await challengeRepository.save(challenge);

            // Assert - TTL por defecto es 300 segundos
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                'EX',
                300
            );
        });

        it('Debe permitir TTL personalizado para casos especiales', async () => {
            // Arrange
            const challenge: EnrollmentChallenge = {
                challenge: testChallenge,
                userId: testUserId,
                createdAt: testCreatedAt,
                expiresAt: testExpiresAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act - TTL de 10 minutos para testing
            await challengeRepository.save(challenge, 600);

            // Assert
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                'EX',
                600
            );
        });
    });
});
