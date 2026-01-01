/**
 * Unit Tests: EnrollmentFlowOrchestrator
 *
 * Tests the enrollment access flow as described in flujo-automata-enrolamiento.md:
 * - CheckEnrolado: Check enrollment status
 * - EvaluarUnoAUno: Evaluate 1:1 policy compliance
 * - ProcesoEnrolamiento: Process enrollment consent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EnrollmentFlowOrchestrator,
  AccessResult,
  ConsentResponse,
  type IDeviceRepositoryForOrchestrator,
  type IPolicyServiceForOrchestrator,
} from '../enrollment-flow.orchestrator';
import type { Device } from '../../../domain/entities';
import { ENROLLMENT_STATES } from '../../../domain/models';

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
    deviceFingerprint: 'fp-hash-12345',
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
function createMockRepository(): IDeviceRepositoryForOrchestrator {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByUserIdIncludingInactive: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Factory to create mock policy service
 */
function createMockPolicyService(): IPolicyServiceForOrchestrator {
  return {
    validate: vi.fn().mockResolvedValue({ compliant: true }),
  };
}

describe('EnrollmentFlowOrchestrator', () => {
  let orchestrator: EnrollmentFlowOrchestrator;
  let mockRepo: IDeviceRepositoryForOrchestrator;
  let mockPolicyService: IPolicyServiceForOrchestrator;

  beforeEach(() => {
    mockRepo = createMockRepository();
    mockPolicyService = createMockPolicyService();
    orchestrator = new EnrollmentFlowOrchestrator(mockRepo, mockPolicyService);
  });

  describe('attemptAccess', () => {
    describe('CheckEnrolado: User not enrolled', () => {
      it('returns REQUIRES_ENROLLMENT when user has no active devices', async () => {
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([]);
        vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([]);

        const result = await orchestrator.attemptAccess(100, 'any-fingerprint');

        expect(result.result).toBe(AccessResult.REQUIRES_ENROLLMENT);
        expect(result.enrollmentInfo.isEnrolled).toBe(false);
        expect(result.enrollmentInfo.hasRevokedDevices).toBe(false);
        expect(result.device).toBeUndefined();
      });

      it('returns REQUIRES_ENROLLMENT with hasRevokedDevices=true when user has revoked devices', async () => {
        const revokedDevice = createMockDevice({ isActive: false });
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([]);
        vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([revokedDevice]);

        const result = await orchestrator.attemptAccess(100, 'any-fingerprint');

        expect(result.result).toBe(AccessResult.REQUIRES_ENROLLMENT);
        expect(result.enrollmentInfo.isEnrolled).toBe(false);
        expect(result.enrollmentInfo.hasRevokedDevices).toBe(true);
      });
    });

    describe('EvaluarUnoAUno: User enrolled, evaluate 1:1', () => {
      it('returns ACCESS_GRANTED when device fingerprint matches', async () => {
        const device = createMockDevice({ deviceFingerprint: 'matching-fp' });
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([device]);
        vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([device]);

        const result = await orchestrator.attemptAccess(100, 'matching-fp');

        expect(result.result).toBe(AccessResult.ACCESS_GRANTED);
        expect(result.device).toBe(device);
        expect(result.policyViolations).toBeUndefined();
      });

      it('returns REQUIRES_REENROLLMENT when device fingerprint does not match', async () => {
        const device = createMockDevice({ deviceFingerprint: 'old-fp' });
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([device]);
        vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([device]);

        const result = await orchestrator.attemptAccess(100, 'new-fp');

        expect(result.result).toBe(AccessResult.REQUIRES_REENROLLMENT);
        expect(result.device).toBe(device);
        expect(result.policyViolations?.userConflict).toBeDefined();
        expect(result.policyViolations?.userConflict?.deviceIds).toContain(device.deviceId);
      });

      it('returns REQUIRES_REENROLLMENT when user has multiple active devices', async () => {
        const device1 = createMockDevice({ deviceId: 1, deviceFingerprint: 'fp' });
        const device2 = createMockDevice({ deviceId: 2, deviceFingerprint: 'fp' });
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([device1, device2]);
        vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([device1, device2]);

        const result = await orchestrator.attemptAccess(100, 'fp');

        expect(result.result).toBe(AccessResult.REQUIRES_REENROLLMENT);
        expect(result.policyViolations?.userConflict?.deviceIds).toHaveLength(2);
      });
    });

    describe('enrollment info accuracy', () => {
      it('correctly reports enrollment state', async () => {
        const activeDevice = createMockDevice({ isActive: true });
        const revokedDevice = createMockDevice({ deviceId: 2, isActive: false });

        vi.mocked(mockRepo.findByUserId).mockResolvedValue([activeDevice]);
        vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([activeDevice, revokedDevice]);

        const result = await orchestrator.attemptAccess(100, activeDevice.deviceFingerprint);

        expect(result.enrollmentInfo.isEnrolled).toBe(true);
        expect(result.enrollmentInfo.hasRevokedDevices).toBe(true);
      });
    });
  });

  describe('processEnrollmentConsent', () => {
    describe('consent rejected', () => {
      it('returns shouldProceed=false when consent rejected', async () => {
        const result = await orchestrator.processEnrollmentConsent(100, ConsentResponse.REJECTED);

        expect(result.shouldProceed).toBe(false);
        expect(result.rejectionReason).toBe('User rejected enrollment consent');
        expect(result.devicesToRevoke).toBeUndefined();
      });
    });

    describe('consent accepted', () => {
      it('returns shouldProceed=true when consent accepted', async () => {
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([]);

        const result = await orchestrator.processEnrollmentConsent(100, ConsentResponse.ACCEPTED);

        expect(result.shouldProceed).toBe(true);
        expect(result.rejectionReason).toBeUndefined();
      });

      it('identifies devices to revoke when user has existing devices', async () => {
        const device1 = createMockDevice({ deviceId: 1 });
        const device2 = createMockDevice({ deviceId: 2 });
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([device1, device2]);

        const result = await orchestrator.processEnrollmentConsent(100, ConsentResponse.ACCEPTED);

        expect(result.shouldProceed).toBe(true);
        expect(result.devicesToRevoke).toContain(1);
        expect(result.devicesToRevoke).toContain(2);
      });

      it('returns undefined devicesToRevoke when user has no existing devices', async () => {
        vi.mocked(mockRepo.findByUserId).mockResolvedValue([]);

        const result = await orchestrator.processEnrollmentConsent(100, ConsentResponse.ACCEPTED);

        expect(result.devicesToRevoke).toBeUndefined();
      });
    });
  });

  describe('needsEnrollment', () => {
    it('returns true when user is not enrolled', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValue([]);
      vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([]);

      const result = await orchestrator.needsEnrollment(100, 'any-fp');

      expect(result).toBe(true);
    });

    it('returns true when user needs re-enrollment', async () => {
      const device = createMockDevice({ deviceFingerprint: 'old-fp' });
      vi.mocked(mockRepo.findByUserId).mockResolvedValue([device]);
      vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([device]);

      const result = await orchestrator.needsEnrollment(100, 'new-fp');

      expect(result).toBe(true);
    });

    it('returns false when user has valid access', async () => {
      const device = createMockDevice({ deviceFingerprint: 'matching-fp' });
      vi.mocked(mockRepo.findByUserId).mockResolvedValue([device]);
      vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([device]);

      const result = await orchestrator.needsEnrollment(100, 'matching-fp');

      expect(result).toBe(false);
    });
  });

  describe('workflow scenarios', () => {
    it('first-time enrollment flow', async () => {
      // Step 1: User attempts access, no enrollment
      vi.mocked(mockRepo.findByUserId).mockResolvedValue([]);
      vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([]);

      const accessResult = await orchestrator.attemptAccess(100, 'new-device-fp');
      expect(accessResult.result).toBe(AccessResult.REQUIRES_ENROLLMENT);

      // Step 2: User accepts consent
      const consentResult = await orchestrator.processEnrollmentConsent(100, ConsentResponse.ACCEPTED);
      expect(consentResult.shouldProceed).toBe(true);
      expect(consentResult.devicesToRevoke).toBeUndefined(); // No devices to revoke
    });

    it('re-enrollment flow (new device)', async () => {
      const oldDevice = createMockDevice({ deviceFingerprint: 'old-device-fp' });

      // Step 1: User attempts access with new device
      vi.mocked(mockRepo.findByUserId).mockResolvedValue([oldDevice]);
      vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([oldDevice]);

      const accessResult = await orchestrator.attemptAccess(100, 'new-device-fp');
      expect(accessResult.result).toBe(AccessResult.REQUIRES_REENROLLMENT);

      // Step 2: User accepts consent
      const consentResult = await orchestrator.processEnrollmentConsent(100, ConsentResponse.ACCEPTED);
      expect(consentResult.shouldProceed).toBe(true);
      expect(consentResult.devicesToRevoke).toContain(oldDevice.deviceId);
    });

    it('successful access flow', async () => {
      const device = createMockDevice({ deviceFingerprint: 'my-device-fp' });

      vi.mocked(mockRepo.findByUserId).mockResolvedValue([device]);
      vi.mocked(mockRepo.findByUserIdIncludingInactive).mockResolvedValue([device]);

      const result = await orchestrator.attemptAccess(100, 'my-device-fp');
      expect(result.result).toBe(AccessResult.ACCESS_GRANTED);
      expect(result.device).toBe(device);
    });

    it('consent rejection flow', async () => {
      // User is prompted for re-enrollment but rejects
      const accessResult = await orchestrator.processEnrollmentConsent(100, ConsentResponse.REJECTED);

      expect(accessResult.shouldProceed).toBe(false);
      expect(accessResult.rejectionReason).toBeDefined();
    });
  });
});
