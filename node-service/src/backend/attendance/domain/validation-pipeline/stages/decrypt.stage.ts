/**
 * Stage: Decrypt Response
 * 
 * Desencripta la respuesta del estudiante y la parsea.
 * Requiere acceso a AesGcmService (I/O stage).
 * 
 * En STUB MODE (ENROLLMENT_STUB_MODE=true):
 * - Acepta el QR encriptado del servidor directamente
 * - Lo desencripta y construye una StudentResponse mock
 * - Permite probar el flujo completo sin FIDO2/enrollment
 */

import type { Stage } from '../stage.interface';
import type { ValidationContext, StudentResponse } from '../context';
import type { AesGcmService } from '../../../../../shared/infrastructure/crypto';
import type { QRPayloadV1 } from '../../../../../shared/types';

const STUB_MODE = process.env.ENROLLMENT_STUB_MODE === 'true';

export function createDecryptStage(aesGcmService: AesGcmService): Stage {
  return {
    name: 'decrypt',

    async execute(ctx: ValidationContext): Promise<boolean> {
      // Verificar formato
      if (!aesGcmService.isValidPayloadFormat(ctx.encrypted)) {
        ctx.error = {
          code: 'INVALID_FORMAT',
          message: 'Formato de payload invalido',
        };
        return false;
      }

      // Desencriptar
      try {
        const decrypted = aesGcmService.decryptFromPayload(ctx.encrypted);
        const parsed = JSON.parse(decrypted);

        // En STUB MODE: el payload es el QR original del servidor (QRPayloadV1)
        // Lo convertimos a StudentResponse para el pipeline
        if (STUB_MODE && isQRPayloadV1(parsed)) {
          ctx.response = {
            original: parsed,
            studentId: ctx.studentId,
            receivedAt: Date.now(),
          };
          return true;
        }

        // Flujo normal: el payload ya es StudentResponse del cliente
        ctx.response = parsed as StudentResponse;
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

/**
 * Verifica si el objeto es un QRPayloadV1 (del servidor)
 * vs una StudentResponse (del cliente)
 */
function isQRPayloadV1(obj: unknown): obj is QRPayloadV1 {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  
  // QRPayloadV1 tiene: v, sid, uid, r, ts, n
  // StudentResponse tiene: original, studentId, receivedAt
  return (
    o.v === 1 &&
    typeof o.sid === 'string' &&
    typeof o.uid === 'number' &&
    typeof o.r === 'number' &&
    typeof o.ts === 'number' &&
    typeof o.n === 'string'
  );
}
