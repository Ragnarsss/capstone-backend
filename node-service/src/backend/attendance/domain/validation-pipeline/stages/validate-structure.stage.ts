/**
 * Stage: Validate Structure
 * 
 * Valida la estructura de la respuesta desencriptada.
 * Stage puro (sin I/O).
 */

import type { SyncStage } from '../stage.interface';
import type { ValidationContext, StudentResponse } from '../context';
import type { QRPayloadV1 } from '../../../../qr-projection/domain/models';

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

/**
 * Valida estructura de QRPayloadV1
 */
function isValidPayloadStructure(payload: unknown): payload is QRPayloadV1 {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const p = payload as Record<string, unknown>;

  return (
    p.v === 1 &&
    typeof p.sid === 'string' &&
    typeof p.uid === 'number' &&
    typeof p.r === 'number' &&
    typeof p.ts === 'number' &&
    typeof p.n === 'string' &&
    (p.n as string).length === 32
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

    // Validar estructura del payload original
    if (!isValidPayloadStructure(ctx.response.original)) {
      ctx.error = {
        code: 'INVALID_FORMAT',
        message: 'Estructura de payload original invalida',
      };
      return false;
    }

    return true;
  },
};
