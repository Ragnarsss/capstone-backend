// Sección 2.3 - Sistema Dual TOTP
// Validación conjunta en servidor

async function validateAttendance(request: AttendanceRequest): Promise<ValidationResult> {
  const { userId, sessionId, TOTPu, TOTPs, roundNumber, timestamp } = request;

  // 1. Validar TOTPu (sesión del usuario)
  const userSession = sessions.get(userId);
  if (!userSession || userSession.TOTPu !== TOTPu) {
    return { error: 'Invalid session token (TOTPu)' };
  }

  // 2. Validar TOTPs (QR específico)
  const expectedTOTPs = generateTOTPs(sessionId, userId, roundNumber);
  if (TOTPs !== expectedTOTPs) {
    return { error: 'Invalid QR token (TOTPs)' };
  }

  // 3. Verificar que TOTPs no ha sido usado
  if (usedTOTPs.has(TOTPs)) {
    return { error: 'Token already used (replay attack?)' };
  }

  // 4. Verificar ventana de tiempo
  if (Date.now() - timestamp > 10000) { // 10 segundos
    return { error: 'Capture too old' };
  }

  // 5. Marcar como usado
  usedTOTPs.add(TOTPs);

  // 6. Registrar asistencia para esta ronda
  await markAttendanceRound(userId, sessionId, roundNumber);

  return { success: true };
}
