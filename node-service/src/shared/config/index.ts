// Configuracion centralizada del servicio

// Re-export attendance defaults para acceso desde shared/config
export {
  DEFAULT_MAX_ROUNDS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_QR_TTL_SECONDS,
  DEFAULT_MIN_POOL_SIZE,
} from './attendance.defaults';

/**
 * Valida que las variables de entorno criticas esten definidas
 * Lanza error descriptivo si falta alguna variable requerida
 */
function validateRequiredEnvVars(): void {
  const requiredVars = [
    'POSTGRES_PASSWORD',
    'JWT_SECRET',
    'SERVER_MASTER_SECRET',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missing.join(', ')}.\n` +
      `Verifica que exista el archivo .env en la raiz del proyecto.\n` +
      `Puedes copiar .env.example como punto de partida: cp .env.example .env`
    );
  }
}

// Validar variables criticas al importar este modulo
validateRequiredEnvVars();

export const config = {
  env: {
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
  },
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  frontend: {
    viteUrl: process.env.VITE_URL || 'http://localhost:5173',
    vitePath: process.env.VITE_BASE_PATH || '/asistencia/',
    staticPath: process.env.STATIC_PATH || process.cwd() + '/dist/frontend',
  },
  valkey: {
    host: process.env.VALKEY_HOST || 'valkey',
    port: parseInt(process.env.VALKEY_PORT || '6379', 10),
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'asistencia',
    user: process.env.POSTGRES_USER || 'asistencia',
    password: process.env.POSTGRES_PASSWORD as string, // Validado en validateRequiredEnvVars()
    // Pool configuration
    poolMax: parseInt(process.env.POSTGRES_POOL_MAX || '10', 10),
    idleTimeout: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
    connectionTimeout: parseInt(process.env.POSTGRES_CONN_TIMEOUT || '5000', 10),
  },
  qr: {
    // Tiempo de countdown inicial antes de mostrar QR
    countdownSeconds: 5,
    // Intervalo de regeneracion de QR (en milisegundos)
    // 333ms = exactamente 3 QRs por segundo
    regenerationInterval: 333,
  },
  jwt: {
    // Secret para validar JWT desde PHP (debe coincidir con JWT_SECRET de PHP)
    secret: process.env.JWT_SECRET as string, // Validado en validateRequiredEnvVars()
    // Tiempo de expiracion del token (5 minutos)
    expiresIn: '5m',
    // Issuer del token
    issuer: 'php-service',
    // Audience del token
    audience: 'node-service',
  },
  // Configuración criptográfica para enrollment y asistencia
  crypto: {
    // Master secret para derivación de claves
    masterSecret: process.env.SERVER_MASTER_SECRET as string, // Validado en validateRequiredEnvVars()
    // Relying Party para WebAuthn
    rpName: process.env.WEBAUTHN_RP_NAME || 'Sistema Asistencia UCN',
    rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
    // Origen esperado para validación WebAuthn
    origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:9500',
  },
  // Configuración de validación AAGUID (fase 22.3)
  aaguid: {
    // Habilitar validación de AAGUID (true por defecto en producción)
    validationEnabled: process.env.AAGUID_VALIDATION_ENABLED !== 'false',
    // Permitir NULL AAGUID (00000000-0000-0000-0000-000000000000)
    // false por defecto para rechazar autenticadores desconocidos
    allowNull: process.env.AAGUID_ALLOW_NULL === 'true',
    // Modo permisivo: permitir AAGUIDs desconocidos pero loggear
    // Util en fase de transicion para identificar dispositivos faltantes
    allowUnknown: process.env.AAGUID_ALLOW_UNKNOWN === 'true',
  },
} as const;
