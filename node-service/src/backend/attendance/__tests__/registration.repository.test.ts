import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistrationRepository, type CreateRegistrationDTO } from '../infrastructure/repositories/registration.repository';
import type { PostgresPool } from '../../../shared/infrastructure/database/postgres-pool';

describe('RegistrationRepository', () => {
    let repository: RegistrationRepository;
    let mockDb: PostgresPool;

    beforeEach(() => {
        mockDb = {
            query: vi.fn(),
        } as any;

        repository = new RegistrationRepository(mockDb);
    });

    describe('create()', () => {
        it('debería crear una registración con queue_position auto-calculado (primer estudiante)', async () => {
            const dto: CreateRegistrationDTO = {
                sessionId: 10,
                userId: 1001,
                deviceId: 'device-abc',
            };

            // Mock: INSERT con subquery COALESCE(MAX(queue_position), 0) + 1
            vi.mocked(mockDb.query).mockResolvedValueOnce({
                rows: [{
                    registration_id: 1,
                    session_id: 10,
                    user_id: 1001,
                    device_id: 'device-abc',
                    queue_position: 1,
                    registered_at: new Date(),
                    status: 'active',
                }]
            } as any);

            const result = await repository.create(dto);

            // Verificar que se hizo INSERT con subquery (no dos queries separadas)
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('COALESCE(MAX(queue_position), 0) + 1'),
                expect.arrayContaining([10, 1001, 'device-abc'])
            );

            expect(result.queuePosition).toBe(1);
        });

        it('debería crear una registración con queue_position auto-calculado (segundo estudiante)', async () => {
            const dto: CreateRegistrationDTO = {
                sessionId: 10,
                userId: 1002,
                deviceId: 'device-xyz',
            };

            // Mock: INSERT con subquery que retorna queue_position = 2
            vi.mocked(mockDb.query).mockResolvedValueOnce({
                rows: [{
                    registration_id: 2,
                    session_id: 10,
                    user_id: 1002,
                    device_id: 'device-xyz',
                    queue_position: 2,
                    registered_at: new Date(),
                    status: 'active',
                }]
            } as any);

            const result = await repository.create(dto);

            expect(result.queuePosition).toBe(2);
        });

        it('debería crear registración con queue_position 5 cuando hay 4 estudiantes', async () => {
            const dto: CreateRegistrationDTO = {
                sessionId: 20,
                userId: 2001,
                deviceId: 'device-123',
            };

            // Mock: INSERT con subquery que retorna queue_position = 5
            vi.mocked(mockDb.query).mockResolvedValueOnce({
                rows: [{
                    registration_id: 5,
                    session_id: 20,
                    user_id: 2001,
                    device_id: 'device-123',
                    queue_position: 5,
                    registered_at: new Date(),
                    status: 'active',
                }]
            } as any);

            const result = await repository.create(dto);

            expect(result.queuePosition).toBe(5);
        });
    });

    describe('getById()', () => {
        it('debería retornar una registración por ID', async () => {
            const mockRow = {
                registration_id: 1,
                session_id: 10,
                user_id: 1001,
                device_id: 'device-abc',
                queue_position: 1,
                registered_at: new Date(),
                status: 'pending',
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getById(1);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM attendance.registrations'),
                [1]
            );

            expect(result).toEqual({
                registrationId: 1,
                sessionId: 10,
                userId: 1001,
                deviceId: 'device-abc',
                queuePosition: 1,
                registeredAt: mockRow.registered_at,
                status: 'pending',
            });
        });

        it('debería retornar null si no existe la registración', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.getById(999);

            expect(result).toBeNull();
        });
    });

    describe('getBySessionAndUser()', () => {
        it('debería retornar registración por sessionId y userId', async () => {
            const mockRow = {
                registration_id: 5,
                session_id: 20,
                user_id: 2001,
                device_id: 'device-xyz',
                queue_position: 3,
                registered_at: new Date(),
                status: 'pending',
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.getBySessionAndUser(20, 2001);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE session_id = $1 AND user_id = $2'),
                [20, 2001]
            );

            expect(result).toEqual({
                registrationId: 5,
                sessionId: 20,
                userId: 2001,
                deviceId: 'device-xyz',
                queuePosition: 3,
                registeredAt: mockRow.registered_at,
                status: 'pending',
            });
        });

        it('debería retornar null si no existe registración para esa combinación', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.getBySessionAndUser(999, 9999);

            expect(result).toBeNull();
        });
    });

    describe('updateStatus()', () => {
        it('debería actualizar el status a "completed"', async () => {
            const mockRow = {
                registration_id: 1,
                session_id: 10,
                user_id: 1001,
                device_id: 'device-abc',
                queue_position: 1,
                registered_at: new Date(),
                status: 'completed',
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.updateStatus(1, { status: 'completed' });

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE attendance.registrations'),
                expect.arrayContaining(['completed', 1])
            );

            expect(result?.status).toBe('completed');
        });

        it('debería actualizar el status a "cancelled"', async () => {
            const mockRow = {
                registration_id: 2,
                session_id: 10,
                user_id: 1002,
                device_id: 'device-xyz',
                queue_position: 2,
                registered_at: new Date(),
                status: 'cancelled',
            };

            vi.mocked(mockDb.query).mockResolvedValue({ rows: [mockRow] } as any);

            const result = await repository.updateStatus(2, { status: 'cancelled' });

            expect(result?.status).toBe('cancelled');
        });

        it('debería retornar null si la registración no existe', async () => {
            vi.mocked(mockDb.query).mockResolvedValue({ rows: [] } as any);

            const result = await repository.updateStatus(999, { status: 'completed' });

            expect(result).toBeNull();
        });
    });
});
