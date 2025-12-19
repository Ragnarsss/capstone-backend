/**
 * Puerto: IQRGenerator
 * 
 * Interface para generación de QRs.
 * Permite que attendance dependa de una abstracción en lugar de 
 * la implementación concreta en qr-projection.
 * 
 * Implementaciones:
 * - QRGenerator (qr-projection/domain) - Implementación real
 * - MockQRGenerator (tests) - Para testing
 */

import type { QRPayloadV1 } from '../types';

/**
 * Opciones para generar QR de estudiante
 */
export interface GenerateStudentQROptions {
  /** ID de la sesión de asistencia */
  readonly sessionId: string;
  /** ID del estudiante (dueño del QR) */
  readonly userId: number;
  /** Número de round (1, 2, 3...) */
  readonly round: number;
  /** ID del host/docente (para tracking) */
  readonly hostUserId: number;
}

/**
 * Resultado de generación de QR
 */
export interface GenerateQRResult {
  /** Payload estructurado (para almacenamiento) */
  readonly payload: QRPayloadV1;
  /** JSON del payload sin encriptar (para encriptación externa) */
  readonly plaintext: string;
  /** String encriptado con mock key (para decoys/fallback) */
  readonly encrypted: string;
}

/**
 * Puerto: Generador de QRs
 * 
 * Abstracción para generar códigos QR encriptados.
 * El módulo attendance usa esta interface, no la implementación concreta.
 */
export interface IQRGenerator {
  /**
   * Genera un QR para un estudiante específico
   * 
   * Retorna el payload, su plaintext y una versión encriptada con mock key.
   * El caller puede re-encriptar el plaintext con la session_key real del estudiante.
   * 
   * @param options - Opciones de generación
   * @returns Payload, plaintext y encrypted (con mock key)
   * 
   * @example
   * ```typescript
   * const { payload, plaintext, encrypted } = generator.generateForStudent({
   *   sessionId: 'session-123',
   *   userId: 42,
   *   round: 1,
   *   hostUserId: 1,
   * });
   * // Luego encriptar plaintext con session_key real si está disponible
   * ```
   */
  generateForStudent(options: GenerateStudentQROptions): GenerateQRResult;

  /**
   * Genera un nonce criptográfico
   * 
   * @returns Nonce en formato hexadecimal (32 caracteres)
   */
  generateNonce(): string;

  /**
   * Encripta un payload con clave aleatoria (para QRs falsos/honeypots)
   * 
   * El resultado tiene formato válido pero NO puede ser desencriptado
   * por nadie, ya que la clave se descarta inmediatamente.
   * 
   * @param payload - Payload a "encriptar" (contenido irrelevante)
   * @returns String encriptado indescifrable
   */
  encryptPayloadWithRandomKey(payload: QRPayloadV1): string;
}
