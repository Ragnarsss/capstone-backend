import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionKeyRepository } from '../session-key.repository';
import { ValkeyClient } from '../../../../../shared/infrastructure/valkey/valkey-client';
import type { SessionKey } from '../../../domain/models';
import crypto from 'crypto';

// Mock de ValkeyClient
vi.mock('../../../../../shared/infrastructure/valkey/valkey-client', () => ({
    ValkeyClient: {
        getInstance: vi.fn(),
    },
}));

describe('SessionKeyRepository - Tests Críticos de Persistencia', () => {
    let sessionKeyRepository: SessionKeyRepository;
    let mockRedisClient: any;

    // Test data común
    const testUserId = 123;
    const testDeviceId = 456;
    const testSessionKey = crypto.randomBytes(32);
    const testCreatedAt = Date.now();

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

        sessionKeyRepository = new SessionKeyRepository();
    });

    describe('save() - Guardar session_key', () => {
        it('Debe guardar session_key en Valkey con TTL por defecto (7200s)', async () => {
            // Arrange
            const sessionKey: SessionKey = {
                sessionKey: testSessionKey,
                userId: testUserId,
                deviceId: testDeviceId,
                createdAt: testCreatedAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await sessionKeyRepository.save(sessionKey);

            // Assert
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                `session:${testUserId}:key`,
                expect.any(String), // JSON stringified data
                'EX',
                7200 // TTL por defecto
            );

            // Verificar el JSON guardado
            const savedData = JSON.parse(mockRedisClient.set.mock.calls[0][1]);
            expect(savedData.sessionKey).toBe(testSessionKey.toString('base64'));
            expect(savedData.userId).toBe(testUserId.toString());
            expect(savedData.deviceId).toBe(testDeviceId.toString());
            expect(savedData.createdAt).toBe(testCreatedAt.toString());
        });

        it('Debe guardar session_key con TTL personalizado', async () => {
            // Arrange
            const sessionKey: SessionKey = {
                sessionKey: testSessionKey,
                userId: testUserId,
                deviceId: testDeviceId,
                createdAt: testCreatedAt,
            };

            const customTtl = 3600; // 1 hora
            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await sessionKeyRepository.save(sessionKey, customTtl);

            // Assert
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                `session:${testUserId}:key`,
                expect.any(String),
                'EX',
                customTtl
            );
        });

        it('Debe serializar Buffer sessionKey como base64', async () => {
            // Arrange
            const sessionKey: SessionKey = {
                sessionKey: testSessionKey,
                userId: testUserId,
                deviceId: testDeviceId,
                createdAt: testCreatedAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await sessionKeyRepository.save(sessionKey);

            // Assert
            const savedData = JSON.parse(mockRedisClient.set.mock.calls[0][1]);

            // Verificar que se guardó como base64 string
            expect(typeof savedData.sessionKey).toBe('string');

            // Verificar que se puede reconstruir el Buffer
            const reconstructed = Buffer.from(savedData.sessionKey, 'base64');
            expect(reconstructed.equals(testSessionKey)).toBe(true);
        });

        it('Debe sobrescribir session_key existente (re-login)', async () => {
            // Arrange
            const oldSessionKey: SessionKey = {
                sessionKey: crypto.randomBytes(32),
                userId: testUserId,
                deviceId: testDeviceId,
                createdAt: Date.now() - 1000,
            };

            const newSessionKey: SessionKey = {
                sessionKey: testSessionKey,
                userId: testUserId,
                deviceId: testDeviceId,
                createdAt: testCreatedAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act - Guardar primera vez
            await sessionKeyRepository.save(oldSessionKey);

            // Act - Guardar segunda vez (sobrescribe)
            await sessionKeyRepository.save(newSessionKey);

            // Assert
            expect(mockRedisClient.set).toHaveBeenCalledTimes(2);

            // Verificar que ambos usan la misma key
            const firstCallKey = mockRedisClient.set.mock.calls[0][0];
            const secondCallKey = mockRedisClient.set.mock.calls[1][0];
            expect(firstCallKey).toBe(secondCallKey);
            expect(firstCallKey).toBe(`session:${testUserId}:key`);
        });
    });

    describe('findByUserId() - Buscar session_key', () => {
        it('Debe retornar session_key cuando existe', async () => {
            // Arrange
            const storedData = {
                sessionKey: testSessionKey.toString('base64'),
                userId: testUserId.toString(),
                deviceId: testDeviceId.toString(),
                createdAt: testCreatedAt.toString(),
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(storedData));

            // Act
            const result = await sessionKeyRepository.findByUserId(testUserId);

            // Assert
            expect(result).not.toBeNull();
            expect(result!.userId).toBe(testUserId);
            expect(result!.deviceId).toBe(testDeviceId);
            expect(result!.createdAt).toBe(testCreatedAt);

            // Verificar que sessionKey es Buffer y tiene el valor correcto
            expect(Buffer.isBuffer(result!.sessionKey)).toBe(true);
            expect(result!.sessionKey.equals(testSessionKey)).toBe(true);

            // Verificar que se buscó con la key correcta
            expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${testUserId}:key`);
        });

        it('Debe retornar null cuando no existe session_key', async () => {
            // Arrange
            mockRedisClient.get.mockResolvedValue(null);

            // Act
            const result = await sessionKeyRepository.findByUserId(999);

            // Assert
            expect(result).toBeNull();
            expect(mockRedisClient.get).toHaveBeenCalledWith('session:999:key');
        });

        it('Debe deserializar correctamente números desde strings', async () => {
            // Arrange - Simular datos almacenados con strings (como están en Redis)
            const storedData = {
                sessionKey: testSessionKey.toString('base64'),
                userId: '12345',
                deviceId: '67890',
                createdAt: '1234567890',
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(storedData));

            // Act
            const result = await sessionKeyRepository.findByUserId(12345);

            // Assert
            expect(result).not.toBeNull();

            // Verificar que los strings se parsearon a números
            expect(typeof result!.userId).toBe('number');
            expect(typeof result!.deviceId).toBe('number');
            expect(typeof result!.createdAt).toBe('number');

            expect(result!.userId).toBe(12345);
            expect(result!.deviceId).toBe(67890);
            expect(result!.createdAt).toBe(1234567890);
        });

        it('Debe reconstruir Buffer desde base64 correctamente', async () => {
            // Arrange
            const originalBuffer = crypto.randomBytes(32);
            const storedData = {
                sessionKey: originalBuffer.toString('base64'),
                userId: testUserId.toString(),
                deviceId: testDeviceId.toString(),
                createdAt: testCreatedAt.toString(),
            };

            mockRedisClient.get.mockResolvedValue(JSON.stringify(storedData));

            // Act
            const result = await sessionKeyRepository.findByUserId(testUserId);

            // Assert
            expect(result).not.toBeNull();
            expect(Buffer.isBuffer(result!.sessionKey)).toBe(true);
            expect(result!.sessionKey.length).toBe(32);
            expect(result!.sessionKey.equals(originalBuffer)).toBe(true);
        });
    });

    describe('delete() - Eliminar session_key', () => {
        it('Debe eliminar session_key de Valkey', async () => {
            // Arrange
            mockRedisClient.del.mockResolvedValue(1); // 1 key eliminada

            // Act
            await sessionKeyRepository.delete(testUserId);

            // Assert
            expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${testUserId}:key`);
        });

        it('Debe manejar eliminación de key inexistente sin error', async () => {
            // Arrange
            mockRedisClient.del.mockResolvedValue(0); // 0 keys eliminadas

            // Act & Assert - No debe lanzar error
            await expect(sessionKeyRepository.delete(999)).resolves.not.toThrow();
            expect(mockRedisClient.del).toHaveBeenCalledWith('session:999:key');
        });
    });

    describe('buildKey() - Construcción de keys', () => {
        it('Debe construir key con formato correcto', async () => {
            // Arrange
            const sessionKey: SessionKey = {
                sessionKey: testSessionKey,
                userId: testUserId,
                deviceId: testDeviceId,
                createdAt: testCreatedAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await sessionKeyRepository.save(sessionKey);

            // Assert - Verificar formato de key
            const usedKey = mockRedisClient.set.mock.calls[0][0];
            expect(usedKey).toBe(`session:${testUserId}:key`);
            expect(usedKey).toMatch(/^session:\d+:key$/);
        });

        it('Debe generar keys únicas para diferentes usuarios', async () => {
            // Arrange
            const sessionKey1: SessionKey = {
                sessionKey: crypto.randomBytes(32),
                userId: 100,
                deviceId: testDeviceId,
                createdAt: testCreatedAt,
            };

            const sessionKey2: SessionKey = {
                sessionKey: crypto.randomBytes(32),
                userId: 200,
                deviceId: testDeviceId,
                createdAt: testCreatedAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');

            // Act
            await sessionKeyRepository.save(sessionKey1);
            await sessionKeyRepository.save(sessionKey2);

            // Assert
            const key1 = mockRedisClient.set.mock.calls[0][0];
            const key2 = mockRedisClient.set.mock.calls[1][0];

            expect(key1).not.toBe(key2);
            expect(key1).toBe('session:100:key');
            expect(key2).toBe('session:200:key');
        });
    });

    describe('Flujo completo: save -> find -> delete', () => {
        it('Debe completar ciclo de vida de session_key', async () => {
            // Arrange
            const sessionKey: SessionKey = {
                sessionKey: testSessionKey,
                userId: testUserId,
                deviceId: testDeviceId,
                createdAt: testCreatedAt,
            };

            mockRedisClient.set.mockResolvedValue('OK');
            mockRedisClient.get.mockResolvedValueOnce(
                JSON.stringify({
                    sessionKey: testSessionKey.toString('base64'),
                    userId: testUserId.toString(),
                    deviceId: testDeviceId.toString(),
                    createdAt: testCreatedAt.toString(),
                })
            );
            mockRedisClient.get.mockResolvedValueOnce(null); // Después de delete
            mockRedisClient.del.mockResolvedValue(1);

            // Act & Assert
            // 1. Save
            await sessionKeyRepository.save(sessionKey);
            expect(mockRedisClient.set).toHaveBeenCalledTimes(1);

            // 2. Find (existe)
            const found = await sessionKeyRepository.findByUserId(testUserId);
            expect(found).not.toBeNull();
            expect(found!.userId).toBe(testUserId);

            // 3. Delete
            await sessionKeyRepository.delete(testUserId);
            expect(mockRedisClient.del).toHaveBeenCalledTimes(1);

            // 4. Find (ya no existe)
            const notFound = await sessionKeyRepository.findByUserId(testUserId);
            expect(notFound).toBeNull();
        });
    });
});
