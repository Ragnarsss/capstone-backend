import type { QRPayloadV1 } from '../../qr-projection/domain/models';

/**
 * Request para validar un payload QR escaneado
 */
export interface ValidatePayloadRequest {
  /** Payload encriptado (formato iv.ciphertext.authTag) */
  encrypted: string;
  /** ID del estudiante que escanea */
  studentId: number;
}

/**
 * Resultado de validación de payload
 */
export interface ValidatePayloadResult {
  /** Si el payload es válido */
  valid: boolean;
  /** Razón de error si no es válido */
  reason?: string;
  /** Código de error para el cliente */
  errorCode?: ValidationErrorCode;
  /** Payload desencriptado (solo si válido) */
  payload?: QRPayloadV1;
  /** Timestamp de validación */
  validatedAt?: number;
}

/**
 * Códigos de error de validación
 */
export type ValidationErrorCode =
  | 'INVALID_FORMAT'
  | 'DECRYPTION_FAILED'
  | 'PAYLOAD_NOT_FOUND'
  | 'PAYLOAD_EXPIRED'
  | 'PAYLOAD_ALREADY_CONSUMED'
  | 'SESSION_MISMATCH'
  | 'USER_MISMATCH'
  | 'TIMESTAMP_MISMATCH'
  | 'INTERNAL_ERROR';

/**
 * Resultado de registro de asistencia
 */
export interface AttendanceRecord {
  /** ID del estudiante */
  studentId: number;
  /** ID de la sesión de proyección */
  sessionId: string;
  /** ID del docente (anfitrión) */
  hostUserId: number;
  /** Número de ronda en que escaneó */
  round: number;
  /** Timestamp del escaneo */
  scannedAt: number;
  /** Nonce del payload usado */
  nonce: string;
}
