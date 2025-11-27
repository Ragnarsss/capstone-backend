import type { QRPayloadV1 } from '../../qr-projection/domain/models';
import type { ValidatePayloadResult, AttendanceRecord } from '../domain/models';
import { CryptoService } from '../../../shared/infrastructure/crypto';
import { QRPayloadRepository } from '../../qr-projection/infrastructure/qr-payload.repository';

/**
 * Application Service para validación de asistencia
 * 
 * Responsabilidad: Orquestar el proceso de validación de payloads escaneados
 * 
 * Flujo:
 * 1. Recibir payload encriptado del estudiante
 * 2. Desencriptar con session_key (mock por ahora)
 * 3. Validar contra Valkey (existe, no consumido)
 * 4. Marcar como consumido
 * 5. Retornar resultado
 */
export class AttendanceValidationService {
  private readonly cryptoService: CryptoService;
  private readonly payloadRepository: QRPayloadRepository;

  constructor(
    cryptoService?: CryptoService,
    payloadRepository?: QRPayloadRepository
  ) {
    this.cryptoService = cryptoService ?? new CryptoService();
    this.payloadRepository = payloadRepository ?? new QRPayloadRepository();
  }

  /**
   * Valida un payload encriptado escaneado por un estudiante
   * 
   * @param encrypted - Payload encriptado (formato iv.ciphertext.authTag)
   * @param studentId - ID del estudiante que escanea
   * @returns Resultado de validación
   */
  async validateScannedPayload(
    encrypted: string,
    studentId: number
  ): Promise<ValidatePayloadResult> {
    const validatedAt = Date.now();

    // 1. Verificar formato del payload encriptado
    if (!this.cryptoService.isValidPayloadFormat(encrypted)) {
      return {
        valid: false,
        reason: 'Formato de payload inválido',
        errorCode: 'INVALID_FORMAT',
      };
    }

    // 2. Desencriptar payload
    let payload: QRPayloadV1;
    try {
      const decrypted = this.cryptoService.decryptFromPayload(encrypted);
      payload = JSON.parse(decrypted) as QRPayloadV1;
    } catch (error) {
      console.error('[AttendanceValidation] Error desencriptando:', error);
      return {
        valid: false,
        reason: 'No se pudo desencriptar el payload',
        errorCode: 'DECRYPTION_FAILED',
      };
    }

    // 3. Validar estructura del payload
    if (!this.isValidPayloadStructure(payload)) {
      return {
        valid: false,
        reason: 'Estructura de payload inválida',
        errorCode: 'INVALID_FORMAT',
      };
    }

    // 4. Validar contra Valkey
    const validationResult = await this.payloadRepository.validate(payload);
    
    if (!validationResult.valid) {
      return {
        valid: false,
        reason: this.mapReasonToMessage(validationResult.reason),
        errorCode: this.mapReasonToCode(validationResult.reason),
      };
    }

    // 5. Marcar como consumido
    const consumed = await this.payloadRepository.markAsConsumed(payload.n, studentId);
    
    if (!consumed) {
      return {
        valid: false,
        reason: 'No se pudo registrar el escaneo',
        errorCode: 'INTERNAL_ERROR',
      };
    }

    // 6. Éxito
    console.log(`[AttendanceValidation] Payload válido: student=${studentId}, session=${payload.sid}, round=${payload.r}`);
    
    return {
      valid: true,
      payload,
      validatedAt,
    };
  }

  /**
   * Crea un registro de asistencia a partir de una validación exitosa
   */
  createAttendanceRecord(
    payload: QRPayloadV1,
    studentId: number,
    scannedAt: number
  ): AttendanceRecord {
    return {
      studentId,
      sessionId: payload.sid,
      hostUserId: payload.uid,
      round: payload.r,
      scannedAt,
      nonce: payload.n,
    };
  }

  /**
   * Valida la estructura básica del payload desencriptado
   */
  private isValidPayloadStructure(payload: unknown): payload is QRPayloadV1 {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const p = payload as Record<string, unknown>;

    return (
      p.v === 1 &&
      typeof p.sid === 'string' &&
      typeof p.uid === 'number' &&
      typeof p.r === 'number' &&
      typeof p.ts === 'number' &&
      typeof p.n === 'string' &&
      p.n.length === 32 // Nonce debe ser 32 caracteres hex (16 bytes)
    );
  }

  /**
   * Mapea razón técnica a mensaje amigable
   */
  private mapReasonToMessage(reason?: string): string {
    switch (reason) {
      case 'PAYLOAD_NOT_FOUND_OR_EXPIRED':
        return 'El código QR ha expirado o no es válido';
      case 'PAYLOAD_ALREADY_CONSUMED':
        return 'Este código QR ya fue escaneado';
      case 'SESSION_ID_MISMATCH':
      case 'USER_ID_MISMATCH':
      case 'ROUND_MISMATCH':
      case 'TIMESTAMP_MISMATCH':
        return 'El código QR no coincide con la sesión activa';
      default:
        return 'Error de validación desconocido';
    }
  }

  /**
   * Mapea razón técnica a código de error
   */
  private mapReasonToCode(reason?: string): ValidatePayloadResult['errorCode'] {
    switch (reason) {
      case 'PAYLOAD_NOT_FOUND_OR_EXPIRED':
        return 'PAYLOAD_EXPIRED';
      case 'PAYLOAD_ALREADY_CONSUMED':
        return 'PAYLOAD_ALREADY_CONSUMED';
      case 'SESSION_ID_MISMATCH':
        return 'SESSION_MISMATCH';
      case 'USER_ID_MISMATCH':
        return 'USER_MISMATCH';
      case 'TIMESTAMP_MISMATCH':
        return 'TIMESTAMP_MISMATCH';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
