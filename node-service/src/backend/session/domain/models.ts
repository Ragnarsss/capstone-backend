/**
 * Domain models para Session (ECDH key exchange)
 */

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
export const SESSION_STATES = {
  NO_SESSION: 'no_session' as const,
  SESSION_ACTIVE: 'session_active' as const,
  SESSION_EXPIRED: 'session_expired' as const,
};

/**
 * Session Key almacenada en Valkey
 */
export interface SessionKey {
  readonly sessionKey: Buffer;
  readonly userId: number;
  readonly deviceId: number;
  readonly createdAt: number;
}
