/**
 * Domain models para Enrollment (FIDO2/WebAuthn)
 */

// Re-export Device entity
export type { Device, CreateDeviceDto, UpdateCounterDto } from './entities/device.entity';

// ============================================================================
// State Machine Types
// ============================================================================

/**
 * Estados del automata de Enrollment
 * 
 * Transiciones validas:
 * - not_enrolled -> pending (startEnrollment)
 * - pending -> enrolled (finishEnrollment OK)
 * - pending -> not_enrolled (TTL expira)
 * - enrolled -> revoked (revoke manual o auto-1:1)
 * - enrolled -> pending (re-enrollment)
 * - revoked -> pending (nuevo enrollment)
 */
export type EnrollmentState = 'not_enrolled' | 'pending' | 'enrolled' | 'revoked';

/**
 * Constantes de estados para uso en comparaciones
 */
export const ENROLLMENT_STATES = {
  NOT_ENROLLED: 'not_enrolled' as const,
  PENDING: 'pending' as const,
  ENROLLED: 'enrolled' as const,
  REVOKED: 'revoked' as const,
};

// ============================================================================
// WebAuthn Types
// ============================================================================

export interface WebAuthnOptions {
  rp: RelyingParty;
  user: UserInfo;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  authenticatorSelection: AuthenticatorSelectionCriteria;
  attestation: AttestationType;
  timeout: number;
}

export interface RelyingParty {
  name: string;
  id: string;
}

export interface UserInfo {
  id: string;
  name: string;
  displayName: string;
}

export interface PublicKeyCredentialParameters {
  type: 'public-key';
  alg: number;
}

export interface AuthenticatorSelectionCriteria {
  authenticatorAttachment: 'platform' | 'cross-platform';
  userVerification: 'required' | 'preferred' | 'discouraged';
  residentKey: 'required' | 'preferred' | 'discouraged';
}

export type AttestationType = 'none' | 'indirect' | 'direct';

export interface EnrollmentChallenge {
  readonly challenge: string;
  readonly userId: number;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface ECDHKeyPair {
  readonly publicKey: string;
  readonly privateKey: Buffer;
}
