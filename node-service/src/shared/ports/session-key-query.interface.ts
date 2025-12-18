/**
 * Interface para consultar session_key
 *
 * Permite que el dominio de attendance consulte session_key
 * sin acoplarse directamente a session/infrastructure/.
 *
 * Sigue el patrón de Ports & Adapters (Arquitectura Hexagonal).
 */

/**
 * Datos de una session_key almacenada
 */
export interface SessionKeyData {
  sessionKey: Buffer;
  userId: number;
  deviceId: number;
  createdAt: number;
}

/**
 * Puerto para consultar session_key de un usuario
 */
export interface ISessionKeyQuery {
  /**
   * Busca la session_key activa de un usuario
   * @param userId ID del usuario
   * @returns Datos de session_key o null si no existe
   */
  findByUserId(userId: number): Promise<SessionKeyData | null>;
}
