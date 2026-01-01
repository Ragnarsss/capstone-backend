/**
 * Unit Tests: FinishEnrollmentController
 *
 * Tests del controller HTTP POST /api/enrollment/finish
 * Responsabilidad: Orquestar revocación automática 1:1 + invocar use case
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinishEnrollmentController } from '../finish-enrollment.controller';
import type { FinishEnrollmentUseCase } from '../../../application/use-cases';
import type { OneToOnePolicyService } from '../../../domain/services';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';

describe('FinishEnrollmentController', () => {
    let controller: FinishEnrollmentController;
    let mockUseCase: FinishEnrollmentUseCase;
    let mockPolicyService: OneToOnePolicyService;
    let mockRequest: FastifyRequest;
    let mockReply: FastifyReply;

    const testCredential: RegistrationResponseJSON = {
        id: 'test-credential-id-123',
        rawId: 'test-credential-id-123',
        type: 'public-key',
        response: {
            clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0',
            attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVikSZYN5YgO',
            transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock del use case
        mockUseCase = {
            execute: vi.fn(),
        } as any;

        // Mock del policy service
        mockPolicyService = {
            revokeViolations: vi.fn(),
        } as any;

        // Mock de Fastify Request
        mockRequest = {
            user: {
                userId: { toNumber: () => 123 },
                username: 'test@ucn.cl',
                nombreCompleto: 'Usuario Test',
            },
            body: {
                credential: testCredential,
                deviceFingerprint: 'test-fingerprint-abc123',
            },
        } as any;

        // Mock de Fastify Reply
        mockReply = {
            code: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        } as any;

        controller = new FinishEnrollmentController(mockUseCase, mockPolicyService);
    });

    describe('handle() - Casos exitosos', () => {
        it('Debe finalizar enrollment exitosamente sin revocaciones', async () => {
            // Arrange
            const mockOutput = {
                deviceId: 456,
                credentialId: 'test-credential-id-123',
                aaguid: '00000000-0000-0000-0000-000000000000',
                success: true,
            };

            mockPolicyService.revokeViolations = vi.fn().mockResolvedValue({
                previousUserUnlinked: null,
                ownDevicesRevoked: 0,
            });
            mockUseCase.execute = vi.fn().mockResolvedValue(mockOutput);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            // Verificar que se ejecutó revocación
            expect(mockPolicyService.revokeViolations).toHaveBeenCalledWith(
                123,
                'test-fingerprint-abc123'
            );

            // Verificar que se invocó el use case
            expect(mockUseCase.execute).toHaveBeenCalledWith({
                userId: 123,
                credential: testCredential,
                deviceFingerprint: 'test-fingerprint-abc123',
            });

            // Verificar respuesta 201
            expect(mockReply.code).toHaveBeenCalledWith(201);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: true,
                device: {
                    deviceId: 456,
                    credentialId: 'test-credential-id-123',
                    aaguid: '00000000-0000-0000-0000-000000000000',
                },
                message: 'Dispositivo enrolado exitosamente',
            });
        });

        it('Debe finalizar enrollment CON revocación de usuario previo', async () => {
            // Arrange
            const mockOutput = {
                deviceId: 789,
                credentialId: 'new-credential-id',
                aaguid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                success: true,
            };

            // Mock: Se revocó dispositivo de otro usuario
            mockPolicyService.revokeViolations = vi.fn().mockResolvedValue({
                previousUserUnlinked: {
                    userId: 999, // Usuario anterior desenrolado
                    deviceId: 111,
                },
                ownDevicesRevoked: 0,
            });
            mockUseCase.execute = vi.fn().mockResolvedValue(mockOutput);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockPolicyService.revokeViolations).toHaveBeenCalled();
            expect(mockUseCase.execute).toHaveBeenCalled();
            expect(mockReply.code).toHaveBeenCalledWith(201);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: true,
                device: {
                    deviceId: 789,
                    credentialId: 'new-credential-id',
                    aaguid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                },
                message: 'Dispositivo enrolado exitosamente',
            });
        });

        it('Debe finalizar enrollment CON revocación de propios dispositivos', async () => {
            // Arrange
            const mockOutput = {
                deviceId: 555,
                credentialId: 'replacement-credential',
                aaguid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                success: true,
            };

            // Mock: Se revocaron 2 dispositivos propios
            mockPolicyService.revokeViolations = vi.fn().mockResolvedValue({
                previousUserUnlinked: null,
                ownDevicesRevoked: 2, // Revocó 2 dispositivos antiguos
            });
            mockUseCase.execute = vi.fn().mockResolvedValue(mockOutput);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockPolicyService.revokeViolations).toHaveBeenCalled();
            expect(mockUseCase.execute).toHaveBeenCalled();
            expect(mockReply.code).toHaveBeenCalledWith(201);
        });

        it('Debe continuar enrollment aunque falle la revocación (best-effort)', async () => {
            // Arrange
            const mockOutput = {
                deviceId: 888,
                credentialId: 'credential-despite-revoke-error',
                aaguid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                success: true,
            };

            // Mock: revocación lanza error
            mockPolicyService.revokeViolations = vi.fn().mockRejectedValue(
                new Error('Database error during revocation')
            );
            mockUseCase.execute = vi.fn().mockResolvedValue(mockOutput);

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            // Debe continuar con enrollment a pesar del error
            expect(mockUseCase.execute).toHaveBeenCalled();
            expect(mockReply.code).toHaveBeenCalledWith(201);
            expect(mockReply.send).toHaveBeenCalledWith({
                success: true,
                device: {
                    deviceId: 888,
                    credentialId: 'credential-despite-revoke-error',
                    aaguid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                },
                message: 'Dispositivo enrolado exitosamente',
            });
        });
    });

    describe('handle() - Validaciones de request', () => {
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

            // Verificar que NO se invocaron servicios
            expect(mockPolicyService.revokeViolations).not.toHaveBeenCalled();
            expect(mockUseCase.execute).not.toHaveBeenCalled();
        });

        it('Debe retornar 400 si falta credential', async () => {
            // Arrange
            mockRequest.body = {
                credential: undefined as any,
                deviceFingerprint: 'test-fingerprint',
            };

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INVALID_REQUEST',
                message: 'credential y deviceFingerprint son requeridos',
            });

            expect(mockPolicyService.revokeViolations).not.toHaveBeenCalled();
            expect(mockUseCase.execute).not.toHaveBeenCalled();
        });

        it('Debe retornar 400 si falta deviceFingerprint', async () => {
            // Arrange
            mockRequest.body = {
                credential: testCredential,
                deviceFingerprint: undefined as any,
            };

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INVALID_REQUEST',
                message: 'credential y deviceFingerprint son requeridos',
            });

            expect(mockPolicyService.revokeViolations).not.toHaveBeenCalled();
            expect(mockUseCase.execute).not.toHaveBeenCalled();
        });

        it('Debe retornar 400 si faltan ambos campos', async () => {
            // Arrange
            mockRequest.body = {
                credential: null as any,
                deviceFingerprint: null as any,
            };

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INVALID_REQUEST',
                message: 'credential y deviceFingerprint son requeridos',
            });
        });
    });

    describe('handle() - Manejo de errores del use case', () => {
        beforeEach(() => {
            // Mock: Revocación sin problemas para aislar errores del use case
            mockPolicyService.revokeViolations = vi.fn().mockResolvedValue({
                previousUserUnlinked: null,
                ownDevicesRevoked: 0,
            });
        });

        it('Debe retornar 400 para CHALLENGE_NOT_FOUND', async () => {
            // Arrange
            mockUseCase.execute = vi.fn().mockRejectedValue(
                new Error('CHALLENGE_NOT_FOUND: No se encontró challenge para este usuario')
            );

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'CHALLENGE_NOT_FOUND',
                message: 'No se encontró un challenge activo. Inicia el proceso nuevamente.',
            });
        });

        it('Debe retornar 400 para CHALLENGE_EXPIRED', async () => {
            // Arrange
            mockUseCase.execute = vi.fn().mockRejectedValue(
                new Error('CHALLENGE_EXPIRED: El challenge ha expirado')
            );

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'CHALLENGE_EXPIRED',
                message: 'El challenge ha expirado. Inicia el proceso nuevamente.',
            });
        });

        it('Debe retornar 400 para VERIFICATION_FAILED', async () => {
            // Arrange
            mockUseCase.execute = vi.fn().mockRejectedValue(
                new Error('VERIFICATION_FAILED: Invalid attestation format')
            );

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(400);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'VERIFICATION_FAILED',
                message: 'La verificación de la credencial falló',
                details: 'Invalid attestation format',
            });
        });

        it('Debe retornar 409 para CREDENTIAL_ALREADY_EXISTS', async () => {
            // Arrange
            mockUseCase.execute = vi.fn().mockRejectedValue(
                new Error('CREDENTIAL_ALREADY_EXISTS: Este dispositivo ya está enrolado')
            );

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(409);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'CREDENTIAL_ALREADY_EXISTS',
                message: 'Este dispositivo ya está enrolado',
            });
        });

        it('Debe retornar 403 para AAGUID_NOT_AUTHORIZED', async () => {
            // Arrange
            mockUseCase.execute = vi.fn().mockRejectedValue(
                new Error('AAGUID_NOT_AUTHORIZED: AAGUID no está en la whitelist')
            );

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(403);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'AAGUID_NOT_AUTHORIZED',
                message: 'Este tipo de autenticador no está autorizado para enrollment',
                details: 'AAGUID no está en la whitelist',
            });
        });

        it('Debe retornar 500 para errores genéricos', async () => {
            // Arrange
            mockUseCase.execute = vi.fn().mockRejectedValue(
                new Error('Database connection timeout')
            );

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al completar enrollment',
            });
        });

        it('Debe manejar errores que no son instancias de Error', async () => {
            // Arrange
            mockUseCase.execute = vi.fn().mockRejectedValue({
                code: 'UNEXPECTED_ERROR',
                detail: 'Something went wrong',
            });

            // Act
            await controller.handle(mockRequest, mockReply);

            // Assert
            expect(mockReply.code).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al completar enrollment',
            });
        });
    });
});
