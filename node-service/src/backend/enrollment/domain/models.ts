/**
 * Domain models para Enrollment (FIDO2/WebAuthn)
 */

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
 * Estados del automata de Session
 * Subordinado a Enrollment: solo permite transiciones si enrollment === 'enrolled'
 * 
 * Transiciones validas:
 * - no_session -> session_active (loginEcdh)
 * - session_active -> session_expired (TTL 2h)
 * - session_expired -> no_session (auto-cleanup)
 */
export type SessionState = 'no_session' | 'session_active' | 'session_expired';

/**
 * Constantes de estados para uso en comparaciones
 */
export const ENROLLMENT_STATES = {
  NOT_ENROLLED: 'not_enrolled' as const,
  PENDING: 'pending' as const,
  ENROLLED: 'enrolled' as const,
  REVOKED: 'revoked' as const,
};

export const SESSION_STATES = {
  NO_SESSION: 'no_session' as const,
  SESSION_ACTIVE: 'session_active' as const,
  SESSION_EXPIRED: 'session_expired' as const,
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

export interface SessionKey {
  readonly sessionKey: Buffer;
  readonly userId: number;
  readonly deviceId: number;
  readonly createdAt: number;
}

export interface ECDHKeyPair {
  readonly publicKey: string;
  readonly privateKey: Buffer;
}
