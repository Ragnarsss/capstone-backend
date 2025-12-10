/**
 * Login Service
 * Responsabilidad: ECDH key exchange para obtener session_key
 */
import { AuthClient } from '../../../shared/auth/auth-client';

export interface LoginResult {
  success: boolean;
  sessionKey?: CryptoKey;
  totpu?: string;
  deviceId?: number;
  error?: string;
}

export class LoginService {
  private authClient = new AuthClient();
  private baseUrl: string;

  constructor() {
    // Detectar si estamos embebidos en PHP (puerto 9500/9505) o acceso directo a Node (9503)
    const isEmbeddedInPhp = window.location.port === '9500' || 
                            window.location.port === '9505' ||
                            window.location.port === '';
    this.baseUrl = isEmbeddedInPhp ? '/minodo-api/enrollment' : '/api/enrollment';
  }

  /**
   * Realiza login ECDH para obtener session_key
   * 
   * Flujo:
   * 1. Genera par de claves ECDH efímeras (cliente)
   * 2. Envía clave pública al servidor
   * 3. Servidor responde con su clave pública
   * 4. Cliente deriva shared secret
   * 5. Cliente deriva session_key con HKDF
   */
  async performLogin(credentialId: string): Promise<LoginResult> {
    try {
      // 1. Generar par de claves ECDH efímeras
      const keyPair = await this.generateEcdhKeyPair();
      const clientPublicKeyBase64 = await this.exportPublicKey(keyPair.publicKey);

      // 2. Enviar al servidor
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
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
          error: errorData.message || `Error ${response.status}`,
        };
      }

      const data = await response.json();
      
      // 3. Importar clave pública del servidor
      const serverPublicKey = await this.importPublicKey(data.serverPublicKey);

      // 4. Derivar shared secret usando ECDH
      const sharedSecret = await this.deriveSharedSecret(
        keyPair.privateKey,
        serverPublicKey
      );

      // 5. Derivar session_key usando HKDF
      const sessionKey = await this.deriveSessionKey(sharedSecret);

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
   * Genera par de claves ECDH usando P-256
   */
  private async generateEcdhKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true, // extractable
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
      256 // 32 bytes
    );
  }

  /**
   * Deriva session_key desde shared secret usando HKDF
   */
  private async deriveSessionKey(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
    // Importar shared secret como clave para HKDF
    const baseKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveKey']
    );

    // Derivar session_key con contexto específico
    const info = new TextEncoder().encode('attendance-session-key-v1');
    
    return await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0), // Salt vacío
        info,
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable para poder exportar
      ['encrypt', 'decrypt']
    );
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

  private getAuthHeaders(): Record<string, string> {
    const token = this.authClient.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}
