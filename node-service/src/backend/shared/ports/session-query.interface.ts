/**
 * Interface read-only para verificar sesion activa
 * Utilizada por el Access Gateway para verificar estado de sesion sin acoplar dominios
 */
export interface ISessionQuery {
  /**
   * Verifica si el usuario tiene una sesion activa
   * @param userId - ID del usuario
   * @returns true si tiene session_key activa, false en caso contrario
   */
  hasActiveSession(userId: number): Promise<boolean>;
}
