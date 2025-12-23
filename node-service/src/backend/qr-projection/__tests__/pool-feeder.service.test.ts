import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoolFeeder, type FeedStudentInput } from '../application/services/pool-feeder.service';
import { PayloadBuilder } from '../domain/services';
import type { AesGcmService } from '../../../shared/infrastructure/crypto';
import type { ProjectionPoolRepository } from '../../../shared/infrastructure/valkey';
import type { QRPayloadRepository } from '../infrastructure/qr-payload.repository';
import type { SessionKeyRepository } from '../../session/infrastructure/repositories/session-key.repository';

describe('PoolFeeder', () => {
    let service: PoolFeeder;
    let mockAesGcmService: AesGcmService;
    let mockPoolRepo: ProjectionPoolRepository;
    let mockPayloadRepo: QRPayloadRepository;
    let mockSessionKeyRepo: SessionKeyRepository;

    beforeEach(() => {
        mockAesGcmService = {
            encryptToPayload: vi.fn().mockReturnValue({ encrypted: 'encrypted-data' }),
            encryptWithRandomKey: vi.fn().mockReturnValue('fake-encrypted'),
        } as any;

        mockPoolRepo = {
            upsertStudentQR: vi.fn().mockResolvedValue('pool-entry-123'),
        } as any;

        mockPayloadRepo = {
            store: vi.fn().mockResolvedValue(undefined),
        } as any;

        mockSessionKeyRepo = {
            findByUserId: vi.fn().mockResolvedValue(null), // Por default, sin session_key
        } as any;

        service = new PoolFeeder(mockAesGcmService, mockPoolRepo, mockPayloadRepo, 60, mockSessionKeyRepo);
    });

    describe('feedStudentQR()', () => {
        it('debería alimentar un QR de estudiante al pool con session_key real', async () => {
            const input: FeedStudentInput = {
                sessionId: 'session-123',
                studentId: 1001,
                roundNumber: 1,
                payloadTTL: 60,
            };

            // Simular que el estudiante tiene session_key (32 bytes exactos)
            const mockSessionKey = {
                userId: 1001,
                sessionKey: Buffer.alloc(32, 'a'),
            };

            vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(mockSessionKey);

            const result = await service.feedStudentQR(input);

            expect(result.success).toBe(true);
            expect(result.payload).toBeDefined();
            // El encrypted es generado por AesGcmService real con session_key
            expect(result.encrypted).toBeDefined();
            expect(typeof result.encrypted).toBe('string');
            expect(result.poolEntryId).toBe('pool-entry-123');

            // Verificar que se usó session_key real (nuevo AesGcmService)
            expect(mockSessionKeyRepo.findByUserId).toHaveBeenCalledWith(1001);
            expect(mockPayloadRepo.store).toHaveBeenCalledWith(expect.any(Object), expect.any(String), 60);
            expect(mockPoolRepo.upsertStudentQR).toHaveBeenCalledWith('session-123', 1001, expect.any(String), 1);
        });

        it('debería usar fallback AES service si no hay session_key', async () => {
            const input: FeedStudentInput = {
                sessionId: 'session-456',
                studentId: 2002,
                roundNumber: 2,
            };

            // No hay session_key (null)
            vi.mocked(mockSessionKeyRepo.findByUserId).mockResolvedValue(null);

            const result = await service.feedStudentQR(input);

            expect(result.success).toBe(true);
            expect(mockSessionKeyRepo.findByUserId).toHaveBeenCalledWith(2002);
            expect(mockAesGcmService.encryptToPayload).toHaveBeenCalled(); // Usa fallback
        });

        it('debería usar TTL por defecto (60s) si no se especifica', async () => {
            const input: FeedStudentInput = {
                sessionId: 'session-789',
                studentId: 3003,
                roundNumber: 1,
            };

            const result = await service.feedStudentQR(input);

            expect(result.success).toBe(true);
            expect(mockPayloadRepo.store).toHaveBeenCalledWith(expect.any(Object), expect.any(String), 60);
        });

        it('debería usar TTL personalizado', async () => {
            const input: FeedStudentInput = {
                sessionId: 'session-abc',
                studentId: 4004,
                roundNumber: 3,
                payloadTTL: 120,
            };

            const result = await service.feedStudentQR(input);

            expect(result.success).toBe(true);
            expect(mockPayloadRepo.store).toHaveBeenCalledWith(expect.any(Object), expect.any(String), 120);
        });

        it('debería retornar error si falla el almacenamiento', async () => {
            const input: FeedStudentInput = {
                sessionId: 'session-error',
                studentId: 5005,
                roundNumber: 1,
            };

            vi.mocked(mockPayloadRepo.store).mockRejectedValue(new Error('Valkey connection failed'));

            const result = await service.feedStudentQR(input);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Valkey connection failed');
        });

        it('debería construir payload con los datos correctos', async () => {
            const input: FeedStudentInput = {
                sessionId: 'session-payload-test',
                studentId: 6006,
                roundNumber: 2,
            };

            const result = await service.feedStudentQR(input);

            expect(result.success).toBe(true);
            expect(result.payload).toMatchObject({
                v: 1,
                sid: 'session-payload-test',
                uid: 6006, // uid debe ser el studentId
                r: 2,
            });
            expect(result.payload?.n).toBeDefined(); // nonce debe estar presente
        });
    });

    describe('feedMultiple()', () => {
        it('debería alimentar múltiples QRs al pool', async () => {
            const inputs: FeedStudentInput[] = [
                { sessionId: 'session-123', studentId: 1001, roundNumber: 1 },
                { sessionId: 'session-123', studentId: 1002, roundNumber: 1 },
                { sessionId: 'session-123', studentId: 1003, roundNumber: 1 },
            ];

            const results = await service.feedMultiple(inputs);

            expect(results).toHaveLength(3);
            expect(results.every(r => r.success)).toBe(true);
            expect(mockPoolRepo.upsertStudentQR).toHaveBeenCalledTimes(3);
        });

        it('debería retornar resultados mixtos (éxito + error)', async () => {
            const inputs: FeedStudentInput[] = [
                { sessionId: 'session-123', studentId: 1001, roundNumber: 1 },
                { sessionId: 'session-123', studentId: 1002, roundNumber: 1 },
            ];

            vi.mocked(mockPoolRepo.upsertStudentQR)
                .mockResolvedValueOnce('pool-entry-1')
                .mockRejectedValueOnce(new Error('Pool error'));

            const results = await service.feedMultiple(inputs);

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
        });
    });

    describe('getNonce()', () => {
        it('debería extraer el nonce del payload', () => {
            const payload = PayloadBuilder.buildStudentPayload({
                sessionId: 'session-123',
                studentId: 5000,
                roundNumber: 1,
            });

            const nonce = PoolFeeder.getNonce(payload);

            expect(nonce).toBeDefined();
            expect(typeof nonce).toBe('string');
            expect(nonce.length).toBeGreaterThan(0);
        });

        it('debería retornar nonce único para cada payload', () => {
            const payload1 = PayloadBuilder.buildStudentPayload({
                sessionId: 'session-123',
                studentId: 5000,
                roundNumber: 1,
            });

            const payload2 = PayloadBuilder.buildStudentPayload({
                sessionId: 'session-123',
                studentId: 5000,
                roundNumber: 1,
            });

            const nonce1 = PoolFeeder.getNonce(payload1);
            const nonce2 = PoolFeeder.getNonce(payload2);

            expect(nonce1).not.toBe(nonce2);
        });
    });

    describe('feedMultiple() - casos adicionales', () => {
        it('debería manejar array vacío', async () => {
            const results = await service.feedMultiple([]);

            expect(results).toHaveLength(0);
            expect(mockPoolRepo.upsertStudentQR).not.toHaveBeenCalled();
        });

        it('debería procesar un solo estudiante correctamente', async () => {
            const inputs: FeedStudentInput[] = [
                { sessionId: 'session-single', studentId: 9001, roundNumber: 1 },
            ];

            const results = await service.feedMultiple(inputs);

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            expect(mockPoolRepo.upsertStudentQR).toHaveBeenCalledTimes(1);
        });

        it('debería continuar procesando después de un error', async () => {
            const inputs: FeedStudentInput[] = [
                { sessionId: 'session-123', studentId: 1001, roundNumber: 1 },
                { sessionId: 'session-123', studentId: 1002, roundNumber: 1 },
                { sessionId: 'session-123', studentId: 1003, roundNumber: 1 },
            ];

            // Falla el segundo, los demás exitosos
            vi.mocked(mockPoolRepo.upsertStudentQR)
                .mockResolvedValueOnce('pool-1')
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce('pool-3');

            const results = await service.feedMultiple(inputs);

            expect(results).toHaveLength(3);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
            expect(results[2].success).toBe(true);
        });
    });
});
