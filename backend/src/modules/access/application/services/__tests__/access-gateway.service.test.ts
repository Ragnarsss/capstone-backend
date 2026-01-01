import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessGatewayService } from '../access-gateway.service';
import { EnrollmentFlowOrchestrator, AccessResult } from '../../../../enrollment/application/orchestrators';
import type { ISessionQuery, IRestrictionQuery } from '../../../../../shared/ports';

describe('AccessGatewayService', () => {
    let service: AccessGatewayService;
    let mockOrchestrator: EnrollmentFlowOrchestrator;
    let mockSessionQuery: ISessionQuery;
    let mockRestrictionQuery: IRestrictionQuery;

    beforeEach(() => {
        mockOrchestrator = {
            attemptAccess: vi.fn(),
        } as any;

        mockSessionQuery = {
            hasActiveSession: vi.fn(),
        } as any;

        mockRestrictionQuery = {
            isBlocked: vi.fn(),
        } as any;

        service = new AccessGatewayService(
            mockOrchestrator,
            mockSessionQuery,
            mockRestrictionQuery
        );
    });

    describe('getState() - Usuario bloqueado', () => {
        it('debería retornar BLOCKED si usuario tiene restricción', async () => {
            // Arrange
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
                blocked: true,
                reason: 'Usuario suspendido temporalmente',
            });

            // Act
            const result = await service.getState(1001, 'device-fp-123');

            // Assert
            expect(result.state).toBe('BLOCKED');
            expect(result.action).toBeNull();
            expect(result.message).toBe('Usuario suspendido temporalmente');
            expect(mockOrchestrator.attemptAccess).not.toHaveBeenCalled();
        });
    });

    describe('getState() - Usuario sin enrollment', () => {
        it('debería retornar NOT_ENROLLED si requiere enrollment', async () => {
            // Arrange
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({ blocked: false });
            vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
                result: AccessResult.REQUIRES_ENROLLMENT,
            });

            // Act
            const result = await service.getState(1001, 'device-fp-123');

            // Assert
            expect(result.state).toBe('NOT_ENROLLED');
            expect(result.action).toBe('enroll');
            expect(mockSessionQuery.hasActiveSession).not.toHaveBeenCalled();
        });

        it('debería retornar NOT_ENROLLED si requiere re-enrollment', async () => {
            // Arrange
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({ blocked: false });
            vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
                result: AccessResult.REQUIRES_REENROLLMENT,
            });

            // Act
            const result = await service.getState(1001, 'device-fp-123');

            // Assert
            expect(result.state).toBe('NOT_ENROLLED');
            expect(result.action).toBe('enroll');
            expect(result.message).toContain('Dispositivo ya esta registrado');
        });
    });

    describe('getState() - Usuario enrolled sin sesión', () => {
        it('debería retornar ENROLLED_NO_SESSION si no tiene sesión activa', async () => {
            // Arrange
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({ blocked: false });
            vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
                result: AccessResult.ACCESS_GRANTED,
                device: {
                    credentialId: 'cred-123',
                    deviceId: 456,
                },
            });
            vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(false);

            // Act
            const result = await service.getState(1001, 'device-fp-123');

            // Assert
            expect(result.state).toBe('ENROLLED_NO_SESSION');
            expect(result.action).toBe('login');
            expect(result.device).toEqual({
                credentialId: 'cred-123',
                deviceId: 456,
            });
        });

        it('debería manejar device undefined', async () => {
            // Arrange
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({ blocked: false });
            vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
                result: AccessResult.ACCESS_GRANTED,
                device: undefined,
            });
            vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(false);

            // Act
            const result = await service.getState(1001, 'device-fp-123');

            // Assert
            expect(result.state).toBe('ENROLLED_NO_SESSION');
            expect(result.action).toBe('login');
            expect(result.device).toBeUndefined();
        });
    });

    describe('getState() - Usuario READY', () => {
        it('debería retornar READY si cumple todas las condiciones', async () => {
            // Arrange
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({ blocked: false });
            vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
                result: AccessResult.ACCESS_GRANTED,
                device: {
                    credentialId: 'cred-456',
                    deviceId: 789,
                },
            });
            vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(true);

            // Act
            const result = await service.getState(1001, 'device-fp-123');

            // Assert
            expect(result.state).toBe('READY');
            expect(result.action).toBe('scan');
            expect(result.device).toEqual({
                credentialId: 'cred-456',
                deviceId: 789,
            });
        });

        it('debería verificar en orden: restricción → enrollment → sesión', async () => {
            // Arrange
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({ blocked: false });
            vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
                result: AccessResult.ACCESS_GRANTED,
            });
            vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(true);

            // Act
            await service.getState(1001, 'device-fp-123');

            // Assert
            const callOrder = [
                vi.mocked(mockRestrictionQuery.isBlocked).mock.invocationCallOrder[0],
                vi.mocked(mockOrchestrator.attemptAccess).mock.invocationCallOrder[0],
                vi.mocked(mockSessionQuery.hasActiveSession).mock.invocationCallOrder[0],
            ];
            expect(callOrder[0]).toBeLessThan(callOrder[1]);
            expect(callOrder[1]).toBeLessThan(callOrder[2]);
        });
    });

    describe('Flujo completo - Casos de borde', () => {
        it('debería pasar deviceFingerprint al orchestrator', async () => {
            // Arrange
            const deviceFp = 'unique-device-fingerprint-xyz';
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({ blocked: false });
            vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
                result: AccessResult.REQUIRES_ENROLLMENT,
            });

            // Act
            await service.getState(1001, deviceFp);

            // Assert
            expect(mockOrchestrator.attemptAccess).toHaveBeenCalledWith(1001, deviceFp);
        });

        it('debería manejar múltiples usuarios concurrentemente', async () => {
            // Arrange
            vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({ blocked: false });
            vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
                result: AccessResult.ACCESS_GRANTED,
            });
            vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(true);

            // Act
            const promises = [
                service.getState(1001, 'fp-1'),
                service.getState(1002, 'fp-2'),
                service.getState(1003, 'fp-3'),
            ];
            const results = await Promise.all(promises);

            // Assert
            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result.state).toBe('READY');
            });
        });
    });
});
