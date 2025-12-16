/**
 * Unit Tests: OneToOnePolicyService
 *
 * Tests 1:1 enrollment policy enforcement:
 * - 1 user = max 1 device
 * - 1 device = max 1 user
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OneToOnePolicyService,
  type IDeviceRepositoryForPolicy,
} from '../one-to-one-policy.service';
import type { Device } from '../../entities';
import { ENROLLMENT_STATES } from '../../models';

/**
 * Factory to create mock devices
 */
function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    deviceId: 1,
    userId: 100,
    credentialId: 'cred-abc123',
    publicKey: 'pk-base64',
    handshakeSecret: 'hs-base64',
    aaguid: 'aaguid-123',
    deviceFingerprint: 'fp-hash',
    attestationFormat: 'packed',
    signCount: 0,
    enrolledAt: new Date(),
    lastUsedAt: null,
    isActive: true,
    status: ENROLLMENT_STATES.ENROLLED,
    transports: ['internal'],
    ...overrides,
  };
}

/**
 * Factory to create mock repository
 */
function createMockRepository(): IDeviceRepositoryForPolicy {
  return {
    findByCredentialIdIncludingInactive: vi.fn().mockResolvedValue(null),
    findActiveByDeviceFingerprint: vi.fn().mockResolvedValue([]),
    findByUserId: vi.fn().mockResolvedValue([]),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAllByUserId: vi.fn().mockResolvedValue(0),
  };
}

