/**
 * AccessService (Frontend)
 * Cliente HTTP para GET /api/access/state
 * Responsabilidad: Obtener estado agregado de acceso del usuario
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
 * AccessService
 * Cliente para el Access Gateway endpoint
 */
export class AccessService {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/access') {
    this.baseUrl = baseUrl;
  }

  /**
   * Obtiene el estado agregado del usuario
   *
   * Llama a GET /api/access/state
   * El backend determina el estado basándose en:
   * 1. Restricciones activas
   * 2. Enrollment de dispositivo
   * 3. Sesión activa
   *
   * @returns Estado agregado del sistema
   * @throws Error si la solicitud falla
   */
  async getState(): Promise<AccessState> {
    try {
      const response = await fetch(`${this.baseUrl}/state`, {
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
