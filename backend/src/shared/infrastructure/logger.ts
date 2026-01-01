// Logger centralizado con control por entorno
// En produccion: solo warn y error
// En desarrollo: todos los niveles

import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// LOG_LEVEL desde env o default segun entorno
const envLogLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
const defaultLevel: LogLevel = config.env.isProduction ? 'warn' : 'info';
const currentLevel = envLogLevel || defaultLevel;

// Prioridad de niveles: debug < info < warn < error
const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ENABLE_VERBOSE_LOGS fuerza todos los logs incluso en produccion (para debugging)
const verboseEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';

function shouldLog(level: LogLevel): boolean {
  if (verboseEnabled) return true;
  return levelPriority[level] >= levelPriority[currentLevel];
}

/**
 * Logger centralizado
 * - debug/info: solo en desarrollo (o si ENABLE_VERBOSE_LOGS=true)
 * - warn/error: siempre disponibles
 */
export const logger = {
  /**
   * Logs de debug - Solo desarrollo
   * Uso: detalles internos, flujo de ejecucion
   */
  debug: (...args: unknown[]): void => {
    if (shouldLog('debug')) {
      console.debug(...args);
    }
  },

  /**
   * Logs informativos - Solo desarrollo
   * Uso: conexiones, inicializacion, estados
   */
  info: (...args: unknown[]): void => {
    if (shouldLog('info')) {
      console.log(...args);
    }
  },

  /**
   * Advertencias - Siempre visibles
   * Uso: situaciones recuperables, deprecaciones
   */
  warn: (...args: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn(...args);
    }
  },

  /**
   * Errores - Siempre visibles
   * Uso: errores operacionales, fallos
   */
  error: (...args: unknown[]): void => {
    if (shouldLog('error')) {
      console.error(...args);
    }
  },
};
