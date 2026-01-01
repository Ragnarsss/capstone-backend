import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceRepository } from '../device.repository';
import { PostgresPool } from '../../../../../shared/infrastructure/database';
import { ENROLLMENT_STATES } from '../../../domain/models';
import type { CreateDeviceDto, UpdateCounterDto } from '../../../domain/entities';
import crypto from 'crypto';

// Mock de PostgresPool
vi.mock('../../../../../shared/infrastructure/database', () => ({
    PostgresPool: {
        getInstance: vi.fn(),
    },
}));

describe('DeviceRepository - Tests Críticos de Persistencia', () => {
    let deviceRepository: DeviceRepository;
    let mockPool: any;
    let mockClient: any;

    // Test data común
    const testUserId = 123;
    const testCredentialId = crypto.randomBytes(32).toString('base64url');
    const testPublicKey = crypto.randomBytes(65).toString('base64');
    const testHandshakeSecret = crypto.randomBytes(32).toString('base64');
    const testDeviceFingerprint = crypto.randomBytes(32).toString('hex');
    const testAaguid = '00000000-0000-0000-0000-000000000000';

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock del pool de PostgreSQL
        mockClient = {
            query: vi.fn(),
            release: vi.fn(),
        };

        mockPool = {
            query: vi.fn(),
            transaction: vi.fn(),
        };

        (PostgresPool.getInstance as any).mockReturnValue(mockPool);

        deviceRepository = new DeviceRepository();
    });

    describe('create() - Crear nuevo dispositivo', () => {
        it('Debe crear un dispositivo nuevo con todos los campos', async () => {
            // Arrange
            const createDto: CreateDeviceDto = {
                userId: testUserId,
                credentialId: testCredentialId,
                publicKey: testPublicKey,
                handshakeSecret: testHandshakeSecret,
                aaguid: testAaguid,
                deviceFingerprint: testDeviceFingerprint,
                attestationFormat: 'none',
                signCount: 0,
                transports: ['internal'],
                status: ENROLLMENT_STATES.ENROLLED,
            };

            const mockRow = {
                device_id: 1,
                user_id: testUserId,
                credential_id: testCredentialId,
                public_key: testPublicKey,
                handshake_secret: testHandshakeSecret,
                aaguid: testAaguid,
                device_fingerprint: testDeviceFingerprint,
                attestation_format: 'none',
                sign_count: 0,
                enrolled_at: new Date(),
                last_used_at: null,
                is_active: true,
                status: ENROLLMENT_STATES.ENROLLED,
                transports: '["internal"]',
            };

            mockPool.query.mockResolvedValue({ rows: [mockRow] });

            // Act
            const result = await deviceRepository.create(createDto);

            // Assert
            expect(result).toBeDefined();
            expect(result.deviceId).toBe(1);
            expect(result.userId).toBe(testUserId);
            expect(result.credentialId).toBe(testCredentialId);
            expect(result.publicKey).toBe(testPublicKey);
            expect(result.handshakeSecret).toBe(testHandshakeSecret);
            expect(result.aaguid).toBe(testAaguid);
            expect(result.deviceFingerprint).toBe(testDeviceFingerprint);
            expect(result.status).toBe(ENROLLMENT_STATES.ENROLLED);
            expect(result.isActive).toBe(true);

            // Verificar query SQL
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO enrollment.devices'),
                expect.arrayContaining([
                    testUserId,
                    testCredentialId,
                    testPublicKey,
                    testHandshakeSecret,
                    testAaguid,
                    testDeviceFingerprint,
                    'none',
                    0,
                    '["internal"]',
                    ENROLLMENT_STATES.ENROLLED,
                ])
            );
        });

        it('Debe usar valores por defecto para campos opcionales', async () => {
            // Arrange
            const createDto: CreateDeviceDto = {
                userId: testUserId,
                credentialId: testCredentialId,
                publicKey: testPublicKey,
                handshakeSecret: testHandshakeSecret,
                aaguid: testAaguid,
                deviceFingerprint: testDeviceFingerprint,
            };

            const mockRow = {
                device_id: 1,
                user_id: testUserId,
                credential_id: testCredentialId,
                public_key: testPublicKey,
                handshake_secret: testHandshakeSecret,
                aaguid: testAaguid,
                device_fingerprint: testDeviceFingerprint,
                attestation_format: null,
                sign_count: 0,
                enrolled_at: new Date(),
                last_used_at: null,
                is_active: true,
                status: ENROLLMENT_STATES.ENROLLED,
                transports: null,
            };

            mockPool.query.mockResolvedValue({ rows: [mockRow] });

            // Act
            const result = await deviceRepository.create(createDto);

            // Assert
            expect(result).toBeDefined();
            expect(result.status).toBe(ENROLLMENT_STATES.ENROLLED);
            expect(result.signCount).toBe(0);

            // Verificar que se usaron valores por defecto
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([
                    null, // attestationFormat
                    0, // signCount
                    null, // transports
                    ENROLLMENT_STATES.ENROLLED, // status por defecto
                ])
            );
        });
    });

    describe('findByCredentialId() - Buscar por credentialId', () => {
        it('Debe retornar dispositivo cuando existe y está activo', async () => {
            // Arrange
            const mockRow = {
                device_id: 1,
                user_id: testUserId,
                credential_id: testCredentialId,
                public_key: testPublicKey,
                handshake_secret: testHandshakeSecret,
                aaguid: testAaguid,
                device_fingerprint: testDeviceFingerprint,
                attestation_format: 'none',
                sign_count: 5,
                enrolled_at: new Date(),
                last_used_at: new Date(),
                is_active: true,
                status: ENROLLMENT_STATES.ENROLLED,
                transports: '["internal"]',
            };

            mockPool.query.mockResolvedValue({ rows: [mockRow] });

            // Act
            const result = await deviceRepository.findByCredentialId(testCredentialId);

            // Assert
            expect(result).not.toBeNull();
            expect(result!.deviceId).toBe(1);
            expect(result!.credentialId).toBe(testCredentialId);
            expect(result!.isActive).toBe(true);

            // Verificar query con filtro is_active = TRUE
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('is_active = TRUE'),
                [testCredentialId]
            );
        });

        it('Debe retornar null cuando el dispositivo no existe', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [] });

            // Act
            const result = await deviceRepository.findByCredentialId('inexistente');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('findByUserId() - Buscar dispositivos de usuario', () => {
        it('Debe retornar array vacío si el usuario no tiene dispositivos', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [] });

            // Act
            const result = await deviceRepository.findByUserId(999);

            // Assert
            expect(result).toEqual([]);
            expect(Array.isArray(result)).toBe(true);
        });

        it('Debe retornar múltiples dispositivos del usuario', async () => {
            // Arrange
            const mockRows = [
                {
                    device_id: 1,
                    user_id: testUserId,
                    credential_id: 'credential1',
                    public_key: testPublicKey,
                    handshake_secret: testHandshakeSecret,
                    aaguid: testAaguid,
                    device_fingerprint: 'fingerprint1',
                    attestation_format: 'none',
                    sign_count: 0,
                    enrolled_at: new Date('2024-01-02'),
                    last_used_at: null,
                    is_active: true,
                    status: ENROLLMENT_STATES.ENROLLED,
                    transports: null,
                },
                {
                    device_id: 2,
                    user_id: testUserId,
                    credential_id: 'credential2',
                    public_key: testPublicKey,
                    handshake_secret: testHandshakeSecret,
                    aaguid: testAaguid,
                    device_fingerprint: 'fingerprint2',
                    attestation_format: 'none',
                    sign_count: 10,
                    enrolled_at: new Date('2024-01-01'),
                    last_used_at: new Date(),
                    is_active: true,
                    status: ENROLLMENT_STATES.ENROLLED,
                    transports: null,
                },
            ];

            mockPool.query.mockResolvedValue({ rows: mockRows });

            // Act
            const result = await deviceRepository.findByUserId(testUserId);

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0].deviceId).toBe(1);
            expect(result[1].deviceId).toBe(2);
            expect(result[0].userId).toBe(testUserId);
            expect(result[1].userId).toBe(testUserId);

            // Verificar query con ORDER BY enrolled_at DESC
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY enrolled_at DESC'),
                [testUserId]
            );
        });
    });

    describe('updateCounter() - Actualizar contador de firmas', () => {
        it('Debe actualizar sign_count y last_used_at', async () => {
            // Arrange
            const updateDto: UpdateCounterDto = {
                deviceId: 1,
                newCounter: 10,
            };

            mockPool.query.mockResolvedValue({ rowCount: 1 });

            // Act
            await deviceRepository.updateCounter(updateDto);

            // Assert
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE enrollment.devices'),
                [10, 1]
            );
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('sign_count = $1'),
                expect.any(Array)
            );
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('last_used_at = NOW()'),
                expect.any(Array)
            );
        });
    });

    describe('updateLastUsed() - Actualizar timestamp de uso', () => {
        it('Debe actualizar last_used_at a NOW()', async () => {
            // Arrange
            const deviceId = 1;
            mockPool.query.mockResolvedValue({ rowCount: 1 });

            // Act
            await deviceRepository.updateLastUsed(deviceId);

            // Assert
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE enrollment.devices'),
                [deviceId]
            );
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SET last_used_at = NOW()'),
                expect.any(Array)
            );
        });
    });

    describe('revoke() - Revocar dispositivo (soft delete)', () => {
        it('Debe actualizar is_active = FALSE en transacción', async () => {
            // Arrange
            const deviceId = 1;
            const reason = 'Usuario solicitó revocación';

            mockPool.transaction.mockImplementation(async (callback: any) => {
                return await callback(mockClient);
            });

            mockClient.query.mockResolvedValue({ rowCount: 1 });

            // Act
            await deviceRepository.revoke(deviceId, reason);

            // Assert
            expect(mockPool.transaction).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE enrollment.devices'),
                expect.arrayContaining([deviceId])
            );
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('is_active = FALSE'),
                expect.any(Array)
            );
        });
    });

    describe('findByCredentialIdIncludingInactive() - Buscar incluyendo inactivos', () => {
        it('Debe retornar dispositivo revocado cuando se busca con includeInactive', async () => {
            // Arrange
            const mockRow = {
                device_id: 1,
                user_id: testUserId,
                credential_id: testCredentialId,
                public_key: testPublicKey,
                handshake_secret: testHandshakeSecret,
                aaguid: testAaguid,
                device_fingerprint: testDeviceFingerprint,
                attestation_format: 'none',
                sign_count: 5,
                enrolled_at: new Date(),
                last_used_at: new Date(),
                is_active: false, // REVOCADO
                status: ENROLLMENT_STATES.REVOKED,
                transports: '["internal"]',
            };

            mockPool.query.mockResolvedValue({ rows: [mockRow] });

            // Act
            const result = await deviceRepository.findByCredentialIdIncludingInactive(testCredentialId);

            // Assert
            expect(result).not.toBeNull();
            expect(result!.deviceId).toBe(1);
            expect(result!.isActive).toBe(false);
            expect(result!.status).toBe(ENROLLMENT_STATES.REVOKED);

            // Verificar que NO filtra por is_active
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.not.stringContaining('is_active = TRUE'),
                [testCredentialId]
            );
        });
    });

    describe('Mapeo de rows a Device', () => {
        it('Debe parsear transports JSON correctamente', async () => {
            // Arrange
            const mockRow = {
                device_id: 1,
                user_id: testUserId,
                credential_id: testCredentialId,
                public_key: testPublicKey,
                handshake_secret: testHandshakeSecret,
                aaguid: testAaguid,
                device_fingerprint: testDeviceFingerprint,
                attestation_format: 'none',
                sign_count: 0,
                enrolled_at: new Date(),
                last_used_at: null,
                is_active: true,
                status: ENROLLMENT_STATES.ENROLLED,
                transports: '["internal", "usb"]',
            };

            mockPool.query.mockResolvedValue({ rows: [mockRow] });

            // Act
            const result = await deviceRepository.findByCredentialId(testCredentialId);

            // Assert
            expect(result).not.toBeNull();
            expect(result!.transports).toEqual(['internal', 'usb']);
        });

        it('Debe manejar transports null correctamente', async () => {
            // Arrange
            const mockRow = {
                device_id: 1,
                user_id: testUserId,
                credential_id: testCredentialId,
                public_key: testPublicKey,
                handshake_secret: testHandshakeSecret,
                aaguid: testAaguid,
                device_fingerprint: testDeviceFingerprint,
                attestation_format: null,
                sign_count: 0,
                enrolled_at: new Date(),
                last_used_at: null,
                is_active: true,
                status: ENROLLMENT_STATES.ENROLLED,
                transports: null,
            };

            mockPool.query.mockResolvedValue({ rows: [mockRow] });

            // Act
            const result = await deviceRepository.findByCredentialId(testCredentialId);

            // Assert
            expect(result).not.toBeNull();
            expect(result!.transports).toBeUndefined();
        });
    });

    describe('findById() - Buscar dispositivo por ID', () => {
        it('Debe retornar dispositivo cuando existe', async () => {
            // Arrange
            const mockRow = {
                device_id: 42,
                user_id: testUserId,
                credential_id: testCredentialId,
                public_key: testPublicKey,
                handshake_secret: testHandshakeSecret,
                aaguid: testAaguid,
                device_fingerprint: testDeviceFingerprint,
                attestation_format: 'none',
                sign_count: 5,
                enrolled_at: new Date(),
                last_used_at: new Date(),
                is_active: true,
                status: ENROLLMENT_STATES.ENROLLED,
                transports: null,
            };

            mockPool.query.mockResolvedValue({ rows: [mockRow] });

            // Act
            const result = await deviceRepository.findById(42);

            // Assert
            expect(result).not.toBeNull();
            expect(result!.deviceId).toBe(42);
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('device_id = $1'),
                [42]
            );
        });

        it('Debe retornar null si no existe', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [] });

            // Act
            const result = await deviceRepository.findById(999);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('findByUserIdIncludingInactive() - Incluye dispositivos revocados', () => {
        it('Debe retornar dispositivos activos e inactivos', async () => {
            // Arrange
            const mockRows = [
                {
                    device_id: 1,
                    user_id: testUserId,
                    credential_id: 'active-credential',
                    public_key: testPublicKey,
                    handshake_secret: testHandshakeSecret,
                    aaguid: testAaguid,
                    device_fingerprint: 'active-fingerprint',
                    attestation_format: 'none',
                    sign_count: 10,
                    enrolled_at: new Date('2024-02-01'),
                    last_used_at: new Date(),
                    is_active: true,
                    status: ENROLLMENT_STATES.ENROLLED,
                    transports: null,
                },
                {
                    device_id: 2,
                    user_id: testUserId,
                    credential_id: 'revoked-credential',
                    public_key: testPublicKey,
                    handshake_secret: testHandshakeSecret,
                    aaguid: testAaguid,
                    device_fingerprint: 'revoked-fingerprint',
                    attestation_format: 'none',
                    sign_count: 5,
                    enrolled_at: new Date('2024-01-01'),
                    last_used_at: new Date('2024-01-15'),
                    is_active: false, // REVOCADO
                    status: ENROLLMENT_STATES.REVOKED,
                    transports: null,
                },
            ];

            mockPool.query.mockResolvedValue({ rows: mockRows });

            // Act
            const result = await deviceRepository.findByUserIdIncludingInactive(testUserId);

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0].isActive).toBe(true);
            expect(result[1].isActive).toBe(false);

            // Verificar que NO filtra por is_active
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.not.stringContaining('is_active = TRUE'),
                [testUserId]
            );
        });
    });

    describe('updateDeviceFingerprint() - Actualiza fingerprint del dispositivo', () => {
        it('Debe actualizar deviceFingerprint y last_used_at', async () => {
            // Arrange
            const deviceId = 1;
            const newFingerprint = 'new-fingerprint-after-os-update';
            mockPool.query.mockResolvedValue({ rowCount: 1 });

            // Act
            await deviceRepository.updateDeviceFingerprint(deviceId, newFingerprint);

            // Assert
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE enrollment.devices'),
                [newFingerprint, deviceId]
            );
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('device_fingerprint = $1'),
                expect.any(Array)
            );
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('last_used_at = NOW()'),
                expect.any(Array)
            );
        });
    });

    describe('countByUserId() - Contar dispositivos activos', () => {
        it('Debe retornar número de dispositivos activos', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });

            // Act
            const result = await deviceRepository.countByUserId(testUserId);

            // Assert
            expect(result).toBe(3);
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('COUNT(*)'),
                [testUserId]
            );
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('is_active = TRUE'),
                expect.any(Array)
            );
        });

        it('Debe retornar 0 si no tiene dispositivos', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });

            // Act
            const result = await deviceRepository.countByUserId(999);

            // Assert
            expect(result).toBe(0);
        });
    });

    describe('hasEnrolledDevices() - Verificar si tiene dispositivos', () => {
        it('Debe retornar true si tiene dispositivos', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [{ count: '2' }] });

            // Act
            const result = await deviceRepository.hasEnrolledDevices(testUserId);

            // Assert
            expect(result).toBe(true);
        });

        it('Debe retornar false si no tiene dispositivos', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });

            // Act
            const result = await deviceRepository.hasEnrolledDevices(testUserId);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('revokeAllByUserId() - Revocar todos los dispositivos del usuario', () => {
        it('Debe revocar todos los dispositivos activos en transacción', async () => {
            // Arrange
            const reason = 'Política 1:1 - auto-revocación';

            mockPool.transaction.mockImplementation(async (callback: any) => {
                return await callback(mockClient);
            });

            // Simular que hay 3 dispositivos activos
            mockClient.query.mockResolvedValueOnce({
                rows: [
                    { device_id: 1 },
                    { device_id: 2 },
                    { device_id: 3 },
                ]
            });

            // Act
            const revokedCount = await deviceRepository.revokeAllByUserId(testUserId, reason);

            // Assert
            expect(revokedCount).toBe(3);
            expect(mockPool.transaction).toHaveBeenCalled();

            // Verificar que se buscaron los dispositivos activos
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT device_id'),
                [testUserId]
            );

            // Verificar que se desactivaron
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('is_active = FALSE'),
                [testUserId]
            );

            // Verificar que se registró en historial (3 veces, uno por device)
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('enrollment_history'),
                expect.arrayContaining([1, testUserId, reason])
            );
        });

        it('Debe retornar 0 si no hay dispositivos activos', async () => {
            // Arrange
            mockPool.transaction.mockImplementation(async (callback: any) => {
                return await callback(mockClient);
            });

            mockClient.query.mockResolvedValueOnce({ rows: [] }); // Sin dispositivos

            // Act
            const revokedCount = await deviceRepository.revokeAllByUserId(testUserId);

            // Assert
            expect(revokedCount).toBe(0);
        });
    });

    describe('findActiveByDeviceFingerprint() - Buscar por fingerprint físico', () => {
        it('Debe retornar dispositivos activos con ese fingerprint', async () => {
            // Arrange - 2 usuarios con el mismo dispositivo físico (compartido)
            const sharedFingerprint = 'shared-physical-device-fingerprint';

            const mockRows = [
                {
                    device_id: 1,
                    user_id: 100,
                    credential_id: 'user100-credential',
                    public_key: testPublicKey,
                    handshake_secret: testHandshakeSecret,
                    aaguid: testAaguid,
                    device_fingerprint: sharedFingerprint,
                    attestation_format: 'none',
                    sign_count: 5,
                    enrolled_at: new Date('2024-02-01'),
                    last_used_at: new Date(),
                    is_active: true,
                    status: ENROLLMENT_STATES.ENROLLED,
                    transports: null,
                },
                {
                    device_id: 2,
                    user_id: 200,
                    credential_id: 'user200-credential',
                    public_key: testPublicKey,
                    handshake_secret: testHandshakeSecret,
                    aaguid: testAaguid,
                    device_fingerprint: sharedFingerprint,
                    attestation_format: 'none',
                    sign_count: 10,
                    enrolled_at: new Date('2024-01-01'),
                    last_used_at: new Date('2024-01-31'),
                    is_active: true,
                    status: ENROLLMENT_STATES.ENROLLED,
                    transports: null,
                },
            ];

            mockPool.query.mockResolvedValue({ rows: mockRows });

            // Act
            const result = await deviceRepository.findActiveByDeviceFingerprint(sharedFingerprint);

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0].userId).toBe(100);
            expect(result[1].userId).toBe(200);
            expect(result[0].deviceFingerprint).toBe(sharedFingerprint);
            expect(result[1].deviceFingerprint).toBe(sharedFingerprint);

            // Verificar que solo busca activos
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('is_active = TRUE'),
                [sharedFingerprint]
            );
        });

        it('Debe retornar array vacío si no hay dispositivos con ese fingerprint', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [] });

            // Act
            const result = await deviceRepository.findActiveByDeviceFingerprint('inexistente');

            // Assert
            expect(result).toEqual([]);
        });

        it('NO debe retornar dispositivos revocados aunque tengan el mismo fingerprint', async () => {
            // Arrange - Solo 1 activo, aunque haya más revocados
            const mockRows = [
                {
                    device_id: 1,
                    user_id: 100,
                    credential_id: 'active-cred',
                    public_key: testPublicKey,
                    handshake_secret: testHandshakeSecret,
                    aaguid: testAaguid,
                    device_fingerprint: 'test-fingerprint',
                    attestation_format: 'none',
                    sign_count: 5,
                    enrolled_at: new Date(),
                    last_used_at: new Date(),
                    is_active: true, // ACTIVO
                    status: ENROLLMENT_STATES.ENROLLED,
                    transports: null,
                },
            ];

            mockPool.query.mockResolvedValue({ rows: mockRows });

            // Act
            const result = await deviceRepository.findActiveByDeviceFingerprint('test-fingerprint');

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].isActive).toBe(true);
        });
    });
});
