/**
 * Interface read-only para consultar dispositivos
 * Utilizada por el Access Gateway para verificar enrollment sin acoplar dominios
 */
export interface IDeviceQuery {
  /**
   * Obtiene el dispositivo activo de un usuario
   * @param userId - ID del usuario
   * @returns Dispositivo activo o null si no tiene dispositivo
   */
  getActiveDevice(userId: number): Promise<{
    credentialId: string;
    deviceId: number;
  } | null>;
}
