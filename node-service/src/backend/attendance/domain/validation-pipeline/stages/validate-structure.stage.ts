/**
 * Stage: Validate Structure
 * 
 * Valida la estructura de la respuesta desencriptada.
 * Stage puro (sin I/O).
 */

import type { SyncStage } from '../stage.interface';
import type { ValidationContext, StudentResponse } from '../context';
import { isQRPayloadV1 } from '../../../../../shared/types';

/**
 * Valida estructura de StudentResponse
 */
function isValidResponseStructure(response: unknown): response is StudentResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const r = response as Record<string, unknown>;

  return (
    typeof r.original === 'object' &&
    r.original !== null &&
    typeof r.studentId === 'number' &&
    typeof r.receivedAt === 'number'
  );
}

export const validateStructureStage: SyncStage = {
  name: 'validateStructure',

  execute(ctx: ValidationContext): boolean {
    if (!ctx.response) {
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: 'No hay respuesta para validar',
      };
      return false;
    }

    // Validar estructura de respuesta
    if (!isValidResponseStructure(ctx.response)) {
      ctx.error = {
        code: 'INVALID_FORMAT',
        message: 'Estructura de respuesta invalida',
      };
      return false;
    }

    // Validar estructura del payload original usando isQRPayloadV1 de shared
    if (!isQRPayloadV1(ctx.response.original)) {
      ctx.error = {
        code: 'INVALID_FORMAT',
        message: 'Estructura de payload original invalida',
      };
      return false;
    }

    return true;
  },
};
