/**
 * Unit Tests: AccessGatewayService
 *
 * Tests para el servicio que agrega estado de todos los dominios
 * Basado en spec-enrollment.md seccion "Access Gateway"
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessGatewayService } from '../application/services/access-gateway.service';
import type { IDeviceQuery, ISessionQuery, IRestrictionQuery } from '../../shared/ports';

describe('AccessGatewayService', () => {
  let service: AccessGatewayService;
  let mockDeviceQuery: IDeviceQuery;
  let mockSessionQuery: ISessionQuery;
  let mockRestrictionQuery: IRestrictionQuery;

  beforeEach(() => {
    // Crear mocks de las queries
    mockDeviceQuery = {
      getActiveDevice: vi.fn(),
    };

    mockSessionQuery = {
      hasActiveSession: vi.fn(),
    };

    mockRestrictionQuery = {
      isBlocked: vi.fn(),
    };

    service = new AccessGatewayService(
      mockDeviceQuery,
      mockSessionQuery,
      mockRestrictionQuery
    );
  });

  describe('getState', () => {
    it('returns BLOCKED when user has active restrictions', async () => {
      // Arrange
      const userId = 100;
      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: true,
        reason: 'User suspended until 2025-01-15',
      });

      // Act
      const state = await service.getState(userId);

      // Assert
      expect(state.state).toBe('BLOCKED');
      expect(state.action).toBeNull();
      expect(state.message).toBe('User suspended until 2025-01-15');
      expect(state.device).toBeUndefined();

      // Verify restriction check was called
      expect(mockRestrictionQuery.isBlocked).toHaveBeenCalledWith(userId);
      // Device and session queries should not be called when blocked
      expect(mockDeviceQuery.getActiveDevice).not.toHaveBeenCalled();
      expect(mockSessionQuery.hasActiveSession).not.toHaveBeenCalled();
    });

    it('returns NOT_ENROLLED when user has no device', async () => {
      // Arrange
      const userId = 200;
      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockDeviceQuery.getActiveDevice).mockResolvedValue(null);

      // Act
      const state = await service.getState(userId);

      // Assert
      expect(state.state).toBe('NOT_ENROLLED');
      expect(state.action).toBe('enroll');
      expect(state.device).toBeUndefined();
      expect(state.message).toBeUndefined();

      // Verify call order
      expect(mockRestrictionQuery.isBlocked).toHaveBeenCalledWith(userId);
      expect(mockDeviceQuery.getActiveDevice).toHaveBeenCalledWith(userId);
      // Session query should not be called when no device
      expect(mockSessionQuery.hasActiveSession).not.toHaveBeenCalled();
    });

    it('returns ENROLLED_NO_SESSION when user has device but no session', async () => {
      // Arrange
      const userId = 300;
      const mockDevice = {
        credentialId: 'abc123',
        deviceId: 1,
      };

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockDeviceQuery.getActiveDevice).mockResolvedValue(mockDevice);
      vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(false);

      // Act
      const state = await service.getState(userId);

      // Assert
      expect(state.state).toBe('ENROLLED_NO_SESSION');
      expect(state.action).toBe('login');
      expect(state.device).toEqual(mockDevice);
      expect(state.message).toBeUndefined();

      // Verify all queries were called
      expect(mockRestrictionQuery.isBlocked).toHaveBeenCalledWith(userId);
      expect(mockDeviceQuery.getActiveDevice).toHaveBeenCalledWith(userId);
      expect(mockSessionQuery.hasActiveSession).toHaveBeenCalledWith(userId);
    });

    it('returns READY when user has active session', async () => {
      // Arrange
      const userId = 400;
      const mockDevice = {
        credentialId: 'xyz789',
        deviceId: 2,
      };

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockDeviceQuery.getActiveDevice).mockResolvedValue(mockDevice);
      vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(true);

      // Act
      const state = await service.getState(userId);

      // Assert
      expect(state.state).toBe('READY');
      expect(state.action).toBe('scan');
      expect(state.device).toEqual(mockDevice);
      expect(state.message).toBeUndefined();

      // Verify all queries were called in order
      expect(mockRestrictionQuery.isBlocked).toHaveBeenCalledWith(userId);
      expect(mockDeviceQuery.getActiveDevice).toHaveBeenCalledWith(userId);
      expect(mockSessionQuery.hasActiveSession).toHaveBeenCalledWith(userId);
    });

    it('includes device info in response when device exists', async () => {
      // Arrange
      const userId = 500;
      const mockDevice = {
        credentialId: 'device-credential-123',
        deviceId: 42,
      };

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockDeviceQuery.getActiveDevice).mockResolvedValue(mockDevice);
      vi.mocked(mockSessionQuery.hasActiveSession).mockResolvedValue(false);

      // Act
      const state = await service.getState(userId);

      // Assert
      expect(state.device).toBeDefined();
      expect(state.device?.credentialId).toBe('device-credential-123');
      expect(state.device?.deviceId).toBe(42);
    });

    it('includes message only when BLOCKED', async () => {
      // Arrange
      const userId = 600;

      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: true,
        reason: 'Account suspended',
      });

      // Act
      const state = await service.getState(userId);

      // Assert
      expect(state.message).toBe('Account suspended');

      // Now test other states have no message
      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockDeviceQuery.getActiveDevice).mockResolvedValue(null);

      const stateNotEnrolled = await service.getState(userId);
      expect(stateNotEnrolled.message).toBeUndefined();
    });
  });

  describe('idempotence', () => {
    it('returns same result for same user state', async () => {
      // Arrange
      const userId = 700;
      vi.mocked(mockRestrictionQuery.isBlocked).mockResolvedValue({
        blocked: false,
      });
      vi.mocked(mockDeviceQuery.getActiveDevice).mockResolvedValue(null);

      // Act
      const state1 = await service.getState(userId);
      const state2 = await service.getState(userId);

      // Assert
      expect(state1).toEqual(state2);
    });
  });
});
