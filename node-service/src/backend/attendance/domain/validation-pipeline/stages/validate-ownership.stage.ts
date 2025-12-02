/**
 * Stage: Validate Ownership
 * 
 * Verifica que el studentId del body coincide con el de la respuesta encriptada.
 * Stage puro (sin I/O).
 */

import type { SyncStage } from '../stage.interface';
import type { ValidationContext } from '../context';

export const validateOwnershipStage: SyncStage = {
  name: 'validateOwnership',

  execute(ctx: ValidationContext): boolean {
    if (!ctx.response) {
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: 'No hay respuesta para validar',
      };
      return false;
    }

    if (ctx.response.studentId !== ctx.studentId) {
      ctx.error = {
        code: 'USER_MISMATCH',
        message: 'ID de estudiante no coincide',
      };
      return false;
    }

    return true;
  },
};
