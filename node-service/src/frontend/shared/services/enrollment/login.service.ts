/**
 * Login Service
 * Responsabilidad: ECDH key exchange para obtener session_key
 *
 * Flujo:
 * 1. Cliente genera par ECDH efímero
 * 2. Envía clave pública al servidor
 * 3. Servidor responde con su clave pública + TOTPu
 * 4. Cliente deriva shared secret
 * 5. Cliente deriva session_key con HKDF
 * 6. Session key se almacena automáticamente en SessionKeyStore
 *
 * NOTA: Servicio compartido usado por enrollment, guest y qr-reader features
 */

import { SessionKeyStore, getSessionKeyStore } from './session-key.store';
import type { AuthClient } from '../../../shared/auth/auth-client';

export interface LoginResult {
  success: boolean;
  sessionKey?: CryptoKey;
  totpu?: string;
  deviceId?: number;
  error?: string;
}

export class LoginService {
  private baseUrl: string;
  private sessionKeyStore: SessionKeyStore;
  private authClient?: AuthClient;

  /**
   * Constructor con inyección de dependencias
   * @param authClient - Cliente de autenticación (opcional, para obtener JWT)
   * @param baseUrl - URL base del API (opcional, auto-detecta si no se provee)
   * @param sessionKeyStore - Store de session keys (opcional, usa singleton por defecto)
   */
  constructor(
    authClient?: AuthClient,
    baseUrl?: string,
    sessionKeyStore?: SessionKeyStore
  ) {
    this.authClient = authClient;
    this.sessionKeyStore = sessionKeyStore || getSessionKeyStore();

    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      // Auto-detectar si estamos embebidos en PHP o acceso directo a Node
      // NOTA: Login ECDH esta en dominio session, no enrollment (fase 19.2)
      const isEmbeddedInPhp =
        window.location.port === '9500' ||
        window.location.port === '9505' ||
        window.location.port === '';
      this.baseUrl = isEmbeddedInPhp ? '/minodo-api/session' : '/api/session';
    }
  }

  /**
   * Realiza login ECDH para obtener session_key
   * @param credentialId - ID del credential FIDO2
   * @param token - JWT token (opcional, usa authClient si no se provee)
   */
  async performLogin(credentialId: string, token?: string): Promise<LoginResult> {
    try {
      // 1. Generar par de claves ECDH efímeras
      const keyPair = await this.generateEcdhKeyPair();
      const clientPublicKeyBase64 = await this.exportPublicKey(keyPair.publicKey);

      // 2. Obtener token de autenticación
      const authToken = token || this.getAuthToken();
      if (!authToken) {
        return {
          success: false,
          error: 'No se encontró token de autenticación',
        };
      }

      // 3. Enviar al servidor
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId,
          clientPublicKey: clientPublicKeyBase64,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || errorData.error || `Error ${response.status}`,
        };
      }

      const data = await response.json();

      // 4. Importar clave pública del servidor
      const serverPublicKey = await this.importPublicKey(data.serverPublicKey);

      // 5. Derivar shared secret usando ECDH
      const sharedSecret = await this.deriveSharedSecret(keyPair.privateKey, serverPublicKey);

      // 6. Derivar session_key usando HKDF
      const sessionKey = await this.deriveSessionKey(sharedSecret);

      // 7. Almacenar automáticamente en SessionKeyStore
      await this.sessionKeyStore.storeSessionKey(sessionKey, data.totpu, data.deviceId);

      return {
        success: true,
        sessionKey,
        totpu: data.totpu,
        deviceId: data.deviceId,
      };
    } catch (error) {
      console.error('[LoginService] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error en login',
      };
    }
  }

  /**
   * Verifica si ya tiene una sesión válida
   */
  hasValidSession(): boolean {
    return this.sessionKeyStore.hasSessionKey();
  }

  /**
   * Obtiene la session key almacenada
   */
  async getStoredSessionKey(): Promise<CryptoKey | null> {
    return this.sessionKeyStore.getSessionKey();
  }

  /**
   * Genera par de claves ECDH usando P-256
   */
  private async generateEcdhKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveBits']
    );
  }

  /**
   * Exporta clave pública a Base64
   */
  private async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', publicKey);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Importa clave pública desde Base64
   */
  private async importPublicKey(base64: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64);
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );
  }

  /**
   * Deriva shared secret usando ECDH
   */
  private async deriveSharedSecret(
    privateKey: CryptoKey,
    publicKey: CryptoKey
  ): Promise<ArrayBuffer> {
    return await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      256
    );
  }

  /**
   * Deriva session_key desde shared secret usando HKDF
   */
  private async deriveSessionKey(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveKey']
    );

    const info = new TextEncoder().encode('attendance-session-key-v1');

    return await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info,
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private getAuthToken(): string | null {
    return this.authClient?.getToken() ?? null;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Singleton para uso global
 */
let instance: LoginService | null = null;

export function getLoginService(): LoginService {
  if (!instance) {
    instance = new LoginService();
  }
  return instance;
}
