/**
 * Error Mapper - Presentation Layer
 * 
 * Mapea códigos de error técnicos del dominio a mensajes
 * amigables para el usuario y códigos HTTP apropiados.
 * 
 * Responsabilidad: Traducción de errores para la API REST
 */

import type { ValidationError } from '../domain/validation-pipeline/context';

/**
 * Respuesta de error para la API
 */
export interface ErrorResponse {
  code: string;
  message: string;
  httpStatus: number;
}

/**
 * Mapeo de códigos de error del pipeline a respuestas HTTP
 */
const ERROR_MAP: Record<string, ErrorResponse> = {
  // Errores de formato/estructura
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    message: 'Formato de payload inválido',
    httpStatus: 400,
  },
  DECRYPTION_FAILED: {
    code: 'DECRYPTION_FAILED',
    message: 'No se pudo desencriptar la respuesta',
    httpStatus: 400,
  },
  INVALID_STRUCTURE: {
    code: 'INVALID_FORMAT',
    message: 'Estructura de respuesta inválida',
    httpStatus: 400,
  },
  INVALID_PAYLOAD_STRUCTURE: {
    code: 'INVALID_FORMAT',
    message: 'Estructura de payload original inválida',
    httpStatus: 400,
  },

  // Errores de propiedad/ownership
  USER_MISMATCH: {
    code: 'USER_MISMATCH',
    message: 'ID de estudiante no coincide',
    httpStatus: 403,
  },

  // Errores de QR
  QR_NOT_FOUND: {
    code: 'QR_EXPIRED',
    message: 'El código QR ha expirado o no es válido',
    httpStatus: 410,
  },
  QR_EXPIRED: {
    code: 'QR_EXPIRED',
    message: 'El código QR ha expirado',
    httpStatus: 410,
  },
  QR_CONSUMED: {
    code: 'QR_ALREADY_CONSUMED',
    message: 'Este código QR ya fue escaneado',
    httpStatus: 409,
  },
  PAYLOAD_NOT_FOUND_OR_EXPIRED: {
    code: 'PAYLOAD_EXPIRED',
    message: 'El código QR ha expirado o no es válido',
    httpStatus: 410,
  },
  PAYLOAD_ALREADY_CONSUMED: {
    code: 'PAYLOAD_ALREADY_CONSUMED',
    message: 'Este código QR ya fue escaneado',
    httpStatus: 409,
  },

  // Errores de sesión
  SESSION_ID_MISMATCH: {
    code: 'SESSION_MISMATCH',
    message: 'El código QR no coincide con la sesión activa',
    httpStatus: 400,
  },
  TIMESTAMP_MISMATCH: {
    code: 'TIMESTAMP_MISMATCH',
    message: 'El código QR no coincide con la sesión activa',
    httpStatus: 400,
  },

  // Errores de estudiante
  STUDENT_NOT_REGISTERED: {
    code: 'STUDENT_NOT_REGISTERED',
    message: 'No estás registrado en esta sesión',
    httpStatus: 403,
  },
  STUDENT_COMPLETED: {
    code: 'STUDENT_COMPLETED',
    message: 'Ya completaste la asistencia',
    httpStatus: 409,
  },
  STUDENT_FAILED: {
    code: 'NO_ATTEMPTS_LEFT',
    message: 'Sin intentos restantes',
    httpStatus: 403,
  },
  STUDENT_STATUS_COMPLETED: {
    code: 'STUDENT_COMPLETED',
    message: 'Ya completaste la asistencia',
    httpStatus: 409,
  },
  STUDENT_STATUS_FAILED: {
    code: 'NO_ATTEMPTS_LEFT',
    message: 'Sin intentos restantes',
    httpStatus: 403,
  },

  // Errores de round/nonce
  QR_NONCE_MISMATCH: {
    code: 'QR_MISMATCH',
    message: 'Este no es tu código QR actual',
    httpStatus: 400,
  },
  ROUND_MISMATCH: {
    code: 'ROUND_MISMATCH',
    message: 'Este código es de una ronda diferente',
    httpStatus: 400,
  },
  ROUND_ALREADY_COMPLETED: {
    code: 'ROUND_MISMATCH',
    message: 'Este código es de una ronda anterior',
    httpStatus: 400,
  },
  ROUND_NOT_REACHED: {
    code: 'ROUND_MISMATCH',
    message: 'Este código es de una ronda futura',
    httpStatus: 400,
  },

  // Errores internos
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor',
    httpStatus: 500,
  },
};

/**
 * Respuesta por defecto para errores no mapeados
 */
const DEFAULT_ERROR: ErrorResponse = {
  code: 'UNKNOWN_ERROR',
  message: 'Error de validación desconocido',
  httpStatus: 400,
};

/**
 * Mapea un error de validación a una respuesta HTTP
 */
export function mapValidationError(error: ValidationError): ErrorResponse {
  const mapped = ERROR_MAP[error.code];
  
  if (mapped) {
    return mapped;
  }

  // Si no está mapeado, usar el mensaje del error si existe
  return {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || DEFAULT_ERROR.message,
    httpStatus: 400,
  };
}

/**
 * Mapea un código de error legacy a una respuesta HTTP
 * (Para compatibilidad con el service antiguo)
 */
export function mapLegacyErrorCode(reason?: string): ErrorResponse {
  if (!reason) {
    return DEFAULT_ERROR;
  }

  return ERROR_MAP[reason] ?? DEFAULT_ERROR;
}

/**
 * Crea una respuesta de error para Fastify
 */
export function createErrorReply(error: ValidationError) {
  const mapped = mapValidationError(error);
  
  return {
    statusCode: mapped.httpStatus,
    body: {
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
      },
    },
  };
}
