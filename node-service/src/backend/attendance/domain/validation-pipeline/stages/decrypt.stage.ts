/**
 * Stage: Decrypt Response
 * 
 * Desencripta la respuesta del estudiante y la parsea.
 * Requiere acceso a AesGcmService y SessionKeyRepository (I/O stage).
 * 
 * Flujo de session_key:
 * 1. Obtiene session_key del estudiante desde Valkey (SessionKeyRepository)
 * 2. Crea AesGcmService con esa clave especifica
 * 3. Desencripta el payload con la clave del estudiante
 * 
 * En STUB MODE (ENROLLMENT_STUB_MODE=true):
 * - Acepta el QR encriptado del servidor directamente
 * - Lo desencripta y construye una StudentResponse mock
 * - Permite probar el flujo completo sin FIDO2/enrollment
 */

import type { Stage } from '../stage.interface';
import type { ValidationContext, StudentResponse } from '../context';
import { AesGcmService } from '../../../../../shared/infrastructure/crypto';
import { SessionKeyRepository } from '../../../../session/infrastructure/repositories/session-key.repository';
import type { QRPayloadV1 } from '../../../../../shared/types';

const STUB_MODE = process.env.ENROLLMENT_STUB_MODE === 'true';

/**
 * Dependencias para el DecryptStage
 */
export interface DecryptStageDeps {
  /** Servicio AES-GCM de fallback (usa mock key) */
  fallbackAesGcmService: AesGcmService;
  /** Repositorio de session keys para obtener clave real */
  sessionKeyRepo: SessionKeyRepository;
}

export function createDecryptStage(deps: DecryptStageDeps): Stage;
export function createDecryptStage(aesGcmService: AesGcmService): Stage;
export function createDecryptStage(
  depsOrService: DecryptStageDeps | AesGcmService
): Stage {
  // Compatibilidad: si recibe AesGcmService directamente, usar como fallback
  const deps: DecryptStageDeps = depsOrService instanceof AesGcmService
    ? { fallbackAesGcmService: depsOrService, sessionKeyRepo: new SessionKeyRepository() }
    : depsOrService;

  return {
    name: 'decrypt',

    async execute(ctx: ValidationContext): Promise<boolean> {
      // 1. Obtener session_key del estudiante desde Valkey
      let aesService: AesGcmService;
      const sessionKeyData = await deps.sessionKeyRepo.findByUserId(ctx.studentId);
      
      if (sessionKeyData) {
        // Usar session_key real del estudiante
        aesService = new AesGcmService(sessionKeyData.sessionKey);
      } else {
        // Fallback a mock key (solo desarrollo)
        aesService = deps.fallbackAesGcmService;
      }

      // 2. Verificar formato
      if (!aesService.isValidPayloadFormat(ctx.encrypted)) {
        ctx.error = {
          code: 'INVALID_FORMAT',
          message: 'Formato de payload invalido',
        };
        return false;
      }

      // 3. Desencriptar
      try {
        const decrypted = aesService.decryptFromPayload(ctx.encrypted);
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
