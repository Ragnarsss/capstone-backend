/**
 * Unit Tests: StartEnrollmentController
 *
 * Tests del controller HTTP POST /api/enrollment/start
 * Responsabilidad: Validar request, extraer usuario JWT, invocar use case
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StartEnrollmentController } from '../start-enrollment.controller';
import type { StartEnrollmentUseCase } from '../../../application/use-cases';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('StartEnrollmentController', () => {
    let controller: StartEnrollmentController;
    let mockUseCase: StartEnrollmentUseCase;
    let mockRequest: FastifyRequest;
    let mockReply: FastifyReply;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock del use case
        mockUseCase = {
            execute: vi.fn(),
        } as any;

        // Mock de Fastify Request
        mockRequest = {
            user: {
                userId: { toNumber: () => 123 },
                username: 'test@ucn.cl',
                nombreCompleto: 'Usuario Test',
            },
            body: {},
        } as any;

        // Mock de Fastify Reply
        mockReply = {
            code: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        } as any;

        controller = new StartEnrollmentController(mockUseCase);
    });

    describe('handle() - Casos exitosos', () => {
        it('Debe iniciar enrollment exitosamente con displayName del body', async () => {
            // Arrange
            const mockOptions = {
                challenge: 'test-challenge-123',
                rp: { name: 'Sistema Asistencia UCN', id: 'mantochrisal.cl' },
                user: {
                    id: '123',
                    name: 'test@ucn.cl',
                    displayName: 'Custom Display Name',
                },
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                timeout: 60000,
                attestation: 'none',
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    requireResidentKey: false,
                    userVerification: 'required',
                },
                excludeCredentials: [],
            };

            mockRequest.body = { displayName: 'Custom Display Name' };
            mockUseCase.execute = vi.fn().mockResolvedValue({ options: mockOptions });

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockUseCase.execute).toHaveBeenCalledWith({
                userId: 123,
                username: 'test@ucn.cl',
                displayName: 'Custom Display Name',
            });

            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: true,
                options: mockOptions,
            });
        });

        it('Debe usar nombreCompleto como displayName si no viene en body', async () => {
            // Arrange
            const mockOptions = {
                challenge: 'test-challenge-456',
                rp: { name: 'Sistema Asistencia UCN', id: 'mantochrisal.cl' },
                user: {
                    id: '123',
                    name: 'test@ucn.cl',
                    displayName: 'Usuario Test',
                },
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
            };

            mockRequest.body = {}; // Sin displayName
            mockUseCase.execute = vi.fn().mockResolvedValue({ options: mockOptions });

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockUseCase.execute).toHaveBeenCalledWith({
                userId: 123,
                username: 'test@ucn.cl',
                displayName: 'Usuario Test', // Tomado de nombreCompleto
            });

            expect(mockReply.code).toHaveBeenCalledWith(200);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: true,
                options: mockOptions,
            });
        });

        it('Debe usar username como displayName si no hay nombreCompleto ni body', async () => {
            // Arrange
            const mockOptions = {
                challenge: 'test-challenge-789',
                rp: { name: 'Sistema Asistencia UCN', id: 'mantochrisal.cl' },
                user: {
                    id: '123',
                    name: 'test@ucn.cl',
                    displayName: 'test@ucn.cl',
                },
            };

            mockRequest.user = {
                userId: { toNumber: () => 123 },
                username: 'test@ucn.cl',
                nombreCompleto: null, // Sin nombreCompleto
            } as any;
            mockRequest.body = {}; // Sin displayName
            mockUseCase.execute = vi.fn().mockResolvedValue({ options: mockOptions });

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockUseCase.execute).toHaveBeenCalledWith({
                userId: 123,
                username: 'test@ucn.cl',
                displayName: 'test@ucn.cl', // Fallback a username
            });

            expect(mockReply.code).toHaveBeenCalledWith(200);
        });
    });

    describe('handle() - Validaciones de autenticación', () => {
        it('Debe retornar 401 si no hay usuario autenticado', async () => {
            // Arrange
            mockRequest.user = undefined;

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'UNAUTHORIZED',
                message: 'User not authenticated',
            });

            // Verificar que NO se invocó el use case
            expect(mockUseCase.execute).not.toHaveBeenCalled();
        });

        it('Debe retornar 401 si request.user es null', async () => {
            // Arrange
            mockRequest.user = null as any;

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'UNAUTHORIZED',
                message: 'User not authenticated',
            });

            expect(mockUseCase.execute).not.toHaveBeenCalled();
        });
    });

    describe('handle() - Manejo de errores del use case', () => {
        it('Debe retornar 429 cuando hay penalización activa', async () => {
            // Arrange
            const penaltyError = new Error(
                'PENALTY_ACTIVE: Usuario penalizado, debe esperar 5 minutos antes de intentar nuevamente'
            );
            mockUseCase.execute = vi.fn().mockRejectedValue(penaltyError);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(429);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'PENALTY_ACTIVE',
                message: 'Usuario penalizado, debe esperar 5 minutos antes de intentar nuevamente',
                waitMinutes: 5,
            });
        });

        it('Debe extraer waitMinutes de diferentes formatos de mensaje de penalización', async () => {
            // Arrange
            const penaltyError = new Error('PENALTY_ACTIVE: Debe esperar 15 minutos por múltiples intentos');
            mockUseCase.execute = vi.fn().mockRejectedValue(penaltyError);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(429);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'PENALTY_ACTIVE',
                message: 'Debe esperar 15 minutos por múltiples intentos',
                waitMinutes: 15,
            });
        });

        it('Debe usar waitMinutes=0 si no se puede extraer del mensaje', async () => {
            // Arrange
            const penaltyError = new Error('PENALTY_ACTIVE: Usuario bloqueado temporalmente');
            mockUseCase.execute = vi.fn().mockRejectedValue(penaltyError);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(429);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'PENALTY_ACTIVE',
                message: 'Usuario bloqueado temporalmente',
                waitMinutes: 0,
            });
        });

        it('Debe retornar 500 para errores genéricos', async () => {
            // Arrange
            const genericError = new Error('Database connection failed');
            mockUseCase.execute = vi.fn().mockRejectedValue(genericError);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al iniciar enrollment',
            });
        });

        it('Debe manejar errores que no son instancias de Error', async () => {
            // Arrange
            const nonError = { code: 'UNKNOWN', detail: 'Something went wrong' };
            mockUseCase.execute = vi.fn().mockRejectedValue(nonError);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al iniciar enrollment',
            });
        });
    });

    describe('handle() - Integración con el use case', () => {
        it('Debe pasar correctamente el userId convertido a número', async () => {
            // Arrange
            mockRequest.user = {
                userId: { toNumber: () => 999 },
                username: 'admin@ucn.cl',
                nombreCompleto: 'Admin User',
            } as any;

            const mockOptions = {
                challenge: 'admin-challenge',
                rp: { name: 'Sistema Asistencia UCN', id: 'mantochrisal.cl' },
                user: { id: '999', name: 'admin@ucn.cl', displayName: 'Admin User' },
            };
            mockUseCase.execute = vi.fn().mockResolvedValue({ options: mockOptions });

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockUseCase.execute).toHaveBeenCalledWith({
                userId: 999, // Número, no BigInt
                username: 'admin@ucn.cl',
                displayName: 'Admin User',
            });

            expect(mockReply.code).toHaveBeenCalledWith(200);
        });
    });
});
