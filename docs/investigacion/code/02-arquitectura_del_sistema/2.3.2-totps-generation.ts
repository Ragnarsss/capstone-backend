// Sección 2.3.2 - TOTPs (TOTP de Servidor/Sesión)
// Generación de TOTPs

TOTPs = TOTP(
  secret: hash(sessionId + userId + roundNumber + server_secret),
  timestamp: qr_generation_time,
  window: 30  // segundos de validez
)
