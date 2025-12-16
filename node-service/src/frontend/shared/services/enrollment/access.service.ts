/**
 * AccessService (Frontend)
 * Cliente HTTP para GET /api/access/state
 * Responsabilidad: Obtener estado agregado de acceso del usuario
 *
 * NOTA: Servicio compartido usado por enrollment, guest y qr-reader features
 */

/**
 * Estado agregado del sistema de acceso (espejo del backend)
 */
export interface AccessState {
  state: 'NOT_ENROLLED' | 'ENROLLED_NO_SESSION' | 'READY' | 'BLOCKED';
  action: 'enroll' | 'login' | 'scan' | null;
  device?: { credentialId: string; deviceId: number };
  message?: string;
}

/**
 * Utilidad para generar deviceFingerprint
 * Combina identificadores del navegador/dispositivo
 */
class DeviceFingerprintGenerator {
  static generate(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.hardwareConcurrency || 'unknown',
      navigator.deviceMemory || 'unknown',
      new Date().getTimezoneOffset(),
      screen.width,
      screen.height,
      screen.colorDepth,
    ];

    return this.hashComponents(components.join('|'));
  }

  private static hashComponents(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * AccessService
 * Cliente para el Access Gateway endpoint
 */
export class AccessService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      // Auto-detectar si estamos embebidos en PHP o acceso directo a Node
      const isEmbeddedInPhp =
        window.location.port === '9500' ||
        window.location.port === '9505' ||
        window.location.port === '';
      this.baseUrl = isEmbeddedInPhp ? '/minodo-api/access' : '/api/access';
    }
  }

  /**
   * Obtiene el estado agregado del usuario
   *
   * Llama a GET /api/access/state?deviceFingerprint={fingerprint}
   * El backend determina el estado basándose en:
   * 1. Restricciones activas
   * 2. Enrollment de dispositivo + validacion 1:1 con deviceFingerprint
   * 3. Sesión activa
   *
   * @returns Estado agregado del sistema
   * @throws Error si la solicitud falla
   */
  async getState(): Promise<AccessState> {
    try {
      // Generar huella del dispositivo actual
      const deviceFingerprint = DeviceFingerprintGenerator.generate();

      // Pasar deviceFingerprint al servidor para validacion 1:1
      const url = new URL(`${this.baseUrl}/state`, window.location.origin);
      url.searchParams.set('deviceFingerprint', deviceFingerprint);

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const state: AccessState = await response.json();
      return state;
    } catch (error) {
      console.error('[AccessService] Error fetching access state:', error);
      throw error;
    }
  }
}
