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

export interface DeviceInfo {
  deviceId: number;
  credentialId: string;
  aaguid: string;
  enrolledAt: string;
  lastUsedAt?: string;
}

export interface GetDevicesResult {
  deviceCount: number;
  devices: DeviceInfo[];
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
  private baseUrl: string;

  constructor() {
    // Detectar si estamos embebidos en PHP (puerto 9500/9505) o acceso directo a Node (9503)
    // PHP proxea /minodo-api/* -> Node /api/*
    const isEmbeddedInPhp = window.location.port === '9500' || 
                            window.location.port === '9505' ||
                            window.location.port === '';  // Puerto default (80/443)
    this.baseUrl = isEmbeddedInPhp ? '/minodo-api/enrollment' : '/api/enrollment';
  }

  /**
   * Enviar log al servidor (fire and forget)
   */
  private sendLog(level: string, message: string, data?: unknown): void {
    const logEntry = {
      logs: [{
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
      }]
    };
    
    // Fire and forget - no await
    fetch(`${this.baseUrl}/client-log`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logEntry),
    }).catch(() => { /* ignore */ });
  }

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
   * Obtiene la lista de dispositivos del usuario
   */
  async getDevices(): Promise<GetDevicesResult> {
    const response = await fetch(`${this.baseUrl}/devices`, {
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
    this.sendLog('info', 'startEnrollment: INICIO', { url: `${this.baseUrl}/start` });
    
    try {
      const response = await fetch(`${this.baseUrl}/start`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.authClient.getUserName(),
          displayName: this.authClient.getUserName(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.sendLog('error', 'startEnrollment: Error HTTP', { status: response.status, error: errorData });
        return {
          success: false,
          error: errorData.message || `Error ${response.status}`,
        };
      }

      const data = await response.json();
      this.sendLog('success', 'startEnrollment: ÉXITO', { 
        hasOptions: !!data.options, 
        hasPenalty: !!data.penaltyInfo,
        challengeLength: data.options?.challenge?.length 
      });
      return {
        success: true,
        options: data.options,
        penaltyInfo: data.penaltyInfo,
      };
    } catch (error) {
      this.sendLog('error', 'startEnrollment: Error de red', { error: error instanceof Error ? error.message : String(error) });
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
    this.sendLog('info', 'createCredential: INICIO', {
      hasOptions: !!options,
      hasChallenge: !!options?.challenge,
      rpId: options?.rp?.id,
      rpName: options?.rp?.name,
      userAgent: navigator.userAgent,
    });
    
    console.log('[EnrollmentService] createCredential options:', JSON.stringify(options, null, 2));
    
    if (!options || !options.challenge) {
      this.sendLog('error', 'createCredential: Opciones inválidas', { options });
      console.error('[EnrollmentService] Invalid options:', options);
      throw new Error('Opciones de registro inválidas');
    }
    
    try {
      this.sendLog('info', 'createCredential: Llamando startRegistration...');
      const result = await startRegistration({ optionsJSON: options });
      
      this.sendLog('success', 'createCredential: ÉXITO', {
        credentialId: result?.id?.substring(0, 30),
        type: result?.type,
        hasResponse: !!result?.response,
      });
      
      console.log('[EnrollmentService] createCredential result id:', result?.id);
      console.log('[EnrollmentService] createCredential result rawId:', result?.rawId);
      console.log('[EnrollmentService] createCredential result type:', result?.type);
      console.log('[EnrollmentService] createCredential has response:', !!result?.response);
      return result;
    } catch (error) {
      const errorInfo = error instanceof Error 
        ? { name: error.name, message: error.message, stack: error.stack?.substring(0, 200) }
        : String(error);
      this.sendLog('error', 'createCredential: ERROR en startRegistration', errorInfo);
      console.error('[EnrollmentService] createCredential error:', error);
      throw error;
    }
  }

  /**
   * Completa el enrollment enviando la credencial al servidor
   */
  async finishEnrollment(
    credential: RegistrationResponseJSON
  ): Promise<FinishEnrollmentResult> {
    console.log('[EnrollmentService] finishEnrollment credential:', {
      id: credential?.id,
      rawId: credential?.rawId,
      type: credential?.type,
      hasResponse: !!credential?.response,
    });
    
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
