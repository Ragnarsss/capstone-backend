import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Resultado de encriptación AES-256-GCM
 */
export interface EncryptionResult {
  /** Datos encriptados en base64 */
  ciphertext: string;
  /** IV usado (12 bytes en base64) */
  iv: string;
  /** Tag de autenticación (16 bytes en base64) */
  authTag: string;
}

/**
 * Payload encriptado completo para transmisión
 * Formato compacto: iv.ciphertext.authTag (todo en base64)
 */
export interface EncryptedPayload {
  /** Payload completo en formato compacto */
  encrypted: string;
  /** Versión del formato de encriptación */
  version: 1;
}

/**
 * Servicio de criptografía para encriptación/desencriptación AES-256-GCM
 * 
 * Características:
 * - AES-256-GCM: Encriptación autenticada (confidencialidad + integridad)
 * - IV de 12 bytes (96 bits) recomendado para GCM
 * - AuthTag de 16 bytes (128 bits) para autenticación
 * 
 * NOTA: En Fase 2 usamos MOCK_SESSION_KEY.
 * En Fase 9+ se usará session_key derivada de ECDH.
 */
export class CryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96 bits recomendado para GCM
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits

  /**
   * Clave de sesión mock para desarrollo
   * 32 bytes = 256 bits para AES-256
   * 
   * IMPORTANTE: Esta clave será reemplazada por session_key
   * derivada de ECDH en Fase 9+
   */
  private static readonly MOCK_SESSION_KEY = Buffer.from(
    'desarrollo_asistencia_mock_key!!', // Exactamente 32 caracteres
    'utf-8'
  );

  private readonly sessionKey: Buffer;

  /**
   * Constructor
   * @param sessionKey - Clave de sesión (32 bytes). Si no se provee, usa mock.
   */
  constructor(sessionKey?: Buffer) {
    if (sessionKey) {
      if (sessionKey.length !== 32) {
        throw new Error('Session key debe ser de 32 bytes (256 bits)');
      }
      this.sessionKey = sessionKey;
    } else {
      // Usar mock key para desarrollo
      this.sessionKey = CryptoService.MOCK_SESSION_KEY;
      console.warn('[CryptoService] Usando MOCK_SESSION_KEY - solo para desarrollo');
    }
  }

  /**
   * Encripta datos usando AES-256-GCM
   * @param plaintext - Texto plano a encriptar
   * @returns Resultado con ciphertext, IV y authTag
   */
  encrypt(plaintext: string): EncryptionResult {
    // Generar IV aleatorio de 12 bytes
    const iv = randomBytes(CryptoService.IV_LENGTH);

    // Crear cipher AES-256-GCM
    const cipher = createCipheriv(
      CryptoService.ALGORITHM,
      this.sessionKey,
      iv,
      { authTagLength: CryptoService.AUTH_TAG_LENGTH }
    );

    // Encriptar
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Obtener tag de autenticación
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  /**
   * Desencripta datos usando AES-256-GCM
   * @param ciphertext - Texto encriptado en base64
   * @param iv - IV en base64
   * @param authTag - Tag de autenticación en base64
   * @returns Texto plano original
   * @throws Error si la autenticación falla
   */
  decrypt(ciphertext: string, iv: string, authTag: string): string {
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    const encryptedBuffer = Buffer.from(ciphertext, 'base64');

    // Crear decipher AES-256-GCM
    const decipher = createDecipheriv(
      CryptoService.ALGORITHM,
      this.sessionKey,
      ivBuffer,
      { authTagLength: CryptoService.AUTH_TAG_LENGTH }
    );

    // Establecer tag de autenticación
    decipher.setAuthTag(authTagBuffer);

    // Desencriptar
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Encripta y empaqueta en formato compacto para transmisión
   * Formato: iv.ciphertext.authTag (separado por puntos, todo en base64)
   * 
   * @param plaintext - Texto plano a encriptar
   * @returns Payload encriptado en formato compacto
   */
  encryptToPayload(plaintext: string): EncryptedPayload {
    const result = this.encrypt(plaintext);
    
    // Formato compacto: iv.ciphertext.authTag
    const encrypted = `${result.iv}.${result.ciphertext}.${result.authTag}`;
    
    return {
      encrypted,
      version: 1,
    };
  }

  /**
   * Desempaqueta y desencripta payload compacto
   * @param payload - Payload en formato iv.ciphertext.authTag
   * @returns Texto plano original
   * @throws Error si el formato es inválido o la autenticación falla
   */
  decryptFromPayload(payload: string): string {
    const parts = payload.split('.');
    
    if (parts.length !== 3) {
      throw new Error('Formato de payload inválido: se esperan 3 partes separadas por punto');
    }

    const [iv, ciphertext, authTag] = parts;
    return this.decrypt(ciphertext, iv, authTag);
  }

  /**
   * Verifica si un payload encriptado es válido (sin desencriptar completamente)
   * @param payload - Payload en formato compacto
   * @returns true si el formato es válido
   */
  isValidPayloadFormat(payload: string): boolean {
    const parts = payload.split('.');
    
    if (parts.length !== 3) {
      return false;
    }

    const [iv, ciphertext, authTag] = parts;

    try {
      // Verificar que son base64 válidos
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');
      Buffer.from(ciphertext, 'base64');

      // Verificar longitudes esperadas
      if (ivBuffer.length !== CryptoService.IV_LENGTH) {
        return false;
      }
      if (authTagBuffer.length !== CryptoService.AUTH_TAG_LENGTH) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
