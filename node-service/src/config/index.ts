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
} as const;
