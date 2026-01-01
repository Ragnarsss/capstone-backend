import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentEncryptionService } from '../student-encryption.service';
import type { ISessionKeyQuery } from '../../../../../shared/ports';

// Mock del AesGcmService
vi.mock('../../../../../shared/infrastructure/crypto', () => ({
    AesGcmService: vi.fn().mockImplementation((key?: Buffer) => ({
        encryptToPayload: vi.fn().mockReturnValue({
            encrypted: key ? 'encrypted-with-real-key' : 'encrypted-with-mock-key',
        }),
    })),
}));

describe('StudentEncryptionService', () => {
    let service: StudentEncryptionService;
    let mockSessionKeyQuery: ISessionKeyQuery;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock SessionKeyQuery
        mockSessionKeyQuery = {
            findByUserId: vi.fn(),
        } as any;

        service = new StudentEncryptionService(mockSessionKeyQuery);
    });

    describe('encryptForStudent()', () => {
        it('debería encriptar con session_key real si existe', async () => {
            // Arrange
            const studentId = 1001;
            const data = 'test-data-to-encrypt';
            const mockSessionKey = Buffer.alloc(32, 'a');

            vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue({
                userId: studentId,
                sessionKey: mockSessionKey,
            } as any);

            // Act
            const result = await service.encryptForStudent(studentId, data);

            // Assert
            expect(result).toBeDefined();
            expect(result.encrypted).toBeDefined();
            expect(typeof result.encrypted).toBe('string');
            expect(result.usedRealKey).toBe(true);
            expect(mockSessionKeyQuery.findByUserId).toHaveBeenCalledWith(studentId);
        });

        it('debería usar fallback AES si no hay session_key', async () => {
            // Arrange
            const studentId = 1002;
            const data = 'test-data-fallback';

            vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

            // Act
            const result = await service.encryptForStudent(studentId, data);

            // Assert
            expect(result.encrypted).toBe('encrypted-with-mock-key');
            expect(result.usedRealKey).toBe(false);
            expect(mockSessionKeyQuery.findByUserId).toHaveBeenCalledWith(studentId);
        });

        it('debería manejar errores de session_key gracefully', async () => {
            // Arrange
            const studentId = 1003;
            const data = 'test-data-error';

            vi.mocked(mockSessionKeyQuery.findByUserId).mockRejectedValue(
                new Error('Database connection failed')
            );

            // Act & Assert - Debería propagar el error
            await expect(service.encryptForStudent(studentId, data)).rejects.toThrow('Database connection failed');
        });

        it('debería encriptar diferentes datos correctamente', async () => {
            // Arrange
            const studentId = 1004;
            const data1 = 'first-data';
            const data2 = 'second-data';

            vi.mocked(mockSessionKeyQuery.findByUserId).mockResolvedValue(null);

            // Act
            const result1 = await service.encryptForStudent(studentId, data1);
            const result2 = await service.encryptForStudent(studentId, data2);

            // Assert
            expect(result1.encrypted).toBeDefined();
            expect(result2.encrypted).toBeDefined();
            expect(result1.usedRealKey).toBe(false);
            expect(result2.usedRealKey).toBe(false);
        });
    });

    describe('constructor', () => {
        it('debería crear instancia correctamente', () => {
            // Arrange & Act
            const newService = new StudentEncryptionService(mockSessionKeyQuery);

            // Assert
            expect(newService).toBeInstanceOf(StudentEncryptionService);
        });
    });
});
