import { randomBytes } from 'crypto';
import { type QRPayloadV1, isQRPayloadV1 } from '../../../../shared/types';

/**
 * Input para construir un payload de estudiante
 */
export interface StudentPayloadInput {
  readonly sessionId: string;
  readonly studentId: number;
  readonly roundNumber: number;
  readonly timestamp?: number;
  readonly nonce?: string;
}

/**
 * Input para construir un payload falso (honeypot)
 */
export interface FakePayloadInput {
  readonly sessionId: string;
  readonly roundNumber: number;
  readonly timestamp?: number;
  readonly nonce?: string;
}

/**
 * PayloadBuilder - Domain Service
 * 
 * Responsabilidad ÚNICA: Construir objetos QRPayloadV1
 * 
 * Características:
 * - Funciones PURAS (sin side effects)
 * - Sin estado interno (stateless)
 * - Sin dependencias de infraestructura
 * - Testeable de forma aislada
 * 
 * @example
 * ```typescript
 * const payload = PayloadBuilder.buildStudentPayload({
 *   sessionId: 'abc123',
 *   hostUserId: 42,
 *   roundNumber: 1
 * });
 * ```
 */
export class PayloadBuilder {
  /**
   * Genera un nonce criptográfico de 16 bytes
   * @returns Nonce en formato hexadecimal (32 caracteres)
   */
  static generateNonce(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Construye un payload para un estudiante real
   * 
   * @param input - Datos necesarios para el payload
   * @returns QRPayloadV1 listo para encriptar
   */
  static buildStudentPayload(input: StudentPayloadInput): QRPayloadV1 {
    return {
      v: 1,
      sid: input.sessionId,
      uid: input.studentId,
      r: input.roundNumber,
      ts: input.timestamp ?? Date.now(),
      n: input.nonce ?? PayloadBuilder.generateNonce(),
    };
  }

  /**
   * Construye un payload falso (honeypot)
   * 
   * Los payloads falsos usan uid = 0 para identificarlos internamente,
   * pero una vez encriptados con clave aleatoria son indistinguibles.
   * 
   * @param input - Datos para el payload falso
   * @returns QRPayloadV1 marcado como falso (uid=0)
   */
  static buildFakePayload(input: FakePayloadInput): QRPayloadV1 {
    return {
      v: 1,
      sid: input.sessionId,
      uid: 0, // Marca interna de payload falso
      r: input.roundNumber,
      ts: input.timestamp ?? Date.now(),
      n: input.nonce ?? PayloadBuilder.generateNonce(),
    };
  }

  /**
   * Valida que un payload tenga estructura correcta
   * 
   * @deprecated Usar isQRPayloadV1 de shared/types directamente
   * @param payload - Objeto a validar
   * @returns true si es un QRPayloadV1 válido
   */
  static isValidPayload(payload: unknown): payload is QRPayloadV1 {
    return isQRPayloadV1(payload);
  }

  /**
   * Serializa un payload a JSON string
   * 
   * @param payload - Payload a serializar
   * @returns String JSON del payload
   */
  static toJsonString(payload: QRPayloadV1): string {
    return JSON.stringify(payload);
  }

  /**
   * Deserializa un JSON string a payload
   * 
   * @param json - String JSON a parsear
   * @returns QRPayloadV1 o null si es inválido
   */
  static fromJsonString(json: string): QRPayloadV1 | null {
    try {
      const parsed = JSON.parse(json);
      if (PayloadBuilder.isValidPayload(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
}
