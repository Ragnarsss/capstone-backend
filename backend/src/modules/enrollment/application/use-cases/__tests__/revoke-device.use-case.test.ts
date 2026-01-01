import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RevokeDeviceUseCase } from '../revoke-device.use-case';
import { DeviceRepository } from '../../../infrastructure/repositories/device.repository';
import { ENROLLMENT_STATES } from '../../../domain/models';

// Mock de DeviceRepository
vi.mock('../../../infrastructure/repositories/device.repository');

describe('RevokeDeviceUseCase - Tests de Revocación de Dispositivos', () => {
    let revokeDeviceUseCase: RevokeDeviceUseCase;
    let mockDeviceRepository: any;

    const testUserId = 123;
    const testDeviceId = 456;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDeviceRepository = {
            findById: vi.fn(),
            revoke: vi.fn(),
        };

        revokeDeviceUseCase = new RevokeDeviceUseCase(mockDeviceRepository);
    });

    describe('execute() - Revocar dispositivo exitosamente', () => {
        it('Debe revocar un dispositivo enrolled exitosamente', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: testUserId,
                credentialId: 'test-credential-id',
                status: ENROLLMENT_STATES.ENROLLED,
                isActive: true,
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);
            mockDeviceRepository.revoke.mockResolvedValue(undefined);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
                reason: 'Usuario solicitó revocación',
            };

            // Act
            const result = await revokeDeviceUseCase.execute(input);

            // Assert
            expect(result.success).toBe(true);
            expect(result.deviceId).toBe(testDeviceId);
            expect(result.message).toBe('Dispositivo revocado exitosamente');

            // Verificar que se llamó a findById
            expect(mockDeviceRepository.findById).toHaveBeenCalledWith(testDeviceId);

            // Verificar que se llamó a revoke con el reason correcto
            expect(mockDeviceRepository.revoke).toHaveBeenCalledWith(
                testDeviceId,
                'Usuario solicitó revocación'
            );
        });

        it('Debe usar reason por defecto si no se proporciona', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: testUserId,
                credentialId: 'test-credential-id',
                status: ENROLLMENT_STATES.ENROLLED,
                isActive: true,
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);
            mockDeviceRepository.revoke.mockResolvedValue(undefined);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
                // Sin reason
            };

            // Act
            await revokeDeviceUseCase.execute(input);

            // Assert - Debe usar reason por defecto
            expect(mockDeviceRepository.revoke).toHaveBeenCalledWith(
                testDeviceId,
                'Revocado por el usuario'
            );
        });
    });

    describe('Validaciones de seguridad', () => {
        it('Debe lanzar error si el dispositivo no existe', async () => {
            // Arrange
            mockDeviceRepository.findById.mockResolvedValue(null);

            const input = {
                userId: testUserId,
                deviceId: 999,
            };

            // Act & Assert
            await expect(revokeDeviceUseCase.execute(input))
                .rejects.toThrow('DEVICE_NOT_FOUND: Dispositivo no encontrado');

            // Verificar que NO se intentó revocar
            expect(mockDeviceRepository.revoke).not.toHaveBeenCalled();
        });

        it('Debe lanzar error si el dispositivo pertenece a otro usuario', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: 999, // Diferente userId
                credentialId: 'test-credential-id',
                status: ENROLLMENT_STATES.ENROLLED,
                isActive: true,
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
            };

            // Act & Assert
            await expect(revokeDeviceUseCase.execute(input))
                .rejects.toThrow('DEVICE_NOT_OWNED: No tienes permiso para revocar este dispositivo');

            // Verificar que NO se intentó revocar
            expect(mockDeviceRepository.revoke).not.toHaveBeenCalled();
        });

        it('Debe lanzar error si el dispositivo ya está revocado', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: testUserId,
                credentialId: 'test-credential-id',
                status: ENROLLMENT_STATES.REVOKED, // Ya revocado
                isActive: false,
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
            };

            // Act & Assert - DeviceStateMachine debe rechazar la transición
            await expect(revokeDeviceUseCase.execute(input))
                .rejects.toThrow(); // Transición inválida

            // Verificar que NO se intentó revocar
            expect(mockDeviceRepository.revoke).not.toHaveBeenCalled();
        });

        it('Debe lanzar error si el estado es not_enrolled', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: testUserId,
                credentialId: 'test-credential-id',
                status: ENROLLMENT_STATES.NOT_ENROLLED,
                isActive: false,
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
            };

            // Act & Assert
            await expect(revokeDeviceUseCase.execute(input))
                .rejects.toThrow(); // Transición inválida

            expect(mockDeviceRepository.revoke).not.toHaveBeenCalled();
        });
    });

    describe('Flujo completo con repository', () => {
        it('Debe completar el flujo completo de revocación', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: testUserId,
                credentialId: 'credential-abc',
                publicKey: 'public-key-xyz',
                aaguid: '00000000-0000-0000-0000-000000000000',
                deviceFingerprint: 'fingerprint-123',
                status: ENROLLMENT_STATES.ENROLLED,
                isActive: true,
                enrolledAt: new Date('2024-01-01'),
                lastUsedAt: new Date('2024-01-15'),
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);
            mockDeviceRepository.revoke.mockResolvedValue(undefined);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
                reason: 'Dispositivo comprometido',
            };

            // Act
            const result = await revokeDeviceUseCase.execute(input);

            // Assert
            expect(result).toEqual({
                success: true,
                deviceId: testDeviceId,
                message: 'Dispositivo revocado exitosamente',
            });

            // Verificar llamadas al repository
            expect(mockDeviceRepository.findById).toHaveBeenCalledTimes(1);
            expect(mockDeviceRepository.revoke).toHaveBeenCalledTimes(1);
            expect(mockDeviceRepository.findById).toHaveBeenCalledWith(testDeviceId);
            expect(mockDeviceRepository.revoke).toHaveBeenCalledWith(
                testDeviceId,
                'Dispositivo comprometido'
            );
        });
    });

    describe('Casos de uso reales', () => {
        it('Debe permitir revocar dispositivo perdido', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: testUserId,
                credentialId: 'lost-device-cred',
                status: ENROLLMENT_STATES.ENROLLED,
                isActive: true,
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);
            mockDeviceRepository.revoke.mockResolvedValue(undefined);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
                reason: 'Dispositivo perdido',
            };

            // Act
            const result = await revokeDeviceUseCase.execute(input);

            // Assert
            expect(result.success).toBe(true);
            expect(mockDeviceRepository.revoke).toHaveBeenCalledWith(
                testDeviceId,
                'Dispositivo perdido'
            );
        });

        it('Debe permitir revocar dispositivo robado', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: testUserId,
                credentialId: 'stolen-device-cred',
                status: ENROLLMENT_STATES.ENROLLED,
                isActive: true,
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);
            mockDeviceRepository.revoke.mockResolvedValue(undefined);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
                reason: 'Dispositivo robado - reportar a seguridad',
            };

            // Act
            const result = await revokeDeviceUseCase.execute(input);

            // Assert
            expect(result.success).toBe(true);
            expect(mockDeviceRepository.revoke).toHaveBeenCalledWith(
                testDeviceId,
                'Dispositivo robado - reportar a seguridad'
            );
        });

        it('Debe permitir revocación preventiva antes de vender dispositivo', async () => {
            // Arrange
            const mockDevice = {
                deviceId: testDeviceId,
                userId: testUserId,
                credentialId: 'device-to-sell',
                status: ENROLLMENT_STATES.ENROLLED,
                isActive: true,
            };

            mockDeviceRepository.findById.mockResolvedValue(mockDevice);
            mockDeviceRepository.revoke.mockResolvedValue(undefined);

            const input = {
                userId: testUserId,
                deviceId: testDeviceId,
                reason: 'Preparando dispositivo para venta',
            };

            // Act
            const result = await revokeDeviceUseCase.execute(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });
});
