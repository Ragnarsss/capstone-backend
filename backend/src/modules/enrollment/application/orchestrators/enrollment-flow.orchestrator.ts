/**
 * EnrollmentFlowOrchestrator
 *
 * Orchestrates the enrollment flow as described in flujo-automata-enrolamiento.md:
 *
 * [*] --> CheckEnrolado
 * CheckEnrolado --> ProcesoEnrolamiento: No está enrolado
 * CheckEnrolado --> EvaluarUnoAUno: Sí está enrolado
 * EvaluarUnoAUno --> ProcesoEnrolamiento: No cumple uno-a-uno (requiere reenrolamiento)
 * EvaluarUnoAUno --> Acceso: Cumple uno-a-uno
 *
 * SoC: This orchestrator ONLY coordinates the flow.
 * - It uses DeviceRepository to check enrollment status
 * - It uses OneToOnePolicyService to evaluate 1:1 compliance
 * - It does NOT handle FIDO2 verification, HKDF derivation, or persistence
 */

import type { Device } from '../../domain/entities';
import {
  OneToOnePolicyService,
  type PolicyValidationResult,
} from '../../domain/services';

/**
 * Result codes for attemptAccess
 */
export enum AccessResult {
  /** User is enrolled and 1:1 compliant - can proceed to session */
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  /** User is not enrolled - needs first-time enrollment */
  REQUIRES_ENROLLMENT = 'REQUIRES_ENROLLMENT',
  /** User is enrolled but 1:1 violated - needs re-enrollment */
  REQUIRES_REENROLLMENT = 'REQUIRES_REENROLLMENT',
}

/**
 * Output from attemptAccess
 */
export interface AttemptAccessOutput {
  result: AccessResult;
  /** Active device if enrolled */
  device?: Device;
  /** Policy violations if re-enrollment required */
  policyViolations?: PolicyValidationResult['violations'];
  /** Enrollment state info */
  enrollmentInfo: {
    isEnrolled: boolean;
    hasRevokedDevices: boolean;
  };
}

/**
 * Consent response for enrollment process
 */
export enum ConsentResponse {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

/**
 * Output from processEnrollmentConsent
 */
export interface ProcessConsentOutput {
  /** Whether enrollment should proceed */
  shouldProceed: boolean;
  /** If proceeding, devices that will be revoked */
  devicesToRevoke?: number[];
  /** If rejected, reason */
  rejectionReason?: string;
}

/**
 * Interface for device repository operations needed by orchestrator
 */
export interface IDeviceRepositoryForOrchestrator {
  findByUserId(userId: number): Promise<Device[]>;
  findByUserIdIncludingInactive(userId: number): Promise<Device[]>;
}

/**
 * Interface for policy service
 */
export interface IPolicyServiceForOrchestrator {
  validate(userId: number, credentialId: string): Promise<PolicyValidationResult>;
}

/**
 * EnrollmentFlowOrchestrator
 *
 * Coordinates the enrollment access flow.
 */
export class EnrollmentFlowOrchestrator {
  constructor(
    private readonly deviceRepository: IDeviceRepositoryForOrchestrator,
    private readonly policyService: IPolicyServiceForOrchestrator
  ) {}

  /**
   * Intenta acceso para un usuario - punto de entrada principal
   *
   * Flujo:
   * 1. CheckEnrolado: Verifica si usuario tiene dispositivo activo enrolado
   * 2. Si no enrolado: retornar REQUIRES_ENROLLMENT
   * 3. Si enrolado: EvaluarUnoAUno (evaluar politica 1:1)
   * 4. Si cumple 1:1: retornar ACCESS_GRANTED
   * 5. Si viola 1:1: retornar REQUIRES_REENROLLMENT
   *
   * @param userId - Usuario intentando acceso
   * @param deviceFingerprint - Huella del dispositivo actual
   * @returns AttemptAccessOutput con resultado y contexto
   */
  async attemptAccess(userId: number, deviceFingerprint: string): Promise<AttemptAccessOutput> {
    // 1. CheckEnrolado: Obtener dispositivos activos del usuario
    const activeDevices = await this.deviceRepository.findByUserId(userId);
    const allDevices = await this.deviceRepository.findByUserIdIncludingInactive(userId);

    const hasActiveDevice = activeDevices.length > 0;
    const hasRevokedDevices = allDevices.some(d => !d.isActive);

    const enrollmentInfo = {
      isEnrolled: hasActiveDevice,
      hasRevokedDevices,
    };

    // 2. If not enrolled: return REQUIRES_ENROLLMENT
    if (!hasActiveDevice) {
      return {
        result: AccessResult.REQUIRES_ENROLLMENT,
        enrollmentInfo,
      };
    }

    // User is enrolled - get the active device
    const device = activeDevices[0];

    // 3. EvaluarUnoAUno: Validate 1:1 policy
    // Check if current device fingerprint matches enrolled device
    const fingerprintMatches = device.deviceFingerprint === deviceFingerprint;

    if (!fingerprintMatches) {
      // Device fingerprint doesn't match - possible new device
      // This is a policy violation (user trying to use different device)
      return {
        result: AccessResult.REQUIRES_REENROLLMENT,
        device,
        enrollmentInfo,
        policyViolations: {
          userConflict: { deviceIds: [device.deviceId] },
        },
      };
    }

    // 4. Validate that user has only one device (1:1 policy)
    if (activeDevices.length > 1) {
      // Multiple active devices - shouldn't happen but handle it
      return {
        result: AccessResult.REQUIRES_REENROLLMENT,
        device,
        enrollmentInfo,
        policyViolations: {
          userConflict: { deviceIds: activeDevices.map(d => d.deviceId) },
        },
      };
    }

    // 5. All checks passed: ACCESS_GRANTED
    return {
      result: AccessResult.ACCESS_GRANTED,
      device,
      enrollmentInfo,
    };
  }

  /**
   * Processes user consent for enrollment
   *
   * Flow (ProcesoEnrolamiento):
   * 1. SolicitarConsent: Check consent response
   * 2. If rejected: return shouldProceed=false
   * 3. If accepted: identify devices to revoke and return shouldProceed=true
   *
   * @param userId - User performing enrollment
   * @param consent - User's consent response
   * @returns ProcessConsentOutput with next steps
   */
  async processEnrollmentConsent(
    userId: number,
    consent: ConsentResponse
  ): Promise<ProcessConsentOutput> {
    // 1. SolicitarConsent: Check consent
    if (consent === ConsentResponse.REJECTED) {
      return {
        shouldProceed: false,
        rejectionReason: 'User rejected enrollment consent',
      };
    }

    // 2. Consent accepted - identify devices to revoke
    const activeDevices = await this.deviceRepository.findByUserId(userId);
    const devicesToRevoke = activeDevices.map(d => d.deviceId);

    return {
      shouldProceed: true,
      devicesToRevoke: devicesToRevoke.length > 0 ? devicesToRevoke : undefined,
    };
  }

  /**
   * Checks if user needs enrollment or re-enrollment
   *
   * Convenience method that returns a simpler boolean result
   *
   * @param userId - User to check
   * @param deviceFingerprint - Current device fingerprint
   * @returns true if enrollment/re-enrollment is needed
   */
  async needsEnrollment(userId: number, deviceFingerprint: string): Promise<boolean> {
    const result = await this.attemptAccess(userId, deviceFingerprint);
    return result.result !== AccessResult.ACCESS_GRANTED;
  }
}
