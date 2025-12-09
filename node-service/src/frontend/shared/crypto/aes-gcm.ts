/**
 * AES-256-GCM Crypto Module (Web Crypto API)
 * 
 * Implementa encriptación/desencriptación compatible con el backend.
 * Formato de payload: iv.ciphertext.authTag (separado por puntos, todo en base64)
 * 
 * Estrategia de claves:
 * 1. Busca session_key derivada de ECDH (SessionKeyStore)
 * 2. Fallback a MOCK_SESSION_KEY en desarrollo
 */
import { getMockSessionKey } from './mock-keys';

// Tamaños según especificación
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

// Cache de la clave para evitar importarla múltiples veces
let cachedKey: CryptoKey | null = null;
let cachedKeySource: 'ecdh' | 'mock' | null = null;

// Referencia al SessionKeyStore (lazy load para evitar import circular)
let sessionKeyStorePromise: Promise<typeof import('../../features/enrollment/services/session-key.store')> | null = null;

/**
 * Obtiene la clave de sesión con prioridad:
 * 1. session_key derivada de ECDH (producción)
 * 2. MOCK_SESSION_KEY (desarrollo)
 */
async function getSessionKey(): Promise<CryptoKey> {
  // Intentar obtener session_key real de ECDH
  try {
    if (!sessionKeyStorePromise) {
      sessionKeyStorePromise = import('../../features/enrollment/services/session-key.store');
    }
    const { SessionKeyStore } = await sessionKeyStorePromise;
    const store = new SessionKeyStore();
    
    if (store.hasSessionKey()) {
      const realKey = await store.getSessionKey();
      if (realKey) {
        if (cachedKeySource !== 'ecdh') {
          console.log('[Crypto] Usando session_key derivada de ECDH');
          cachedKeySource = 'ecdh';
        }
        cachedKey = realKey;
        return cachedKey;
      }
    }
  } catch {
    // SessionKeyStore no disponible, usar mock
  }

  // Fallback a mock key
  if (!cachedKey || cachedKeySource !== 'mock') {
    cachedKey = await getMockSessionKey();
    cachedKeySource = 'mock';
    console.warn('[Crypto] Usando MOCK_SESSION_KEY - solo para desarrollo');
  }
  return cachedKey;
}

/**
 * Establece manualmente una session_key derivada de ECDH
 * Útil para pruebas o cuando no se usa SessionKeyStore
 */
export function setSessionKey(key: CryptoKey): void {
  cachedKey = key;
  cachedKeySource = 'ecdh';
  console.log('[Crypto] Session key establecida manualmente');
}

/**
 * Decodifica Base64 a Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Codifica Uint8Array a Base64
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Genera IV aleatorio de 12 bytes
 */
function generateIV(): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(IV_LENGTH);
  const iv = new Uint8Array(buffer);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Desencripta un payload QR encriptado por el backend
 * 
 * Formato entrada: iv.ciphertext.authTag (separado por puntos, base64)
 * 
 * @param encryptedPayload - Payload en formato compacto del backend
 * @returns JSON string desencriptado del payload QR
 * @throws Error si el formato es inválido o la autenticación falla
 */
export async function decryptQR(encryptedPayload: string): Promise<string> {
  // Separar componentes
  const parts = encryptedPayload.split('.');
  
  if (parts.length !== 3) {
    throw new Error('Formato de payload inválido: se esperan 3 partes separadas por punto');
  }

  const [ivBase64, ciphertextBase64, authTagBase64] = parts;

  // Decodificar de Base64
  const iv = base64ToBytes(ivBase64);
  const ciphertext = base64ToBytes(ciphertextBase64);
  const authTag = base64ToBytes(authTagBase64);

  // Validar longitudes
  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV inválido: longitud ${iv.length}, esperado ${IV_LENGTH}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`AuthTag inválido: longitud ${authTag.length}, esperado ${AUTH_TAG_LENGTH}`);
  }

  // Web Crypto API espera ciphertext + authTag concatenados
  const combinedCiphertext = new Uint8Array(ciphertext.length + authTag.length);
  combinedCiphertext.set(ciphertext, 0);
  combinedCiphertext.set(authTag, ciphertext.length);

  const key = await getSessionKey();

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: AUTH_TAG_LENGTH * 8, // En bits
      },
      key,
      combinedCiphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Fallo en desencriptación o autenticación');
  }
}

/**
 * Encripta un payload para enviar al backend
 * 
 * Formato salida: iv.ciphertext.authTag (separado por puntos, base64)
 * Compatible con CryptoService.decryptFromPayload() del backend
 * 
 * @param plaintext - JSON string a encriptar
 * @returns Payload en formato compacto
 */
export async function encryptPayload(plaintext: string): Promise<string> {
  const key = await getSessionKey();
  const iv = generateIV();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // AES-GCM devuelve ciphertext + authTag concatenados
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: AUTH_TAG_LENGTH * 8, // En bits
    },
    key,
    data
  );

  const encryptedBytes = new Uint8Array(encrypted);
  
  // Separar ciphertext y authTag
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - AUTH_TAG_LENGTH);
  const authTag = encryptedBytes.slice(encryptedBytes.length - AUTH_TAG_LENGTH);

  // Formato compacto: iv.ciphertext.authTag
  const ivBase64 = bytesToBase64(iv);
  const ciphertextBase64 = bytesToBase64(ciphertext);
  const authTagBase64 = bytesToBase64(authTag);

  return `${ivBase64}.${ciphertextBase64}.${authTagBase64}`;
}

/**
 * Invalida la clave cacheada
 * Llamar cuando cambie la sesión o se cierre sesión
 */
export function clearKeyCache(): void {
  cachedKey = null;
  cachedKeySource = null;
}

/**
 * Obtiene la fuente actual de la clave de sesión
 * @returns 'ecdh' si usa clave real, 'mock' si usa desarrollo, null si no hay clave
 */
export function getKeySource(): 'ecdh' | 'mock' | null {
  return cachedKeySource;
}
