/**
 * Servicio de encriptación para estudiantes
 * 
 * Responsabilidad: Encriptar payloads usando la session_key real del estudiante.
 * Simétrico a DecryptStage que desencripta con la misma lógica.
 * 
 * Flujo:
 * 1. Obtiene session_key del estudiante desde Valkey (via ISessionKeyQuery)
 * 2. Si existe, encripta con esa clave (flujo producción)
 * 3. Si no existe, usa mock key (solo desarrollo)
 */

import type { ISessionKeyQuery } from '../../../../shared/ports';
import { AesGcmService } from '../../../../shared/infrastructure/crypto';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * Resultado de encriptación para un estudiante
 */
export interface StudentEncryptionResult {
  /** Payload encriptado */
  encrypted: string;
  /** true si se usó session_key real, false si usó mock */
  usedRealKey: boolean;
}

/**
 * Servicio que encripta payloads con la session_key del estudiante
 */
export class StudentEncryptionService {
  constructor(private readonly sessionKeyQuery: ISessionKeyQuery) {}

  /**
   * Encripta un payload para un estudiante específico
   * 
   * @param studentId - ID del estudiante
   * @param plaintext - Texto plano a encriptar (JSON del QR payload)
   * @returns Payload encriptado e indicador de qué clave se usó
   */
  async encryptForStudent(
    studentId: number,
    plaintext: string
  ): Promise<StudentEncryptionResult> {
    // Intentar obtener session_key real del estudiante
    const keyData = await this.sessionKeyQuery.findByUserId(studentId);

    if (keyData) {
      // Usar session_key real del estudiante
      const aes = new AesGcmService(keyData.sessionKey);
      const encrypted = aes.encryptToPayload(plaintext).encrypted;
      
      logger.debug(`[StudentEncryption] Encriptado con session_key real para student=${studentId}`);
      
      return { encrypted, usedRealKey: true };
    }

    // Fallback: usar mock key (solo desarrollo)
    const fallbackAes = new AesGcmService();
    const encrypted = fallbackAes.encryptToPayload(plaintext).encrypted;
    
    logger.warn(`[StudentEncryption] No se encontró session_key para student=${studentId}, usando mock`);
    
    return { encrypted, usedRealKey: false };
  }
}
