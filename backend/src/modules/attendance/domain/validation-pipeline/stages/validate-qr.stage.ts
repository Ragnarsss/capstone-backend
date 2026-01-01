/**
 * Stage: Validate QR State
 * 
 * Valida que el QR existe y no ha sido consumido.
 * Stage puro (sin I/O).
 */

import type { SyncStage } from '../stage.interface';
import type { ValidationContext } from '../context';

export const validateQRNotExpiredStage: SyncStage = {
  name: 'validateQRNotExpired',

  execute(ctx: ValidationContext): boolean {
    if (!ctx.qrState) {
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: 'No hay estado QR cargado',
      };
      return false;
    }

    if (!ctx.qrState.exists) {
      ctx.error = {
        code: 'PAYLOAD_EXPIRED',
        message: 'El codigo QR ha expirado o no es valido',
      };
      return false;
    }

    return true;
  },
};

export const validateQRNotConsumedStage: SyncStage = {
  name: 'validateQRNotConsumed',

  execute(ctx: ValidationContext): boolean {
    if (!ctx.qrState) {
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: 'No hay estado QR cargado',
      };
      return false;
    }

    if (ctx.qrState.consumed) {
      ctx.error = {
        code: 'PAYLOAD_ALREADY_CONSUMED',
        message: 'Este codigo QR ya fue escaneado',
      };
      return false;
    }

    return true;
  },
};
