/**
 * Stage: Load QR State
 * 
 * Carga el estado del QR desde Valkey.
 * I/O stage que requiere acceso al repositorio.
 */

import type { Stage } from '../stage.interface';
import type { ValidationContext, QRState } from '../context';

/**
 * Interface para el repositorio de QR (inversion de dependencia)
 */
export interface QRStateLoader {
  getState(nonce: string): Promise<QRState | null>;
}

export function createLoadQRStateStage(loader: QRStateLoader): Stage {
  return {
    name: 'loadQRState',

    async execute(ctx: ValidationContext): Promise<boolean> {
      if (!ctx.response) {
        ctx.error = {
          code: 'INTERNAL_ERROR',
          message: 'No hay respuesta para cargar estado QR',
        };
        return false;
      }

      const nonce = ctx.response.original.n;
      const qrState = await loader.getState(nonce);

      // Si no existe, creamos estado "no existe"
      ctx.qrState = qrState ?? { exists: false, consumed: false };

      return true;
    },
  };
}
