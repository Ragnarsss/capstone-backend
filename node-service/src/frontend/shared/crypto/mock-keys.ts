/**
 * Claves mock para desarrollo
 * 
 * IMPORTANTE: Estas claves deben coincidir EXACTAMENTE con las del backend
 * (node-service/src/shared/infrastructure/crypto/crypto.service.ts)
 * 
 * @deprecated Será reemplazado por session_key derivada de ECDH en integracion PHP.
 * Fecha estimada de eliminacion: Fase 12 (Integracion PHP Legacy)
 */

/**
 * Clave de sesión mock para desarrollo
 * 32 bytes = 256 bits para AES-256
 * Debe coincidir con MOCK_SESSION_KEY del backend
 * 
 * @deprecated Usar session_key derivada de ECDH en produccion
 */
export const MOCK_SESSION_KEY = 'desarrollo_asistencia_mock_key!!';

/**
 * Convierte la clave string a formato CryptoKey para Web Crypto API
 * @returns CryptoKey lista para usar con AES-GCM
 * 
 * @deprecated Usar SessionKeyStore.getKey() en produccion
 */
export async function getMockSessionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(MOCK_SESSION_KEY);
  
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    true, // extractable - necesario para TOTP
    ['encrypt', 'decrypt']
  );
}
