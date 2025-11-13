import { UserId } from './user-id';

/**
 * Domain models para Authentication
 */

export interface JWTPayload {
  userId: number;
  username: string;
  nombreCompleto?: string;
  rol?: string;
  iat?: number;  // Issued at
  exp?: number;  // Expiration
  iss?: string;  // Issuer
  aud?: string;  // Audience
}

export interface AuthenticatedUser {
  readonly userId: UserId;
  readonly username: string;
  readonly nombreCompleto?: string;
  readonly rol?: string;
}
