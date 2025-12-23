import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import { JWTUtils } from '../../domain/jwt-utils';
import { UserId } from '../../domain/user-id';
import type { JWTPayload } from '../../domain/models';

describe('AuthService', () => {
    let authService: AuthService;
    let mockJWTUtils: JWTUtils;

    beforeEach(() => {
        mockJWTUtils = {
            extractFromHeader: vi.fn(),
            verify: vi.fn(),
            sign: vi.fn(),
        } as any;

        authService = new AuthService(mockJWTUtils);
    });

    describe('authenticateFromHeader()', () => {
        it('debería autenticar usuario desde header válido', () => {
            // Arrange
            const authHeader = 'Bearer valid-token-123';
            const mockPayload: JWTPayload = {
                userId: 1001,
                username: 'test.user',
                nombreCompleto: 'Test User',
                rol: 'student',
            };

            vi.mocked(mockJWTUtils.extractFromHeader).mockReturnValue('valid-token-123');
            vi.mocked(mockJWTUtils.verify).mockReturnValue(mockPayload);

            // Act
            const result = authService.authenticateFromHeader(authHeader);

            // Assert
            expect(mockJWTUtils.extractFromHeader).toHaveBeenCalledWith(authHeader);
            expect(mockJWTUtils.verify).toHaveBeenCalledWith('valid-token-123');
            expect(result.userId.value).toBe(1001);
            expect(result.username).toBe('test.user');
            expect(result.nombreCompleto).toBe('Test User');
            expect(result.rol).toBe('student');
        });

        it('debería lanzar error si header es undefined', () => {
            // Arrange
            vi.mocked(mockJWTUtils.extractFromHeader).mockImplementation(() => {
                throw new Error('Authorization header missing');
            });

            // Act & Assert
            expect(() => {
                authService.authenticateFromHeader(undefined);
            }).toThrow('Authorization header missing');
        });

        it('debería lanzar error si token es inválido', () => {
            // Arrange
            const authHeader = 'Bearer invalid-token';
            vi.mocked(mockJWTUtils.extractFromHeader).mockReturnValue('invalid-token');
            vi.mocked(mockJWTUtils.verify).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            // Act & Assert
            expect(() => {
                authService.authenticateFromHeader(authHeader);
            }).toThrow('Invalid token');
        });
    });

    describe('verifyToken()', () => {
        it('debería verificar token directamente', () => {
            // Arrange
            const token = 'direct-token-456';
            const mockPayload: JWTPayload = {
                userId: 2002,
                username: 'admin.user',
                nombreCompleto: 'Admin User',
                rol: 'admin',
            };

            vi.mocked(mockJWTUtils.verify).mockReturnValue(mockPayload);

            // Act
            const result = authService.verifyToken(token);

            // Assert
            expect(mockJWTUtils.verify).toHaveBeenCalledWith(token);
            expect(result.userId.value).toBe(2002);
            expect(result.username).toBe('admin.user');
            expect(result.rol).toBe('admin');
        });

        it('debería lanzar error si token expirado', () => {
            // Arrange
            const token = 'expired-token';
            vi.mocked(mockJWTUtils.verify).mockImplementation(() => {
                throw new Error('Token expired');
            });

            // Act & Assert
            expect(() => {
                authService.verifyToken(token);
            }).toThrow('Token expired');
        });
    });

    describe('mapToAuthenticatedUser()', () => {
        it('debería mapear payload a AuthenticatedUser con todos los campos', () => {
            // Arrange
            const mockPayload: JWTPayload = {
                userId: 3003,
                username: 'profesor.test',
                nombreCompleto: 'Profesor Test',
                rol: 'teacher',
            };

            vi.mocked(mockJWTUtils.extractFromHeader).mockReturnValue('token');
            vi.mocked(mockJWTUtils.verify).mockReturnValue(mockPayload);

            // Act
            const result = authService.authenticateFromHeader('Bearer token');

            // Assert
            expect(result).toEqual({
                userId: expect.any(UserId),
                username: 'profesor.test',
                nombreCompleto: 'Profesor Test',
                rol: 'teacher',
            });
        });
    });
});
