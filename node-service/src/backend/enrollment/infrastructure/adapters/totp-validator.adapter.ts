import type { ITotpValidator, ISessionKeyQuery } from '../../../../shared/ports';
import type { HkdfService } from '../crypto/hkdf.service';

/**
 * Adapter para validacion TOTP
 * 
 * Implementa ITotpValidator usando:
 * - ISessionKeyQuery: para obtener session_key de Valkey
 * - HkdfService: para derivar hmacKey y validar TOTP
 * 
 * Flujo segun diseno 14-decision-totp-session-key.md:
 * 1. Obtener session_key + credentialId de Valkey
 * 2. Derivar hmacKey = HKDF(session_key, 'attendance-hmac-key-v1:' + credentialId)
 * 3. Validar TOTP con hmacKey
 */
export class TotpValidatorAdapter implements ITotpValidator {
  constructor(
    private readonly sessionKeyQuery: ISessionKeyQuery,
    private readonly hkdfService: HkdfService,
  ) {}

  /**
   * Valida un TOTP para un usuario dado
   * 
   * 1. Obtiene session_key de Valkey
   * 2. Deriva hmacKey con HKDF
   * 3. Valida el TOTP con ventana de +/-30s
   * 
   * @param userId - ID del usuario
   * @param totp - Valor TOTP de 6 digitos
   * @returns true si valido, false si no hay sesion o TOTP invalido
   */
  async validate(userId: number, totp: string): Promise<boolean> {
    // 1. Obtener session_key de Valkey
    const sessionData = await this.sessionKeyQuery.findByUserId(userId);

    if (!sessionData) {
      return false;
    }

    // 2. Derivar hmacKey desde session_key (mismo algoritmo que frontend)
    const hmacKey = await this.hkdfService.deriveHmacKey(
      sessionData.sessionKey,
      sessionData.credentialId
    );

    // 3. Validar TOTP con ventana de tolerancia (+/-1 step = +/-30s)
    return this.hkdfService.validateTotp(hmacKey, totp);
  }
}
