// Configuracion centralizada del servicio

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
    password: process.env.POSTGRES_PASSWORD || 'asistencia_dev_password',
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
    // En produccion, usar variable de entorno segura
    secret: process.env.JWT_SECRET || 'CAMBIAR_EN_PRODUCCION_SECRET_KEY_COMPARTIDO_PHP_NODE',
    // Tiempo de expiracion del token (5 minutos)
    expiresIn: '5m',
    // Issuer del token
    issuer: 'php-service',
    // Audience del token
    audience: 'node-service',
  },
  // Configuración criptográfica para enrollment y asistencia
  crypto: {
    // Master secret para derivación de claves (DEBE cambiar en producción)
    masterSecret: process.env.SERVER_MASTER_SECRET || 'CAMBIAR_EN_PRODUCCION_MASTER_SECRET_32_BYTES',
    // Relying Party para WebAuthn
    rpName: process.env.WEBAUTHN_RP_NAME || 'Sistema Asistencia UCN',
    rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
    // Origen esperado para validación WebAuthn
    origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:9500',
  },
} as const;
