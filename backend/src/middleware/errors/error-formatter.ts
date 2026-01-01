/**
 * Error Response Formatter
 * 
 * Formatea errores en respuestas HTTP consistentes
 * según el entorno (development/production)
 */

import { FastifyReply } from 'fastify';
import { AppError, isAppError } from './app-error.js';
import { config } from '../../shared/config/index.js';

/**
 * Estructura de respuesta de error estándar
 */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  timestamp: string;
  path?: string;
  stack?: string; // Solo en desarrollo
}

/**
 * Formatea un error en una respuesta HTTP estándar
 */
export function formatErrorResponse(
  error: Error | AppError,
  path?: string
): ErrorResponse {
  const isDevelopment = config.env.isDevelopment;
  
  // Error operacional (AppError)
  if (isAppError(error)) {
    const response: ErrorResponse = {
      statusCode: error.statusCode,
      error: getErrorName(error.statusCode),
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    if (error.code) {
      response.code = error.code;
    }

    if (error.details) {
      response.details = error.details;
    }

    if (path) {
      response.path = path;
    }

    // Stack trace solo en desarrollo
    if (isDevelopment && error.stack) {
      response.stack = error.stack;
    }

    return response;
  }

  // Error no operacional (Error genérico)
  const response: ErrorResponse = {
    statusCode: 500,
    error: 'Internal Server Error',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };

  if (path) {
    response.path = path;
  }

  // Stack trace solo en desarrollo
  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  return response;
}

/**
 * Envía una respuesta de error formateada
 */
export function sendErrorResponse(
  reply: FastifyReply,
  error: Error | AppError,
  path?: string
): void {
  const errorResponse = formatErrorResponse(error, path);
  
  // Headers adicionales según el tipo de error
  if (isAppError(error)) {
    if (error.code === 'RATE_LIMIT_ERROR' && error.details) {
      const details = error.details as { retryAfter?: number };
      if (details.retryAfter) {
        reply.header('Retry-After', details.retryAfter);
      }
    }
  }

  reply.status(errorResponse.statusCode).send(errorResponse);
}

/**
 * Obtiene el nombre del error según el código de estado
 */
function getErrorName(statusCode: number): string {
  const errorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    409: 'Conflict',
    413: 'Payload Too Large',
    415: 'Unsupported Media Type',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };

  return errorNames[statusCode] || 'Error';
}
