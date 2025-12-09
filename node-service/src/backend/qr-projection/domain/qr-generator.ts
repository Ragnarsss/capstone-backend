import { randomBytes } from 'crypto';
import type { QRPayloadV1, QRPayloadEnvelope } from './models';
import { SessionId } from './session-id';
import { AesGcmService } from '../../../shared/infrastructure/crypto';
import type { IQRGenerator, GenerateStudentQROptions, GenerateQRResult } from '../../../shared/ports';

/**
 * Domain service: Generación de payloads QR
 * Responsabilidad: Generar el mensaje/payload que será codificado en QR
 * 
 * Implementa IQRGenerator para desacoplamiento con otros módulos.
 * 
 * Nota: El renderizado visual del QR se realiza en el frontend para reducir
 * carga del servidor y mejorar escalabilidad
 */
export class QRGenerator implements IQRGenerator {
  private roundCounters: Map<string, number> = new Map();
  private readonly aesGcmService: AesGcmService;

  /**
   * Constructor
   * @param aesGcmService - Servicio de encriptación AES-GCM (opcional, usa mock si no se provee)
   */
  constructor(aesGcmService?: AesGcmService) {
    this.aesGcmService = aesGcmService ?? new AesGcmService();
  }

  /**
   * Genera un nonce criptográfico de 16 bytes
   * @returns Nonce en formato hexadecimal (32 caracteres)
   */
  generateNonce(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Obtiene y incrementa el contador de ronda para una sesión
   * @param sessionId - ID de la sesión
   * @returns Número de ronda actual (1-indexed)
   */
  private getAndIncrementRound(sessionId: SessionId): number {
    const key = sessionId.toString();
    const current = this.roundCounters.get(key) ?? 0;
    const next = current + 1;
    this.roundCounters.set(key, next);
    return next;
  }

  /**
   * Limpia el contador de rondas para una sesión
   * Llamar cuando termina la proyección
   */
  resetRoundCounter(sessionId: SessionId): void {
    this.roundCounters.delete(sessionId.toString());
  }

  /**
   * Construye el payload V1 estructurado
   * @param sessionId - ID de la sesión de proyección
   * @param userId - ID del usuario anfitrión (docente)
   * @returns Payload V1 con todos los campos
   */
  buildPayloadV1(sessionId: SessionId, userId: number): QRPayloadV1 {
    return {
      v: 1,
      sid: sessionId.toString(),
      uid: userId,
      r: this.getAndIncrementRound(sessionId),
      ts: Date.now(),
      n: this.generateNonce(),
    };
  }

  /**
   * Convierte el payload a string JSON (sin encriptar)
   * @param payload - Payload V1 estructurado
   * @returns String JSON del payload
   */
  toQRString(payload: QRPayloadV1): string {
    return JSON.stringify(payload);
  }

  /**
   * Encripta el payload usando AES-256-GCM
   * Formato de salida: iv.ciphertext.authTag (base64)
   * @param payload - Payload V1 estructurado
   * @returns String encriptado para el QR
   */
  encryptPayload(payload: QRPayloadV1): string {
    const plaintext = this.toQRString(payload);
    const encrypted = this.aesGcmService.encryptToPayload(plaintext);
    return encrypted.encrypted;
  }

  /**
   * Encripta el payload con una clave ALEATORIA (para QRs falsos)
   * 
   * El resultado tiene formato válido pero NO puede ser desencriptado
   * por nadie, ya que la clave se descarta inmediatamente.
   * 
   * @param payload - Payload V1 (contenido irrelevante, solo para tamaño similar)
   * @returns String encriptado indescifrable
   */
  encryptPayloadWithRandomKey(payload: QRPayloadV1): string {
    const plaintext = this.toQRString(payload);
    return this.aesGcmService.encryptWithRandomKey(plaintext);
  }

  /**
   * Genera payload completo con envelope (encriptado)
   * Método principal para uso en producción
   * @param sessionId - ID de la sesión
   * @param userId - ID del usuario anfitrión
   * @returns Envelope con payload encriptado
   */
  generateV1(sessionId: SessionId, userId: number): QRPayloadEnvelope {
    const payload = this.buildPayloadV1(sessionId, userId);
    return {
      payload,
      payloadString: this.encryptPayload(payload),
      sessionId,
    };
  }

  /**
   * Genera payload para un estudiante específico en un round específico
   * Usado por el módulo de attendance para generar QRs individuales
   * 
   * Implementa IQRGenerator.generateForStudent
   * 
   * @param options - Opciones de generación
   * @returns Payload y string encriptado
   */
  generateForStudent(options: GenerateStudentQROptions): GenerateQRResult {
    const payload: QRPayloadV1 = {
      v: 1,
      sid: options.sessionId,
      uid: options.hostUserId,
      r: options.round,
      ts: Date.now(),
      n: this.generateNonce(),
    };

    const encrypted = this.encryptPayload(payload);

    return { payload, encrypted };
  }
}
