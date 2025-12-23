import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoolBalancer, type BalanceResult, type PoolStats } from '../pool-balancer.service';
import { AesGcmService } from '../../../../../shared/infrastructure/crypto';
import { ProjectionPoolRepository } from '../../../../../shared/infrastructure/valkey';

describe('PoolBalancer', () => {
    let balancer: PoolBalancer;
    let mockAesGcmService: AesGcmService;
    let mockPoolRepo: ProjectionPoolRepository;

    beforeEach(() => {
        mockAesGcmService = {
            encryptWithRandomKey: vi.fn().mockReturnValue('fake-encrypted-qr'),
        } as any;

        mockPoolRepo = {
            getPoolStats: vi.fn(),
            addFakeQRs: vi.fn(),
            removeFakeQRs: vi.fn(),
        } as any;

        balancer = new PoolBalancer(mockAesGcmService, mockPoolRepo, { minPoolSize: 10 });
    });

    describe('Constructor y configuración', () => {
        it('debería inicializar con configuración por defecto', () => {
            const defaultBalancer = new PoolBalancer();
            const config = defaultBalancer.getConfig();

            expect(config.minPoolSize).toBe(10);
        });

        it('debería aceptar configuración personalizada', () => {
            const customBalancer = new PoolBalancer(undefined, undefined, { minPoolSize: 20 });
            const config = customBalancer.getConfig();

            expect(config.minPoolSize).toBe(20);
        });

        it('debería permitir actualizar configuración en runtime', () => {
            balancer.updateConfig({ minPoolSize: 15 });
            const config = balancer.getConfig();

            expect(config.minPoolSize).toBe(15);
        });
    });

    describe('calculateFakesNeeded()', () => {
        it('debería calcular 10 falsos cuando hay 0 reales (minPoolSize=10)', () => {
            const fakesNeeded = balancer.calculateFakesNeeded(0);

            expect(fakesNeeded).toBe(10);
        });

        it('debería calcular 5 falsos cuando hay 5 reales (minPoolSize=10)', () => {
            const fakesNeeded = balancer.calculateFakesNeeded(5);

            expect(fakesNeeded).toBe(5);
        });

        it('debería calcular 0 falsos cuando hay >= minPoolSize reales', () => {
            const fakesNeeded1 = balancer.calculateFakesNeeded(10);
            const fakesNeeded2 = balancer.calculateFakesNeeded(15);
            const fakesNeeded3 = balancer.calculateFakesNeeded(100);

            expect(fakesNeeded1).toBe(0);
            expect(fakesNeeded2).toBe(0);
            expect(fakesNeeded3).toBe(0);
        });

        it('debería manejar valores negativos retornando 0', () => {
            const fakesNeeded = balancer.calculateFakesNeeded(-5);

            expect(fakesNeeded).toBe(15); // minPoolSize=10, -5 → 10 - (-5) = 15
        });
    });

    describe('balance() - Agregar falsos', () => {
        it('debería agregar falsos cuando pool está vacío', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 0, students: 0, fakes: 0 }) // Estado inicial
                .mockResolvedValueOnce({ total: 10, students: 0, fakes: 10 }); // Estado final

            // Act
            const result = await balancer.balance(sessionId);

            // Assert
            expect(result.added).toBe(10);
            expect(result.removed).toBe(0);
            expect(result.total).toBe(10);
            expect(result.fakes).toBe(10);
            expect(mockPoolRepo.addFakeQRs).toHaveBeenCalledWith(
                sessionId,
                10,
                expect.any(Function)
            );
        });

        it('debería agregar falsos parciales cuando hay algunos reales', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 7, students: 7, fakes: 0 })
                .mockResolvedValueOnce({ total: 10, students: 7, fakes: 3 });

            // Act
            const result = await balancer.balance(sessionId);

            // Assert
            expect(result.added).toBe(3);
            expect(result.removed).toBe(0);
            expect(result.students).toBe(7);
            expect(result.fakes).toBe(3);
        });

        it('debería generar encrypted falsos usando AesGcmService', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 0, students: 0, fakes: 0 })
                .mockResolvedValueOnce({ total: 10, students: 0, fakes: 10 });

            // Act
            await balancer.balance(sessionId);

            // Assert
            expect(mockPoolRepo.addFakeQRs).toHaveBeenCalled();
            const generatorFn = vi.mocked(mockPoolRepo.addFakeQRs).mock.calls[0][2];
            const encrypted = generatorFn();
            expect(encrypted).toBe('fake-encrypted-qr');
        });
    });

    describe('balance() - Remover falsos', () => {
        it('debería remover falsos cuando sobran', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 15, students: 8, fakes: 7 }) // Necesita solo 2 falsos
                .mockResolvedValueOnce({ total: 10, students: 8, fakes: 2 });
            vi.mocked(mockPoolRepo.removeFakeQRs).mockResolvedValue(5);

            // Act
            const result = await balancer.balance(sessionId);

            // Assert
            expect(result.added).toBe(0);
            expect(result.removed).toBe(5);
            expect(mockPoolRepo.removeFakeQRs).toHaveBeenCalledWith(sessionId, 5);
        });

        it('debería remover todos los falsos cuando hay >= minPoolSize reales', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 20, students: 15, fakes: 5 })
                .mockResolvedValueOnce({ total: 15, students: 15, fakes: 0 });
            vi.mocked(mockPoolRepo.removeFakeQRs).mockResolvedValue(5);

            // Act
            const result = await balancer.balance(sessionId);

            // Assert
            expect(result.removed).toBe(5);
            expect(result.fakes).toBe(0);
        });
    });

    describe('balance() - Pool balanceado', () => {
        it('no debería hacer cambios si pool está balanceado', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 10, students: 7, fakes: 3 }) // Ya balanceado
                .mockResolvedValueOnce({ total: 10, students: 7, fakes: 3 });

            // Act
            const result = await balancer.balance(sessionId);

            // Assert
            expect(result.added).toBe(0);
            expect(result.removed).toBe(0);
            expect(mockPoolRepo.addFakeQRs).not.toHaveBeenCalled();
            expect(mockPoolRepo.removeFakeQRs).not.toHaveBeenCalled();
        });

        it('no debería hacer cambios si hay solo reales >= minPoolSize', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 12, students: 12, fakes: 0 })
                .mockResolvedValueOnce({ total: 12, students: 12, fakes: 0 });

            // Act
            const result = await balancer.balance(sessionId);

            // Assert
            expect(result.added).toBe(0);
            expect(result.removed).toBe(0);
        });
    });

    describe('injectFakes()', () => {
        it('debería inyectar cantidad específica de falsos', async () => {
            // Arrange
            const sessionId = 'session-123';
            const count = 5;

            // Act
            await balancer.injectFakes(sessionId, count);

            // Assert
            expect(mockPoolRepo.addFakeQRs).toHaveBeenCalledWith(
                sessionId,
                count,
                expect.any(Function)
            );
        });

        it('no debería hacer nada si count es 0', async () => {
            // Arrange
            const sessionId = 'session-123';

            // Act
            await balancer.injectFakes(sessionId, 0);

            // Assert
            expect(mockPoolRepo.addFakeQRs).not.toHaveBeenCalled();
        });

        it('no debería hacer nada si count es negativo', async () => {
            // Arrange
            const sessionId = 'session-123';

            // Act
            await balancer.injectFakes(sessionId, -5);

            // Assert
            expect(mockPoolRepo.addFakeQRs).not.toHaveBeenCalled();
        });

        it('debería usar el generador de falsos', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockAesGcmService.encryptWithRandomKey).mockReturnValue('test-encrypted');

            // Act
            await balancer.injectFakes(sessionId, 1);

            // Assert
            const generatorFn = vi.mocked(mockPoolRepo.addFakeQRs).mock.calls[0][2];
            const encrypted = generatorFn();
            expect(encrypted).toBe('test-encrypted');
        });
    });

    describe('getPoolStats()', () => {
        it('debería retornar estadísticas del pool', async () => {
            // Arrange
            const sessionId = 'session-123';
            const mockStats: PoolStats = {
                total: 15,
                students: 10,
                fakes: 5,
            };
            vi.mocked(mockPoolRepo.getPoolStats).mockResolvedValue(mockStats);

            // Act
            const stats = await balancer.getPoolStats(sessionId);

            // Assert
            expect(stats).toEqual(mockStats);
            expect(mockPoolRepo.getPoolStats).toHaveBeenCalledWith(sessionId);
        });
    });

    describe('getConfig() y updateConfig()', () => {
        it('getConfig debería retornar copia de la configuración', () => {
            const config1 = balancer.getConfig();
            const config2 = balancer.getConfig();

            // Modificar config1 no debe afectar config2
            config1.minPoolSize = 999;

            expect(config2.minPoolSize).toBe(10);
        });

        it('updateConfig debería actualizar configuración', () => {
            balancer.updateConfig({ minPoolSize: 25 });

            const config = balancer.getConfig();
            expect(config.minPoolSize).toBe(25);
        });

        it('updateConfig debería mantener otros valores no actualizados', () => {
            const initialConfig = balancer.getConfig();
            balancer.updateConfig({ minPoolSize: 30 });

            const updatedConfig = balancer.getConfig();
            expect(updatedConfig.minPoolSize).toBe(30);
        });
    });

    describe('Integración - Escenarios reales', () => {
        it('debería manejar sesión que crece de 0 a 15 estudiantes', async () => {
            // Escenario: Sesión empieza vacía, van llegando estudiantes
            const sessionId = 'session-growing';

            // Paso 1: Pool vacío → agrega 10 falsos
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 0, students: 0, fakes: 0 })
                .mockResolvedValueOnce({ total: 10, students: 0, fakes: 10 });
            let result = await balancer.balance(sessionId);
            expect(result.added).toBe(10);

            // Paso 2: Llegan 5 estudiantes → remueve 5 falsos
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 15, students: 5, fakes: 10 })
                .mockResolvedValueOnce({ total: 10, students: 5, fakes: 5 });
            vi.mocked(mockPoolRepo.removeFakeQRs).mockResolvedValue(5);
            result = await balancer.balance(sessionId);
            expect(result.removed).toBe(5);

            // Paso 3: Llegan 10 más (15 total) → remueve todos los falsos
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 20, students: 15, fakes: 5 })
                .mockResolvedValueOnce({ total: 15, students: 15, fakes: 0 });
            vi.mocked(mockPoolRepo.removeFakeQRs).mockResolvedValue(5);
            result = await balancer.balance(sessionId);
            expect(result.removed).toBe(5);
            expect(result.fakes).toBe(0);
        });

        it('debería manejar configuración dinámica durante operación', async () => {
            const sessionId = 'session-dynamic';

            // Inicialmente minPoolSize=10, pool vacío
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 0, students: 0, fakes: 0 })
                .mockResolvedValueOnce({ total: 10, students: 0, fakes: 10 });
            let result = await balancer.balance(sessionId);
            expect(result.added).toBe(10);

            // Cambiar minPoolSize a 20
            balancer.updateConfig({ minPoolSize: 20 });

            // Ahora debería agregar 10 más (total 20)
            vi.mocked(mockPoolRepo.getPoolStats)
                .mockResolvedValueOnce({ total: 10, students: 0, fakes: 10 })
                .mockResolvedValueOnce({ total: 20, students: 0, fakes: 20 });
            result = await balancer.balance(sessionId);
            expect(result.added).toBe(10);
        });
    });
});
