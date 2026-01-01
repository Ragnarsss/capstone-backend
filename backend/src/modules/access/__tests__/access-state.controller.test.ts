import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessStateController } from '../presentation/controllers/access-state.controller';
import type { AccessGatewayService } from '../application/services';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('AccessStateController', () => {
    let controller: AccessStateController;
    let mockAccessGatewayService: AccessGatewayService;
    let mockRequest: FastifyRequest;
    let mockReply: FastifyReply;

    beforeEach(() => {
        mockAccessGatewayService = {
            getState: vi.fn(),
        } as any;

        controller = new AccessStateController(mockAccessGatewayService);

        mockRequest = {
            user: { userId: { toNumber: () => 1001 } } as any,
            query: { deviceFingerprint: 'device-fingerprint-abc123' },
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

        it('debería retornar 400 si falta deviceFingerprint', async () => {
            mockRequest.query = {};

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'BAD_REQUEST',
                message: 'deviceFingerprint query param es requerido',
            });
        });

        it('debería retornar 400 si deviceFingerprint es undefined', async () => {
            mockRequest.query = { deviceFingerprint: undefined };

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'BAD_REQUEST',
                message: 'deviceFingerprint query param es requerido',
            });
        });
    });

    describe('Casos de éxito - estados del sistema', () => {
        it('debería retornar estado BLOCKED si usuario está bloqueado', async () => {
            vi.mocked(mockAccessGatewayService.getState).mockResolvedValue({
                state: 'BLOCKED',
                action: null,
                message: 'Usuario bloqueado por incumplimiento académico',
            });

            await controller.handle(mockRequest, mockReply);

            expect(mockAccessGatewayService.getState).toHaveBeenCalledWith(1001, 'device-fingerprint-abc123');

            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                state: 'BLOCKED',
                action: null,
                message: 'Usuario bloqueado por incumplimiento académico',
            });
        });

        it('debería retornar estado NOT_ENROLLED con action=enroll', async () => {
            vi.mocked(mockAccessGatewayService.getState).mockResolvedValue({
                state: 'NOT_ENROLLED',
                action: 'enroll',
            });

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                state: 'NOT_ENROLLED',
                action: 'enroll',
            });
        });

        it('debería retornar estado ENROLLED_NO_SESSION con action=login y device', async () => {
            vi.mocked(mockAccessGatewayService.getState).mockResolvedValue({
                state: 'ENROLLED_NO_SESSION',
                action: 'login',
                device: {
                    credentialId: 'credential-abc-123',
                    deviceId: 'device-xyz-789',
                },
            });

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                state: 'ENROLLED_NO_SESSION',
                action: 'login',
                device: {
                    credentialId: 'credential-abc-123',
                    deviceId: 'device-xyz-789',
                },
            });
        });

        it('debería retornar estado READY con action=scan y device', async () => {
            vi.mocked(mockAccessGatewayService.getState).mockResolvedValue({
                state: 'READY',
                action: 'scan',
                device: {
                    credentialId: 'credential-def-456',
                    deviceId: 'device-uvw-012',
                },
            });

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                state: 'READY',
                action: 'scan',
                device: {
                    credentialId: 'credential-def-456',
                    deviceId: 'device-uvw-012',
                },
            });
        });

        it('debería retornar estado NOT_ENROLLED con mensaje de re-enrollment', async () => {
            vi.mocked(mockAccessGatewayService.getState).mockResolvedValue({
                state: 'NOT_ENROLLED',
                action: 'enroll',
                message: 'Dispositivo ya esta registrado en otra sesion. Re-enrolement requerido.',
            });

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                state: 'NOT_ENROLLED',
                action: 'enroll',
                message: 'Dispositivo ya esta registrado en otra sesion. Re-enrolement requerido.',
            });
        });
    });

    describe('Manejo de errores internos', () => {
        it('debería retornar 500 si el servicio lanza error', async () => {
            vi.mocked(mockAccessGatewayService.getState).mockRejectedValue(new Error('Database error'));

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al obtener estado de acceso',
            });
        });

        it('debería retornar 500 si el servicio lanza error genérico', async () => {
            vi.mocked(mockAccessGatewayService.getState).mockRejectedValue(new Error('Unexpected error'));

            await controller.handle(mockRequest, mockReply);

            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al obtener estado de acceso',
            });
        });
    });
});
