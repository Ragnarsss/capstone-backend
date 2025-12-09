/**
 * Tipos compartidos para QR Payloads
 * 
 * Estos tipos son utilizados por múltiples módulos:
 * - qr-projection: genera y proyecta QRs
 * - attendance: valida y procesa escaneos
 * 
 * Mover estos tipos a shared/ evita acoplamiento directo entre módulos.
 */

/**
 * Payload V1 - Estructura preparada para encriptación
 * Formato JSON que será encriptado con AES-256-GCM
 * 
 * @property v - Versión del protocolo (1 para esta estructura)
 * @property sid - Session ID de proyección
 * @property uid - User ID del estudiante (dueño del QR)
 * @property r - Número de ronda (contador incremental por estudiante)
 * @property ts - Timestamp Unix en milisegundos (momento de generación)
 * @property n - Nonce criptográfico (16 bytes hex = 32 caracteres)
 */
export interface QRPayloadV1 {
  readonly v: 1;
  readonly sid: string;
  readonly uid: number;
  readonly r: number;
  readonly ts: number;
  readonly n: string;
}

/**
 * Type guard para validar estructura de QRPayloadV1
 * 
 * Validaciones:
 * - v === 1 (versión del protocolo)
 * - sid: string no vacío
 * - uid: entero >= 0 (0 = fake, > 0 = estudiante real)
 * - r: entero >= 1 (rounds empiezan en 1)
 * - ts: número > 0 (timestamp Unix en ms)
 * - n: string de 32 caracteres (16 bytes hex)
 * 
 * @example
 * ```typescript
 * const data = JSON.parse(decrypted);
 * if (isQRPayloadV1(data)) {
 *   // data es QRPayloadV1
 * }
 * ```
 */
export function isQRPayloadV1(obj: unknown): obj is QRPayloadV1 {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const p = obj as Record<string, unknown>;

  return (
    p.v === 1 &&
    typeof p.sid === 'string' &&
    p.sid.length > 0 &&
    typeof p.uid === 'number' &&
    Number.isInteger(p.uid) &&
    p.uid >= 0 && // 0 = fake, > 0 = real
    typeof p.r === 'number' &&
    Number.isInteger(p.r) &&
    p.r >= 1 && // rounds empiezan en 1
    typeof p.ts === 'number' &&
    p.ts > 0 &&
    typeof p.n === 'string' &&
    p.n.length === 32 // 16 bytes hex = 32 chars
  );
}

/**
 * Versión del protocolo de payload soportada
 */
export const PAYLOAD_VERSION = 1 as const;

/**
 * Longitud esperada del nonce en caracteres hex
 */
export const NONCE_LENGTH = 32;
