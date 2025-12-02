/**
 * Stage: Decrypt Response
 * 
 * Desencripta la respuesta del estudiante y la parsea.
 * Requiere acceso a CryptoService (I/O stage).
 */

import type { Stage } from '../stage.interface';
import type { ValidationContext, StudentResponse } from '../context';
import type { CryptoService } from '../../../../../shared/infrastructure/crypto';

export function createDecryptStage(cryptoService: CryptoService): Stage {
  return {
    name: 'decrypt',

    async execute(ctx: ValidationContext): Promise<boolean> {
      // Verificar formato
      if (!cryptoService.isValidPayloadFormat(ctx.encrypted)) {
        ctx.error = {
          code: 'INVALID_FORMAT',
          message: 'Formato de payload invalido',
        };
        return false;
      }

      // Desencriptar
      try {
        const decrypted = cryptoService.decryptFromPayload(ctx.encrypted);
        ctx.response = JSON.parse(decrypted) as StudentResponse;
        return true;
      } catch (error) {
        ctx.error = {
          code: 'DECRYPTION_FAILED',
          message: 'No se pudo desencriptar la respuesta',
        };
        return false;
      }
    },
  };
}
