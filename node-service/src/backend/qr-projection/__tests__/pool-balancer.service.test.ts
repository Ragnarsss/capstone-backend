import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoolBalancer } from '../application/services/pool-balancer.service';
import type { AesGcmService } from '../../../shared/infrastructure/crypto';
import type { ProjectionPoolRepository, PoolStats } from '../../../shared/infrastructure/valkey';

describe('PoolBalancer', () => {
    let service: PoolBalancer;
    let mockAesGcmService: AesGcmService;
    let mockPoolRepo: ProjectionPoolRepository;

    beforeEach(() => {
        mockAesGcmService = {
            encryptWithRandomKey: vi.fn().mockReturnValue('fake-encrypted-qr'),
        } as any;

        mockPoolRepo = {
            getPoolStats: vi.fn(),
            addFakeQRs: vi.fn().mockResolvedValue(undefined),
            removeFakeQRs: vi.fn().mockResolvedValue(0),
        } as any;

        service = new PoolBalancer(mockAesGcmService, mockPoolRepo, { minPoolSize: 10 });
    });

    describe('calculateFakesNeeded()', () => {
        it('debería calcular que se necesitan 10 falsos si no hay estudiantes reales', () => {
            const result = service.calculateFakesNeeded(0);
            expect(result).toBe(10);
        });

        it('debería calcular que se necesitan 5 falsos si hay 5 estudiantes', () => {
            const result = service.calculateFakesNeeded(5);
            expect(result).toBe(5);
        });

        it('debería calcular que NO se necesitan falsos si hay 10 estudiantes', () => {
            const result = service.calculateFakesNeeded(10);
            expect(result).toBe(0);
        });

        it('debería calcular que NO se necesitan falsos si hay más de 10 estudiantes', () => {
            const result = service.calculateFakesNeeded(15);
            expect(result).toBe(0);
        });
    });

    describe('balance() - agregar falsos', () => {
        it('debería agregar 10 falsos si el pool está vacío', async () => {
            const initialStats: PoolStats = { total: 0, students: 0, fakes: 0 };
            const finalStats: PoolStats = { total: 10, students: 0, fakes: 10 };

            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce(initialStats)
                .mockResolvedValueOnce(finalStats);

            const result = await service.balance('session-123');

            expect(result.added).toBe(10);
            expect(result.removed).toBe(0);
            expect(result.total).toBe(10);
            expect(result.fakes).toBe(10);

            expect(mockPoolRepo.addFakeQRs).toHaveBeenCalledWith(
                'session-123',
                10,
                expect.any(Function)
            );
        });

        it('debería agregar 5 falsos si hay 5 estudiantes', async () => {
            const initialStats: PoolStats = { total: 5, students: 5, fakes: 0 };
            const finalStats: PoolStats = { total: 10, students: 5, fakes: 5 };

            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce(initialStats)
                .mockResolvedValueOnce(finalStats);

            const result = await service.balance('session-456');

            expect(result.added).toBe(5);
            expect(result.removed).toBe(0);
            expect(result.total).toBe(10);
        });

        it('debería agregar 3 falsos si hay 7 estudiantes y 0 falsos', async () => {
            const initialStats: PoolStats = { total: 7, students: 7, fakes: 0 };
            const finalStats: PoolStats = { total: 10, students: 7, fakes: 3 };

            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce(initialStats)
                .mockResolvedValueOnce(finalStats);

            const result = await service.balance('session-789');

            expect(result.added).toBe(3);
            expect(result.removed).toBe(0);
        });
    });

    describe('balance() - remover falsos', () => {
        it('debería remover 5 falsos si hay 15 estudiantes y 5 falsos', async () => {
            const initialStats: PoolStats = { total: 20, students: 15, fakes: 5 };
            const finalStats: PoolStats = { total: 15, students: 15, fakes: 0 };

            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce(initialStats)
                .mockResolvedValueOnce(finalStats);

            vi.mocked(mockPoolRepo.removeFakeQRs).mockResolvedValue(5);

            const result = await service.balance('session-abc');

            expect(result.added).toBe(0);
            expect(result.removed).toBe(5);
            expect(result.total).toBe(15);
            expect(result.fakes).toBe(0);

            expect(mockPoolRepo.removeFakeQRs).toHaveBeenCalledWith('session-abc', 5);
        });

        it('debería remover 10 falsos si hay 12 estudiantes y 10 falsos', async () => {
            const initialStats: PoolStats = { total: 22, students: 12, fakes: 10 };
            const finalStats: PoolStats = { total: 12, students: 12, fakes: 0 };

            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce(initialStats)
                .mockResolvedValueOnce(finalStats);

            vi.mocked(mockPoolRepo.removeFakeQRs).mockResolvedValue(10);

            const result = await service.balance('session-def');

            expect(result.added).toBe(0);
            expect(result.removed).toBe(10);
        });
    });

    describe('balance() - sin cambios', () => {
        it('NO debería hacer nada si el pool ya está balanceado (10 estudiantes, 0 falsos)', async () => {
            const stats: PoolStats = { total: 10, students: 10, fakes: 0 };

            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce(stats)
                .mockResolvedValueOnce(stats);

            const result = await service.balance('session-ghi');

            expect(result.added).toBe(0);
            expect(result.removed).toBe(0);
            expect(result.total).toBe(10);
        });

        it('NO debería hacer nada si hay 5 estudiantes y 5 falsos', async () => {
            const stats: PoolStats = { total: 10, students: 5, fakes: 5 };

            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce(stats)
                .mockResolvedValueOnce(stats);

            const result = await service.balance('session-jkl');

            expect(result.added).toBe(0);
            expect(result.removed).toBe(0);
        });
    });

    describe('injectFakes()', () => {
        it('debería inyectar 15 QRs falsos manualmente', async () => {
            await service.injectFakes('session-manual', 15);

            expect(mockPoolRepo.addFakeQRs).toHaveBeenCalledWith(
                'session-manual',
                15,
                expect.any(Function)
            );
        });

        it('NO debería inyectar si count es 0', async () => {
            await service.injectFakes('session-zero', 0);

            expect(mockPoolRepo.addFakeQRs).not.toHaveBeenCalled();
        });

        it('NO debería inyectar si count es negativo', async () => {
            await service.injectFakes('session-negative', -5);

            expect(mockPoolRepo.addFakeQRs).not.toHaveBeenCalled();
        });
    });

    describe('getPoolStats()', () => {
        it('debería retornar estadísticas del pool', async () => {
            const mockStats: PoolStats = { total: 15, students: 10, fakes: 5 };
            vi.mocked(mockPoolRepo.getPoolStats).mockResolvedValue(mockStats);

            const stats = await service.getPoolStats('session-stats');

            expect(stats).toEqual(mockStats);
            expect(mockPoolRepo.getPoolStats).toHaveBeenCalledWith('session-stats');
        });
    });

    describe('getConfig()', () => {
        it('debería retornar la configuración actual', () => {
            const config = service.getConfig();

            expect(config).toEqual({ minPoolSize: 10 });
        });
    });

    describe('updateConfig()', () => {
        it('debería actualizar minPoolSize en runtime', () => {
            service.updateConfig({ minPoolSize: 20 });

            const config = service.getConfig();
            expect(config.minPoolSize).toBe(20);
        });

        it('debería recalcular falsos necesarios con nueva configuración', () => {
            service.updateConfig({ minPoolSize: 15 });

            const fakesNeeded = service.calculateFakesNeeded(10);
            expect(fakesNeeded).toBe(5); // 15 - 10 = 5
        });

        it('debería mantener configuración anterior si no se provee', () => {
            service.updateConfig({});

            const config = service.getConfig();
            expect(config.minPoolSize).toBe(10); // Valor inicial
        });
    });

    describe('generateFakeEncrypted() - generación de QRs falsos', () => {
        it('debería generar QRs falsos con formato válido', async () => {
            const initialStats: PoolStats = { total: 0, students: 0, fakes: 0 };
            const finalStats: PoolStats = { total: 10, students: 0, fakes: 10 };

            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce(initialStats)
                .mockResolvedValueOnce(finalStats);

            await service.balance('session-fake-gen');

            // Verificar que se llamó addFakeQRs con un generator function
            expect(mockPoolRepo.addFakeQRs).toHaveBeenCalledWith(
                'session-fake-gen',
                10,
                expect.any(Function)
            );

            // Verificar que el generator produce encrypted strings
            const generator = vi.mocked(mockPoolRepo.addFakeQRs).mock.calls[0][2];
            const encrypted = generator();
            expect(typeof encrypted).toBe('string');
            expect(encrypted).toBe('fake-encrypted-qr');
            expect(mockAesGcmService.encryptWithRandomKey).toHaveBeenCalled();
        });
    });
});
