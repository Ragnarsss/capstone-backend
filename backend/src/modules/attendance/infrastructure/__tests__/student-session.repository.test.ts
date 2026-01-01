import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentSessionRepository, type SessionConfig } from '../student-session.repository';
import type { StudentSessionData } from '../../domain/student-session.entity';
import type { ValkeyClientType } from '../../../../shared/infrastructure/valkey/valkey-client';

describe('StudentSessionRepository', () => {
    let repository: StudentSessionRepository;
    let mockClient: ValkeyClientType;

    beforeEach(() => {
        mockClient = {
            get: vi.fn(),
            set: vi.fn(),
            setex: vi.fn(),
            expire: vi.fn(),
            ttl: vi.fn(),
            sadd: vi.fn(),
            smembers: vi.fn(),
        } as any;

        repository = new StudentSessionRepository();
        (repository as any).client = mockClient;
    });

    describe('registerStudent()', () => {
        it('debería crear estado inicial para nuevo estudiante', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null); // No existe

            const result = await repository.registerStudent('session-123', 1001);

            expect(result.studentId).toBe(1001);
            expect(result.sessionId).toBe('session-123');
            expect(result.currentRound).toBe(1);
            expect(result.maxRounds).toBe(3);
            expect(result.roundsCompleted).toEqual([]);
            expect(result.currentAttempt).toBe(1);
            expect(result.maxAttempts).toBe(3);
            expect(result.status).toBe('active');
            expect(mockClient.setex).toHaveBeenCalledWith(
                'student:session:session-123:1001',
                7200,
                expect.any(String)
            );
            expect(mockClient.sadd).toHaveBeenCalledWith('session:students:session-123', '1001');
        });

        it('debería retornar estado existente si estudiante ya está registrado', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 2,
                maxRounds: 3,
                roundsCompleted: [{ round: 1, responseTime: 1500, validatedAt: Date.now() }],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-abc',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now() - 30000,
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.registerStudent('session-123', 1001);

            expect(result.currentRound).toBe(2);
            expect(mockClient.setex).not.toHaveBeenCalled();
        });

        it('debería usar configuración personalizada', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null);

            const customConfig: Partial<SessionConfig> = {
                maxRounds: 5,
                maxAttempts: 5,
            };

            const result = await repository.registerStudent('session-456', 2002, customConfig);

            expect(result.maxRounds).toBe(5);
            expect(result.maxAttempts).toBe(5);
        });
    });

    describe('getState()', () => {
        it('debería retornar estado del estudiante', async () => {
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

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(mockState));

            const result = await repository.getState('session-123', 1001);

            expect(result).toEqual(mockState);
            expect(mockClient.get).toHaveBeenCalledWith('student:session:session-123:1001');
        });

        it('debería retornar null si no existe estado', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null);

            const result = await repository.getState('session-999', 9999);

            expect(result).toBeNull();
        });

        it('debería retornar null si hay error de parsing', async () => {
            vi.mocked(mockClient.get).mockResolvedValue('invalid-json{');

            const result = await repository.getState('session-123', 1001);

            expect(result).toBeNull();
        });
    });

    describe('saveState()', () => {
        it('debería guardar estado con TTL y actualizar timestamp', async () => {
            const state: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 2,
                maxRounds: 3,
                roundsCompleted: [{ round: 1, responseTime: 1500, validatedAt: Date.now() }],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-abc',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now() - 5000,
            };

            await repository.saveState(state);

            expect(mockClient.setex).toHaveBeenCalledWith(
                'student:session:session-123:1001',
                7200,
                expect.stringContaining('"studentId":1001')
            );
            expect(state.updatedAt).toBeGreaterThan(Date.now() - 1000);
        });
    });

    describe('setActiveQR()', () => {
        it('debería actualizar QR activo y renovar TTL', async () => {
            const existingState: StudentSessionData = {
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

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.setActiveQR('session-123', 1001, 'nonce-xyz');

            expect(result?.activeQRNonce).toBe('nonce-xyz');
            expect(result?.qrGeneratedAt).toBeGreaterThan(Date.now() - 1000);
            expect(mockClient.setex).toHaveBeenCalledWith(
                'student:session:session-123:1001',
                7200,
                expect.stringContaining('"activeQRNonce":"nonce-xyz"')
            );
        });

        it('debería retornar null si no existe estado', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null);

            const result = await repository.setActiveQR('session-999', 9999, 'nonce-abc');

            expect(result).toBeNull();
            expect(mockClient.setex).not.toHaveBeenCalled();
        });
    });

    describe('completeRound()', () => {
        it('debería completar round y avanzar al siguiente', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-abc',
                qrGeneratedAt: Date.now() - 5000,
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now() - 5000,
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.completeRound('session-123', 1001, {
                responseTime: 1500,
                validatedAt: Date.now(),
            });

            expect(result.isComplete).toBe(false);
            expect(result.state.currentRound).toBe(2);
            expect(result.state.roundsCompleted).toHaveLength(1);
            expect(result.state.roundsCompleted[0].round).toBe(1);
            expect(result.state.roundsCompleted[0].responseTime).toBe(1500);
            expect(result.state.currentAttempt).toBe(1); // Reset
            expect(mockClient.setex).toHaveBeenCalled();
        });

        it('debería marcar como completado al terminar todos los rounds', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 3,
                maxRounds: 3,
                roundsCompleted: [
                    { round: 1, responseTime: 1500, validatedAt: Date.now() - 120000 },
                    { round: 2, responseTime: 1800, validatedAt: Date.now() - 60000 },
                ],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-final',
                qrGeneratedAt: Date.now() - 5000,
                status: 'active',
                registeredAt: Date.now() - 180000,
                updatedAt: Date.now() - 5000,
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.completeRound('session-123', 1001, {
                responseTime: 2000,
                validatedAt: Date.now(),
            });

            expect(result.isComplete).toBe(true);
            expect(result.state.status).toBe('completed');
            expect(result.state.roundsCompleted).toHaveLength(3);
        });

        it('debería lanzar error si no existe estado', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null);
            vi.mocked(mockClient.ttl).mockResolvedValue(-2);

            await expect(
                repository.completeRound('session-123', 9999, {
                    responseTime: 1000,
                    validatedAt: Date.now(),
                })
            ).rejects.toThrow('No state found');

            expect(mockClient.ttl).toHaveBeenCalledWith('student:session:session-123:9999');
        });
    });

    describe('failRound()', () => {
        it('debería incrementar intento fallido', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-abc',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now(),
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.failRound('session-123', 1001, 'QR_EXPIRED');

            expect(result.canRetry).toBe(true);
            expect(result.state.currentAttempt).toBe(2);
            expect(result.state.status).toBe('active');
        });

        it('debería marcar como fallido si no quedan intentos', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 3,
                maxAttempts: 3,
                activeQRNonce: 'nonce-abc',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now(),
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.failRound('session-123', 1001, 'QR_EXPIRED');

            expect(result.canRetry).toBe(false);
            expect(result.state.status).toBe('failed');
        });

        it('debería lanzar error si no existe estado', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null);

            await expect(
                repository.failRound('session-123', 9999, 'QR_EXPIRED')
            ).rejects.toThrow('No state found');
        });
    });

    describe('validateRoundMatch()', () => {
        it('debería validar round correcto con nonce coincidente', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 2,
                maxRounds: 3,
                roundsCompleted: [{ round: 1, responseTime: 1500, validatedAt: Date.now() }],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-correct',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now() - 60000,
                updatedAt: Date.now(),
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.validateRoundMatch('session-123', 1001, 2, 'nonce-correct');

            expect(result.valid).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('debería rechazar si estudiante no está registrado', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null);

            const result = await repository.validateRoundMatch('session-123', 9999, 1, 'nonce-abc');

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('STUDENT_NOT_REGISTERED');
        });

        it('debería rechazar si estudiante está completed', async () => {
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

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(completedState));

            const result = await repository.validateRoundMatch('session-123', 1001, 3, 'nonce-abc');

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('STUDENT_STATUS_COMPLETED');
        });

        it('debería rechazar si nonce no coincide', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-correct',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now(),
                updatedAt: Date.now(),
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.validateRoundMatch('session-123', 1001, 1, 'nonce-wrong');

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('QR_NONCE_MISMATCH');
        });

        it('debería rechazar si round ya fue completado', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 2,
                maxRounds: 3,
                roundsCompleted: [{ round: 1, responseTime: 1500, validatedAt: Date.now() }],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-current',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now(),
                updatedAt: Date.now(),
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.validateRoundMatch('session-123', 1001, 1, 'nonce-current');

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('ROUND_ALREADY_COMPLETED');
        });

        it('debería rechazar si round todavía no fue alcanzado', async () => {
            const existingState: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 1,
                maxRounds: 3,
                roundsCompleted: [],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-current',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now(),
                updatedAt: Date.now(),
            };

            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingState));

            const result = await repository.validateRoundMatch('session-123', 1001, 3, 'nonce-current');

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('ROUND_NOT_REACHED');
        });
    });

    describe('getActiveStudents()', () => {
        it('debería retornar lista de estudiantes activos', async () => {
            vi.mocked(mockClient.smembers).mockResolvedValue(['1001', '1002', '1003']);

            const result = await repository.getActiveStudents('session-123');

            expect(result).toEqual([1001, 1002, 1003]);
            expect(mockClient.smembers).toHaveBeenCalledWith('session:students:session-123');
        });

        it('debería retornar array vacío si no hay estudiantes', async () => {
            vi.mocked(mockClient.smembers).mockResolvedValue([]);

            const result = await repository.getActiveStudents('session-empty');

            expect(result).toEqual([]);
        });
    });

    describe('countByStatus()', () => {
        it('debería contar estudiantes por estado', async () => {
            vi.mocked(mockClient.smembers).mockResolvedValue(['1001', '1002', '1003']);

            const state1: StudentSessionData = {
                studentId: 1001,
                sessionId: 'session-123',
                currentRound: 2,
                maxRounds: 3,
                roundsCompleted: [{ round: 1, responseTime: 1500, validatedAt: Date.now() }],
                currentAttempt: 1,
                maxAttempts: 3,
                activeQRNonce: 'nonce-1',
                qrGeneratedAt: Date.now(),
                status: 'active',
                registeredAt: Date.now(),
                updatedAt: Date.now(),
            };

            const state2: StudentSessionData = { ...state1, studentId: 1002, status: 'completed' };
            const state3: StudentSessionData = { ...state1, studentId: 1003, status: 'failed' };

            vi.mocked(mockClient.get)
                .mockResolvedValueOnce(JSON.stringify(state1))
                .mockResolvedValueOnce(JSON.stringify(state2))
                .mockResolvedValueOnce(JSON.stringify(state3));

            const result = await repository.countByStatus('session-123');

            expect(result).toEqual({
                active: 1,
                completed: 1,
                failed: 1,
            });
        });
    });

    describe('getOrCreateSessionConfig()', () => {
        it('debería retornar config existente', async () => {
            const existingConfig = { maxRounds: 5, maxAttempts: 5, qrTTL: 90 };
            vi.mocked(mockClient.get).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await repository.getOrCreateSessionConfig('session-123');

            expect(result).toEqual(existingConfig);
            expect(mockClient.setex).not.toHaveBeenCalled();
        });

        it('debería crear nueva config con valores por defecto', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null);

            const result = await repository.getOrCreateSessionConfig('session-456');

            expect(result.maxRounds).toBe(3);
            expect(result.maxAttempts).toBe(3);
            expect(result.qrTTL).toBe(60);
            expect(mockClient.setex).toHaveBeenCalledWith(
                'session:config:session-456',
                7200,
                expect.any(String)
            );
        });

        it('debería crear config con valores personalizados', async () => {
            vi.mocked(mockClient.get).mockResolvedValue(null);

            const result = await repository.getOrCreateSessionConfig('session-789', {
                maxRounds: 4,
                qrTTL: 120,
            });

            expect(result.maxRounds).toBe(4);
            expect(result.maxAttempts).toBe(3);
            expect(result.qrTTL).toBe(120);
        });
    });
});
