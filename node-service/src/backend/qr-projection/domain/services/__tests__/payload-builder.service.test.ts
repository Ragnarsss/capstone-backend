import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PayloadBuilder, type StudentPayloadInput, type FakePayloadInput } from '../payload-builder.service';
import { randomBytes } from 'crypto';

// Mock crypto.randomBytes
vi.mock('crypto', () => ({
    randomBytes: vi.fn(),
}));

describe('PayloadBuilder', () => {
    beforeEach(() => {
        // Mock randomBytes con valor predecible
        vi.mocked(randomBytes).mockReturnValue(Buffer.from('0123456789abcdef0123456789abcdef', 'hex'));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('generateNonce()', () => {
        it('debería generar nonce de 32 caracteres hex (16 bytes)', () => {
            const nonce = PayloadBuilder.generateNonce();

            expect(nonce).toBe('0123456789abcdef0123456789abcdef');
            expect(nonce.length).toBe(32);
            expect(randomBytes).toHaveBeenCalledWith(16);
        });

        it('debería generar nonces diferentes en cada llamada', () => {
            vi.mocked(randomBytes).mockReturnValueOnce(Buffer.from('aaaa', 'hex'));
            vi.mocked(randomBytes).mockReturnValueOnce(Buffer.from('bbbb', 'hex'));

            const nonce1 = PayloadBuilder.generateNonce();
            const nonce2 = PayloadBuilder.generateNonce();

            expect(nonce1).not.toBe(nonce2);
        });
    });

    describe('buildStudentPayload()', () => {
        it('debería construir payload con todos los campos', () => {
            const input: StudentPayloadInput = {
                sessionId: 'session-123',
                hostUserId: 1001,
                roundNumber: 2,
                timestamp: 1234567890,
                nonce: 'custom-nonce-abc',
            };

            const payload = PayloadBuilder.buildStudentPayload(input);

            expect(payload).toEqual({
                v: 1,
                sid: 'session-123',
                uid: 1001,
                r: 2,
                ts: 1234567890,
                n: 'custom-nonce-abc',
            });
        });

        it('debería generar timestamp automático si no se provee', () => {
            const now = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(now);

            const input: StudentPayloadInput = {
                sessionId: 'session-123',
                hostUserId: 1001,
                roundNumber: 1,
            };

            const payload = PayloadBuilder.buildStudentPayload(input);

            expect(payload.ts).toBe(now);
            expect(Date.now).toHaveBeenCalled();
        });

        it('debería generar nonce automático si no se provee', () => {
            const input: StudentPayloadInput = {
                sessionId: 'session-123',
                hostUserId: 1001,
                roundNumber: 1,
            };

            const payload = PayloadBuilder.buildStudentPayload(input);

            expect(payload.n).toBe('0123456789abcdef0123456789abcdef');
            expect(randomBytes).toHaveBeenCalledWith(16);
        });

        it('debería usar nonce personalizado si se provee', () => {
            const input: StudentPayloadInput = {
                sessionId: 'session-123',
                hostUserId: 1001,
                roundNumber: 1,
                nonce: 'my-custom-nonce',
            };

            const payload = PayloadBuilder.buildStudentPayload(input);

            expect(payload.n).toBe('my-custom-nonce');
            expect(randomBytes).not.toHaveBeenCalled();
        });

        it('debería soportar múltiples rounds', () => {
            const input: StudentPayloadInput = {
                sessionId: 'session-123',
                hostUserId: 1001,
                roundNumber: 5,
            };

            const payload = PayloadBuilder.buildStudentPayload(input);

            expect(payload.r).toBe(5);
        });

        it('debería soportar userId grande', () => {
            const input: StudentPayloadInput = {
                sessionId: 'session-123',
                hostUserId: 999999999,
                roundNumber: 1,
            };

            const payload = PayloadBuilder.buildStudentPayload(input);

            expect(payload.uid).toBe(999999999);
        });
    });

    describe('buildFakePayload()', () => {
        it('debería construir payload con uid=0 (honeypot)', () => {
            const input: FakePayloadInput = {
                sessionId: 'session-123',
                roundNumber: 1,
            };

            const payload = PayloadBuilder.buildFakePayload(input);

            expect(payload.uid).toBe(0);
            expect(payload.v).toBe(1);
            expect(payload.sid).toBe('session-123');
            expect(payload.r).toBe(1);
        });

        it('debería generar timestamp y nonce automáticos', () => {
            const now = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(now);

            const input: FakePayloadInput = {
                sessionId: 'session-123',
                roundNumber: 1,
            };

            const payload = PayloadBuilder.buildFakePayload(input);

            expect(payload.ts).toBe(now);
            expect(payload.n).toBe('0123456789abcdef0123456789abcdef');
        });

        it('debería usar timestamp personalizado', () => {
            const input: FakePayloadInput = {
                sessionId: 'session-123',
                roundNumber: 1,
                timestamp: 1111111111,
            };

            const payload = PayloadBuilder.buildFakePayload(input);

            expect(payload.ts).toBe(1111111111);
        });

        it('debería usar nonce personalizado', () => {
            const input: FakePayloadInput = {
                sessionId: 'session-123',
                roundNumber: 1,
                nonce: 'fake-nonce-xyz',
            };

            const payload = PayloadBuilder.buildFakePayload(input);

            expect(payload.n).toBe('fake-nonce-xyz');
        });
    });

    describe('isValidPayload()', () => {
        it('debería validar payload correcto', () => {
            const payload = {
                v: 1,
                sid: 'session-123',
                uid: 1001,
                r: 1,
                ts: Date.now(),
                n: '0123456789abcdef0123456789abcdef', // 32 chars hex
            };

            const isValid = PayloadBuilder.isValidPayload(payload);

            expect(isValid).toBe(true);
        });

        it('debería rechazar payload sin versión', () => {
            const payload = {
                sid: 'session-123',
                uid: 1001,
                r: 1,
                ts: Date.now(),
                n: 'nonce-abc',
            };

            const isValid = PayloadBuilder.isValidPayload(payload);

            expect(isValid).toBe(false);
        });

        it('debería rechazar payload con versión incorrecta', () => {
            const payload = {
                v: 2,
                sid: 'session-123',
                uid: 1001,
                r: 1,
                ts: Date.now(),
                n: 'nonce-abc',
            };

            const isValid = PayloadBuilder.isValidPayload(payload);

            expect(isValid).toBe(false);
        });

        it('debería rechazar payload sin sid', () => {
            const payload = {
                v: 1,
                uid: 1001,
                r: 1,
                ts: Date.now(),
                n: 'nonce-abc',
            };

            const isValid = PayloadBuilder.isValidPayload(payload);

            expect(isValid).toBe(false);
        });

        it('debería rechazar payload null', () => {
            const isValid = PayloadBuilder.isValidPayload(null);

            expect(isValid).toBe(false);
        });

        it('debería rechazar payload undefined', () => {
            const isValid = PayloadBuilder.isValidPayload(undefined);

            expect(isValid).toBe(false);
        });

        it('debería rechazar payload con tipo incorrecto', () => {
            const isValid = PayloadBuilder.isValidPayload('not-an-object');

            expect(isValid).toBe(false);
        });
    });

    describe('toJsonString()', () => {
        it('debería serializar payload a JSON string', () => {
            const payload = {
                v: 1,
                sid: 'session-123',
                uid: 1001,
                r: 1,
                ts: 1234567890,
                n: 'nonce-abc',
            };

            const jsonString = PayloadBuilder.toJsonString(payload);

            expect(jsonString).toBe('{"v":1,"sid":"session-123","uid":1001,"r":1,"ts":1234567890,"n":"nonce-abc"}');
        });

        it('debería serializar payload fake (uid=0)', () => {
            const payload = {
                v: 1,
                sid: 'session-123',
                uid: 0,
                r: 1,
                ts: 1234567890,
                n: 'nonce-abc',
            };

            const jsonString = PayloadBuilder.toJsonString(payload);
            const parsed = JSON.parse(jsonString);

            expect(parsed.uid).toBe(0);
        });
    });

    describe('fromJsonString()', () => {
        it('debería deserializar JSON string válido', () => {
            const jsonString = '{"v":1,"sid":"session-123","uid":1001,"r":1,"ts":1234567890,"n":"0123456789abcdef0123456789abcdef"}';

            const payload = PayloadBuilder.fromJsonString(jsonString);

            expect(payload).toEqual({
                v: 1,
                sid: 'session-123',
                uid: 1001,
                r: 1,
                ts: 1234567890,
                n: '0123456789abcdef0123456789abcdef',
            });
        });

        it('debería retornar null si JSON inválido', () => {
            const jsonString = 'invalid-json{';

            const payload = PayloadBuilder.fromJsonString(jsonString);

            expect(payload).toBeNull();
        });

        it('debería retornar null si estructura incorrecta', () => {
            const jsonString = '{"invalid":"structure"}';

            const payload = PayloadBuilder.fromJsonString(jsonString);

            expect(payload).toBeNull();
        });

        it('debería retornar null si falta campo requerido', () => {
            const jsonString = '{"v":1,"sid":"session-123","r":1,"ts":1234567890,"n":"0123456789abcdef0123456789abcdef"}'; // Falta uid

            const payload = PayloadBuilder.fromJsonString(jsonString);

            expect(payload).toBeNull();
        });

        it('debería manejar whitespace en JSON', () => {
            const jsonString = `
            {
                "v": 1,
                "sid": "session-123",
                "uid": 1001,
                "r": 1,
                "ts": 1234567890,
                "n": "0123456789abcdef0123456789abcdef"
            }`;

            const payload = PayloadBuilder.fromJsonString(jsonString);

            expect(payload).not.toBeNull();
            expect(payload?.uid).toBe(1001);
        });
    });

    describe('Integración buildStudentPayload() + toJsonString() + fromJsonString()', () => {
        it('debería serializar y deserializar correctamente', () => {
            const input: StudentPayloadInput = {
                sessionId: 'session-xyz',
                hostUserId: 2002,
                roundNumber: 3,
                timestamp: 9999999999,
                nonce: 'abcdef0123456789abcdef0123456789', // 32 chars hex
            };

            const payload1 = PayloadBuilder.buildStudentPayload(input);
            const jsonString = PayloadBuilder.toJsonString(payload1);
            const payload2 = PayloadBuilder.fromJsonString(jsonString);

            expect(payload2).toEqual(payload1);
        });
    });

    describe('Integración buildFakePayload() + serialización', () => {
        it('debería mantener uid=0 después de serialización', () => {
            const input: FakePayloadInput = {
                sessionId: 'session-fake',
                roundNumber: 1,
            };

            const payload1 = PayloadBuilder.buildFakePayload(input);
            const jsonString = PayloadBuilder.toJsonString(payload1);
            const payload2 = PayloadBuilder.fromJsonString(jsonString);

            expect(payload2?.uid).toBe(0);
            expect(payload1.uid).toBe(0);
        });
    });
});
