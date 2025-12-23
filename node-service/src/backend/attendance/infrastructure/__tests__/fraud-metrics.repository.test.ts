import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FraudMetricsRepository, type FraudType, type FraudAttempt } from '../fraud-metrics.repository';
import { ValkeyClient } from '../../../../shared/infrastructure/valkey/valkey-client';

describe('FraudMetricsRepository', () => {
    let repository: FraudMetricsRepository;
    let mockClient: any;

    beforeEach(() => {
        mockClient = {
            incr: vi.fn(),
            expire: vi.fn(),
            lpush: vi.fn(),
            ltrim: vi.fn(),
            sadd: vi.fn(),
            get: vi.fn(),
            lrange: vi.fn(),
            smembers: vi.fn(),
            del: vi.fn(),
        };

        vi.spyOn(ValkeyClient, 'getInstance').mockReturnValue({
            getClient: () => mockClient,
        } as any);

        repository = new FraudMetricsRepository();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('recordAttempt()', () => {
        it('debería registrar intento fraudulento con todos los datos', async () => {
            // Arrange
            const sessionId = 'session-123';
            const type: FraudType = 'DECRYPT_FAILED';
            const studentId = 1001;
            const encryptedPayload = 'encrypted-qr-data-very-long-string-here';

            // Act
            await repository.recordAttempt(sessionId, type, studentId, encryptedPayload);

            // Assert
            expect(mockClient.incr).toHaveBeenCalledWith('fraud:count:session-123:DECRYPT_FAILED');
            expect(mockClient.expire).toHaveBeenCalled();
        });

        it('debería agregar intento a lista de recientes', async () => {
            // Arrange
            const sessionId = 'session-123';
            const type: FraudType = 'QR_ALREADY_USED';
            const studentId = 2002;
            const encryptedPayload = 'test-payload-123';

            // Act
            await repository.recordAttempt(sessionId, type, studentId, encryptedPayload);

            // Assert
            expect(mockClient.lpush).toHaveBeenCalledWith(
                'fraud:attempts:session-123',
                expect.stringContaining('QR_ALREADY_USED')
            );
            expect(mockClient.ltrim).toHaveBeenCalledWith('fraud:attempts:session-123', 0, 99);
        });

        it('debería agregar estudiante al set de sospechosos', async () => {
            // Arrange
            const sessionId = 'session-123';
            const type: FraudType = 'WRONG_OWNER';
            const studentId = 3003;

            // Act
            await repository.recordAttempt(sessionId, type, studentId, 'payload');

            // Assert
            expect(mockClient.sadd).toHaveBeenCalledWith('fraud:students:session-123', '3003');
        });

        it('debería truncar payload preview a 20 caracteres', async () => {
            // Arrange
            const longPayload = 'a'.repeat(100);

            // Act
            await repository.recordAttempt('session-123', 'INVALID_FORMAT', 1001, longPayload);

            // Assert
            const lpushCall = vi.mocked(mockClient.lpush).mock.calls[0];
            const attempt = JSON.parse(lpushCall[1] as string);
            expect(attempt.payloadPreview).toBe('aaaaaaaaaaaaaaaaaaaa...');
        });

        it('debería establecer TTL en todas las keys', async () => {
            // Arrange
            const sessionId = 'session-123';

            // Act
            await repository.recordAttempt(sessionId, 'QR_EXPIRED', 1001, 'payload');

            // Assert
            expect(mockClient.expire).toHaveBeenCalledTimes(3);
            expect(mockClient.expire).toHaveBeenCalledWith(expect.any(String), 14400);
        });
    });

    describe('getStats()', () => {
        it('debería retornar estadísticas completas', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockClient.get).mockImplementation((key: string) => {
                if (key.includes('DECRYPT_FAILED')) return Promise.resolve('5');
                if (key.includes('QR_ALREADY_USED')) return Promise.resolve('3');
                return Promise.resolve('0');
            });
            vi.mocked(mockClient.lrange).mockResolvedValue([
                JSON.stringify({ type: 'DECRYPT_FAILED', studentId: 1001, timestamp: 123456, payloadPreview: 'abc...' }),
                JSON.stringify({ type: 'QR_ALREADY_USED', studentId: 1002, timestamp: 123457, payloadPreview: 'def...' }),
            ]);

            // Act
            const stats = await repository.getStats(sessionId);

            // Assert
            expect(stats.total).toBe(8); // 5 + 3
            expect(stats.byType.DECRYPT_FAILED).toBe(5);
            expect(stats.byType.QR_ALREADY_USED).toBe(3);
            expect(stats.recentAttempts).toHaveLength(2);
        });

        it('debería manejar sesión sin fraudes', async () => {
            // Arrange
            vi.mocked(mockClient.get).mockResolvedValue(null);
            vi.mocked(mockClient.lrange).mockResolvedValue([]);

            // Act
            const stats = await repository.getStats('session-empty');

            // Assert
            expect(stats.total).toBe(0);
            expect(stats.recentAttempts).toHaveLength(0);
        });

        it('debería parsear intentos recientes correctamente', async () => {
            // Arrange
            const attempt: FraudAttempt = {
                type: 'WRONG_OWNER',
                studentId: 5005,
                timestamp: 987654321,
                payloadPreview: 'xyz...',
            };
            vi.mocked(mockClient.get).mockResolvedValue('0');
            vi.mocked(mockClient.lrange).mockResolvedValue([JSON.stringify(attempt)]);

            // Act
            const stats = await repository.getStats('session-123');

            // Assert
            expect(stats.recentAttempts[0]).toEqual(attempt);
        });

        it('debería ignorar intentos con JSON inválido', async () => {
            // Arrange
            vi.mocked(mockClient.get).mockResolvedValue('0');
            vi.mocked(mockClient.lrange).mockResolvedValue([
                'invalid-json{',
                JSON.stringify({ type: 'QR_EXPIRED', studentId: 1001, timestamp: 123, payloadPreview: 'abc' }),
            ]);

            // Act
            const stats = await repository.getStats('session-123');

            // Assert
            expect(stats.recentAttempts).toHaveLength(1);
            expect(stats.recentAttempts[0].type).toBe('QR_EXPIRED');
        });
    });

    describe('getSuspiciousStudents()', () => {
        it('debería retornar lista de estudiantes sospechosos', async () => {
            // Arrange
            const sessionId = 'session-123';
            vi.mocked(mockClient.smembers).mockResolvedValue(['1001', '2002', '3003']);

            // Act
            const students = await repository.getSuspiciousStudents(sessionId);

            // Assert
            expect(students).toEqual([1001, 2002, 3003]);
            expect(mockClient.smembers).toHaveBeenCalledWith('fraud:students:session-123');
        });

        it('debería retornar array vacío si no hay sospechosos', async () => {
            // Arrange
            vi.mocked(mockClient.smembers).mockResolvedValue([]);

            // Act
            const students = await repository.getSuspiciousStudents('session-empty');

            // Assert
            expect(students).toEqual([]);
        });

        it('debería convertir strings a números', async () => {
            // Arrange
            vi.mocked(mockClient.smembers).mockResolvedValue(['999999']);

            // Act
            const students = await repository.getSuspiciousStudents('session-123');

            // Assert
            expect(students[0]).toBe(999999);
            expect(typeof students[0]).toBe('number');
        });
    });

    describe('getCountByType()', () => {
        it('debería retornar conteo para tipo específico', async () => {
            // Arrange
            vi.mocked(mockClient.get).mockResolvedValue('15');

            // Act
            const count = await repository.getCountByType('session-123', 'ROUND_MISMATCH');

            // Assert
            expect(count).toBe(15);
            expect(mockClient.get).toHaveBeenCalledWith('fraud:count:session-123:ROUND_MISMATCH');
        });

        it('debería retornar 0 si no existe el contador', async () => {
            // Arrange
            vi.mocked(mockClient.get).mockResolvedValue(null);

            // Act
            const count = await repository.getCountByType('session-123', 'INVALID_FORMAT');

            // Assert
            expect(count).toBe(0);
        });
    });

    describe('clearSession()', () => {
        it('debería eliminar todas las keys de la sesión', async () => {
            // Arrange
            const sessionId = 'session-to-clear';

            // Act
            await repository.clearSession(sessionId);

            // Assert
            expect(mockClient.del).toHaveBeenCalledWith(
                'fraud:count:session-to-clear:DECRYPT_FAILED',
                'fraud:count:session-to-clear:INVALID_FORMAT',
                'fraud:count:session-to-clear:QR_NOT_FOUND',
                'fraud:count:session-to-clear:QR_EXPIRED',
                'fraud:count:session-to-clear:QR_ALREADY_USED',
                'fraud:count:session-to-clear:WRONG_OWNER',
                'fraud:count:session-to-clear:ROUND_MISMATCH',
                'fraud:attempts:session-to-clear',
                'fraud:students:session-to-clear'
            );
        });
    });

    describe('Keys building', () => {
        it('debería construir count key correctamente', async () => {
            // Act
            await repository.recordAttempt('sess-123', 'QR_NOT_FOUND', 1001, 'payload');

            // Assert
            expect(mockClient.incr).toHaveBeenCalledWith('fraud:count:sess-123:QR_NOT_FOUND');
        });

        it('debería construir attempts key correctamente', async () => {
            // Act
            await repository.recordAttempt('sess-456', 'QR_EXPIRED', 1001, 'payload');

            // Assert
            expect(mockClient.lpush).toHaveBeenCalledWith('fraud:attempts:sess-456', expect.any(String));
        });

        it('debería construir students key correctamente', async () => {
            // Act
            await repository.recordAttempt('sess-789', 'WRONG_OWNER', 1001, 'payload');

            // Assert
            expect(mockClient.sadd).toHaveBeenCalledWith('fraud:students:sess-789', '1001');
        });
    });

    describe('Integración - Múltiples intentos', () => {
        it('debería acumular múltiples intentos del mismo tipo', async () => {
            // Arrange
            const sessionId = 'session-multi';
            const type: FraudType = 'DECRYPT_FAILED';

            // Act
            await repository.recordAttempt(sessionId, type, 1001, 'payload1');
            await repository.recordAttempt(sessionId, type, 1002, 'payload2');
            await repository.recordAttempt(sessionId, type, 1003, 'payload3');

            // Assert
            expect(mockClient.incr).toHaveBeenCalledTimes(3);
            expect(mockClient.lpush).toHaveBeenCalledTimes(3);
        });

        it('debería acumular diferentes estudiantes en set', async () => {
            // Arrange
            const sessionId = 'session-students';

            // Act
            await repository.recordAttempt(sessionId, 'WRONG_OWNER', 1001, 'p1');
            await repository.recordAttempt(sessionId, 'QR_EXPIRED', 1002, 'p2');
            await repository.recordAttempt(sessionId, 'INVALID_FORMAT', 1003, 'p3');

            // Assert
            expect(mockClient.sadd).toHaveBeenCalledWith('fraud:students:session-students', '1001');
            expect(mockClient.sadd).toHaveBeenCalledWith('fraud:students:session-students', '1002');
            expect(mockClient.sadd).toHaveBeenCalledWith('fraud:students:session-students', '1003');
        });
    });
});
