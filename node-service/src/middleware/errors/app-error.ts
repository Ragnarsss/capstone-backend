/**
 * Application Error Classes
 * 
 * Jerarquía de errores personalizados para manejo consistente
 * de excepciones en toda la aplicación.
 */

/**
 * Error base de la aplicación
 * Todos los errores operacionales deben extender de esta clase
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this);
  }
}

/**
 * Error de validación (400 Bad Request)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Error de autenticación (401 Unauthorized)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: unknown) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Error de autorización (403 Forbidden)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: unknown) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Error de recurso no encontrado (404 Not Found)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: unknown) {
    super(`${resource} not found`, 404, 'NOT_FOUND', details);
  }
}

/**
 * Error de conflicto (409 Conflict)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

/**
 * Error de rate limiting (429 Too Many Requests)
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
    this.retryAfter = retryAfter;
  }
}

/**
 * Error de servicio no disponible (503 Service Unavailable)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', details?: unknown) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

/**
 * Error interno del servidor (500 Internal Server Error)
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details, false);
  }
}

/**
 * Error de timeout (408 Request Timeout)
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'Request timeout', details?: unknown) {
    super(message, 408, 'TIMEOUT_ERROR', details);
  }
}

/**
 * Error de payload muy grande (413 Payload Too Large)
 */
export class PayloadTooLargeError extends AppError {
  constructor(message: string = 'Payload too large', details?: unknown) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', details);
  }
}

/**
 * Error de tipo de contenido no soportado (415 Unsupported Media Type)
 */
export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string = 'Unsupported media type', details?: unknown) {
    super(message, 415, 'UNSUPPORTED_MEDIA_TYPE', details);
  }
}

/**
 * Type guard para verificar si un error es operacional
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Type guard para verificar si un error es de tipo AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
