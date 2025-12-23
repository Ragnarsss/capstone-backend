/**
 * Port de validación TOTP
 * 
 * Abstracción para validar TOTP (Time-based One-Time Password) sin exponer
 * detalles de implementación criptográfica al consumidor.
 * 
 * La implementación concreta (TotpValidatorAdapter) usa:
 * - DeviceRepository para obtener handshake_secret del dispositivo
 * - HkdfService.validateTotp() para validación RFC 4226
 * 
 * @module shared/ports
 */

/**
 * Interface de validación TOTP
 * 
 * Permite validar un TOTP de 6 dígitos contra el handshake_secret
 * del dispositivo enrolado del usuario.
 */
export interface ITotpValidator {
  /**
   * Valida un TOTP para un usuario dado
   * 
   * @param userId - ID del usuario cuyo dispositivo se usará para validar
   * @param totp - Valor TOTP de 6 dígitos a validar
   * @returns Promise<boolean> - true si el TOTP es válido, false si no
   * 
   * @example
   * const isValid = await totpValidator.validate(123, '456789');
   * if (!isValid) {
   *   throw new Error('TOTP inválido');
   * }
   */
  validate(userId: number, totp: string): Promise<boolean>;
}
