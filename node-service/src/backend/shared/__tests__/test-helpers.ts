/**
 * Test Helpers - Utilidades comunes para tests
 * 
 * Proporciona helpers reutilizables para crear mocks, datos de prueba,
 * y contextos válidos en los tests.
 */

import type { ValidationContext } from '@backend/attendance/domain/validation-pipeline/context';
import { createContext } from '@backend/attendance/domain/validation-pipeline/context';
import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@backend/auth/domain/models';

// ==================== ATTENDANCE HELPERS ====================

/**
 * Crea un ValidationContext válido con todos los datos necesarios
 * para pasar las validaciones del pipeline
 */
export function createValidContext(overrides?: Partial<ValidationContext>): ValidationContext {
    const ctx = createContext('encrypted-test', 42);

    ctx.response = {
        original: {
            v: 1,
            sid: 'session-123',
            uid: 1,
            r: 1,
            ts: Date.now() - 1000,
            n: 'a'.repeat(32),
        },
        studentId: 42,
        receivedAt: Date.now(),
    };

    ctx.qrState = {
        exists: true,
        consumed: false,
    };

    ctx.studentState = {
        registered: true,
        status: 'active',
        currentRound: 1,
        activeNonce: 'a'.repeat(32),
        roundsCompleted: [],
        currentAttempt: 1,
        maxAttempts: 3,
        maxRounds: 3,
    };

    return { ...ctx, ...overrides };
}

/**
 * Crea un QRPayload válido para tests
 */
export function createValidQRPayload(overrides?: any) {
    return {
        v: 1,
        sid: 'session-123',
        uid: 1,
        r: 1,
        ts: Date.now() - 1000,
        n: 'a'.repeat(32),
        ...overrides,
    };
}

// ==================== AUTH HELPERS ====================

/**
 * Configuración por defecto de JWT para tests
 */
export const TEST_JWT_CONFIG = {
    secret: 'test-secret-key-for-jwt-testing',
    expiresIn: '1h',
    issuer: 'test-issuer',
    audience: 'test-audience',
};

/**
 * Genera un JWT válido para tests
 * @param payload - Payload del JWT
 * @param config - Configuración opcional (usa TEST_JWT_CONFIG por defecto)
 */
export function generateTestJWT(
    payload: JWTPayload,
    config = TEST_JWT_CONFIG
): string {
    return jwt.sign(payload, config.secret, {
        issuer: config.issuer,
        audience: config.audience,
        expiresIn: config.expiresIn,
    });
}

/**
 * Genera un JWT expirado para tests
 */
export function generateExpiredJWT(
    payload: JWTPayload,
    config = TEST_JWT_CONFIG
): string {
    return jwt.sign(payload, config.secret, {
        issuer: config.issuer,
        audience: config.audience,
        expiresIn: '-1s', // Expirado hace 1 segundo
    });
}

/**
 * Crea un JWTPayload válido para tests
 */
export function createTestJWTPayload(overrides?: Partial<JWTPayload>): JWTPayload {
    return {
        userId: 42,
        username: 'test@ucn.cl',
        nombreCompleto: 'Test User',
        rol: 'profesor',
        ...overrides,
    };
}

/**
 * Crea un header Authorization válido para tests
 */
export function createAuthHeader(token: string): string {
    return `Bearer ${token}`;
}

// ==================== SESSION HELPERS ====================

/**
 * Crea una session_key de prueba (32 bytes)
 */
export function createTestSessionKey(): Buffer {
    return Buffer.from('0'.repeat(64), 'hex');
}

/**
 * Crea un shared secret de prueba para ECDH (32 bytes)
 */
export function createTestSharedSecret(): Buffer {
    return Buffer.from('a'.repeat(64), 'hex');
}

/**
 * Crea una clave pública ECDH de prueba (base64)
 */
export function createTestECDHPublicKey(): string {
    const randomBytes = Buffer.from('test-public-key-ecdh-p256');
    return randomBytes.toString('base64');
}

// ==================== MOCK REPOSITORIES ====================

/**
 * Crea un mock básico de repositorio con métodos comunes
 */
