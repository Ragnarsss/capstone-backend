import type { QRPayloadV1 } from '../../qr-projection/domain/models';

/**
 * Request para registrar participación en sesión
 */
export interface RegisterParticipationRequest {
  /** ID de la sesión de asistencia */
  sessionId: string;
  /** ID del estudiante */
  studentId: number;
}

/**
 * Resultado de registro de participación
 */
export interface RegisterParticipationResult {
  /** Si el registro fue exitoso */
  success: boolean;
  /** Razón de error si falló */
  reason?: string;
  /** Código de error */
  errorCode?: string;
  /** Datos del registro exitoso */
  data?: {
    /** Round actual */
    currentRound: number;
    /** Total de rounds requeridos */
    totalRounds: number;
    /** Intento actual */
    currentAttempt: number;
    /** Total de intentos permitidos */
    maxAttempts: number;
    /** Payload encriptado del QR generado */
    qrPayload: string;
    /** TTL del QR en segundos */
    qrTTL: number;
  };
}

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
  /** Si completó todos los rounds */
  isComplete?: boolean;
  /** ID de la sesión (para notificar al parent cuando completa) */
  sessionId?: string;
  /** Datos del siguiente round (si no completó) */
  nextRound?: {
    round: number;
    qrPayload: string;
    qrTTL: number;
  };
  /** Estadísticas finales (si completó) */
  stats?: {
    roundsCompleted: number;
    avgResponseTime: number;
    certainty: number;
  };
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
  | 'ROUND_MISMATCH'
  | 'STUDENT_NOT_REGISTERED'
  | 'NO_ATTEMPTS_LEFT'
  | 'TIMESTAMP_MISMATCH'
  | 'INTERNAL_ERROR';

/**
 * Request para consultar estado del estudiante
 */
export interface GetStatusRequest {
  sessionId: string;
  studentId: number;
}

/**
 * Resultado de consulta de estado
 */
export interface GetStatusResult {
  /** Si el estudiante está registrado */
  registered: boolean;
  /** Estado actual */
  status?: 'active' | 'completed' | 'failed';
  /** Round actual */
  currentRound?: number;
  /** Total rounds */
  totalRounds?: number;
  /** Intento actual */
  currentAttempt?: number;
  /** Intentos máximos */
  maxAttempts?: number;
  /** Rounds completados */
  roundsCompleted?: number;
  /** Si tiene QR activo */
  hasActiveQR?: boolean;
  /** QR payload si está activo */
  qrPayload?: string;
  /** TTL restante del QR en segundos */
  qrTTLRemaining?: number;
}

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
