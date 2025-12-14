/**
 * Enrollment Service
 * Responsabilidad: Comunicación con API de enrollment + WebAuthn
 */

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

export interface EnrollmentStartResponse {
  success: boolean;
  options: PublicKeyCredentialCreationOptions;
  penaltyInfo?: {
    enrollmentCount: number;
    nextDelayMinutes: number;
  };
}

export interface EnrollmentFinishResponse {
  success: boolean;
  deviceId: number;
  credentialId: string;
  aaguid: string;
  penaltyInfo?: {
    newEnrollmentCount: number;
    nextDelayMinutes: number;
  };
}

export class EnrollmentService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '/minodo-api') {
    // Usar /minodo-api que Apache proxea a Node.js
    // Apache: /minodo-api/* -> http://node-service:3000/api/*
    this.baseUrl = baseUrl;
  }

  /**
   * Obtiene la lista de dispositivos del usuario
   */
  async getDevices(token: string): Promise<GetDevicesResult> {
    const response = await fetch(`${this.baseUrl}/enrollment/devices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener dispositivos: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Inicia el proceso de enrollment
   * Retorna las opciones para navigator.credentials.create()
   */
  async startEnrollment(token: string): Promise<EnrollmentStartResponse> {
    const response = await fetch(`${this.baseUrl}/enrollment/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Error al iniciar enrollment: ${response.status}`);
    }

    const data = await response.json();
    
    // Convertir las opciones para WebAuthn API
    const options = this.prepareCredentialOptions(data.options);
    
    return {
      success: true,
      options,
      penaltyInfo: data.penaltyInfo,
    };
  }

  /**
   * Completa el proceso de enrollment con la credencial
   */
  async finishEnrollment(
    token: string,
    credential: PublicKeyCredential,
    deviceFingerprint: string
  ): Promise<EnrollmentFinishResponse> {
    const credentialData = this.serializeCredential(credential);

    const response = await fetch(`${this.baseUrl}/enrollment/finish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: credentialData,
        deviceFingerprint,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Error al completar enrollment: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Prepara las opciones para navigator.credentials.create()
   * Convierte base64url strings a ArrayBuffer
   */
  private prepareCredentialOptions(options: any): PublicKeyCredentialCreationOptions {
    return {
      ...options,
      challenge: this.base64urlToBuffer(options.challenge),
      user: {
        ...options.user,
        id: this.base64urlToBuffer(options.user.id),
      },
      excludeCredentials: (options.excludeCredentials || []).map((cred: any) => ({
        ...cred,
        id: this.base64urlToBuffer(cred.id),
      })),
    };
  }

  /**
   * Serializa la credencial para enviar al servidor
   */
  private serializeCredential(credential: PublicKeyCredential): any {
    const response = credential.response as AuthenticatorAttestationResponse;
    
    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.bufferToBase64url(response.clientDataJSON),
        attestationObject: this.bufferToBase64url(response.attestationObject),
        transports: response.getTransports?.() || [],
      },
      authenticatorAttachment: credential.authenticatorAttachment,
    };
  }

  /**
   * Convierte base64url a ArrayBuffer
   */
  private base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * Convierte ArrayBuffer a base64url
   */
  private bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Genera un fingerprint del dispositivo
   */
  async generateDeviceFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
    ];
    
    const data = components.join('|');
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    
    return this.bufferToBase64url(hashBuffer);
  }

  /**
   * Verifica si WebAuthn está disponible
   */
  isWebAuthnAvailable(): boolean {
    return !!(
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === 'function'
    );
  }

  /**
   * Verifica si el dispositivo soporta autenticación de plataforma
   */
  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isWebAuthnAvailable()) {
      return false;
    }
    
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
}
