import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendancePersistenceService, type SaveValidationParams, type SaveResultParams } from '../application/services/attendance-persistence.service';
import type { ValidationRepository, ResultRepository, RegistrationRepository } from '../infrastructure/repositories';

describe('AttendancePersistenceService', () => {
    let service: AttendancePersistenceService;
    let mockValidationRepo: ValidationRepository;
    let mockResultRepo: ResultRepository;
    let mockRegistrationRepo: RegistrationRepository;

    beforeEach(() => {
        mockValidationRepo = {
            create: vi.fn(),
            complete: vi.fn(),
            getByRound: vi.fn(),
            getResponseTimeStats: vi.fn().mockResolvedValue({
                avg: 2500,
                stdDev: 200,
                min: 2200,
                max: 2800,
                median: 2500,
            }),
            countSuccessful: vi.fn().mockResolvedValue(3),
        } as any;

        mockResultRepo = {
            create: vi.fn(),
            getByRegistration: vi.fn().mockResolvedValue(null),
        } as any;

        mockRegistrationRepo = {
            getBySessionAndUser: vi.fn().mockResolvedValue({
                registrationId: 10,
                sessionId: 100,
                userId: 1001,
                deviceId: 'device-abc',
                queuePosition: 1,
                registeredAt: new Date(),
                status: 'pending',
            }),
            updateStatus: vi.fn(),
        } as any;

        service = new AttendancePersistenceService(
            mockValidationRepo,
            mockResultRepo,
            mockRegistrationRepo
        );
    });

    describe('saveValidationAttempt()', () => {
        it('debería crear y completar una nueva validación', async () => {
            const params: SaveValidationParams = {
                sessionId: '100',
                studentId: 1001,
                round: 1,
                responseTime: 2500,
                validatedAt: Date.now(),
            };

            vi.mocked(mockValidationRepo.getByRound).mockResolvedValue(null); // No existe

            await service.saveValidationAttempt(params);

            expect(mockValidationRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    registrationId: 10,
                    roundNumber: 1,
                })
            );

            expect(mockValidationRepo.complete).toHaveBeenCalledWith(
                10,
                1,
                expect.objectContaining({
                    responseTimeMs: 2500,
                    validationStatus: 'success',
                })
            );
        });

        it('debería completar una validación existente (sin crear nueva)', async () => {
            const params: SaveValidationParams = {
                sessionId: '100',
                studentId: 1001,
                round: 2,
                responseTime: 2600,
                validatedAt: Date.now(),
            };

            const existingValidation = {
                validationId: 1,
                registrationId: 10,
                roundNumber: 2,
                qrGeneratedAt: new Date(),
                qrScannedAt: null,
                responseReceivedAt: null,
                responseTimeMs: null,
                totpuValid: null,
                totpsValid: null,
                rtValid: null,
                secretValid: null,
                validationStatus: null,
                failedAttempts: 0,
                createdAt: new Date(),
            };

            vi.mocked(mockValidationRepo.getByRound).mockResolvedValue(existingValidation);

            await service.saveValidationAttempt(params);

            expect(mockValidationRepo.create).not.toHaveBeenCalled(); // No crea nueva
            expect(mockValidationRepo.complete).toHaveBeenCalledWith(
                10,
                2,
                expect.objectContaining({
                    responseTimeMs: 2600,
                    validationStatus: 'success',
                })
            );
        });

        it('NO debería fallar si sessionId no es numérico', async () => {
            const params: SaveValidationParams = {
                sessionId: 'invalid-session-id',
                studentId: 1001,
                round: 1,
                responseTime: 2500,
                validatedAt: Date.now(),
            };

            await expect(service.saveValidationAttempt(params)).resolves.not.toThrow();
            expect(mockValidationRepo.create).not.toHaveBeenCalled();
        });

        it('NO debería fallar si no existe registración', async () => {
            vi.mocked(mockRegistrationRepo.getBySessionAndUser).mockResolvedValue(null);

            const params: SaveValidationParams = {
                sessionId: '100',
                studentId: 9999,
                round: 1,
                responseTime: 2500,
                validatedAt: Date.now(),
            };

            await expect(service.saveValidationAttempt(params)).resolves.not.toThrow();
            expect(mockValidationRepo.create).not.toHaveBeenCalled();
        });
    });

    describe('saveAttendanceResult()', () => {
        it('debería guardar resultado PRESENT con certeza alta', async () => {
            const params: SaveResultParams = {
                sessionId: '100',
                studentId: 1001,
                round: 3,
                responseTime: 2500,
                stats: {
                    avg: 2500,
                    stdDev: 200,
                    min: 2200,
                    max: 2800,
                    certainty: 95,
                },
                validatedAt: Date.now(),
                maxRounds: 3,
            };

            await service.saveAttendanceResult(params);

            expect(mockResultRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    registrationId: 10,
                    totalRounds: 3,
                    successfulRounds: 3,
                    failedRounds: 0,
                    certaintyScore: 95,
                    finalStatus: 'PRESENT',
                })
            );
        });

        it('debería guardar resultado DOUBTFUL con certeza media', async () => {
            const params: SaveResultParams = {
                sessionId: '100',
                studentId: 1001,
                round: 3,
                responseTime: 3000,
                stats: {
                    avg: 3000,
                    stdDev: 500,
                    min: 2500,
                    max: 3500,
                    certainty: 55,
                },
                validatedAt: Date.now(),
                maxRounds: 3,
            };

            vi.mocked(mockValidationRepo.countSuccessful).mockResolvedValue(2);

            await service.saveAttendanceResult(params);

            expect(mockResultRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    successfulRounds: 2,
                    failedRounds: 1,
                    certaintyScore: 55,
                    finalStatus: 'DOUBTFUL',
                })
            );
        });

        it('debería guardar resultado ABSENT con certeza baja', async () => {
            const params: SaveResultParams = {
                sessionId: '100',
                studentId: 1001,
                round: 3,
                responseTime: 10000,
                stats: {
                    avg: 10000,
                    stdDev: 1000,
                    min: 9000,
                    max: 11000,
                    certainty: 20,
                },
                validatedAt: Date.now(),
                maxRounds: 3,
            };

            vi.mocked(mockValidationRepo.countSuccessful).mockResolvedValue(0);

            await service.saveAttendanceResult(params);

            expect(mockResultRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    successfulRounds: 0,
                    failedRounds: 3,
                    certaintyScore: 20,
                    finalStatus: 'ABSENT',
                })
            );
        });

        it('NO debería duplicar resultado si ya existe (idempotencia)', async () => {
            const existingResult = {
                resultId: 1,
                registrationId: 10,
                totalRounds: 3,
                successfulRounds: 3,
                failedRounds: 0,
                avgResponseTimeMs: 2500,
                stdDevResponseTime: 200,
                minResponseTimeMs: 2200,
                maxResponseTimeMs: 2800,
                medianResponseTimeMs: 2500,
                certaintyScore: 95,
                finalStatus: 'PRESENT' as const,
                calculatedAt: new Date(),
            };

            vi.mocked(mockResultRepo.getByRegistration).mockResolvedValue(existingResult);

            const params: SaveResultParams = {
                sessionId: '100',
                studentId: 1001,
                round: 3,
                responseTime: 2500,
                stats: {
                    avg: 2500,
                    stdDev: 200,
                    min: 2200,
                    max: 2800,
                    certainty: 95,
                },
                validatedAt: Date.now(),
                maxRounds: 3,
            };

            await service.saveAttendanceResult(params);

            expect(mockResultRepo.create).not.toHaveBeenCalled(); // No duplica
        });

        it('debería usar estadísticas reales desde validation_attempts', async () => {
            const params: SaveResultParams = {
                sessionId: '100',
                studentId: 1001,
                round: 3,
                responseTime: 2500,
                stats: {
                    avg: 9999, // Stats de Valkey (no se usan)
                    stdDev: 9999,
                    min: 9999,
                    max: 9999,
                    certainty: 95,
                },
                validatedAt: Date.now(),
                maxRounds: 3,
            };

            // Stats reales desde PostgreSQL
            vi.mocked(mockValidationRepo.getResponseTimeStats).mockResolvedValue({
                avg: 2500,
                stdDev: 200,
                min: 2200,
                max: 2800,
                median: 2500,
            });

            await service.saveAttendanceResult(params);

            expect(mockResultRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    avgResponseTimeMs: 2500, // Desde PostgreSQL, no Valkey
                    stdDevResponseTime: 200,
                    minResponseTimeMs: 2200,
                    maxResponseTimeMs: 2800,
                    medianResponseTimeMs: 2500,
                })
            );
        });
    });

    describe('markRegistrationComplete()', () => {
        it('debería marcar registración como completada', async () => {
            await service.markRegistrationComplete(1001, '100');

            expect(mockRegistrationRepo.updateStatus).toHaveBeenCalledWith(
                10,
                { status: 'completed' }
            );
        });

        it('NO debería fallar si no existe registración', async () => {
            vi.mocked(mockRegistrationRepo.getBySessionAndUser).mockResolvedValue(null);

            await expect(service.markRegistrationComplete(9999, '100')).resolves.not.toThrow();
            expect(mockRegistrationRepo.updateStatus).not.toHaveBeenCalled();
        });
    });

    describe('saveCompleteAttendance() - operación atómica', () => {
        it('debería guardar validación + resultado + marcar completado', async () => {
            const validation: SaveValidationParams = {
                sessionId: '100',
                studentId: 1001,
                round: 3,
                responseTime: 2500,
                validatedAt: Date.now(),
            };

            const result: SaveResultParams = {
                sessionId: '100',
                studentId: 1001,
                round: 3,
                responseTime: 2500,
                stats: {
                    avg: 2500,
                    stdDev: 200,
                    min: 2200,
                    max: 2800,
                    certainty: 95,
                },
                validatedAt: Date.now(),
                maxRounds: 3,
            };

            vi.mocked(mockValidationRepo.getByRound).mockResolvedValue(null);

            await service.saveCompleteAttendance(validation, result);

            // Verificar que se ejecutaron las 3 operaciones
            expect(mockValidationRepo.create).toHaveBeenCalled();
            expect(mockValidationRepo.complete).toHaveBeenCalled();
            expect(mockResultRepo.create).toHaveBeenCalled();
            expect(mockRegistrationRepo.updateStatus).toHaveBeenCalledWith(
                10,
                { status: 'completed' }
            );
        });
    });
});
