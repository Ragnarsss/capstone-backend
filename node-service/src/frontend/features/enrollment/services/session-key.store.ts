/**
 * Session Key Store
 * Responsabilidad: Almacenar y gestionar session_key derivada de ECDH
 * 
 * Almacenamiento:
 * - sessionStorage: Clave exportada en formato JWK (JSON Web Key)
 * - No usar localStorage por seguridad (persiste entre sesiones)
 */

export interface StoredSession {
  sessionKey: JsonWebKey;
  totpu: string;
  createdAt: number;
  expiresAt: number;
}

const STORAGE_KEY = 'asistencia_session';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

export class SessionKeyStore {
  /**
   * Almacena session_key derivada de ECDH
   */
  async storeSessionKey(sessionKey: CryptoKey, totpu: string): Promise<void> {
    try {
      // Exportar clave a formato JWK
      const keyData = await crypto.subtle.exportKey('jwk', sessionKey);
      
      const session: StoredSession = {
        sessionKey: keyData,
        totpu,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
      };

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      console.log('[SessionKeyStore] Session key almacenada');
    } catch (error) {
      console.error('[SessionKeyStore] Error almacenando session key:', error);
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
