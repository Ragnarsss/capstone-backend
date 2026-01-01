import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionRepository, type CreateSessionDTO, type UpdateSessionDTO } from '../infrastructure/repositories/session.repository';
import type { PostgresPool } from '../../../shared/infrastructure/database/postgres-pool';

describe('SessionRepository', () => {
    let repository: SessionRepository;
    let mockDb: PostgresPool;

    beforeEach(() => {
        mockDb = {
            query: vi.fn(),
        } as any;

        repository = new SessionRepository(mockDb);
    });

    describe('create()', () => {
        it('debería crear una sesión con maxRounds default 3', async () => {
            const dto: CreateSessionDTO = {
                professorId: 100,
                professorName: 'Dr. Smith',
                courseCode: 'CS101',
                courseName: 'Intro to CS',
                room: 'Lab-A',
                semester: '2024-1',
                startTime: new Date('2024-01-15T10:00:00Z'),
                endTime: new Date('2024-01-15T12:00:00Z'),
            };

            const mockRow = {
                session_id: 1,
                professor_id: 100,
                professor_name: 'Dr. Smith',
                course_code: 'CS101',
                course_name: 'Intro to CS',
                room: 'Lab-A',
                semester: '2024-1',
                start_time: new Date('2024-01-15T10:00:00Z'),
                end_time: new Date('2024-01-15T12:00:00Z'),
                max_rounds: 3,
                status: 'active',
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.create(dto);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('NOW()'),
                expect.arrayContaining([100, 'Dr. Smith', 'CS101', 'Intro to CS', 'Lab-A', '2024-1', 3])
            );

            expect(result).toEqual({
                sessionId: 1,
                professorId: 100,
                professorName: 'Dr. Smith',
                courseCode: 'CS101',
                courseName: 'Intro to CS',
                room: 'Lab-A',
                semester: '2024-1',
                startTime: mockRow.start_time,
                endTime: mockRow.end_time,
                maxRounds: 3,
                status: 'active',
                createdAt: mockRow.created_at,
            });
        });

        it('debería crear una sesión con maxRounds personalizado', async () => {
            const dto: CreateSessionDTO = {
                professorId: 200,
                professorName: 'Prof. Jones',
                courseCode: 'MATH202',
                courseName: 'Calculus II',
                room: 'Room-B',
                semester: '2024-2',
                startTime: new Date('2024-01-16T14:00:00Z'),
                endTime: new Date('2024-01-16T16:00:00Z'),
                maxRounds: 5,
            };

            const mockRow = {
                session_id: 2,
                professor_id: 200,
                professor_name: 'Prof. Jones',
                course_code: 'MATH202',
                course_name: 'Calculus II',
                room: 'Room-B',
                semester: '2024-2',
                start_time: dto.startTime,
                end_time: dto.endTime,
                max_rounds: 5,
                status: 'active',
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.create(dto);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('NOW()'),
                expect.arrayContaining([200, 'Prof. Jones', 'MATH202', 'Calculus II', 'Room-B', '2024-2', 5])
            );

            expect(result.maxRounds).toBe(5);
        });
    });

    describe('getById()', () => {
        it('debería retornar una sesión por ID', async () => {
            const mockRow = {
                session_id: 10,
                professor_id: 300,
                professor_name: 'Dr. Lee',
                course_code: 'PHY303',
                course_name: 'Quantum Physics',
                room: 'Lab-C',
                semester: '2024-1',
                start_time: new Date('2024-01-20T09:00:00Z'),
                end_time: new Date('2024-01-20T11:00:00Z'),
                max_rounds: 3,
                status: 'active',
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getById(10);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM attendance.sessions'),
                [10]
            );

            expect(result).toEqual({
                sessionId: 10,
                professorId: 300,
                professorName: 'Dr. Lee',
                courseCode: 'PHY303',
                courseName: 'Quantum Physics',
                room: 'Lab-C',
                semester: '2024-1',
                startTime: mockRow.start_time,
                endTime: mockRow.end_time,
                maxRounds: 3,
                status: 'active',
                createdAt: mockRow.created_at,
            });
        });

        it('debería retornar null si no existe la sesión', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.getById(999);

            expect(result).toBeNull();
        });
    });

    describe('getActiveByProfessor()', () => {
        it('debería retornar sesiones activas del profesor', async () => {
            const mockRow = {
                session_id: 1,
                professor_id: 100,
                professor_name: 'Dr. Smith',
                course_code: 'CS101',
                course_name: 'Intro to CS',
                room: 'Lab-A',
                semester: '2024-1',
                start_time: new Date(),
                end_time: null,
                max_rounds: 3,
                status: 'active',
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getActiveByProfessor(100);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE professor_id = $1 AND status = 'active'"),
                [100]
            );

            expect(result).not.toBeNull();
            expect(result?.sessionId).toBe(1);
            expect(result?.professorId).toBe(100);
        });

        it('debería retornar null si no hay sesiones activas', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.getActiveByProfessor(999);

            expect(result).toBeNull();
        });
    });

    describe('getActiveByRoom()', () => {
        it('debería retornar sesiones activas en una sala', async () => {
            const mockRow = {
                session_id: 5,
                professor_id: 200,
                professor_name: 'Prof. Jones',
                course_code: 'MATH202',
                course_name: 'Calculus II',
                room: 'Lab-A',
                semester: '2024-1',
                start_time: new Date(),
                end_time: null,
                max_rounds: 3,
                status: 'active',
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getActiveByRoom('Lab-A');

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE room = $1 AND status = 'active'"),
                ['Lab-A']
            );

            expect(result).not.toBeNull();
            expect(result?.room).toBe('Lab-A');
        });

        it('debería retornar null si no hay sesiones en la sala', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.getActiveByRoom('NonExistentRoom');

            expect(result).toBeNull();
        });
    });

    describe('update()', () => {
        it('debería actualizar el status de una sesión', async () => {
            const dto: UpdateSessionDTO = {
                status: 'ended',
            };

            const mockRow = {
                session_id: 1,
                professor_id: 100,
                professor_name: 'Dr. Smith',
                course_code: 'CS101',
                course_name: 'Intro to CS',
                room: 'Lab-A',
                semester: '2024-1',
                start_time: new Date(),
                end_time: new Date(),
                max_rounds: 3,
                status: 'ended',
                created_at: new Date(),
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.update(1, dto);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE attendance.sessions'),
                expect.arrayContaining(['ended', 1])
            );

            expect(result?.status).toBe('ended');
        });

        it('debería retornar null si la sesión no existe', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.update(999, { status: 'ended' });

            expect(result).toBeNull();
        });
    });
});
