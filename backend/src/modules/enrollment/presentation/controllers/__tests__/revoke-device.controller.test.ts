import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RevokeDeviceController } from '../revoke-device.controller';
import type { RevokeDeviceUseCase } from '../../../application/use-cases';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('RevokeDeviceController', () => {
    let controller: RevokeDeviceController;
    let mockUseCase: RevokeDeviceUseCase;
    let mockRequest: FastifyRequest;
    let mockReply: FastifyReply;

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseCase = { execute: vi.fn() } as any;
        mockRequest = {
            user: { userId: { toNumber: () => 123 } },
            params: { deviceId: '456' },
            body: {},
        } as any;
        mockReply = {
            code: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        } as any;
        controller = new RevokeDeviceController(mockUseCase);
    });

    describe('handle() - Casos exitosos', () => {
        it('Debe revocar dispositivo exitosamente', async () => {
            mockUseCase.execute = vi.fn().mockResolvedValue({
                success: true,
                deviceId: 456,
                message: 'Dispositivo revocado exitosamente',
            });
            await controller.handle(mockRequest, mockReply);
            expect(mockUseCase.execute).toHaveBeenCalledWith({
                userId: 123,
                deviceId: 456,
                reason: undefined,
            });
            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: true,
                deviceId: 456,
                message: 'Dispositivo revocado exitosamente',
            });
        });
        it('Debe pasar el reason si viene en el body', async () => {
            mockRequest.body = { reason: 'Dispositivo perdido' };
            mockUseCase.execute = vi.fn().mockResolvedValue({
                success: true,
                deviceId: 456,
                message: 'Dispositivo revocado exitosamente',
            });
            await controller.handle(mockRequest, mockReply);
            expect(mockUseCase.execute).toHaveBeenCalledWith({
                userId: 123,
                deviceId: 456,
                reason: 'Dispositivo perdido',
            });
        });
    });

    describe('handle() - Validaciones de request', () => {
        it('Debe retornar 401 si no hay usuario autenticado', async () => {
            mockRequest.user = undefined;
            await controller.handle(mockRequest, mockReply);
            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'UNAUTHORIZED',
                message: 'User not authenticated',
            });
            expect(mockUseCase.execute).not.toHaveBeenCalled();
        });
        it('Debe retornar 400 si deviceId no es un número', async () => {
            mockRequest.params.deviceId = 'abc';
            await controller.handle(mockRequest, mockReply);
            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INVALID_DEVICE_ID',
                message: 'deviceId debe ser un número válido',
            });
            expect(mockUseCase.execute).not.toHaveBeenCalled();
        });
    });

    describe('handle() - Manejo de errores del use case', () => {
        it('Debe retornar 404 para DEVICE_NOT_FOUND', async () => {
            mockUseCase.execute = vi.fn().mockRejectedValue(new Error('DEVICE_NOT_FOUND: Dispositivo no encontrado'));
            await controller.handle(mockRequest, mockReply);
            expect(mockReply.code).toHaveBeenCalledWith(404);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'DEVICE_NOT_FOUND',
                message: 'Dispositivo no encontrado',
            });
        });
        it('Debe retornar 403 para DEVICE_NOT_OWNED', async () => {
            mockUseCase.execute = vi.fn().mockRejectedValue(new Error('DEVICE_NOT_OWNED: No tienes permiso para revocar este dispositivo'));
            await controller.handle(mockRequest, mockReply);
            expect(mockReply.code).toHaveBeenCalledWith(403);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'FORBIDDEN',
                message: 'No tienes permiso para revocar este dispositivo',
            });
        });
        it('Debe retornar 409 para DEVICE_ALREADY_REVOKED', async () => {
            mockUseCase.execute = vi.fn().mockRejectedValue(new Error('DEVICE_ALREADY_REVOKED: El dispositivo ya está revocado'));
            await controller.handle(mockRequest, mockReply);
            expect(mockReply.code).toHaveBeenCalledWith(409);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'DEVICE_ALREADY_REVOKED',
                message: 'El dispositivo ya está revocado',
            });
        });
        it('Debe retornar 500 para errores genéricos', async () => {
            mockUseCase.execute = vi.fn().mockRejectedValue(new Error('Database error'));
            await controller.handle(mockRequest, mockReply);
            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al revocar dispositivo',
            });
        });
        it('Debe manejar errores que no son instancia de Error', async () => {
            mockUseCase.execute = vi.fn().mockRejectedValue({ code: 'UNKNOWN', detail: 'fail' });
            await controller.handle(mockRequest, mockReply);
            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al revocar dispositivo',
            });
        });
    });
});
