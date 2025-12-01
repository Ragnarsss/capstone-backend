import type { QRPayloadV1 } from '../../qr-projection/domain/models';
import type { ValidatePayloadResult, AttendanceRecord } from '../domain/models';
import { CryptoService } from '../../../shared/infrastructure/crypto';
import { QRPayloadRepository } from '../../qr-projection/infrastructure/qr-payload.repository';
import { StudentSessionRepository } from '../infrastructure/student-session.repository';
import { ProjectionPoolRepository } from '../infrastructure/projection-pool.repository';
import { QRGenerator } from '../../qr-projection/domain/qr-generator';

/**
 * Configuración del servicio
 */
interface ValidationServiceConfig {
  qrTTL: number;
  mockHostUserId: number;
}

const DEFAULT_CONFIG: ValidationServiceConfig = {
  qrTTL: 30,
  mockHostUserId: 1,
};

/**
 * Estructura de la respuesta encriptada del estudiante
 */
interface StudentResponse {
  original: QRPayloadV1;  // Payload desencriptado del QR
  studentId: number;      // ID del alumno que escanea
  receivedAt: number;     // Timestamp de recepcion
  // TODO: totp - se agregara cuando se integre con enrollment
}

/**
 * Application Service para validación de asistencia
 * 
 * Responsabilidad: Orquestar el proceso de validación de payloads escaneados
 * 
 * Flujo:
 * 1. Recibir respuesta encriptada del estudiante
 * 2. Desencriptar con session_key (mock por ahora)
 * 3. Extraer payload original y validar estructura
 * 4. Validar contra Valkey (existe, no consumido)
 * 5. Validar round correcto para el estudiante
 * 6. TODO: Validar TOTP cuando se integre con enrollment
 * 7. Marcar como consumido y avanzar round
 * 8. Generar siguiente QR si no completo
 * 9. Retornar resultado con stats si completo
 */
export class AttendanceValidationService {
  private readonly cryptoService: CryptoService;
  private readonly payloadRepository: QRPayloadRepository;
  private readonly studentRepository: StudentSessionRepository;
  private readonly poolRepository: ProjectionPoolRepository;
  private readonly qrGenerator: QRGenerator;
  private readonly config: ValidationServiceConfig;