describe('OneToOnePolicyService', () => {
  let service: OneToOnePolicyService;
  let mockRepo: IDeviceRepositoryForPolicy;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new OneToOnePolicyService(mockRepo);
  });

  describe('validate', () => {
    describe('compliant scenarios (no violations)', () => {
      it('returns compliant when no existing devices', async () => {
        const result = await service.validate(100, 'new-credential');

        expect(result.compliant).toBe(true);
        expect(result.violations).toBeUndefined();
      });

      it('returns compliant when device exists but is inactive', async () => {
        const inactiveDevice = createMockDevice({
          isActive: false,
          userId: 200, // different user
        });
        vi.mocked(mockRepo.findByCredentialIdIncludingInactive).mockResolvedValue(inactiveDevice);

        const result = await service.validate(100, 'cred-abc123');

        expect(result.compliant).toBe(true);
        expect(result.violations).toBeUndefined();
      });

      it('returns compliant when device is active for same user (re-validation)', async () => {
        const sameUserDevice = createMockDevice({
          userId: 100,
          isActive: true,
        });
        vi.mocked(mockRepo.findByCredentialIdIncludingInactive).mockResolvedValue(sameUserDevice);
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([sameUserDevice]);

        const result = await service.validate(100, 'cred-abc123');

        // No violations because device belongs to same user
        expect(result.compliant).toBe(true);
      });
    });

    describe('device conflict (device enrolled by another user)', () => {
      it('detects device conflict when device is active for different user', async () => {
        const otherUserDevice = createMockDevice({
          userId: 200, // different user
          isActive: true,
          credentialId: 'cred-conflict',
        });
        vi.mocked(mockRepo.findByCredentialIdIncludingInactive).mockResolvedValue(otherUserDevice);

        const result = await service.validate(100, 'cred-conflict');

        expect(result.compliant).toBe(false);
        expect(result.violations?.deviceConflict).toEqual({
          userId: 200,
          credentialId: 'cred-conflict',
        });
      });
    });

    describe('user conflict (user has other devices)', () => {
      it('detects user conflict when user has other active devices', async () => {
        const existingDevice = createMockDevice({
          deviceId: 1,
          userId: 100,
          credentialId: 'old-credential',
        });
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([existingDevice]);

        const result = await service.validate(100, 'new-credential');

        expect(result.compliant).toBe(false);
        expect(result.violations?.userConflict).toEqual({
          deviceIds: [1],
        });
      });

      it('detects multiple device conflict', async () => {
        const devices = [
          createMockDevice({ deviceId: 1, credentialId: 'old-1' }),
          createMockDevice({ deviceId: 2, credentialId: 'old-2' }),
        ];
        vi.mocked(mockRepo.findByUserId).mockResolvedValue(devices);

        const result = await service.validate(100, 'new-credential');

        expect(result.compliant).toBe(false);
        expect(result.violations?.userConflict?.deviceIds).toHaveLength(2);
        expect(result.violations?.userConflict?.deviceIds).toContain(1);
        expect(result.violations?.userConflict?.deviceIds).toContain(2);
      });
    });

    describe('combined conflicts', () => {
      it('detects both device and user conflicts simultaneously', async () => {
        // Device owned by another user
        const otherUserDevice = createMockDevice({
          userId: 200,
          isActive: true,
          credentialId: 'shared-device',
        });
        vi.mocked(mockRepo.findByCredentialIdIncludingInactive).mockResolvedValue(otherUserDevice);

        // User has another device
        const userExistingDevice = createMockDevice({
          deviceId: 5,
          userId: 100,
          credentialId: 'old-device',
        });
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([userExistingDevice]);

        const result = await service.validate(100, 'shared-device');

        expect(result.compliant).toBe(false);
        expect(result.violations?.deviceConflict).toBeDefined();
        expect(result.violations?.userConflict).toBeDefined();
      });
    });
  });

  describe('revokeViolations', () => {
    it('returns empty result when no violations exist', async () => {
      vi.mocked(mockRepo.findActiveByDeviceFingerprint).mockResolvedValue([]);
      vi.mocked(mockRepo.revokeAllByUserId).mockResolvedValue(0);

      const result = await service.revokeViolations(100, 'new-fingerprint');

      expect(result.previousUserUnlinked).toBeUndefined();
      expect(result.ownDevicesRevoked).toBe(0);
    });

    it('revokes device from other user (device conflict by fingerprint)', async () => {
      const otherUserDevice = createMockDevice({
        deviceId: 10,
        userId: 200,
        isActive: true,
        deviceFingerprint: 'shared-fingerprint',
      });
      vi.mocked(mockRepo.findActiveByDeviceFingerprint).mockResolvedValue([otherUserDevice]);
      vi.mocked(mockRepo.revokeAllByUserId).mockResolvedValue(0);

      const result = await service.revokeViolations(100, 'shared-fingerprint');

      expect(mockRepo.revoke).toHaveBeenCalledWith(
        10,
        'Auto-revoked: Device re-enrolled by user 100 (1:1 policy)'
      );
      expect(result.previousUserUnlinked).toEqual({
        userId: 200,
        reason: 'Device re-enrolled by another user',
      });
    });

    it('does not revoke when no other user has same fingerprint', async () => {
      // Same user has a device with same fingerprint - not a conflict
      const sameUserDevice = createMockDevice({
        userId: 100,
        isActive: true,
        deviceFingerprint: 'same-fingerprint',
      });
      vi.mocked(mockRepo.findActiveByDeviceFingerprint).mockResolvedValue([sameUserDevice]);
      vi.mocked(mockRepo.revokeAllByUserId).mockResolvedValue(0);

      const result = await service.revokeViolations(100, 'same-fingerprint');

      expect(mockRepo.revoke).not.toHaveBeenCalled();
      expect(result.previousUserUnlinked).toBeUndefined();
    });

    it('revokes all user existing devices (user conflict)', async () => {
      vi.mocked(mockRepo.findActiveByDeviceFingerprint).mockResolvedValue([]);
      vi.mocked(mockRepo.revokeAllByUserId).mockResolvedValue(3);

      const result = await service.revokeViolations(100, 'new-fingerprint');

      expect(mockRepo.revokeAllByUserId).toHaveBeenCalledWith(
        100,
        'Auto-revoked: New device enrolled (1:1 policy)'
      );
      expect(result.ownDevicesRevoked).toBe(3);
    });

    it('handles both conflicts in correct order', async () => {
      const otherUserDevice = createMockDevice({
        deviceId: 10,
        userId: 200,
        isActive: true,
        deviceFingerprint: 'shared-fingerprint',
      });
      vi.mocked(mockRepo.findActiveByDeviceFingerprint).mockResolvedValue([otherUserDevice]);
      vi.mocked(mockRepo.revokeAllByUserId).mockResolvedValue(2);

      const result = await service.revokeViolations(100, 'shared-fingerprint');

      // Both operations should execute
      expect(mockRepo.revoke).toHaveBeenCalled();
      expect(mockRepo.revokeAllByUserId).toHaveBeenCalled();
      expect(result.previousUserUnlinked?.userId).toBe(200);
      expect(result.ownDevicesRevoked).toBe(2);
    });
  });

  describe('isDuplicateEnrollment', () => {
    it('returns true when device is active for same user', async () => {
      const sameUserDevice = createMockDevice({
        userId: 100,
        isActive: true,
      });
      vi.mocked(mockRepo.findByCredentialIdIncludingInactive).mockResolvedValue(sameUserDevice);

      const result = await service.isDuplicateEnrollment(100, 'cred-abc123');

      expect(result).toBe(true);
    });

    it('returns false when device is inactive for same user', async () => {
      const inactiveDevice = createMockDevice({
        userId: 100,
        isActive: false,
      });
      vi.mocked(mockRepo.findByCredentialIdIncludingInactive).mockResolvedValue(inactiveDevice);

      const result = await service.isDuplicateEnrollment(100, 'cred-abc123');

      expect(result).toBe(false);
    });

    it('returns false when device is active for different user', async () => {
      const otherUserDevice = createMockDevice({
        userId: 200,
        isActive: true,
      });
      vi.mocked(mockRepo.findByCredentialIdIncludingInactive).mockResolvedValue(otherUserDevice);

      const result = await service.isDuplicateEnrollment(100, 'cred-abc123');

      expect(result).toBe(false);
    });

    it('returns false when device does not exist', async () => {
      vi.mocked(mockRepo.findByCredentialIdIncludingInactive).mockResolvedValue(null);

      const result = await service.isDuplicateEnrollment(100, 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('workflow: validate -> revokeViolations for re-enrollment', async () => {
      // User 100 has an old device, trying to enroll a new one
      const oldDevice = createMockDevice({
        deviceId: 1,
        userId: 100,
        credentialId: 'old-device',
        deviceFingerprint: 'old-fingerprint',
      });
      vi.mocked(mockRepo.findByUserId).mockResolvedValue([oldDevice]);
      vi.mocked(mockRepo.findActiveByDeviceFingerprint).mockResolvedValue([]);
      vi.mocked(mockRepo.revokeAllByUserId).mockResolvedValue(1);

      // Step 1: Validate (uses credentialId)
      const validation = await service.validate(100, 'new-device');
      expect(validation.compliant).toBe(false);
      expect(validation.violations?.userConflict?.deviceIds).toContain(1);

      // Step 2: Revoke violations (uses deviceFingerprint)
      const revoke = await service.revokeViolations(100, 'new-fingerprint');
      expect(revoke.ownDevicesRevoked).toBe(1);
    });

    it('workflow: device takeover from another user by fingerprint', async () => {
      // Device currently enrolled by user 200, user 100 wants to take it
      // Now detected by deviceFingerprint instead of credentialId
      const existingDevice = createMockDevice({
        deviceId: 10,
        userId: 200,
        isActive: true,
        deviceFingerprint: 'shared-fingerprint',
      });
      vi.mocked(mockRepo.findActiveByDeviceFingerprint).mockResolvedValue([existingDevice]);
      vi.mocked(mockRepo.revokeAllByUserId).mockResolvedValue(0);

      // Revoke violations - detects same physical device by fingerprint
      const revoke = await service.revokeViolations(100, 'shared-fingerprint');
      expect(revoke.previousUserUnlinked?.userId).toBe(200);
    });
  });
});
