import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultRepository, type CreateResultDTO } from '../infrastructure/repositories/result.repository';
import type { PostgresPool } from '../../../shared/infrastructure/database/postgres-pool';

describe('ResultRepository', () => {
    let repository: ResultRepository;
    let mockDb: PostgresPool;

    beforeEach(() => {
        mockDb = {
            query: vi.fn(),
        } as any;

        repository = new ResultRepository(mockDb);
    });

    describe('create()', () => {
        it('debería crear un resultado PRESENT con todas las métricas', async () => {
            const dto: CreateResultDTO = {
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
                finalStatus: 'PRESENT',
            };

            const mockRow = {
                result_id: 1,
                registration_id: 10,
                total_rounds: 3,
                successful_rounds: 3,
                failed_rounds: 0,
                avg_response_time_ms: 2500,
                std_dev_response_time: 200,
                min_response_time_ms: 2200,
                max_response_time_ms: 2800,
                median_response_time_ms: 2500,
                certainty_score: 95,
                final_status: 'PRESENT',
                calculated_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.create(dto);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO attendance.results'),
                expect.arrayContaining([10, 3, 3, 0, 2500, 200, 2200, 2800, 2500, 95, 'PRESENT'])
            );

            expect(result).toEqual({
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
                finalStatus: 'PRESENT',
                calculatedAt: mockRow.calculated_at,
            });
        });

        it('debería crear un resultado DOUBTFUL con métricas parciales', async () => {
            const dto: CreateResultDTO = {
                registrationId: 20,
                totalRounds: 3,
                successfulRounds: 2,
                failedRounds: 1,
                avgResponseTimeMs: 3000,
                stdDevResponseTime: 500,
                minResponseTimeMs: 2500,
                maxResponseTimeMs: 3500,
                certaintyScore: 60,
                finalStatus: 'DOUBTFUL',
            };

            const mockRow = {
                result_id: 2,
                registration_id: 20,
                total_rounds: 3,
                successful_rounds: 2,
                failed_rounds: 1,
                avg_response_time_ms: 3000,
                std_dev_response_time: 500,
                min_response_time_ms: 2500,
                max_response_time_ms: 3500,
                median_response_time_ms: null,
                certainty_score: 60,
                final_status: 'DOUBTFUL',
                calculated_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.create(dto);

            expect(result.finalStatus).toBe('DOUBTFUL');
            expect(result.certaintyScore).toBe(60);
            expect(result.successfulRounds).toBe(2);
        });

        it('debería crear un resultado ABSENT', async () => {
            const dto: CreateResultDTO = {
                registrationId: 30,
                totalRounds: 3,
                successfulRounds: 0,
                failedRounds: 3,
                certaintyScore: 0,
                finalStatus: 'ABSENT',
            };

            const mockRow = {
                result_id: 3,
                registration_id: 30,
                total_rounds: 3,
                successful_rounds: 0,
                failed_rounds: 3,
                avg_response_time_ms: null,
                std_dev_response_time: null,
                min_response_time_ms: null,
                max_response_time_ms: null,
                median_response_time_ms: null,
                certainty_score: 0,
                final_status: 'ABSENT',
                calculated_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.create(dto);

            expect(result.finalStatus).toBe('ABSENT');
            expect(result.successfulRounds).toBe(0);
            expect(result.avgResponseTimeMs).toBeNull();
        });

        it('debería crear un resultado ERROR', async () => {
            const dto: CreateResultDTO = {
                registrationId: 40,
                totalRounds: 3,
                successfulRounds: 1,
                failedRounds: 2,
                certaintyScore: 10,
                finalStatus: 'ERROR',
            };

            const mockRow = {
                result_id: 4,
                registration_id: 40,
                total_rounds: 3,
                successful_rounds: 1,
                failed_rounds: 2,
                avg_response_time_ms: null,
                std_dev_response_time: null,
                min_response_time_ms: null,
                max_response_time_ms: null,
                median_response_time_ms: null,
                certainty_score: 10,
                final_status: 'ERROR',
                calculated_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.create(dto);

            expect(result.finalStatus).toBe('ERROR');
        });
    });

    describe('getByRegistration()', () => {
        it('debería obtener resultado por registrationId', async () => {
            const mockRow = {
                result_id: 1,
                registration_id: 10,
                total_rounds: 3,
                successful_rounds: 3,
                failed_rounds: 0,
                avg_response_time_ms: 2500,
                std_dev_response_time: 200,
                min_response_time_ms: 2200,
                max_response_time_ms: 2800,
                median_response_time_ms: 2500,
                certainty_score: 95,
                final_status: 'PRESENT',
                calculated_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getByRegistration(10);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE registration_id = $1'),
                [10]
            );

            expect(result?.registrationId).toBe(10);
            expect(result?.finalStatus).toBe('PRESENT');
        });

        it('debería retornar null si no existe resultado', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.getByRegistration(999);

            expect(result).toBeNull();
        });
    });

    describe('listBySession()', () => {
        it('debería listar todos los resultados de una sesión', async () => {
            const mockRows = [
                {
                    result_id: 1,
                    registration_id: 10,
                    total_rounds: 3,
                    successful_rounds: 3,
                    failed_rounds: 0,
                    avg_response_time_ms: 2500,
                    std_dev_response_time: 200,
                    min_response_time_ms: 2200,
                    max_response_time_ms: 2800,
                    median_response_time_ms: 2500,
                    certainty_score: 95,
                    final_status: 'PRESENT',
                    calculated_at: new Date('2024-01-15T10:10:00Z'),
                },
                {
                    result_id: 2,
                    registration_id: 11,
                    total_rounds: 3,
                    successful_rounds: 2,
                    failed_rounds: 1,
                    avg_response_time_ms: 3000,
                    std_dev_response_time: 500,
                    min_response_time_ms: 2500,
                    max_response_time_ms: 3500,
                    median_response_time_ms: 3000,
                    certainty_score: 60,
                    final_status: 'DOUBTFUL',
                    calculated_at: new Date('2024-01-15T10:15:00Z'),
                },
                {
                    result_id: 3,
                    registration_id: 12,
                    total_rounds: 3,
                    successful_rounds: 0,
                    failed_rounds: 3,
                    avg_response_time_ms: null,
                    std_dev_response_time: null,
                    min_response_time_ms: null,
                    max_response_time_ms: null,
                    median_response_time_ms: null,
                    certainty_score: 0,
                    final_status: 'ABSENT',
                    calculated_at: new Date('2024-01-15T10:20:00Z'),
                },
            ];

            vi.mocked(mockDb.query).mockResolvedValue({ rows: mockRows } as any);

            const results = await repository.listBySession(100);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INNER JOIN attendance.registrations'),
                [100]
            );

            expect(results).toHaveLength(3);
            expect(results[0].finalStatus).toBe('PRESENT');
            expect(results[1].finalStatus).toBe('DOUBTFUL');
            expect(results[2].finalStatus).toBe('ABSENT');
        });

        it('debería retornar array vacío si no hay resultados', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const results = await repository.listBySession(999);

            expect(results).toEqual([]);
        });
    });

    describe.skip('countByStatus()', () => {
        it('debería contar resultados por estado final', async () => {
            const mockRows = [
                { final_status: 'PRESENT', count: 15 },
                { final_status: 'DOUBTFUL', count: 3 },
                { final_status: 'ABSENT', count: 2 },
            ];

            vi.mocked(mockDb.query).mockResolvedValue({ rows: mockRows } as any);

            const counts = await repository.countByStatus(100);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('GROUP BY r.final_status'),
                [100]
            );

            expect(counts).toEqual({
                PRESENT: 15,
                DOUBTFUL: 3,
                ABSENT: 2,
                ERROR: 0,
            });
        });

        it('debería retornar contadores en 0 si no hay resultados', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const counts = await repository.countByStatus(999);

            expect(counts).toEqual({
                PRESENT: 0,
                DOUBTFUL: 0,
                ABSENT: 0,
                ERROR: 0,
            });
        });
    });
});
