import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetDevicesUseCase } from '../get-devices.use-case';
import { DeviceRepository } from '../../../infrastructure/repositories/device.repository';
import { ENROLLMENT_STATES } from '../../../domain/models';

// Mock de DeviceRepository
vi.mock('../../../infrastructure/repositories/device.repository');

describe('GetDevicesUseCase - Tests de Listado de Dispositivos', () => {
    let getDevicesUseCase: GetDevicesUseCase;
    let mockDeviceRepository: any;

    const testUserId = 123;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDeviceRepository = {
            findByUserId: vi.fn(),
        };

        getDevicesUseCase = new GetDevicesUseCase(mockDeviceRepository);
    });

    describe('execute() - Listar dispositivos exitosamente', () => {
        it('Debe retornar lista de dispositivos activos del usuario', async () => {
            // Arrange
            const mockDevices = [
                {
                    deviceId: 1,
                    userId: testUserId,
                    credentialId: 'cred-1',
                    publicKey: 'pub-key-1',
                    aaguid: '00000000-0000-0000-0000-000000000001',
                    deviceFingerprint: 'fingerprint-1',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-01-01'),
                    lastUsedAt: new Date('2024-01-15'),
                    signCount: 10,
                },
                {
                    deviceId: 2,
                    userId: testUserId,
                    credentialId: 'cred-2',
                    publicKey: 'pub-key-2',
                    aaguid: '00000000-0000-0000-0000-000000000002',
                    deviceFingerprint: 'fingerprint-2',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-02-01'),
                    lastUsedAt: new Date('2024-02-15'),
                    signCount: 5,
                },
            ];

            mockDeviceRepository.findByUserId.mockResolvedValue(mockDevices);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert
            expect(result.deviceCount).toBe(2);
            expect(result.devices).toHaveLength(2);

            // Verificar estructura del primer dispositivo
            expect(result.devices[0]).toEqual({
                deviceId: 1,
                credentialId: 'cred-1',
                aaguid: '00000000-0000-0000-0000-000000000001',
                enrolledAt: new Date('2024-01-01'),
                lastUsedAt: new Date('2024-01-15'),
            });

            // Verificar estructura del segundo dispositivo
            expect(result.devices[1]).toEqual({
                deviceId: 2,
                credentialId: 'cred-2',
                aaguid: '00000000-0000-0000-0000-000000000002',
                enrolledAt: new Date('2024-02-01'),
                lastUsedAt: new Date('2024-02-15'),
            });

            // Verificar que se llamó al repository
            expect(mockDeviceRepository.findByUserId).toHaveBeenCalledWith(testUserId);
            expect(mockDeviceRepository.findByUserId).toHaveBeenCalledTimes(1);
        });

        it('Debe retornar array vacío si el usuario no tiene dispositivos', async () => {
            // Arrange
            mockDeviceRepository.findByUserId.mockResolvedValue([]);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert
            expect(result.deviceCount).toBe(0);
            expect(result.devices).toEqual([]);
            expect(Array.isArray(result.devices)).toBe(true);
        });

        it('Debe transformar correctamente los datos del dispositivo', async () => {
            // Arrange
            const mockDevices = [
                {
                    deviceId: 42,
                    userId: testUserId,
                    credentialId: 'test-credential-id',
                    publicKey: 'should-not-be-included',
                    aaguid: 'aaguid-test',
                    deviceFingerprint: 'should-not-be-included',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-03-01T10:00:00Z'),
                    lastUsedAt: new Date('2024-03-15T15:30:00Z'),
                    signCount: 100,
                    revokedAt: null,
                    revokedReason: null,
                },
            ];

            mockDeviceRepository.findByUserId.mockResolvedValue(mockDevices);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert
            const device = result.devices[0];

            // Verificar que solo incluye campos necesarios (no publicKey, fingerprint, status, etc.)
            expect(device).toHaveProperty('deviceId');
            expect(device).toHaveProperty('credentialId');
            expect(device).toHaveProperty('aaguid');
            expect(device).toHaveProperty('enrolledAt');
            expect(device).toHaveProperty('lastUsedAt');

            // Verificar que NO incluye campos sensibles
            expect(device).not.toHaveProperty('publicKey');
            expect(device).not.toHaveProperty('deviceFingerprint');
            expect(device).not.toHaveProperty('signCount');
            expect(device).not.toHaveProperty('status');
            expect(device).not.toHaveProperty('isActive');
            expect(device).not.toHaveProperty('userId');
        });
    });

    describe('Múltiples dispositivos', () => {
        it('Debe manejar correctamente 5 dispositivos', async () => {
            // Arrange
            const mockDevices = Array.from({ length: 5 }, (_, i) => ({
                deviceId: i + 1,
                userId: testUserId,
                credentialId: `cred-${i + 1}`,
                publicKey: `pub-key-${i + 1}`,
                aaguid: `aaguid-${i + 1}`,
                deviceFingerprint: `fingerprint-${i + 1}`,
                status: ENROLLMENT_STATES.ENROLLED,
                isActive: true,
                enrolledAt: new Date(`2024-01-0${i + 1}`),
                lastUsedAt: new Date(`2024-02-0${i + 1}`),
                signCount: i * 10,
            }));

            mockDeviceRepository.findByUserId.mockResolvedValue(mockDevices);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert
            expect(result.deviceCount).toBe(5);
            expect(result.devices).toHaveLength(5);

            // Verificar que todos los dispositivos están presentes
            for (let i = 0; i < 5; i++) {
                expect(result.devices[i].deviceId).toBe(i + 1);
                expect(result.devices[i].credentialId).toBe(`cred-${i + 1}`);
            }
        });

        it('Debe mantener el orden de los dispositivos del repository', async () => {
            // Arrange - Orden específico por lastUsedAt descendente
            const mockDevices = [
                {
                    deviceId: 3,
                    userId: testUserId,
                    credentialId: 'cred-3',
                    publicKey: 'pub-key-3',
                    aaguid: 'aaguid-3',
                    deviceFingerprint: 'fingerprint-3',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-01-01'),
                    lastUsedAt: new Date('2024-03-01'), // Más reciente
                    signCount: 30,
                },
                {
                    deviceId: 1,
                    userId: testUserId,
                    credentialId: 'cred-1',
                    publicKey: 'pub-key-1',
                    aaguid: 'aaguid-1',
                    deviceFingerprint: 'fingerprint-1',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-01-01'),
                    lastUsedAt: new Date('2024-02-01'),
                    signCount: 10,
                },
                {
                    deviceId: 2,
                    userId: testUserId,
                    credentialId: 'cred-2',
                    publicKey: 'pub-key-2',
                    aaguid: 'aaguid-2',
                    deviceFingerprint: 'fingerprint-2',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-01-01'),
                    lastUsedAt: new Date('2024-01-01'), // Más antiguo
                    signCount: 20,
                },
            ];

            mockDeviceRepository.findByUserId.mockResolvedValue(mockDevices);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert - El orden debe mantenerse como lo retorna el repository
            expect(result.devices[0].deviceId).toBe(3);
            expect(result.devices[1].deviceId).toBe(1);
            expect(result.devices[2].deviceId).toBe(2);
        });
    });

    describe('Casos edge con fechas', () => {
        it('Debe manejar dispositivo sin lastUsedAt (nunca usado después de enrollment)', async () => {
            // Arrange
            const mockDevices = [
                {
                    deviceId: 1,
                    userId: testUserId,
                    credentialId: 'cred-1',
                    publicKey: 'pub-key-1',
                    aaguid: 'aaguid-1',
                    deviceFingerprint: 'fingerprint-1',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-01-01'),
                    lastUsedAt: null, // Nunca usado
                    signCount: 0,
                },
            ];

            mockDeviceRepository.findByUserId.mockResolvedValue(mockDevices);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert
            expect(result.devices[0].lastUsedAt).toBeNull();
        });

        it('Debe manejar correctamente timezone en fechas', async () => {
            // Arrange
            const enrolledDate = new Date('2024-01-01T12:00:00.000Z');
            const lastUsedDate = new Date('2024-01-15T18:30:45.123Z');

            const mockDevices = [
                {
                    deviceId: 1,
                    userId: testUserId,
                    credentialId: 'cred-1',
                    publicKey: 'pub-key-1',
                    aaguid: 'aaguid-1',
                    deviceFingerprint: 'fingerprint-1',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: enrolledDate,
                    lastUsedAt: lastUsedDate,
                    signCount: 10,
                },
            ];

            mockDeviceRepository.findByUserId.mockResolvedValue(mockDevices);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert - Las fechas deben preservarse exactamente
            expect(result.devices[0].enrolledAt).toEqual(enrolledDate);
            expect(result.devices[0].lastUsedAt).toEqual(lastUsedDate);
        });
    });

    describe('Casos de uso reales', () => {
        it('Debe listar dispositivos para UI de gestión de usuario', async () => {
            // Arrange - Usuario con laptop y teléfono
            const mockDevices = [
                {
                    deviceId: 1,
                    userId: testUserId,
                    credentialId: 'laptop-chrome-credential',
                    publicKey: 'laptop-pubkey',
                    aaguid: '08987058-cadc-4b81-b6e1-30de50dcbe96', // Windows Hello
                    deviceFingerprint: 'laptop-fingerprint',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-01-10'),
                    lastUsedAt: new Date('2024-03-15T09:00:00Z'), // Usado hoy
                    signCount: 50,
                },
                {
                    deviceId: 2,
                    userId: testUserId,
                    credentialId: 'phone-android-credential',
                    publicKey: 'phone-pubkey',
                    aaguid: 'b93fd961-f2e6-462f-b122-82002247de78', // Android SafetyNet
                    deviceFingerprint: 'phone-fingerprint',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-02-01'),
                    lastUsedAt: new Date('2024-03-14'), // Ayer
                    signCount: 25,
                },
            ];

            mockDeviceRepository.findByUserId.mockResolvedValue(mockDevices);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert
            expect(result.deviceCount).toBe(2);
            expect(result.devices[0].aaguid).toBe('08987058-cadc-4b81-b6e1-30de50dcbe96');
            expect(result.devices[1].aaguid).toBe('b93fd961-f2e6-462f-b122-82002247de78');
        });

        it('Debe manejar nuevo usuario sin dispositivos enrolados', async () => {
            // Arrange - Nuevo usuario
            mockDeviceRepository.findByUserId.mockResolvedValue([]);

            const input = { userId: 999 };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert
            expect(result.deviceCount).toBe(0);
            expect(result.devices).toEqual([]);
        });
    });

    describe('Consistencia de datos', () => {
        it('Debe verificar que deviceCount coincide con el tamaño del array', async () => {
            // Arrange
            const mockDevices = [
                {
                    deviceId: 1,
                    userId: testUserId,
                    credentialId: 'cred-1',
                    publicKey: 'pub-key-1',
                    aaguid: 'aaguid-1',
                    deviceFingerprint: 'fingerprint-1',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-01-01'),
                    lastUsedAt: new Date('2024-01-15'),
                    signCount: 10,
                },
                {
                    deviceId: 2,
                    userId: testUserId,
                    credentialId: 'cred-2',
                    publicKey: 'pub-key-2',
                    aaguid: 'aaguid-2',
                    deviceFingerprint: 'fingerprint-2',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-02-01'),
                    lastUsedAt: new Date('2024-02-15'),
                    signCount: 5,
                },
                {
                    deviceId: 3,
                    userId: testUserId,
                    credentialId: 'cred-3',
                    publicKey: 'pub-key-3',
                    aaguid: 'aaguid-3',
                    deviceFingerprint: 'fingerprint-3',
                    status: ENROLLMENT_STATES.ENROLLED,
                    isActive: true,
                    enrolledAt: new Date('2024-03-01'),
                    lastUsedAt: new Date('2024-03-15'),
                    signCount: 15,
                },
            ];

            mockDeviceRepository.findByUserId.mockResolvedValue(mockDevices);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert - deviceCount debe ser igual a la longitud del array
            expect(result.deviceCount).toBe(result.devices.length);
            expect(result.deviceCount).toBe(3);
        });

        it('Debe retornar estructura consistente incluso con array vacío', async () => {
            // Arrange
            mockDeviceRepository.findByUserId.mockResolvedValue([]);

            const input = { userId: testUserId };

            // Act
            const result = await getDevicesUseCase.execute(input);

            // Assert
            expect(result).toHaveProperty('deviceCount');
            expect(result).toHaveProperty('devices');
            expect(result.deviceCount).toBe(result.devices.length);
        });
    });
});
