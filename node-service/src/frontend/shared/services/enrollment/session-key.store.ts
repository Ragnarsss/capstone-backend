/**
 * Session Key Store
 * Responsabilidad: Almacenar y gestionar session_key derivada de ECDH
 *
 * Almacenamiento:
 * - sessionStorage: Claves exportadas en formato JWK (JSON Web Key)
 * - No usar localStorage por seguridad (persiste entre sesiones)
 *
 * Almacena dos claves derivadas del mismo shared secret:
 * - sessionKey (AES-GCM): para encriptar/desencriptar payloads QR
 * - hmacKey (HMAC-SHA256): para generar TOTPu sin necesidad de exportKey
 *
 * NOTA: Servicio compartido usado por enrollment, guest y qr-reader features
 */

export interface StoredSession {
  sessionKey: JsonWebKey;
  hmacKey: JsonWebKey;
  totpu: string;
  deviceId: number;
  createdAt: number;
  expiresAt: number;
}

const STORAGE_KEY = 'asistencia_session';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

export class SessionKeyStore {
  /**
   * Almacena session_key y hmacKey derivadas de ECDH
   */
  async storeSessionKey(
    sessionKey: CryptoKey,
    hmacKey: CryptoKey,
    totpu: string,
    deviceId: number
  ): Promise<void> {
    try {
      // Exportar ambas claves a formato JWK
      const sessionKeyData = await crypto.subtle.exportKey('jwk', sessionKey);
      const hmacKeyData = await crypto.subtle.exportKey('jwk', hmacKey);

      const session: StoredSession = {
        sessionKey: sessionKeyData,
        hmacKey: hmacKeyData,
        totpu,
        deviceId,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
      };

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      console.log('[SessionKeyStore] Session keys almacenadas, deviceId:', deviceId);
    } catch (error) {
      console.error('[SessionKeyStore] Error almacenando session keys:', error);
      throw error;
    }
  }

  /**
   * Verifica si hay una session key válida
   */
  hasSessionKey(): boolean {
    const session = this.getStoredSession();
    return session !== null && !this.isExpired(session);
  }

  /**
   * Recupera la session_key almacenada como CryptoKey
   */
  async getSessionKey(): Promise<CryptoKey | null> {
    const session = this.getStoredSession();

    if (!session || this.isExpired(session)) {
      this.clear();
      return null;
    }

    try {
      // Importar JWK a CryptoKey
      return await crypto.subtle.importKey(
        'jwk',
        session.sessionKey,
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('[SessionKeyStore] Error importando session key:', error);
      this.clear();
      return null;
    }
  }

  /**
   * Recupera la hmacKey almacenada como CryptoKey
   * Usada para generar TOTPu sin necesidad de exportKey
   */
  async getHmacKey(): Promise<CryptoKey | null> {
    const session = this.getStoredSession();

    if (!session || this.isExpired(session)) {
      this.clear();
      return null;
    }

    // Compatibilidad: si no hay hmacKey (sesion antigua), retornar null
    if (!session.hmacKey) {
      console.warn('[SessionKeyStore] Sesion sin hmacKey, requiere re-login');
      return null;
    }

    try {
      return await crypto.subtle.importKey(
        'jwk',
        session.hmacKey,
        {
          name: 'HMAC',
          hash: 'SHA-256',
        },
        false,
        ['sign']
      );
    } catch (error) {
      console.error('[SessionKeyStore] Error importando hmac key:', error);
      return null;
    }
  }

  /**
   * Obtiene el deviceId del dispositivo actual
   */
  getDeviceId(): number | null {
    const session = this.getStoredSession();
    return session?.deviceId ?? null;
  }

  /**
   * Obtiene el TOTPu almacenado
   */
  getTotpu(): string | null {
    const session = this.getStoredSession();
    return session?.totpu ?? null;
  }

  /**
   * Limpia la sesión almacenada
   */
  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    console.log('[SessionKeyStore] Sesión limpiada');
  }

  /**
   * Obtiene tiempo restante de sesión en minutos
   */
  getTimeRemainingMinutes(): number {
    const session = this.getStoredSession();
    if (!session) return 0;

    const remaining = session.expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 60000));
  }

  /**
   * Obtiene información de la sesión actual
   */
  getSessionInfo(): { deviceId: number; createdAt: Date; expiresAt: Date } | null {
    const session = this.getStoredSession();
    if (!session || this.isExpired(session)) return null;

    return {
      deviceId: session.deviceId,
      createdAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt),
    };
  }

  private getStoredSession(): StoredSession | null {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data) as StoredSession;
    } catch {
      return null;
    }
  }

  private isExpired(session: StoredSession): boolean {
    return Date.now() > session.expiresAt;
  }
}

/**
 * Singleton para uso global
 */
let instance: SessionKeyStore | null = null;

export function getSessionKeyStore(): SessionKeyStore {
  if (!instance) {
    instance = new SessionKeyStore();
  }
  return instance;
}
