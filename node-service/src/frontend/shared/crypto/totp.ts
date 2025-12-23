/**
 * TOTP Generation for Frontend
 * 
 * Genera TOTPu (Time-based One-Time Password) usando Web Crypto API.
 * Compatible con la implementacion backend en HkdfService.
 * 
 * Algoritmo: HMAC-SHA256 con dynamic truncation (RFC 4226/6238)
 * Time step: 30 segundos
 * Digitos: 6
 */

const TIME_STEP = 30;
const DIGITS = 6;

/**
 * Genera un TOTP de 6 digitos usando la hmacKey almacenada
 * 
 * @param hmacKey - CryptoKey de tipo HMAC-SHA256 derivada del ECDH handshake
 * @returns String de 6 digitos (ej: "123456")
 */
export async function generateTotp(hmacKey: CryptoKey): Promise<string> {
  // Calcular contador basado en tiempo actual
  const counter = Math.floor(Date.now() / 1000 / TIME_STEP);
  
  // Convertir contador a buffer de 8 bytes (Big Endian)
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  // DataView no tiene setBigInt64 en todos los navegadores, usar workaround
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);
  
  // Calcular HMAC-SHA256
  const signature = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    counterBuffer
  );
  
  const hash = new Uint8Array(signature);
  
  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  const otp = binary % 1000000;
  return otp.toString().padStart(DIGITS, '0');
}
