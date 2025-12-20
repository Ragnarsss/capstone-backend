import type { ITotpValidator } from '../../../../shared/ports';
import type { DeviceRepository } from '../repositories/device.repository';
import type { HkdfService } from '../crypto/hkdf.service';

/**
 * Adapter para validación TOTP
 * 
 * Implementa ITotpValidator usando:
 * - DeviceRepository: para obtener handshake_secret del dispositivo activo
 * - HkdfService: para validar TOTP con implementación RFC 4226
 * 
 * Este adapter encapsula toda la lógica de obtención del secret y validación,
 * exponiendo una interfaz simple al consumidor (attendance pipeline).
 */
export class TotpValidatorAdapter implements ITotpValidator {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly hkdfService: HkdfService,
  ) {}

  /**
   * Valida un TOTP para un usuario dado
   * 
   * 1. Busca el dispositivo activo del usuario
   * 2. Obtiene el handshake_secret almacenado
   * 3. Valida el TOTP con ventana de ±30s
   * 
   * @param userId - ID del usuario
   * @param totp - Valor TOTP de 6 dígitos
   * @returns true si válido, false si no hay dispositivo o TOTP inválido
   */
  async validate(userId: number, totp: string): Promise<boolean> {
    // Obtener dispositivos activos del usuario
    const devices = await this.deviceRepository.findByUserId(userId);

    if (devices.length === 0) {
      return false;
    }

    // Usar el dispositivo más reciente (primero en el array ordenado por enrolled_at DESC)
    const device = devices[0];

    // Convertir handshake_secret de Base64 a Buffer
    const handshakeSecret = Buffer.from(device.handshakeSecret, 'base64');

    // Validar TOTP con ventana de tolerancia (±1 step = ±30s)
    return this.hkdfService.validateTotp(handshakeSecret, totp);
  }
}
