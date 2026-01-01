/**
 * Interface read-only para verificar restricciones de acceso
 * Utilizada por el Access Gateway para verificar bloqueos sin acoplar dominios
 */
export interface IRestrictionQuery {
  /**
   * Verifica si el usuario tiene restricciones activas
   * @param userId - ID del usuario
   * @returns Objeto con blocked=true si tiene restricciones, false en caso contrario
   */
  isBlocked(userId: number): Promise<{
    blocked: boolean;
    reason?: string;
  }>;
}
