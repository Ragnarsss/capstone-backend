import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompleteScanUseCase, type CompleteScanDependencies, type ServiceDependencies, type PersistenceDependencies } from '../application/complete-scan.usecase';
import { ValidateScanUseCase } from '../application/validate-scan.usecase';
import type { IAttendanceStatsCalculator, IQRLifecycleManager } from '../../../shared/ports';
import type { AttendancePersistenceService } from '../application/services/attendance-persistence.service';

// Mock ValidateScanUseCase
vi.mock('../application/validate-scan.usecase', () => ({
    ValidateScanUseCase: vi.fn(),
}));

describe('CompleteScanUseCase', () => {
    let useCase: CompleteScanUseCase;
    let mockDeps: CompleteScanDependencies;
    let mockServices: ServiceDependencies;
    let mockPersistence: PersistenceDependencies;
    let mockValidateUseCase: any;

    beforeEach(() => {
        // Mock ValidateScanUseCase instance
        mockValidateUseCase = {
            execute: vi.fn(),
        };
        vi.mocked(ValidateScanUseCase).mockImplementation(() => mockValidateUseCase);

        // Mock basic dependencies
        mockDeps = {
            decryptQR: vi.fn(),
            loadQRState: vi.fn(),
            loadStudentState: vi.fn(),
            markQRConsumed: vi.fn(),
            completeRound: vi.fn(),
        } as any;

        // Mock services
        const mockStatsCalculator: IAttendanceStatsCalculator = {
            calculate: vi.fn().mockReturnValue({
                stats: { avg: 1500, certainty: 95.5 },
            }),
        } as any;

        const mockQRLifecycle: IQRLifecycleManager = {
            generateAndPublish: vi.fn().mockResolvedValue({
                round: 2,
                encrypted: 'next-qr-encrypted',
                qrTTL: 60,
            }),
        } as any;

        mockServices = {
            statsCalculator: mockStatsCalculator,
            qrLifecycleManager: mockQRLifecycle,
        };

        mockPersistence = {
            persistenceService: {
                saveValidationAttempt: vi.fn().mockResolvedValue(undefined),
                saveCompleteAttendance: vi.fn().mockResolvedValue(undefined),
                markRegistrationComplete: vi.fn().mockResolvedValue(undefined),
            } as any as AttendancePersistenceService,
        };

        useCase = new CompleteScanUseCase(mockDeps, mockServices, undefined, mockPersistence);
    });

    describe('execute() - Validación fallida', () => {
        it('debería retornar error si la validación falla por QR_NOT_FOUND', async () => {
            // Mock: ValidateScanUseCase retorna invalid
            mockValidateUseCase.execute.mockResolvedValue({
                valid: false,
                error: {
                    code: 'QR_NOT_FOUND',
                    message: 'QR no existe en el pool',
                },
            });

            const result = await useCase.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('QR_NOT_FOUND');
            expect(result.reason).toContain('no existe');
            expect(mockDeps.markQRConsumed).not.toHaveBeenCalled();
        });

        it('debería retornar error si el QR ya fue consumido', async () => {
            mockValidateUseCase.execute.mockResolvedValue({
                valid: false,
                error: {
                    code: 'PAYLOAD_ALREADY_CONSUMED',
                    message: 'QR ya fue usado',
                },
            });

            const result = await useCase.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PAYLOAD_ALREADY_CONSUMED');
        });

        it('debería retornar error si el usuario no coincide (USER_MISMATCH)', async () => {
            mockValidateUseCase.execute.mockResolvedValue({
                valid: false,
                error: {
                    code: 'USER_MISMATCH',
                    message: 'QR no pertenece a este usuario',
                },
            });

            const result = await useCase.execute('encrypted-qr', 2002);

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('USER_MISMATCH');
        });
    });

    describe('execute() - Validación exitosa pero falla markQRConsumed', () => {
        it('debería retornar error si markQRConsumed falla', async () => {
            const mockPayload = { sid: 'session-123', uid: 1001, r: 1, ts: Date.now() - 1000, n: 'nonce-abc' };

            mockValidateUseCase.execute.mockResolvedValue({
                valid: true,
                context: { response: { original: mockPayload } },
            });
            vi.mocked(mockDeps.markQRConsumed).mockResolvedValue(false);

            const result = await useCase.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('INTERNAL_ERROR');
            expect(result.reason).toContain('No se pudo registrar');
        });

        it('debería retornar error si markQRConsumed lanza excepción', async () => {
            const mockPayload = { sid: 'session-123', uid: 1001, r: 1, ts: Date.now() - 1000, n: 'nonce-abc' };

            mockValidateUseCase.execute.mockResolvedValue({
                valid: true,
                context: { response: { original: mockPayload } },
            });
            vi.mocked(mockDeps.markQRConsumed).mockRejectedValue(new Error('Valkey connection failed'));

            const result = await useCase.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('INTERNAL_ERROR');
            expect(result.reason).toContain('Error interno');
        });
    });

    describe('execute() - Validación exitosa pero falla completeRound', () => {
        it('debería retornar error si completeRound falla', async () => {
            const mockPayload = { sid: 'session-123', uid: 1001, r: 1, ts: Date.now() - 1000, n: 'nonce-abc' };

            mockValidateUseCase.execute.mockResolvedValue({
                valid: true,
                context: { response: { original: mockPayload } },
            });
            vi.mocked(mockDeps.markQRConsumed).mockResolvedValue(true);
            vi.mocked(mockDeps.completeRound).mockRejectedValue(new Error('Session not found'));

            const result = await useCase.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('SESSION_STATE_ERROR');
            expect(result.reason).toContain('Estado de sesión no encontrado');
        });
    });

    describe('execute() - Round parcial (no completó todos)', () => {
        it('debería retornar nextRound si completó round 1 de 3', async () => {
            const mockPayload = { sid: 'session-123', uid: 1001, r: 1, ts: Date.now() - 1500, n: 'nonce-abc' };

            mockValidateUseCase.execute.mockResolvedValue({
                valid: true,
                context: { response: { original: mockPayload } },
            });
            vi.mocked(mockDeps.markQRConsumed).mockResolvedValue(true);
            vi.mocked(mockDeps.completeRound).mockResolvedValue({
                currentRound: 2,
                isComplete: false,
                roundsCompleted: [{ responseTime: 1500 }],
            });

            const result = await useCase.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(true);
            expect(result.isComplete).toBe(false);
            expect(result.nextRound).toBeDefined();
            expect(result.nextRound?.round).toBe(2);
            expect(result.nextRound?.qrPayload).toBe('next-qr-encrypted');
            expect(mockServices.qrLifecycleManager.generateAndPublish).toHaveBeenCalledWith({
                sessionId: 'session-123',
                studentId: 1001,
                round: 2,
                qrTTL: 60,
            });
            expect(mockPersistence.persistenceService?.saveValidationAttempt).toHaveBeenCalled();
        });

        it('debería retornar error parcial si falla generateAndPublish', async () => {
            const mockPayload = { sid: 'session-123', uid: 1001, r: 1, ts: Date.now() - 1500, n: 'nonce-abc' };

            mockValidateUseCase.execute.mockResolvedValue({
                valid: true,
                context: { response: { original: mockPayload } },
            });
            vi.mocked(mockDeps.markQRConsumed).mockResolvedValue(true);
            vi.mocked(mockDeps.completeRound).mockResolvedValue({
                currentRound: 2,
                isComplete: false,
                roundsCompleted: [{ responseTime: 1500 }],
            });
            vi.mocked(mockServices.qrLifecycleManager.generateAndPublish).mockRejectedValue(
                new Error('QR generation failed')
            );

            const result = await useCase.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(true);
            expect(result.isComplete).toBe(false);
            expect(result.error?.code).toBe('QR_GENERATION_ERROR');
            expect(result.error?.message).toContain('Round completado');
        });
    });

    describe('execute() - Asistencia completada (todos los rounds)', () => {
        it('debería calcular stats y retornar isComplete=true', async () => {
            const mockPayload = { sid: 'session-123', uid: 1001, r: 3, ts: Date.now() - 2000, n: 'nonce-abc' };

            mockValidateUseCase.execute.mockResolvedValue({
                valid: true,
                context: { response: { original: mockPayload } },
            });
            vi.mocked(mockDeps.markQRConsumed).mockResolvedValue(true);
            vi.mocked(mockDeps.completeRound).mockResolvedValue({
                currentRound: 3,
                isComplete: true,
                roundsCompleted: [
                    { responseTime: 1500 },
                    { responseTime: 1800 },
                    { responseTime: 2000 },
                ],
            });

            const result = await useCase.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(true);
            expect(result.isComplete).toBe(true);
            expect(result.stats).toBeDefined();
            expect(result.stats?.roundsCompleted).toBe(3);
            expect(result.stats?.avgResponseTime).toBe(1500);
            expect(result.stats?.certainty).toBe(95.5);
            expect(result.nextRound).toBeUndefined();
            expect(mockServices.statsCalculator.calculate).toHaveBeenCalledWith({
                responseTimes: [1500, 1800, 2000],
                maxRounds: 3,
                sessionId: 'session-123',
                studentId: 1001,
            });
            expect(mockPersistence.persistenceService?.saveCompleteAttendance).toHaveBeenCalled();
        });
    });

    describe('Persistencia opcional', () => {
        it('NO debería fallar si persistenceService no está configurado', async () => {
            const useCaseNoPersistence = new CompleteScanUseCase(mockDeps, mockServices, undefined, {});
            const mockPayload = { sid: 'session-123', uid: 1001, r: 1, ts: Date.now() - 1000, n: 'nonce-abc' };

            mockValidateUseCase.execute.mockResolvedValue({
                valid: true,
                context: { response: { original: mockPayload } },
            });
            vi.mocked(mockDeps.markQRConsumed).mockResolvedValue(true);
            vi.mocked(mockDeps.completeRound).mockResolvedValue({
                currentRound: 2,
                isComplete: false,
                roundsCompleted: [{ responseTime: 1000 }],
            });

            const result = await useCaseNoPersistence.execute('encrypted-qr', 1001);

            expect(result.valid).toBe(true);
            expect(result.isComplete).toBe(false);
        });
    });
});
