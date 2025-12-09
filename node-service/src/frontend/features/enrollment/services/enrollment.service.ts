/**
 * Enrollment Service
 * Responsabilidad: Comunicación con API de enrollment + WebAuthn
 */
import type { 
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';
import { startRegistration } from '@simplewebauthn/browser';
import { AuthClient } from '../../../shared/auth/auth-client';

export interface EnrollmentStatus {
  hasDevices: boolean;
  deviceCount: number;
  devices?: Array<{
    deviceId: number;
    credentialId: string;
    aaguid: string;
    enrolledAt: string;
    lastUsedAt?: string;
  }>;
}

export interface StartEnrollmentResult {
  success: boolean;
  options?: PublicKeyCredentialCreationOptionsJSON;
  penaltyInfo?: {
    enrollmentCount: number;
    nextDelayMinutes: number;
  };
  error?: string;
}

export interface FinishEnrollmentResult {
  success: boolean;
  deviceId?: number;
  credentialId?: string;
  error?: string;
}

export interface RevokeResult {
  success: boolean;
  error?: string;
}

export class EnrollmentService {
  private authClient = new AuthClient();
  private baseUrl = '/api/enrollment';

  /**
   * Verifica si WebAuthn está soportado en este navegador
   */
  isWebAuthnSupported(): boolean {
    return (
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function'
    );
  }

  /**
   * Obtiene el estado de enrollment del usuario
   */
  async getStatus(): Promise<EnrollmentStatus> {
    const response = await fetch(`${this.baseUrl}/status`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Inicia el proceso de enrollment
   * Retorna las opciones para WebAuthn
   */
  async startEnrollment(): Promise<StartEnrollmentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/start`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.authClient.getUsername(),
          displayName: this.authClient.getUsername(),
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
      return {
        success: true,
        options: data.options,
        penaltyInfo: data.penaltyInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de red',
      };
    }
  }

  /**
   * Crea credencial WebAuthn usando el navegador
   * Esto muestra el diálogo de biometría/PIN
   */
  async createCredential(
    options: PublicKeyCredentialCreationOptionsJSON
  ): Promise<RegistrationResponseJSON> {
    // Usar SimpleWebAuthn browser helper
    return await startRegistration({ optionsJSON: options });
  }

  /**
   * Completa el enrollment enviando la credencial al servidor
   */
  async finishEnrollment(
    credential: RegistrationResponseJSON
  ): Promise<FinishEnrollmentResult> {
    try {
      // Generar fingerprint del dispositivo
      const deviceFingerprint = await this.generateDeviceFingerprint();

      const response = await fetch(`${this.baseUrl}/finish`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential,
          deviceFingerprint,
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
      return {
        success: true,
        deviceId: data.deviceId,
        credentialId: data.credentialId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de red',
      };
    }
  }

  /**
   * Revoca un dispositivo
   */
  async revokeDevice(deviceId: number): Promise<RevokeResult> {
    try {
      const response = await fetch(`${this.baseUrl}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Error ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de red',
      };
    }
  }

  /**
   * Genera un fingerprint simple del dispositivo
   * Usado para identificar el dispositivo en logs y UI
   */
  private async generateDeviceFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
    ];

    const text = components.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex.substring(0, 32);
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.authClient.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}
