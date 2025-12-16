/**
 * Unit Tests: AccessGatewayService
 *
 * Tests para el servicio que agrega estado de todos los dominios
 * Delega enrollment a EnrollmentFlowOrchestrator (SoC)
 * Basado en spec-architecture.md seccion "Access Gateway"
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessGatewayService } from '../application/services/access-gateway.service';
import { EnrollmentFlowOrchestrator, AccessResult } from '../../enrollment/application/orchestrators';
import type { ISessionQuery, IRestrictionQuery } from '../../shared/ports';
import type { Device } from '../../enrollment/domain/entities';

describe('AccessGatewayService', () => {
  let service: AccessGatewayService;
  let mockOrchestrator: EnrollmentFlowOrchestrator;
  let mockSessionQuery: ISessionQuery;
  let mockRestrictionQuery: IRestrictionQuery;

  beforeEach(() => {
    // Mock del orchestrator de enrollment
    mockOrchestrator = {
      attemptAccess: vi.fn(),
    } as unknown as EnrollmentFlowOrchestrator;

    // Mocks de queries de otros dominios
    mockSessionQuery = {
      hasActiveSession: vi.fn(),
    };

    mockRestrictionQuery = {
      isBlocked: vi.fn(),
    };

    service = new AccessGatewayService(
      mockOrchestrator,
      mockSessionQuery,
      mockRestrictionQuery
    );
  });

  describe('getState', () => {
    const deviceFingerprint = 'abc123def456';

    it('returns BLOCKED when user has active restrictions', async () => {
      // Arrange
      const userId = 100;
      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: true,
        reason: 'User suspended until 2025-01-15',
      });

      // Act
      const state = await service.getState(userId, deviceFingerprint);

      // Assert
      expect(state.state).toBe('BLOCKED');
      expect(state.action).toBeNull();
      expect(state.message).toBe('User suspended until 2025-01-15');
      expect(state.device).toBeUndefined();

      // Verify restriction check was called first (before orchestrator)
      expect(mockRestrictionQuery.isBlocked).toHaveBeenCalledWith(userId);
      // Orchestrator should not be called when blocked
      expect(mockOrchestrator.attemptAccess).not.toHaveBeenCalled();
    });

    it('returns NOT_ENROLLED when user has no active device (REQUIRES_ENROLLMENT)', async () => {
      // Arrange
      const userId = 200;
      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
        result: AccessResult.REQUIRES_ENROLLMENT,
        enrollmentInfo: {
          isEnrolled: false,
          hasRevokedDevices: false,
        },
      });

      // Act
      const state = await service.getState(userId, deviceFingerprint);

      // Assert
      expect(state.state).toBe('NOT_ENROLLED');
      expect(state.action).toBe('enroll');
      expect(state.device).toBeUndefined();
      expect(state.message).toBeUndefined();

      // Verify delegation to orchestrator
      expect(mockRestrictionQuery.isBlocked).toHaveBeenCalledWith(userId);
      expect(mockOrchestrator.attemptAccess).toHaveBeenCalledWith(userId, deviceFingerprint);
      // Session query should not be called when enrollment required
      expect(mockSessionQuery.hasActiveSession).not.toHaveBeenCalled();
    });

    it('returns NOT_ENROLLED with message when user violates 1:1 policy (REQUIRES_REENROLLMENT)', async () => {
      // Arrange
      const userId = 250;
      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
        result: AccessResult.REQUIRES_REENROLLMENT,
        enrollmentInfo: {
          isEnrolled: true,
          hasRevokedDevices: true,
        },
      });

      // Act
      const state = await service.getState(userId, deviceFingerprint);

      // Assert
      expect(state.state).toBe('NOT_ENROLLED');
      expect(state.action).toBe('enroll');
      expect(state.device).toBeUndefined();
      expect(state.message).toBeTruthy();
      expect(state.message).toContain('Re-enrolement');

      // Verify orchestrator detected 1:1 violation
      expect(mockOrchestrator.attemptAccess).toHaveBeenCalledWith(userId, deviceFingerprint);
    });

    it('returns ENROLLED_NO_SESSION when user has device but no session (ACCESS_GRANTED)', async () => {
      // Arrange
      const userId = 300;
      const mockDevice: Device = {
        credentialId: 'abc123',
        deviceId: 1,
      } as Device;

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
        result: AccessResult.ACCESS_GRANTED,
        device: mockDevice,
        enrollmentInfo: {
          isEnrolled: true,
          hasRevokedDevices: false,
        },
      });
      vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(false);

      // Act
      const state = await service.getState(userId, deviceFingerprint);

      // Assert
      expect(state.state).toBe('ENROLLED_NO_SESSION');
      expect(state.action).toBe('login');
      expect(state.device).toEqual({
        credentialId: 'abc123',
        deviceId: 1,
      });
      expect(state.message).toBeUndefined();

      // Verify all checks were performed in order
      expect(mockRestrictionQuery.isBlocked).toHaveBeenCalledWith(userId);
      expect(mockOrchestrator.attemptAccess).toHaveBeenCalledWith(userId, deviceFingerprint);
      expect(mockSessionQuery.hasActiveSession).toHaveBeenCalledWith(userId);
    });

    it('returns READY when user has active session (ACCESS_GRANTED + session)', async () => {
      // Arrange
      const userId = 400;
      const mockDevice: Device = {
        credentialId: 'xyz789',
        deviceId: 2,
      } as Device;

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
        result: AccessResult.ACCESS_GRANTED,
        device: mockDevice,
        enrollmentInfo: {
          isEnrolled: true,
          hasRevokedDevices: false,
        },
      });
      vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(true);

      // Act
      const state = await service.getState(userId, deviceFingerprint);

      // Assert
      expect(state.state).toBe('READY');
      expect(state.action).toBe('scan');
      expect(state.device).toEqual({
        credentialId: 'xyz789',
        deviceId: 2,
      });
      expect(state.message).toBeUndefined();

      // Verify all checks were performed
      expect(mockRestrictionQuery.isBlocked).toHaveBeenCalledWith(userId);
      expect(mockOrchestrator.attemptAccess).toHaveBeenCalledWith(userId, deviceFingerprint);
      expect(mockSessionQuery.hasActiveSession).toHaveBeenCalledWith(userId);
    });

    it('passes deviceFingerprint to orchestrator for 1:1 validation', async () => {
      // Arrange
      const userId = 500;
      const customFingerprint = 'fingerprint-from-client-device';

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
        result: AccessResult.REQUIRES_ENROLLMENT,
        enrollmentInfo: {
          isEnrolled: false,
          hasRevokedDevices: false,
        },
      });

      // Act
      await service.getState(userId, customFingerprint);

      // Assert: Verify deviceFingerprint was passed to orchestrator
      expect(mockOrchestrator.attemptAccess).toHaveBeenCalledWith(userId, customFingerprint);
    });

    it('includes device info when ACCESS_GRANTED', async () => {
      // Arrange
      const userId = 550;
      const mockDevice: Device = {
        credentialId: 'device-cred-555',
        deviceId: 99,
      } as Device;

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
        result: AccessResult.ACCESS_GRANTED,
        device: mockDevice,
        enrollmentInfo: {
          isEnrolled: true,
          hasRevokedDevices: false,
        },
      });
      vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(false);

      // Act
      const state = await service.getState(userId, deviceFingerprint);

      // Assert
      expect(state.device).toBeDefined();
      expect(state.device?.credentialId).toBe('device-cred-555');
      expect(state.device?.deviceId).toBe(99);
    });

    it('does not include message when state is not BLOCKED', async () => {
      // Arrange
      const userId = 600;

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
        result: AccessResult.REQUIRES_ENROLLMENT,
        enrollmentInfo: {
          isEnrolled: false,
          hasRevokedDevices: false,
        },
      });

      // Act
      const state = await service.getState(userId, deviceFingerprint);

      // Assert: Message should be undefined for NOT_ENROLLED state
      expect(state.message).toBeUndefined();
    });
  });

  describe('idempotence', () => {
    it('returns same result for same user state', async () => {
      // Arrange
      const userId = 700;
      const testFingerprint = 'idempotence-test-fingerprint';

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockOrchestrator.attemptAccess).mockResolvedValue({
        result: AccessResult.REQUIRES_ENROLLMENT,
        enrollmentInfo: {
          isEnrolled: false,
          hasRevokedDevices: false,
        },
      });

      // Act: Call twice with same parameters
      const state1 = await service.getState(userId, testFingerprint);
      const state2 = await service.getState(userId, testFingerprint);

      // Assert: Results should be identical (idempotent operation)
      expect(state1).toEqual(state2);
    });
  });
});
