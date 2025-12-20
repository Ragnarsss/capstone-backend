import type { Stage } from '../stage.interface';
import type { ValidationContext } from '../context';
import type { ITotpValidator } from '../../../../../shared/ports';

/**
 * Dependencias para el TOTPValidationStage
 */
export interface TOTPValidationStageDeps {
  /** Validador TOTP inyectado (usa handshake_secret internamente) */
  totpValidator: ITotpValidator;
}

export function createTOTPValidationStage(deps: TOTPValidationStageDeps): Stage {
  const { totpValidator } = deps;

  return {
    name: 'totp-validation',

    async execute(ctx: ValidationContext): Promise<boolean> {

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

      // Validar TOTP usando el port inyectado
      // El adapter internamente obtiene handshake_secret y valida con HkdfService
      const isValid = await totpValidator.validate(ctx.studentId, ctx.response.totpu);

      if (!isValid) {
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
