/**
 * Error Handler Middleware
 * 
 * Manejo centralizado de errores para HTTP y WebSocket.
 * Captura todas las excepciones no manejadas y las formatea
 * de manera consistente.
 */

import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, isAppError, isOperationalError } from './errors/app-error';
import { sendErrorResponse } from './errors/error-formatter';
import { config } from '../shared/config/index.js';
import { logger } from '../shared/infrastructure/logger';

/**
 * Registra el error handler global de Fastify
 */
export function errorHandlerMiddleware(fastify: FastifyInstance): void {
  // setErrorHandler captura todos los errores en la aplicación
  fastify.setErrorHandler((error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    // Log del error
    logError(error, request);

    // Si el error no es operacional, es un bug crítico
    if (!isOperationalError(error)) {
      // En producción, alertar al equipo (aquí podrías integrar con Sentry, etc.)
      if (config.env.isProduction) {
        logger.error('[CRITICAL] Non-operational error:', {
          message: error.message,
          stack: error.stack,
          url: request.url,
          method: request.method,
        });
      }
    }

    // Convertir FastifyError a AppError si es necesario
    const appError = convertToAppError(error);

    // Enviar respuesta formateada
    sendErrorResponse(reply, appError, request.url);
  });

  // Hook onError para logging adicional
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    // Este hook se ejecuta antes del error handler
    // Útil para métricas, logging adicional, etc.
    request.log.error({
      error: {
        message: error.message,
        name: error.name,
        stack: config.env.isDevelopment ? error.stack : undefined,
      },
      request: {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        headers: {
          userAgent: request.headers['user-agent'],
          referer: request.headers.referer,
        },
      },
    }, 'Request error');
  });
}

/**
 * Convierte un error genérico o FastifyError a AppError
 */
function convertToAppError(error: FastifyError | Error): AppError {
  // Si ya es AppError, retornarlo
  if (isAppError(error)) {
    return error;
  }

  // Convertir FastifyError
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const fastifyError = error as FastifyError;
    const statusCode = fastifyError.statusCode ?? 500;
    return new AppError(
      fastifyError.message,
      statusCode,
      fastifyError.code,
      undefined,
      statusCode < 500 // Errores 4xx son operacionales
    );
  }

  // Error genérico -> InternalServerError
  return new AppError(
    config.env.isDevelopment ? error.message : 'Internal server error',
    500,
    'INTERNAL_ERROR',
    undefined,
    false
  );
}

/**
 * Logging estructurado de errores
 */
function logError(error: Error, request: FastifyRequest): void {
  const isDevelopment = config.env.isDevelopment;
  const isOperational = isOperationalError(error);

  const logData = {
    errorType: error.name,
    message: error.message,
    operational: isOperational,
    request: {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    },
  };

  // Agregar stack trace en desarrollo o si es error crítico
  if (isDevelopment || !isOperational) {
    (logData as any).stack = error.stack;
  }

  // Agregar detalles si es AppError
  if (isAppError(error)) {
    (logData as any).statusCode = error.statusCode;
    (logData as any).code = error.code;
    if (error.details) {
      (logData as any).details = error.details;
    }
  }

  // Log según severidad
  if (isOperational) {
    request.log.warn(logData, 'Operational error');
  } else {
    request.log.error(logData, 'Non-operational error');
  }
}

/**
 * Handler de errores no capturados (safety net)
 */
export function setupGlobalErrorHandlers(): void {
  // Capturar excepciones no manejadas
  process.on('uncaughtException', (error: Error) => {
    logger.error('[FATAL] Uncaught Exception:', error);
    logger.error(error.stack);
    
    // En producción, dar tiempo para flush de logs antes de salir
    if (config.env.isProduction) {
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    } else {
      process.exit(1);
    }
  });

  // Capturar promesas rechazadas no manejadas
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('[FATAL] Unhandled Rejection at:', promise);
    logger.error('Reason:', reason);
    
    if (reason instanceof Error) {
      logger.error(reason.stack);
    }
    
    // En desarrollo, no matar el proceso para facilitar debugging
    if (config.env.isProduction) {
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });

  // Señales de terminación
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`[Server] Received ${signal}, shutting down gracefully`);
      // El shutdown graceful se maneja en app.ts
    });
  });
}
