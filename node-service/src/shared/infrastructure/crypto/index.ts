/**
 * Módulo de criptografía compartida
 * 
 * Exporta servicios de encriptación simétrica para payloads QR.
 * Para servicios de derivación de claves (HKDF, ECDH, FIDO2),
 * ver: enrollment/infrastructure/crypto/
 */
export { AesGcmService, CryptoService } from './aes-gcm.service';
export type { EncryptionResult, EncryptedPayload } from './aes-gcm.service';
