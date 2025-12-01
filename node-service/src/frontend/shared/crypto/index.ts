/**
 * Módulo de criptografía frontend
 * Exporta funciones de encriptación/desencriptación usando Web Crypto API
 */
export { decryptQR, encryptPayload, clearKeyCache } from './aes-gcm';
export { getMockSessionKey, MOCK_SESSION_KEY } from './mock-keys';
