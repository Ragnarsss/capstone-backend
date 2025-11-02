// Sección 2.3.1 - TOTPu (TOTP de Usuario)
// Generación de deviceId en el cliente (browser/app)

const deviceId = hash(
  navigator.userAgent +
  screen.width + screen.height +
  navigator.hardwareConcurrency +
  Intl.DateTimeFormat().resolvedOptions().timeZone +
  (await getCanvasFingerprint()) +
  localStorage.getItem('persistent_device_uuid') // Si existe
);
