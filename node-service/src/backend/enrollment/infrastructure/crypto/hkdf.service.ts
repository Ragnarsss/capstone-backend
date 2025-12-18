import { createHmac, hkdf as nodeHkdf } from 'node:crypto';
import { config } from '../../../../shared/config';

/**
 * Servicio de derivación de claves usando HKDF (RFC 5869)
 * Responsabilidad única: Derivar claves criptográficas seguras
 * 
 * Usos principales:
 * - handshake_secret: derivado de credentialId + userId + masterSecret
 * - session_key: derivado de shared_secret ECDH
 */
export class HkdfService {
  private readonly algorithm = 'sha256';
  private readonly masterSecret: Buffer;

  constructor(masterSecret?: string) {
    const secret = masterSecret || config.crypto.masterSecret;
    this.masterSecret = Buffer.from(secret, 'utf-8');
  }

  /**
   * Deriva handshake_secret para un dispositivo enrolado
   * Este secret se almacena en la DB y se usa para generar TOTPu
   * 
   * @param credentialId - ID único de la credencial FIDO2 (Base64)
   * @param userId - ID del usuario
   * @returns Buffer de 32 bytes (handshake_secret)
   */
  async deriveHandshakeSecret(credentialId: string, userId: number): Promise<Buffer> {
    // IKM: concatenación de credentialId + userId + masterSecret
    const ikm = Buffer.concat([
      Buffer.from(credentialId, 'base64'),
      Buffer.from(String(userId), 'utf-8'),
      this.masterSecret,
    ]);

    const info = Buffer.from('attendance-handshake-v1', 'utf-8');
    const salt = Buffer.alloc(0); // Salt vacío según spec

    return await this.hkdf(ikm, salt, info, 32);
  }

  /**
   * Deriva session_key a partir del shared_secret ECDH
   * Esta clave es efímera y se usa para encriptar comunicación
   * 
   * La session_key está vinculada al dispositivo específico mediante credentialId
   * en el info string de HKDF, previniendo replay attacks con shared_secret robado.
   * 
   * @param sharedSecret - Resultado del key exchange ECDH
   * @param credentialId - ID único de la credencial FIDO2 (Base64) para binding
   * @returns Buffer de 32 bytes (session_key)
   */
  async deriveSessionKey(sharedSecret: Buffer, credentialId: string): Promise<Buffer> {
    // Info incluye credentialId para vincular session_key al dispositivo específico
    const info = Buffer.from('attendance-session-key-v1:' + credentialId, 'utf-8');
    const salt = Buffer.alloc(0);

    return await this.hkdf(sharedSecret, salt, info, 32);
  }

  /**
   * Deriva una clave genérica con contexto personalizado
   * 
   * @param ikm - Input Key Material
   * @param context - Contexto único para esta derivación
   * @param length - Longitud de la clave derivada (default: 32)
   * @returns Buffer con la clave derivada
   */
  async deriveKey(ikm: Buffer, context: string, length: number = 32): Promise<Buffer> {
    const info = Buffer.from(context, 'utf-8');
    const salt = Buffer.alloc(0);

    return await this.hkdf(ikm, salt, info, length);
  }

  /**
   * Implementación de HKDF usando Node.js crypto
   * Wrapper sobre la función nativa hkdf
   */
  private hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      nodeHkdf(
        this.algorithm,
        ikm,
        salt,
        info,
        length,
        (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(Buffer.from(derivedKey));
          }
        }
      );
    });
  }

  /**
   * Genera TOTP de 6 dígitos a partir de un secret
   * Implementación simplificada para TOTPu y TOTPs
   * 
   * @param secret - Secret para TOTP (handshake_secret u otro)
   * @param timeStep - Período TOTP en segundos (default: 30)
   * @returns String de 6 dígitos
   */
  generateTotp(secret: Buffer, timeStep: number = 30): string {
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = createHmac('sha256', secret);
    hmac.update(counterBuffer);
    const hash = hmac.digest();

    // Dynamic truncation (RFC 4226)
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * Valida un TOTP con ventana de tolerancia
   * 
   * @param secret - Secret usado para generar el TOTP
   * @param totp - Valor TOTP a validar
   * @param window - Ventana de tolerancia (default: 1 = ±30s)
   * @returns true si el TOTP es válido
   */
  validateTotp(secret: Buffer, totp: string, window: number = 1): boolean {
    const timeStep = 30;
    const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

    for (let i = -window; i <= window; i++) {
      const counter = currentCounter + i;
      const counterBuffer = Buffer.alloc(8);
      counterBuffer.writeBigInt64BE(BigInt(counter));

      const hmac = createHmac('sha256', secret);
      hmac.update(counterBuffer);
      const hash = hmac.digest();

      const offset = hash[hash.length - 1] & 0x0f;
      const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

      const expectedOtp = (binary % 1000000).toString().padStart(6, '0');

      if (expectedOtp === totp) {
        return true;
      }
    }

    return false;
  }
}
