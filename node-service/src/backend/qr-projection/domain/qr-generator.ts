import { randomBytes } from 'crypto';
import type { QRPayload, QRPayloadV1, QRPayloadEnvelope } from './models';
import { SessionId } from './session-id';
import { CryptoService } from '../../../shared/infrastructure/crypto';

/**
 * Domain service: Generación de payloads QR
 * Responsabilidad: Generar el mensaje/payload que será codificado en QR
 * 
 * Nota: El renderizado visual del QR se realiza en el frontend para reducir
 * carga del servidor y mejorar escalabilidad
 */
export class QRGenerator {
  private roundCounters: Map<string, number> = new Map();
  private readonly cryptoService: CryptoService;

  /**
   * Constructor
   * @param cryptoService - Servicio de criptografía (opcional, usa mock si no se provee)
   */
  constructor(cryptoService?: CryptoService) {
    this.cryptoService = cryptoService ?? new CryptoService();
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
    const encrypted = this.cryptoService.encryptToPayload(plaintext);
    return encrypted.encrypted;
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
   * @param options - Opciones de generación
   * @returns Payload y string encriptado
   */
  generateForStudent(options: {
    sessionId: string;
    userId: number;
    round: number;
    hostUserId: number;
  }): { payload: QRPayloadV1; encrypted: string } {
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

  /**
   * Genera payload sin encriptar (para debug/testing)
   * @param sessionId - ID de la sesión
   * @param userId - ID del usuario anfitrión
   * @returns Envelope con payload en texto plano
   */
  generateV1Unencrypted(sessionId: SessionId, userId: number): QRPayloadEnvelope {
    const payload = this.buildPayloadV1(sessionId, userId);
    return {
      payload,
      payloadString: this.toQRString(payload),
      sessionId,
    };
  }

  /**
   * @deprecated Usar generateV1 en su lugar
   * Mantenido por compatibilidad - será removido en Fase 3
   */
  private generateUniqueMessage(sessionId: SessionId): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `ASISTENCIA:${sessionId.toString()}:${timestamp}:${random}`;
  }

  /**
   * @deprecated Usar generateV1 en su lugar
   * Mantenido por compatibilidad - será removido en Fase 3
   */
  generate(sessionId: SessionId): QRPayload {
    const message = this.generateUniqueMessage(sessionId);

    return {
      message,
      timestamp: Date.now(),
      sessionId,
    };
  }
}
