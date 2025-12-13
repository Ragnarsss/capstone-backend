/**
 * OneToOnePolicyService
 *
 * Enforces 1:1 policy for device enrollment:
 * - 1 user = max 1 active device
 * - 1 device = max 1 active user
 *
 * SoC: This service ONLY handles policy validation and enforcement.
 * It does NOT handle FIDO2 verification, HKDF derivation, or persistence.
 */

import type { Device } from '../entities';

/**
 * Result of policy validation
 */
export interface PolicyValidationResult {
  compliant: boolean;
  violations?: {
    /** Device is already enrolled by another user */
    deviceConflict?: { userId: number; credentialId: string };
    /** User has other active devices */
    userConflict?: { deviceIds: number[] };
  };
}

/**
 * Result of revoking policy violations
 */
export interface RevokeResult {
  /** Previous user unlinked from device (device conflict resolved) */
  previousUserUnlinked?: { userId: number; reason: string };
  /** Number of user's own devices revoked (user conflict resolved) */
  ownDevicesRevoked: number;
}

/**
 * Interface for device repository operations needed by policy service
 * This allows for dependency injection and testing with mocks
 */
export interface IDeviceRepositoryForPolicy {
  findByCredentialIdIncludingInactive(credentialId: string): Promise<Device | null>;
  findByUserId(userId: number): Promise<Device[]>;
  revoke(deviceId: number, reason: string): Promise<void>;
  revokeAllByUserId(userId: number, reason: string): Promise<number>;
}

/**
 * OneToOnePolicyService
 *
 * Validates and enforces 1:1 enrollment policy.
 */
export class OneToOnePolicyService {
  constructor(
    private readonly deviceRepository: IDeviceRepositoryForPolicy
  ) {}

  /**
   * Validates if a new enrollment would violate the 1:1 policy
   *
   * @param userId - User attempting enrollment
   * @param credentialId - Credential ID of the device being enrolled
   * @returns PolicyValidationResult with compliance status and any violations
   */
  async validate(userId: number, credentialId: string): Promise<PolicyValidationResult> {
    const violations: PolicyValidationResult['violations'] = {};

    // Check device conflict: Is this device enrolled by another user?
    const existingDevice = await this.deviceRepository.findByCredentialIdIncludingInactive(credentialId);

    if (existingDevice?.isActive && existingDevice.userId !== userId) {
      violations.deviceConflict = {
        userId: existingDevice.userId,
        credentialId: existingDevice.credentialId,
      };
    }

    // Check user conflict: Does user have other active devices?
    const userDevices = await this.deviceRepository.findByUserId(userId);
    const otherActiveDevices = userDevices.filter(d => d.credentialId !== credentialId);

    if (otherActiveDevices.length > 0) {
      violations.userConflict = {
        deviceIds: otherActiveDevices.map(d => d.deviceId),
      };
    }

    const hasViolations = Object.keys(violations).length > 0;

    return {
      compliant: !hasViolations,
      violations: hasViolations ? violations : undefined,
    };
  }

  /**
   * Revokes all policy violations to allow new enrollment
   *
   * @param userId - User performing enrollment
   * @param newCredentialId - Credential ID of new device being enrolled
   * @returns RevokeResult with details of what was revoked
   */
  async revokeViolations(userId: number, newCredentialId: string): Promise<RevokeResult> {
    let previousUserUnlinked: RevokeResult['previousUserUnlinked'];
    let ownDevicesRevoked = 0;

    // 1. Handle device conflict: Revoke if device is active for another user
    const existingDevice = await this.deviceRepository.findByCredentialIdIncludingInactive(newCredentialId);

    if (existingDevice?.isActive && existingDevice.userId !== userId) {
      await this.deviceRepository.revoke(
        existingDevice.deviceId,
        `Auto-revoked: Device re-enrolled by user ${userId} (1:1 policy)`
      );
      previousUserUnlinked = {
        userId: existingDevice.userId,
        reason: 'Device re-enrolled by another user',
      };
    }

    // 2. Handle user conflict: Revoke all user's existing devices
    ownDevicesRevoked = await this.deviceRepository.revokeAllByUserId(
      userId,
      'Auto-revoked: New device enrolled (1:1 policy)'
    );

    return {
      previousUserUnlinked,
      ownDevicesRevoked,
    };
  }

  /**
   * Checks if same device is already enrolled by same user (duplicate enrollment attempt)
   *
   * @param userId - User attempting enrollment
   * @param credentialId - Credential ID of the device
   * @returns true if device is already enrolled by this user
   */
  async isDuplicateEnrollment(userId: number, credentialId: string): Promise<boolean> {
    const existingDevice = await this.deviceRepository.findByCredentialIdIncludingInactive(credentialId);
    return existingDevice?.isActive === true && existingDevice.userId === userId;
  }
}
