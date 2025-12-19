import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParticipationService } from '../participation.service';
import { StudentStateService, QRLifecycleService } from '../services';
import type { StudentSessionData } from '../../domain/student-session.entity';
import type { StoredPayload } from '../../../../shared/ports';

describe('ParticipationService', () => {
    let service: ParticipationService;
    let mockStudentState: StudentStateService;
    let mockQRLifecycle: QRLifecycleService;

    beforeEach(() => {
        mockStudentState = {
            registerStudent: vi.fn(),
            getState: vi.fn(),
            setActiveQR: vi.fn(),
            failRound: vi.fn(),
        } as any;

        mockQRLifecycle = {
            generateAndProject: vi.fn(),
            balancePool: vi.fn(),
            getStoredPayload: vi.fn(),
        } as any;

        service = new ParticipationService(mockStudentState, mockQRLifecycle, {
            maxRounds: 3,
            maxAttempts: 3,
            qrTTL: 60,
            mockHostUserId: 5000,
        });
    });

    describe('registerParticipation()', () => {
        it('debería registrar nuevo estudiante y generar QR', async () => {
            const mockState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: null,
                qrGeneratedAt: null,
                status: 'active',
                registeredAt: Date.now(),
                updatedAt: Date.now(),
            };

            const mockQR = {
                payload: { sid: 'session-123', uid: 1001, r: 1, ts: Date.now(), n: 'nonce-abc' },
                encrypted: 'encrypted-qr-data',
            };

            vi.mocked(mockStudentState.registerStudent).mockResolvedValue(mockState);
            vi.mocked(mockQRLifecycle.generateAndProject).mockResolvedValue(mockQR);

            const result = await service.registerParticipation('session-123', 1001);

            expect(result.success).toBe(true);
            expect(result.data?.currentRound).toBe(1);
            expect(result.data?.totalRounds).toBe(3);
            expect(result.data?.qrPayload).toBe('encrypted-qr-data');
            expect(mockStudentState.registerStudent).toHaveBeenCalledWith('session-123', 1001, {
                maxRounds: 3,
                maxAttempts: 3,
                qrTTL: 60,
            });
            expect(mockQRLifecycle.generateAndProject).toHaveBeenCalledWith({
                sessionId: 'session-123',
                studentId: 1001,
                round: 1,
                hostUserId: 5000,
                ttl: 60,
            });
            expect(mockStudentState.setActiveQR).toHaveBeenCalledWith('session-123', 1001, 'nonce-abc');
            expect(mockQRLifecycle.balancePool).toHaveBeenCalledWith('session-123');
        });

        it('debería rechazar si estudiante ya completó', async () => {
            const completedState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 3,
                maxRounds: 3,
                roundsCompleted: [
                    { round: 1, responseTime: 1500, validatedAt: Date.now() },
                    { round: 2, responseTime: 1800, validatedAt: Date.now() },
                    { round: 3, responseTime: 2000, validatedAt: Date.now() },
                ],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: null,
                qrGeneratedAt: null,
                status: 'completed',
                registeredAt: Date.now() - 180000,
                updatedAt: Date.now(),
            };

            vi.mocked(mockStudentState.registerStudent).mockResolvedValue(completedState);

            const result = await service.registerParticipation('session-123', 1001);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('ALREADY_COMPLETED');
            expect(result.reason).toContain('Ya completaste');
            expect(mockQRLifecycle.generateAndProject).not.toHaveBeenCalled();
        });

        it('debería rechazar si estudiante está failed', async () => {
            const failedState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 3,
                maxAttempts: 3,
                activeQRNonce: null,
                qrGeneratedAt: null,
                status: 'failed',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now(),
            };

            vi.mocked(mockStudentState.registerStudent).mockResolvedValue(failedState);

            const result = await service.registerParticipation('session-123', 1001);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('NO_ATTEMPTS_LEFT');
            expect(result.reason).toContain('Sin intentos');
        });

        it('debería retornar error si generateAndProject falla', async () => {
            const mockState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: null,
                qrGeneratedAt: null,
                status: 'active',
                registeredAt: Date.now(),
                updatedAt: Date.now(),
            };

            vi.mocked(mockStudentState.registerStudent).mockResolvedValue(mockState);
            vi.mocked(mockQRLifecycle.generateAndProject).mockRejectedValue(new Error('QR generation failed'));

            const result = await service.registerParticipation('session-123', 1001);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('INTERNAL_ERROR');
            expect(result.reason).toContain('Error interno');
        });
    });

    describe('requestNewQR()', () => {
        it('debería retornar error si estudiante no está registrado', async () => {
            vi.mocked(mockStudentState.getState).mockResolvedValue(null);

            const result = await service.requestNewQR('session-123', 9999);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('NOT_REGISTERED');
            expect(result.reason).toContain('No estás registrado');
        });

        it('debería rechazar si estudiante completó', async () => {
            const completedState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 3,
                maxRounds: 3,
                roundsCompleted: [
                    { round: 1, responseTime: 1500, validatedAt: Date.now() },
                    { round: 2, responseTime: 1800, validatedAt: Date.now() },
                    { round: 3, responseTime: 2000, validatedAt: Date.now() },
                ],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: null,
                qrGeneratedAt: null,
                status: 'completed',
                registeredAt: Date.now(),
                updatedAt: Date.now(),
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(completedState);

            const result = await service.requestNewQR('session-123', 1001);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('ALREADY_COMPLETED');
        });

        it('debería rechazar si estudiante está failed', async () => {
            const failedState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 3,
                maxAttempts: 3,
                activeQRNonce: null,
                qrGeneratedAt: null,
                status: 'failed',
                registeredAt: Date.now(),
                updatedAt: Date.now(),
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(failedState);

            const result = await service.requestNewQR('session-123', 1001);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('NO_ATTEMPTS_LEFT');
        });

        it('debería retornar QR existente si sigue válido', async () => {
            const activeState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-existing',
                qrGeneratedAt: Date.now() - 10000,
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now() - 10000,
            };

            const storedPayload: StoredPayload = {
                nonce: 'nonce-existing',
                encrypted: 'existing-encrypted-qr',
                consumed: false,
                createdAt: Date.now() - 10000,
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(activeState);
            vi.mocked(mockQRLifecycle.getStoredPayload).mockResolvedValue(storedPayload);

            const result = await service.requestNewQR('session-123', 1001);

            expect(result.success).toBe(true);
            expect(result.data?.qrPayload).toBe('existing-encrypted-qr');
            expect(result.data?.currentRound).toBe(1);
            expect(mockQRLifecycle.generateAndProject).not.toHaveBeenCalled();
        });

        it('debería generar nuevo QR si el anterior expiró', async () => {
            const activeState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-expired',
                qrGeneratedAt: Date.now() - 120000,
                status: 'active',
                registeredAt: Date.now() - 180000,
                updatedAt: Date.now() - 120000,
            };

            const newState: StudentSessionData = {
                ...activeState,
                currentAttempt: 2,
                activeQRNonce: null,
                updatedAt: Date.now(),
            };

            const mockQR = {
                payload: { sid: 'session-123', uid: 1001, r: 1, ts: Date.now(), n: 'nonce-new' },
                encrypted: 'new-encrypted-qr',
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(activeState);
            vi.mocked(mockQRLifecycle.getStoredPayload).mockResolvedValue(null); // Expiró
            vi.mocked(mockStudentState.failRound).mockResolvedValue({
                state: newState,
                canRetry: true,
            });
            vi.mocked(mockQRLifecycle.generateAndProject).mockResolvedValue(mockQR);

            const result = await service.requestNewQR('session-123', 1001);

            expect(result.success).toBe(true);
            expect(result.data?.qrPayload).toBe('new-encrypted-qr');
            expect(result.data?.currentAttempt).toBe(2);
            expect(mockStudentState.failRound).toHaveBeenCalledWith('session-123', 1001, 'QR_EXPIRED');
            expect(mockQRLifecycle.generateAndProject).toHaveBeenCalledWith({
                sessionId: 'session-123',
                studentId: 1001,
                round: 1,
                hostUserId: 5000,
                ttl: 60,
            });
        });

        it('debería rechazar si QR expiró y no quedan intentos', async () => {
            const activeState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 3,
                maxAttempts: 3,
                activeQRNonce: 'nonce-expired',
                qrGeneratedAt: Date.now() - 120000,
                status: 'active',
                registeredAt: Date.now() - 180000,
                updatedAt: Date.now() - 120000,
            };

            const failedState: StudentSessionData = {
                ...activeState,
                status: 'failed',
                updatedAt: Date.now(),
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(activeState);
            vi.mocked(mockQRLifecycle.getStoredPayload).mockResolvedValue(null);
            vi.mocked(mockStudentState.failRound).mockResolvedValue({
                state: failedState,
                canRetry: false,
            });

            const result = await service.requestNewQR('session-123', 1001);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('NO_ATTEMPTS_LEFT');
        });

        it('debería manejar errores internos', async () => {
            vi.mocked(mockStudentState.getState).mockRejectedValue(new Error('Valkey connection failed'));

            const result = await service.requestNewQR('session-123', 1001);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('INTERNAL_ERROR');
        });
    });

    describe('getStatus()', () => {
        it('debería retornar registered=false si estudiante no existe', async () => {
            vi.mocked(mockStudentState.getState).mockResolvedValue(null);

            const result = await service.getStatus('session-123', 9999);

            expect(result.registered).toBe(false);
            expect(result.status).toBeUndefined();
        });

        it('debería retornar estado completo con QR activo', async () => {
            const activeState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 2,
                maxRounds: 3,
                roundsCompleted: [{ round: 1, responseTime: 1500, validatedAt: Date.now() - 60000 }],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-active',
                qrGeneratedAt: Date.now() - 5000,
                status: 'active',
                registeredAt: Date.now() - 120000,
                updatedAt: Date.now() - 5000,
            };

            const storedPayload: StoredPayload = {
                nonce: 'nonce-active',
                encrypted: 'active-encrypted-qr',
                consumed: false,
                createdAt: Date.now() - 5000,
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(activeState);
            vi.mocked(mockQRLifecycle.getStoredPayload).mockResolvedValue(storedPayload);

            const result = await service.getStatus('session-123', 1001);

            expect(result.registered).toBe(true);
            expect(result.status).toBe('active');
            expect(result.currentRound).toBe(2);
            expect(result.totalRounds).toBe(3);
            expect(result.currentAttempt).toBe(1);
            expect(result.maxAttempts).toBe(3);
            expect(result.roundsCompleted).toBe(1);
            expect(result.hasActiveQR).toBe(true);
            expect(result.qrPayload).toBe('active-encrypted-qr');
            expect(result.qrTTLRemaining).toBeGreaterThan(50);
            expect(result.qrTTLRemaining).toBeLessThan(60);
        });

        it('debería retornar estado sin QR si no hay activo', async () => {
            const activeState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 2,
                maxAttempts: 3,
                activeQRNonce: null,
                qrGeneratedAt: null,
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now(),
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(activeState);

            const result = await service.getStatus('session-123', 1001);

            expect(result.registered).toBe(true);
            expect(result.hasActiveQR).toBe(false);
            expect(result.qrPayload).toBeUndefined();
            expect(result.qrTTLRemaining).toBeUndefined();
        });

        it('debería retornar estado completed', async () => {
            const completedState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 3,
                maxRounds: 3,
                roundsCompleted: [
                    { round: 1, responseTime: 1500, validatedAt: Date.now() - 120000 },
                    { round: 2, responseTime: 1800, validatedAt: Date.now() - 60000 },
                    { round: 3, responseTime: 2000, validatedAt: Date.now() },
                ],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: null,
                qrGeneratedAt: null,
                status: 'completed',
                registeredAt: Date.now() - 180000,
                updatedAt: Date.now(),
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(completedState);

            const result = await service.getStatus('session-123', 1001);

            expect(result.registered).toBe(true);
            expect(result.status).toBe('completed');
            expect(result.roundsCompleted).toBe(3);
            expect(result.hasActiveQR).toBe(false);
        });

        it('debería ignorar QR consumido', async () => {
            const activeState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-consumed',
                qrGeneratedAt: Date.now() - 5000,
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now() - 5000,
            };

            const consumedPayload: StoredPayload = {
                nonce: 'nonce-consumed',
                encrypted: 'consumed-qr',
                consumed: true,
                createdAt: Date.now() - 5000,
            };

            vi.mocked(mockStudentState.getState).mockResolvedValue(activeState);
            vi.mocked(mockQRLifecycle.getStoredPayload).mockResolvedValue(consumedPayload);

            const result = await service.getStatus('session-123', 1001);

            expect(result.hasActiveQR).toBe(false);
            expect(result.qrPayload).toBeUndefined();
        });
    });
});
