import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationRepository, type CreateValidationDTO, type CompleteValidationDTO } from '../infrastructure/repositories/validation.repository';
import type { PostgresPool } from '../../../shared/infrastructure/database/postgres-pool';

describe('ValidationRepository', () => {
    let repository: ValidationRepository;
    let mockDb: PostgresPool;

    beforeEach(() => {
        mockDb = {
            query: vi.fn(),
        } as any;

        repository = new ValidationRepository(mockDb);
    });

    describe('create()', () => {
        it('debería crear una validación con QR generado (estado inicial)', async () => {
            const dto: CreateValidationDTO = {
                registrationId: 10,
                roundNumber: 1,
                qrGeneratedAt: new Date('2024-01-15T10:00:00Z'),
            };

            const mockRow = {
                validation_id: 1,
                registration_id: 10,
                round_number: 1,
                qr_generated_at: dto.qrGeneratedAt,
                qr_scanned_at: null,
                response_received_at: null,
                response_time_ms: null,
                totpu_valid: null,
                totps_valid: null,
                rt_valid: null,
                secret_valid: null,
                validation_status: null,
                failed_attempts: 0,
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.create(dto);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO attendance.validations'),
                [10, 1, dto.qrGeneratedAt]
            );

            expect(result).toEqual({
                validationId: 1,
                registrationId: 10,
                roundNumber: 1,
                qrGeneratedAt: dto.qrGeneratedAt,
                qrScannedAt: null,
                responseReceivedAt: null,
                responseTimeMs: null,
                totpuValid: null,
                totpsValid: null,
                rtValid: null,
                secretValid: null,
                validationStatus: null,
                failedAttempts: 0,
                createdAt: mockRow.created_at,
            });
        });

        it('debería crear validaciones para múltiples rounds', async () => {
            const dto1: CreateValidationDTO = {
                registrationId: 10,
                roundNumber: 1,
                qrGeneratedAt: new Date('2024-01-15T10:00:00Z'),
            };

            const dto2: CreateValidationDTO = {
                registrationId: 10,
                roundNumber: 2,
                qrGeneratedAt: new Date('2024-01-15T10:05:00Z'),
            };

            vi.mocked(mockDb.query)
                .mockResolvedValueOnce({ rows: [{ validation_id: 1, round_number: 1, registration_id: 10, qr_generated_at: dto1.qrGeneratedAt, failed_attempts: 0, created_at: new Date() }] } as any)
                .mockResolvedValueOnce({ rows: [{ validation_id: 2, round_number: 2, registration_id: 10, qr_generated_at: dto2.qrGeneratedAt, failed_attempts: 0, created_at: new Date() }] } as any);

            const result1 = await repository.create(dto1);
            const result2 = await repository.create(dto2);

            expect(result1.roundNumber).toBe(1);
            expect(result2.roundNumber).toBe(2);
        });
    });

    describe('complete()', () => {
        it('debería completar una validación exitosa', async () => {
            const dto: CompleteValidationDTO = {
                qrScannedAt: new Date('2024-01-15T10:00:05Z'),
                responseReceivedAt: new Date('2024-01-15T10:00:08Z'),
                responseTimeMs: 3000,
                totpuValid: true,
                totpsValid: true,
                rtValid: true,
                secretValid: true,
                validationStatus: 'success',
            };

            const mockRow = {
                validation_id: 1,
                registration_id: 10,
                round_number: 1,
                qr_generated_at: new Date('2024-01-15T10:00:00Z'),
                qr_scanned_at: dto.qrScannedAt,
                response_received_at: dto.responseReceivedAt,
                response_time_ms: 3000,
                totpu_valid: true,
                totps_valid: true,
                rt_valid: true,
                secret_valid: true,
                validation_status: 'success',
                failed_attempts: 0,
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.complete(10, 1, dto);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE attendance.validations'),
                expect.arrayContaining([10, 1, dto.qrScannedAt, dto.responseReceivedAt, 3000, true, true, true, true, 'success'])
            );

            expect(result).toEqual({
                validationId: 1,
                registrationId: 10,
                roundNumber: 1,
                qrGeneratedAt: mockRow.qr_generated_at,
                qrScannedAt: dto.qrScannedAt,
                responseReceivedAt: dto.responseReceivedAt,
                responseTimeMs: 3000,
                totpuValid: true,
                totpsValid: true,
                rtValid: true,
                secretValid: true,
                validationStatus: 'success',
                failedAttempts: 0,
                createdAt: mockRow.created_at,
            });
        });

        it('debería completar una validación fallida', async () => {
            const dto: CompleteValidationDTO = {
                responseReceivedAt: new Date('2024-01-15T10:00:10Z'),
                responseTimeMs: 5000,
                totpuValid: false,
                totpsValid: false,
                rtValid: false,
                secretValid: false,
                validationStatus: 'failed',
            };

            const mockRow = {
                validation_id: 2,
                registration_id: 10,
                round_number: 2,
                qr_generated_at: new Date('2024-01-15T10:00:05Z'),
                qr_scanned_at: null,
                response_received_at: dto.responseReceivedAt,
                response_time_ms: 5000,
                totpu_valid: false,
                totps_valid: false,
                rt_valid: false,
                secret_valid: false,
                validation_status: 'failed',
                failed_attempts: 1,
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.complete(10, 2, dto);

            expect(result?.validationStatus).toBe('failed');
            expect(result?.totpuValid).toBe(false);
        });

        it('debería completar una validación con timeout', async () => {
            const dto: CompleteValidationDTO = {
                responseReceivedAt: new Date('2024-01-15T10:01:00Z'),
                responseTimeMs: 60000,
                validationStatus: 'timeout',
            };

            const mockRow = {
                validation_id: 3,
                registration_id: 10,
                round_number: 3,
                qr_generated_at: new Date('2024-01-15T10:00:00Z'),
                qr_scanned_at: null,
                response_received_at: dto.responseReceivedAt,
                response_time_ms: 60000,
                totpu_valid: null,
                totps_valid: null,
                rt_valid: null,
                secret_valid: null,
                validation_status: 'timeout',
                failed_attempts: 0,
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.complete(10, 3, dto);

            expect(result?.validationStatus).toBe('timeout');
        });

        it('debería retornar null si no existe la validación', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.complete(999, 1, {
                responseReceivedAt: new Date(),
                responseTimeMs: 1000,
                validationStatus: 'success',
            });

            expect(result).toBeNull();
        });
    });

    describe('incrementFailedAttempts()', () => {
        it('debería incrementar contador de intentos fallidos', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [{ failed_attempts: 1 }] } as any);

            const result = await repository.incrementFailedAttempts(10, 1);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('failed_attempts = failed_attempts + 1'),
                [10, 1]
            );

            expect(result).toBe(1);
        });

        it('debería retornar 0 si no existe la validación', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.incrementFailedAttempts(999, 1);

            expect(result).toBe(0);
        });

        it('debería incrementar múltiples veces', async () => {
            vi.mocked(mockDb.query)
                .mockResolvedValueOnce({ rows: [{ failed_attempts: 1 }] } as any)
                .mockResolvedValueOnce({ rows: [{ failed_attempts: 2 }] } as any)
                .mockResolvedValueOnce({ rows: [{ failed_attempts: 3 }] } as any);

            const result1 = await repository.incrementFailedAttempts(10, 1);
            const result2 = await repository.incrementFailedAttempts(10, 1);
            const result3 = await repository.incrementFailedAttempts(10, 1);

            expect(result1).toBe(1);
            expect(result2).toBe(2);
            expect(result3).toBe(3);
        });
    });

    describe('getByRound()', () => {
        it('debería obtener una validación por registrationId y round', async () => {
            const mockRow = {
                validation_id: 1,
                registration_id: 10,
                round_number: 1,
                qr_generated_at: new Date('2024-01-15T10:00:00Z'),
                qr_scanned_at: new Date('2024-01-15T10:00:05Z'),
                response_received_at: new Date('2024-01-15T10:00:08Z'),
                response_time_ms: 3000,
                totpu_valid: true,
                totps_valid: true,
                rt_valid: true,
                secret_valid: true,
                validation_status: 'success',
                failed_attempts: 0,
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getByRound(10, 1);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE registration_id = $1 AND round_number = $2'),
                [10, 1]
            );

            expect(result?.validationId).toBe(1);
            expect(result?.roundNumber).toBe(1);
        });

        it('debería retornar null si no existe la validación', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.getByRound(999, 1);

            expect(result).toBeNull();
        });
    });

    describe('getResponseTimeStats()', () => {
        it('debería calcular estadísticas de tiempo de respuesta', async () => {
            const mockRow = {
                avg: 2500.5,
                std_dev: 300.2,
                min: 2000,
                max: 3000,
                median: 2500,
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getResponseTimeStats(10);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('AVG(response_time_ms)'),
                [10]
            );

            expect(result).toEqual({
                avg: 2500.5,
                stdDev: 300.2,
                min: 2000,
                max: 3000,
                median: 2500,
            });
        });

        it('debería retornar valores null si no hay validaciones exitosas', async () => {
            const mockRow = {
                avg: null,
                std_dev: null,
                min: null,
                max: null,
                median: null,
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getResponseTimeStats(999);

            expect(result.avg).toBeNull();
            expect(result.stdDev).toBeNull();
        });
    });

    describe('countSuccessful()', () => {
        it('debería contar validaciones exitosas', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [{ count: 3 }] } as any);

            const result = await repository.countSuccessful(10);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE registration_id = $1 AND validation_status = 'success'"),
                [10]
            );

            expect(result).toBe(3);
        });

        it('debería retornar 0 si no hay validaciones exitosas', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [{ count: 0 }] } as any);

            const result = await repository.countSuccessful(999);

            expect(result).toBe(0);
        });
    });
});
