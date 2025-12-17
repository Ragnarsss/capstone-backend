import type { Stage } from '../stage.interface';
import type { ValidationContext } from '../context';
import { totp } from 'otplib';

/**
 * Dependencias para el TOTPValidationStage
 * El sessionKeyRepo es inyectado o creado internamente
 */
export interface TOTPValidationStageDeps {
  sessionKeyRepo?: any; // Inyectable para testing
}

export function createTOTPValidationStage(deps: TOTPValidationStageDeps = {}): Stage {
  // Lazy load SessionKeyRepository para evitar circular dependencies
  let sessionKeyRepo = deps.sessionKeyRepo;

  return {
    name: 'totp-validation',

    async execute(ctx: ValidationContext): Promise<boolean> {
      // Crear repositorio en lazy load (primera ejecucion) si no fue inyectado
      if (!sessionKeyRepo) {
        // Dynamic import para evitar circular dependencies
        const { SessionKeyRepository } = await import('../../../../session/infrastructure/repositories/session-key.repository');
        sessionKeyRepo = new SessionKeyRepository();
      }

      // Stage solo se ejecuta si tenemos response desencriptada
      if (!ctx.response) {
        ctx.error = {
          code: 'TOTP_VALIDATION_FAILED',
          message: 'No se encontró respuesta desencriptada para validar TOTP',
        };
        return false;
      }

      // Si no hay TOTPu en el payload, es un error
      if (!ctx.response.totpu) {
        ctx.error = {
          code: 'TOTP_MISSING',
          message: 'Falta TOTPu en la respuesta del cliente',
        };
        return false;
      }

      // Obtener session_key del estudiante desde Valkey
      const sessionKeyData = await sessionKeyRepo.findByUserId(ctx.studentId);
      
      if (!sessionKeyData) {
        ctx.error = {
          code: 'SESSION_KEY_NOT_FOUND',
          message: 'No se encontró session_key para el estudiante',
        };
        return false;
      }

      // Convertir session_key a secreto para TOTP
      const secret = keyToSecret(sessionKeyData.sessionKey);

      // Verificar con tolerancia de +/- 1 step (30s)
      if (!verifyTOTP(secret, ctx.response.totpu)) {
        ctx.error = {
          code: 'TOTP_INVALID',
          message: 'TOTPu no coincide con lo esperado',
        };
        return false;
      }

      // TOTP validado exitosamente
      return true;
    },
  };
}

/**
 * Convierte session_key a secreto para TOTP
 */
function keyToSecret(key: Buffer): string {
  // otplib.totp espera secret como string
  // Usamos base64 para convertir el Buffer
  return key.toString('base64');
}

/**
 * Verifica si el TOTPu enviado por cliente es valido
 * 
 * Usa ventana de +/- 1 step (30s) para tolerancia de clock skew
 * Esto permite que el TOTP sea valido si fue generado 30s antes o despues
 */
function verifyTOTP(secret: string, clientTOTP: string): boolean {
  // Configurar window para tolerar +/- 1 step (30 segundos)
  // window=1 significa: step actual, 1 anterior, 1 siguiente
  totp.options = { window: 1 };
  
  // totp.check() verifica si el token es valido para el secreto
  // con la ventana de tolerancia configurada
  return totp.check(clientTOTP, secret);
}