export function createMockRepository<T>() {
    return {
        findById: vi.fn<(id: number) => Promise<T | null>>(),
        save: vi.fn<(entity: T) => Promise<void>>(),
        delete: vi.fn<(id: number) => Promise<void>>(),
        findAll: vi.fn<() => Promise<T[]>>(),
    };
}

/**
 * Crea un mock de Redis/Valkey
 */
export function createMockRedis() {
    return {
        get: vi.fn<(key: string) => Promise<string | null>>(),
        set: vi.fn<(key: string, value: string, ttl?: number) => Promise<'OK'>>(),
        del: vi.fn<(key: string) => Promise<number>>(),
        exists: vi.fn<(key: string) => Promise<number>>(),
        expire: vi.fn<(key: string, seconds: number) => Promise<number>>(),
        ttl: vi.fn<(key: string) => Promise<number>>(),
    };
}

/**
 * Crea un mock de PostgreSQL client
 */
export function createMockPostgres() {
    return {
        query: vi.fn<(sql: string, params?: any[]) => Promise<{
            rows: any[];
            rowCount: number;
        }>>(),
    };
}

// ==================== TIME HELPERS ====================

/**
 * Crea un timestamp en el pasado
 * @param secondsAgo - Segundos en el pasado
 */
export function timestampSecondsAgo(secondsAgo: number): number {
    return Date.now() - (secondsAgo * 1000);
}

/**
 * Crea un timestamp en el futuro
 * @param secondsFromNow - Segundos en el futuro
 */
export function timestampSecondsFromNow(secondsFromNow: number): number {
    return Date.now() + (secondsFromNow * 1000);
}

// ==================== RANDOM DATA GENERATORS ====================

/**
 * Genera un RUT chileno válido aleatorio
 */
export function generateRandomRut(): string {
    const number = Math.floor(Math.random() * 24000000) + 1000000;
    const dv = calculateRutDV(number);
    return `${number}-${dv}`;
}

/**
 * Calcula el dígito verificador de un RUT
 */
function calculateRutDV(rut: number): string {
    let sum = 0;
    let multiplier = 2;

    while (rut > 0) {
        sum += (rut % 10) * multiplier;
        rut = Math.floor(rut / 10);
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const mod = 11 - (sum % 11);
    if (mod === 11) return '0';
    if (mod === 10) return 'K';
    return mod.toString();
}

/**
 * Genera un email aleatorio
 */
export function generateRandomEmail(): string {
    const randomString = Math.random().toString(36).substring(2, 10);
    return `${randomString}@ucn.cl`;
}

/**
 * Genera un nonce aleatorio (32 caracteres hexadecimales)
 */
export function generateRandomNonce(): string {
    return Buffer.from(Math.random().toString()).toString('hex').substring(0, 32).padEnd(32, '0');
}

/**
 * Genera un session ID aleatorio
 */
export function generateRandomSessionId(): string {
    return `session-${Math.random().toString(36).substring(2, 15)}`;
}

// ==================== ASSERTION HELPERS ====================

/**
 * Verifica que un objeto tenga todas las propiedades requeridas
 */
export function expectToHaveProperties<T extends object>(
    obj: T,
    properties: (keyof T)[]
): void {
    for (const prop of properties) {
        expect(obj).toHaveProperty(prop);
        expect(obj[prop]).toBeDefined();
    }
}

/**
 * Verifica que una función asíncrona lance un error con mensaje específico
 */
export async function expectToThrowAsync(
    fn: () => Promise<any>,
    errorMessage?: string
): Promise<void> {
    try {
        await fn();
        throw new Error('Expected function to throw, but it did not');
    } catch (error) {
        if (error instanceof Error && errorMessage) {
            expect(error.message).toContain(errorMessage);
        }
    }
}

// ==================== BUFFER HELPERS ====================

/**
 * Crea un Buffer de tamaño específico con datos aleatorios
 */
export function createRandomBuffer(size: number): Buffer {
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
}

/**
 * Compara dos buffers y retorna true si son iguales
 */
export function buffersAreEqual(buf1: Buffer, buf2: Buffer): boolean {
    if (buf1.length !== buf2.length) return false;
    return buf1.equals(buf2);
}

// ==================== IMPORT/EXPORT ====================

// Re-exportar vi para que los tests solo importen desde test-helpers
export { vi } from 'vitest';
