/**
 * Mock Factories - Factories para crear mocks reutilizables
 * 
 * Este archivo contiene factories para crear mocks de infraestructura
 * que pueden ser reutilizados en múltiples tests.
 */

import { vi } from 'vitest';

// ==================== STUDENT REPOSITORY MOCK ====================

export interface MockStudentRepository {
    findById: ReturnType<typeof vi.fn>;
    findByRut: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    isRegisteredInCourse: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del StudentRepository con respuestas por defecto
 */
export function createMockStudentRepository(overrides?: Partial<MockStudentRepository>): MockStudentRepository {
    return {
        findById: vi.fn().mockResolvedValue({
            id: 42,
            rut: '18687505-2',
            nombre: 'Juan Pérez',
            email: 'juan.perez@alumnos.ucn.cl',
        }),
        findByRut: vi.fn().mockResolvedValue({
            id: 42,
            rut: '18687505-2',
            nombre: 'Juan Pérez',
            email: 'juan.perez@alumnos.ucn.cl',
        }),
        save: vi.fn().mockResolvedValue(undefined),
        isRegisteredInCourse: vi.fn().mockResolvedValue(true),
        ...overrides,
    };
}

// ==================== QR STATE REPOSITORY MOCK ====================

export interface MockQRStateRepository {
    findBySessionId: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    markAsConsumed: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del QRStateRepository
 */
export function createMockQRStateRepository(overrides?: Partial<MockQRStateRepository>): MockQRStateRepository {
    return {
        findBySessionId: vi.fn().mockResolvedValue({
            sessionId: 'session-123',
            exists: true,
            consumed: false,
            round: 1,
            createdAt: Date.now(),
        }),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        markAsConsumed: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ==================== STUDENT STATE REPOSITORY MOCK ====================

export interface MockStudentStateRepository {
    findByStudentAndSession: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    incrementAttempt: ReturnType<typeof vi.fn>;
    addCompletedRound: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del StudentStateRepository
 */
export function createMockStudentStateRepository(overrides?: Partial<MockStudentStateRepository>): MockStudentStateRepository {
    return {
        findByStudentAndSession: vi.fn().mockResolvedValue({
            studentId: 42,
            sessionId: 'session-123',
            registered: true,
            status: 'active',
            currentRound: 1,
            activeNonce: 'a'.repeat(32),
            roundsCompleted: [],
            currentAttempt: 1,
            maxAttempts: 3,
            maxRounds: 3,
        }),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        incrementAttempt: vi.fn().mockResolvedValue(undefined),
        addCompletedRound: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ==================== SESSION KEY REPOSITORY MOCK ====================

export interface MockSessionKeyRepository {
    findByUserId: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del SessionKeyRepository
 */
export function createMockSessionKeyRepository(overrides?: Partial<MockSessionKeyRepository>): MockSessionKeyRepository {
    return {
        findByUserId: vi.fn().mockResolvedValue({
            sessionKey: Buffer.from('0'.repeat(64), 'hex'),
            userId: 42,
            deviceId: 100,
            createdAt: Date.now(),
        }),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ==================== DEVICE REPOSITORY MOCK ====================

export interface MockDeviceRepository {
    findByCredentialId: ReturnType<typeof vi.fn>;
    findByUserId: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    updateLastUsed: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del DeviceRepository
 */
export function createMockDeviceRepository(overrides?: Partial<MockDeviceRepository>): MockDeviceRepository {
    return {
        findByCredentialId: vi.fn().mockResolvedValue({
            deviceId: 100,
            userId: 42,
            credentialId: 'credential-id-base64',
            publicKey: 'public-key-base64',
            handshakeSecret: Buffer.from('handshake-secret-32-bytes').toString('base64'),
            status: 'enrolled',
            createdAt: new Date('2025-01-01'),
            lastUsedAt: new Date('2025-01-10'),
        }),
        findByUserId: vi.fn().mockResolvedValue([{
            deviceId: 100,
            userId: 42,
            credentialId: 'credential-id-base64',
            publicKey: 'public-key-base64',
            handshakeSecret: Buffer.from('handshake-secret-32-bytes').toString('base64'),
            status: 'enrolled',
            createdAt: new Date('2025-01-01'),
            lastUsedAt: new Date('2025-01-10'),
        }]),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        updateLastUsed: vi.fn().mockResolvedValue(undefined),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ==================== CRYPTO SERVICES MOCKS ====================

export interface MockEcdhService {
    performKeyExchange: ReturnType<typeof vi.fn>;
    generateKeyPair: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del EcdhService
 */
export function createMockEcdhService(overrides?: Partial<MockEcdhService>): MockEcdhService {
    return {
        performKeyExchange: vi.fn().mockReturnValue({
            sharedSecret: Buffer.from('a'.repeat(64), 'hex'),
            serverPublicKey: 'server-public-key-base64',
        }),
        generateKeyPair: vi.fn().mockReturnValue({
            privateKey: Buffer.from('private-key'),
            publicKey: 'public-key-base64',
        }),
        ...overrides,
    };
}

export interface MockHkdfService {
    deriveSessionKey: ReturnType<typeof vi.fn>;
    deriveHandshakeSecret: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del HkdfService
 */
export function createMockHkdfService(overrides?: Partial<MockHkdfService>): MockHkdfService {
    return {
        deriveSessionKey: vi.fn().mockResolvedValue(Buffer.from('0'.repeat(64), 'hex')),
        deriveHandshakeSecret: vi.fn().mockResolvedValue(Buffer.from('handshake-secret-32')),
        ...overrides,
    };
}

export interface MockTotpService {
    generate: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del TotpService
 */
export function createMockTotpService(overrides?: Partial<MockTotpService>): MockTotpService {
    return {
        generate: vi.fn().mockReturnValue('123456'),
        verify: vi.fn().mockReturnValue(true),
        ...overrides,
    };
}

// ==================== REDIS/VALKEY MOCK ====================

export interface MockRedisClient {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    ttl: ReturnType<typeof vi.fn>;
    setex: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del cliente Redis/Valkey
 */
export function createMockRedisClient(overrides?: Partial<MockRedisClient>): MockRedisClient {
    return {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        exists: vi.fn().mockResolvedValue(0),
        expire: vi.fn().mockResolvedValue(1),
        ttl: vi.fn().mockResolvedValue(-1),
        setex: vi.fn().mockResolvedValue('OK'),
        ...overrides,
    };
}

// ==================== POSTGRESQL MOCK ====================

export interface MockPostgresClient {
    query: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del cliente PostgreSQL
 */
export function createMockPostgresClient(overrides?: Partial<MockPostgresClient>): MockPostgresClient {
    return {
        query: vi.fn().mockResolvedValue({
            rows: [],
            rowCount: 0,
        }),
        connect: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ==================== FRAUD METRICS REPOSITORY MOCK ====================

export interface MockFraudMetricsRepository {
    recordSuspiciousActivity: ReturnType<typeof vi.fn>;
    incrementCounter: ReturnType<typeof vi.fn>;
    getMetricsForStudent: ReturnType<typeof vi.fn>;
}

/**
 * Crea un mock del FraudMetricsRepository
 */
export function createMockFraudMetricsRepository(overrides?: Partial<MockFraudMetricsRepository>): MockFraudMetricsRepository {
    return {
        recordSuspiciousActivity: vi.fn().mockResolvedValue(undefined),
        incrementCounter: vi.fn().mockResolvedValue(undefined),
        getMetricsForStudent: vi.fn().mockResolvedValue({
            studentId: 42,
            totalAttempts: 3,
            failedAttempts: 1,
            suspiciousActivities: [],
        }),
        ...overrides,
    };
}

// ==================== HELPERS PARA TESTS ====================

/**
 * Resetea todos los mocks en un objeto mock
 */
export function resetAllMocks(mockObject: Record<string, ReturnType<typeof vi.fn>>): void {
    Object.values(mockObject).forEach((mockFn) => {
        if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
            mockFn.mockClear();
        }
    });
}

/**
 * Verifica que un mock fue llamado con argumentos específicos
 */
export function expectMockCalledWith<T extends any[]>(
    mockFn: ReturnType<typeof vi.fn>,
    ...args: T
): void {
    expect(mockFn).toHaveBeenCalledWith(...args);
}

/**
 * Verifica que un mock fue llamado exactamente N veces
 */
export function expectMockCalledTimes(
    mockFn: ReturnType<typeof vi.fn>,
    times: number
): void {
    expect(mockFn).toHaveBeenCalledTimes(times);
}
