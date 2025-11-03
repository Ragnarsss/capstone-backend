// Configuracion centralizada del servicio

export const config = {
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  valkey: {
    host: process.env.VALKEY_HOST || 'valkey',
    port: parseInt(process.env.VALKEY_PORT || '6379', 10),
  },
  qr: {
    // Tiempo de countdown inicial antes de mostrar QR
    countdownSeconds: 5,
    // Intervalo de regeneracion de QR (en milisegundos)
    regenerationInterval: 3000,
  },
  jwt: {
    // Secret para firmar JWT (debe coincidir con PHP)
    // En produccion, usar variable de entorno segura
    secret: process.env.JWT_SECRET || 'CAMBIAR_EN_PRODUCCION_SECRET_KEY_COMPARTIDO_PHP_NODE',
    // Tiempo de expiracion del token (5 minutos)
    expiresIn: '5m',
    // Issuer del token
    issuer: 'php-service',
    // Audience del token
    audience: 'node-service',
  },
} as const;
