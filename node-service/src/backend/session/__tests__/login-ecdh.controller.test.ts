import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginEcdhController } from '../presentation/controllers/login-ecdh.controller';
import type { LoginEcdhUseCase } from '../application/use-cases/login-ecdh.use-case';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('LoginEcdhController', () => {
    let controller: LoginEcdhController;
    let mockUseCase: LoginEcdhUseCase;
    let mockRequest: FastifyRequest;
    let mockReply: FastifyReply;

    beforeEach(() => {
        mockUseCase = {
            execute: vi.fn(),
        } as any;

        controller = new LoginEcdhController(mockUseCase);

        mockRequest = {
            user: { userId: { toNumber: () => 12345 } } as any,
            body: {
                credentialId: 'test-credential-id',
                clientPublicKey: 'client-public-key-base64',
            },
        } as any;

        mockReply = {
            code: vi.fn().mockReturnThis(),
            send: vi.fn(),
        } as any;
    });

    describe('Validaciones de entrada', () => {
        it('debería retornar 401 si no hay usuario autenticado', async () => {
            mockRequest.user = undefined;

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'UNAUTHORIZED',
                message: 'User not authenticated',
            });
        });

        it('debería retornar 400 si falta credentialId', async () => {
            mockRequest.body = { clientPublicKey: 'key' };

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INVALID_REQUEST',
                message: 'credentialId y clientPublicKey son requeridos',
            });
        });

        it('debería retornar 400 si falta clientPublicKey', async () => {
            mockRequest.body = { credentialId: 'cred-id' };

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INVALID_REQUEST',
                message: 'credentialId y clientPublicKey son requeridos',
            });
        });

        it('debería retornar 400 si ambos campos faltan', async () => {
            mockRequest.body = {};

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INVALID_REQUEST',
                message: 'credentialId y clientPublicKey son requeridos',
            });
        });
    });

    describe('Manejo de errores del UseCase', () => {
        it('debería retornar 404 si el dispositivo no existe (DEVICE_NOT_FOUND)', async () => {
            vi.mocked(mockUseCase.execute).mockRejectedValue(
                new Error('DEVICE_NOT_FOUND: Device not found')
            );

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(404);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'DEVICE_NOT_FOUND',
                message: 'Dispositivo no encontrado. Verifica el credentialId.',
            });
        });

        it('debería retornar 403 si el dispositivo no pertenece al usuario (DEVICE_NOT_OWNED)', async () => {
            vi.mocked(mockUseCase.execute).mockRejectedValue(
                new Error('DEVICE_NOT_OWNED: Device not owned')
            );

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(403);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'DEVICE_NOT_OWNED',
                message: 'El dispositivo no pertenece a este usuario',
            });
        });

        it('debería retornar 403 si el dispositivo está revocado (DEVICE_REVOKED)', async () => {
            vi.mocked(mockUseCase.execute).mockRejectedValue(
                new Error('DEVICE_REVOKED: Device revoked')
            );

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(403);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'DEVICE_REVOKED',
                message: 'El dispositivo ha sido revocado. Debes enrolar nuevamente.',
            });
        });

        it('debería retornar 500 para errores genéricos sin código', async () => {
            vi.mocked(mockUseCase.execute).mockRejectedValue(new Error('Unknown error'));

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al establecer sesión',
            });
        });
    });

    describe('Caso de éxito', () => {
        it('debería retornar 200 con serverPublicKey, totpu y deviceId', async () => {
            const mockResult = {
                serverPublicKey: 'server-public-key-base64',
                totpu: 123456,
                deviceId: 'device-123',
            };

            vi.mocked(mockUseCase.execute).mockResolvedValue(mockResult);

            await controller.handle(mockRequest, mockReply);

            expect(mockUseCase.execute).toHaveBeenCalledWith({
                userId: 12345,
                credentialId: 'test-credential-id',
                clientPublicKey: 'client-public-key-base64',
            });

            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: true,
                session: {
                    serverPublicKey: 'server-public-key-base64',
                    totpu: 123456,
                    deviceId: 'device-123',
                },
                message: 'Sesion establecida exitosamente',
            });
        });
    });
});
