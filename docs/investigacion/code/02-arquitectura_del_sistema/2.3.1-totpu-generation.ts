// Sección 2.3.1 - TOTPu (TOTP de Usuario)
// Generación de TOTPu

TOTPu = TOTP(
  secret: hash(userId + password_hash + server_secret),
  timestamp: current_time,
  deviceId: unique_device_fingerprint
)
