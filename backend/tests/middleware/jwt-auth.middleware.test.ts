import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createJWTAuthMiddleware } from '../../src/middleware/jwt-auth.middleware';
import { JWTUtils } from '../../src/modules/auth/domain/jwt-utils';
import type { JWTPayload } from '../../src/modules/auth/domain/models';

describe('JWT Auth Middleware', () => {
    let jwtUtils: JWTUtils;
    let middleware: ReturnType<typeof createJWTAuthMiddleware>;
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;

    beforeEach(() => {
        // Mock JWTUtils
        jwtUtils = {
            verify: vi.fn(),
        } as unknown as JWTUtils;

        middleware = createJWTAuthMiddleware(jwtUtils);

        // Mock FastifyRequest
        mockRequest = {
            headers: {},
            query: {},
            url: '/api/test',
            ip: '127.0.0.1',
        };

        // Mock FastifyReply
        mockReply = {
            code: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        };
    });

    describe('Token Extraction', () => {
        it('debería extraer token desde header Authorization', async () => {
            const token = 'valid-jwt-token';
            const payload: JWTPayload = {
                userId: 123,
                username: 'profesor@ucn.cl',
                rol: 'profesor',
                iat: 1234567890,
                exp: 1234567890 + 300,
                jti: 'unique-id',
            };

            mockRequest.headers = {
                authorization: `Bearer ${token}`,
            };

            vi.mocked(jwtUtils.verify).mockReturnValue(payload);

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(jwtUtils.verify).toHaveBeenCalledWith(token);
            expect(mockRequest.user).toEqual(payload);
            expect(mockReply.code).not.toHaveBeenCalled();
        });

        it('debería extraer token desde query string', async () => {
            const token = 'valid-jwt-token';
            const payload: JWTPayload = {
                userId: 123,
                username: 'profesor@ucn.cl',
                rol: 'profesor',
                iat: 1234567890,
                exp: 1234567890 + 300,
                jti: 'unique-id',
            };

            mockRequest.query = { token };

            vi.mocked(jwtUtils.verify).mockReturnValue(payload);

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(jwtUtils.verify).toHaveBeenCalledWith(token);
            expect(mockRequest.user).toEqual(payload);
            expect(mockReply.code).not.toHaveBeenCalled();
        });

        it('debería priorizar header Authorization sobre query string', async () => {
            const headerToken = 'header-token';
            const queryToken = 'query-token';
            const payload: JWTPayload = {
                userId: 123,
                username: 'profesor@ucn.cl',
                rol: 'profesor',
                iat: 1234567890,
                exp: 1234567890 + 300,
                jti: 'unique-id',
            };

            mockRequest.headers = {
                authorization: `Bearer ${headerToken}`,
            };
            mockRequest.query = { token: queryToken };

            vi.mocked(jwtUtils.verify).mockReturnValue(payload);

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(jwtUtils.verify).toHaveBeenCalledWith(headerToken);
            expect(jwtUtils.verify).not.toHaveBeenCalledWith(queryToken);
        });
    });

    describe('Error Handling', () => {
        it('debería retornar 401 si no hay token', async () => {
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: false,
                error: 'NO_TOKEN',
                message: expect.stringContaining('Token JWT requerido'),
            });
        });

        it('debería retornar 401 si token es inválido', async () => {
            mockRequest.headers = {
                authorization: 'Bearer invalid-token',
            };

            vi.mocked(jwtUtils.verify).mockImplementation(() => {
                throw new Error('Token inválido');
            });

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: false,
                error: 'INVALID_TOKEN',
                message: 'Token inválido',
            });
        });

        it('debería retornar TOKEN_EXPIRED si token expiró', async () => {
            mockRequest.headers = {
                authorization: 'Bearer expired-token',
            };

            vi.mocked(jwtUtils.verify).mockImplementation(() => {
                throw new Error('Token expirado');
            });

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: false,
                error: 'TOKEN_EXPIRED',
                message: 'Token expirado',
            });
        });
    });

    describe('User Injection', () => {
        it('debería inyectar payload decodificado en request.user', async () => {
            const payload: JWTPayload = {
                userId: 456,
                username: '12345678-9',
                rol: 'alumno',
                iat: 1234567890,
                exp: 1234567890 + 300,
                jti: 'another-unique-id',
            };

            mockRequest.headers = {
                authorization: 'Bearer valid-token',
            };

            vi.mocked(jwtUtils.verify).mockReturnValue(payload);

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(mockRequest.user).toBeDefined();
            expect(mockRequest.user?.userId).toBe(456);
            expect(mockRequest.user?.username).toBe('12345678-9');
            expect(mockRequest.user?.rol).toBe('alumno');
        });

        it('debería incluir todos los campos del payload', async () => {
            const payload: JWTPayload = {
                userId: 789,
                username: 'otro@ucn.cl',
                rol: 'profesor',
                iat: 1234567890,
                exp: 1234567890 + 300,
                jti: 'jti-value',
            };

            mockRequest.headers = {
                authorization: 'Bearer valid-token',
            };

            vi.mocked(jwtUtils.verify).mockReturnValue(payload);

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(mockRequest.user).toEqual(payload);
            expect(mockRequest.user?.jti).toBe('jti-value');
            expect(mockRequest.user?.iat).toBe(1234567890);
            expect(mockRequest.user?.exp).toBe(1234567890 + 300);
        });
    });

    describe('Security', () => {
        it('debería rechazar Authorization header sin Bearer prefix', async () => {
            mockRequest.headers = {
                authorization: 'token-without-bearer',
            };

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(jwtUtils.verify).not.toHaveBeenCalled();
            expect(mockReply.code).toHaveBeenCalledWith(401);
        });

        it('debería rechazar query string sin campo token', async () => {
            mockRequest.query = { other: 'value' };

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(jwtUtils.verify).not.toHaveBeenCalled();
            expect(mockReply.code).toHaveBeenCalledWith(401);
        });

        it('debería rechazar query token no-string', async () => {
            mockRequest.query = { token: 123 as unknown as string };

            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

            expect(jwtUtils.verify).not.toHaveBeenCalled();
            expect(mockReply.code).toHaveBeenCalledWith(401);
        });
    });
});