  constructor(
    cryptoService?: CryptoService,
    payloadRepository?: QRPayloadRepository,
    studentRepository?: StudentSessionRepository,
    poolRepository?: ProjectionPoolRepository,
    config?: Partial<ValidationServiceConfig>
  ) {
    this.cryptoService = cryptoService ?? new CryptoService();
    this.payloadRepository = payloadRepository ?? new QRPayloadRepository();
    this.studentRepository = studentRepository ?? new StudentSessionRepository();
    this.poolRepository = poolRepository ?? new ProjectionPoolRepository();
    this.qrGenerator = new QRGenerator(this.cryptoService);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Valida un payload encriptado escaneado por un estudiante
   * 
   * @param encrypted - Respuesta encriptada del estudiante (formato iv.ciphertext.authTag)
   * @param studentId - ID del estudiante que escanea (para verificacion)
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
        reason: 'Formato de payload invalido',
        errorCode: 'INVALID_FORMAT',
      };
    }

    // 2. Desencriptar respuesta del estudiante
    let studentResponse: StudentResponse;
    try {
      const decrypted = this.cryptoService.decryptFromPayload(encrypted);
      studentResponse = JSON.parse(decrypted) as StudentResponse;
    } catch (error) {
      console.error('[AttendanceValidation] Error desencriptando respuesta:', error);
      return {
        valid: false,
        reason: 'No se pudo desencriptar la respuesta',
        errorCode: 'DECRYPTION_FAILED',
      };
    }

    // 3. Validar estructura de la respuesta
    if (!this.isValidResponseStructure(studentResponse)) {
      return {
        valid: false,
        reason: 'Estructura de respuesta invalida',
        errorCode: 'INVALID_FORMAT',
      };
    }

    // 4. Verificar que el studentId coincide
    if (studentResponse.studentId !== studentId) {
      console.warn(`[AttendanceValidation] studentId mismatch: body=${studentId}, response=${studentResponse.studentId}`);
      return {
        valid: false,
        reason: 'ID de estudiante no coincide',
        errorCode: 'USER_MISMATCH',
      };
    }

    const payload = studentResponse.original;

    // 5. Validar estructura del payload original
    if (!this.isValidPayloadStructure(payload)) {
      return {
        valid: false,
        reason: 'Estructura de payload original invalida',
        errorCode: 'INVALID_FORMAT',
      };
    }

    // 6. TODO: Validar TOTP cuando se integre con enrollment
    // if (studentResponse.totp) {
    //   const validTotp = await this.validateTotp(studentId, studentResponse.totp);
    //   if (!validTotp) { return error; }
    // }

    // 7. Validar que el estudiante esta registrado y en el round correcto
    const roundValidation = await this.studentRepository.validateRoundMatch(
      payload.sid,
      studentId,
      payload.r,
      payload.n
    );

    if (!roundValidation.valid) {
      return {
        valid: false,
        reason: this.mapReasonToMessage(roundValidation.reason),
        errorCode: this.mapReasonToCode(roundValidation.reason),
      };
    }

    // 5. Validar contra Valkey (no consumido, no expirado)
    const valkeyValidation = await this.payloadRepository.validate(payload);
    
    if (!valkeyValidation.valid) {
      // Si el payload expiró, consumir un intento
      if (valkeyValidation.reason === 'PAYLOAD_NOT_FOUND_OR_EXPIRED') {
        const { canRetry } = await this.studentRepository.failRound(
          payload.sid,
          studentId,
          'QR_EXPIRED'
        );
        
        if (!canRetry) {
          return {
            valid: false,
            reason: 'Sin intentos restantes',
            errorCode: 'NO_ATTEMPTS_LEFT',
          };
        }
      }

      return {
        valid: false,
        reason: this.mapReasonToMessage(valkeyValidation.reason),
        errorCode: this.mapReasonToCode(valkeyValidation.reason),
      };
    }

    // 6. Marcar como consumido
    const consumed = await this.payloadRepository.markAsConsumed(payload.n, studentId);
    
    if (!consumed) {
      return {
        valid: false,
        reason: 'No se pudo registrar el escaneo',
        errorCode: 'INTERNAL_ERROR',
      };
    }

    // 7. Calcular Response Time
    const responseTime = validatedAt - payload.ts;

    // 8. Registrar round completado y avanzar
    const { state, isComplete } = await this.studentRepository.completeRound(
      payload.sid,
      studentId,
      {
        responseTime,
        validatedAt,
        nonce: payload.n,
      }
    );

    console.log(`[AttendanceValidation] Payload válido: student=${studentId}, session=${payload.sid}, round=${payload.r}, RT=${responseTime}ms`);

    // 9. Si completó todos los rounds, calcular estadísticas y redirigir
    if (isComplete) {
      const stats = this.calculateStats(state.roundsCompleted.map(r => r.responseTime));
      
      console.log(`[AttendanceValidation] Asistencia completada para student=${studentId}, session=${payload.sid}`);
      
      return {
        valid: true,
        payload,
        validatedAt,
        isComplete: true,
        sessionId: payload.sid,
        stats: {
          roundsCompleted: state.roundsCompleted.length,
          avgResponseTime: stats.avg,
          certainty: stats.certainty,
        },
      };
    }

    // 10. Generar QR para siguiente round
    const { payload: nextPayload, encrypted: nextEncrypted } = this.qrGenerator.generateForStudent({
      sessionId: payload.sid,
      userId: studentId,
      round: state.currentRound,
      hostUserId: this.config.mockHostUserId,
    });

    await this.payloadRepository.store(nextPayload, nextEncrypted, this.config.qrTTL);
    await this.studentRepository.setActiveQR(payload.sid, studentId, nextPayload.n);
    
    // 11. Actualizar QR en el pool de proyección
    await this.poolRepository.upsertStudentQR(payload.sid, studentId, nextEncrypted, state.currentRound);

    return {
      valid: true,
      payload,
      validatedAt,
      isComplete: false,
      nextRound: {
        round: state.currentRound,
        qrPayload: nextEncrypted,
        qrTTL: this.config.qrTTL,
      },
    };
  }

  /**
   * Calcula estadísticas de Response Time y certeza
   */
  private calculateStats(responseTimes: number[]): { avg: number; stdDev: number; certainty: number } {
    if (responseTimes.length === 0) {
      return { avg: 0, stdDev: 0, certainty: 0 };
    }

    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    const squaredDiffs = responseTimes.map(rt => Math.pow(rt - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);

    // Algoritmo de certeza basado en consistencia y rango
    let certainty = 50; // Base

    // Bonus por consistencia (baja desviación estándar)
    if (stdDev < 500) certainty += 30;
    else if (stdDev < 1000) certainty += 20;
    else if (stdDev < 2000) certainty += 10;

    // Bonus por tiempo de respuesta realista
    if (avg > 800 && avg < 3000) certainty += 20;
    else if (avg > 500 && avg < 5000) certainty += 10;
    else if (avg > 300 && avg < 8000) certainty += 5;
    // Tiempos muy rápidos o muy lentos son sospechosos
    else if (avg < 300 || avg > 15000) certainty -= 20;

    return {
      avg: Math.round(avg),
      stdDev: Math.round(stdDev),
      certainty: Math.max(0, Math.min(100, certainty)),
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
   * Valida la estructura de la respuesta del estudiante
   */
  private isValidResponseStructure(response: unknown): response is StudentResponse {
    if (!response || typeof response !== 'object') {
      return false;
    }

    const r = response as Record<string, unknown>;

    return (
      typeof r.original === 'object' &&
      r.original !== null &&
      typeof r.studentId === 'number' &&
      typeof r.receivedAt === 'number'
      // TODO: validar r.totp cuando se integre con enrollment
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
      case 'STUDENT_NOT_REGISTERED':
        return 'No estás registrado en esta sesión';
      case 'STUDENT_STATUS_COMPLETED':
        return 'Ya completaste la asistencia';
      case 'STUDENT_STATUS_FAILED':
        return 'Sin intentos restantes';
      case 'QR_NONCE_MISMATCH':
        return 'Este no es tu código QR actual';
      case 'ROUND_ALREADY_COMPLETED':
        return 'Este código es de una ronda anterior';
      case 'ROUND_NOT_REACHED':
        return 'Este código es de una ronda futura';
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
      case 'STUDENT_NOT_REGISTERED':
        return 'STUDENT_NOT_REGISTERED';
      case 'STUDENT_STATUS_COMPLETED':
      case 'STUDENT_STATUS_FAILED':
        return 'NO_ATTEMPTS_LEFT';
      case 'QR_NONCE_MISMATCH':
      case 'ROUND_ALREADY_COMPLETED':
      case 'ROUND_NOT_REACHED':
        return 'ROUND_MISMATCH';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
