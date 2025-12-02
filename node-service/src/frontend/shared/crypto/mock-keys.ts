/**
 * Claves mock para desarrollo
 * 
 * IMPORTANTE: Estas claves deben coincidir EXACTAMENTE con las del backend
 * (node-service/src/shared/infrastructure/crypto/crypto.service.ts)
 * 
 * En Fase 9+ serán reemplazadas por session_key derivada de ECDH.
 */

/**
 * Clave de sesión mock para desarrollo
 * 32 bytes = 256 bits para AES-256
 * Debe coincidir con MOCK_SESSION_KEY del backend
 */
export const MOCK_SESSION_KEY = 'desarrollo_asistencia_mock_key!!';

/**
 * Convierte la clave string a formato CryptoKey para Web Crypto API
 * @returns CryptoKey lista para usar con AES-GCM
 */
export async function getMockSessionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(MOCK_SESSION_KEY);
  
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false, // extractable
    ['encrypt', 'decrypt']
  );
}
