/**
 * Domain models para Enrollment (FIDO2/WebAuthn)
 */

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
