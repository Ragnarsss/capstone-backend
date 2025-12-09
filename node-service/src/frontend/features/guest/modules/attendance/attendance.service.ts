/**
 * Attendance Service
 * Responsabilidad: Lógica de negocio de asistencia
 * 
 * Este servicio:
 * - Verifica sesiones activas
 * - Registra participación del estudiante
 * - Valida QR escaneados
 * - Maneja el flujo de rounds
 * 
 * NO maneja: cámara, UI, autenticación
 */

import { getSessionKeyStore, SessionKeyStore } from '../enrollment/session-key.store';
import { decryptQR, encryptPayload } from '../../../../shared/crypto/aes-gcm';

export interface ActiveSession {
  hasActiveSession: boolean;
  sessionId?: string;
  hostUsername?: string;
  message?: string;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  currentRound?: number;
  errorCode?: string;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  status?: 'partial' | 'completed';
  nextRound?: number;
  sessionId?: string;
  errorCode?: string;
}

export interface QRPayload {
  sid: string;     // Session ID
  uid: number;     // User ID
  r: number;       // Round
  n: string;       // Nonce
  ts: number;      // Timestamp
  ttl: number;     // TTL en segundos
}

export class AttendanceService {
  private baseUrl: string;
  private sessionKeyStore: SessionKeyStore;
  private expectedRound: number = 1;

  constructor(baseUrl: string = '/asistencia/api/attendance') {
    this.baseUrl = baseUrl;
    this.sessionKeyStore = getSessionKeyStore();
  }

  /**
   * Consulta si hay una sesión de QR activa
   */
  async getActiveSession(): Promise<ActiveSession> {
    try {
      const response = await fetch(`${this.baseUrl}/active-session`);
      const result = await response.json();

      if (!response.ok) {
        return {
          hasActiveSession: false,
          message: 'Error al consultar sesión',
        };
      }

      return {
        hasActiveSession: result.data.hasActiveSession,
        sessionId: result.data.sessionId,
        hostUsername: result.data.hostUsername,
        message: result.data.message,
      };
    } catch (error) {
      console.error('[AttendanceService] Error:', error);
      return {
        hasActiveSession: false,
        message: 'Error de conexión',
      };
    }
  }

  /**
   * Registra al estudiante en la sesión activa
   * Esto genera su QR y lo agrega al pool de proyección
   */
  async register(sessionId: string, studentId: number): Promise<RegisterResult> {
    try {
      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, studentId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          message: result.error?.message || 'Error al registrar',
          errorCode: result.error?.code,
        };
      }

      this.expectedRound = result.data.currentRound || 1;

      return {
        success: true,
        message: 'Registrado exitosamente',
        currentRound: result.data.currentRound,
      };
    } catch (error) {
      console.error('[AttendanceService] Error:', error);
      return {
        success: false,
        message: 'Error de conexión',
      };
    }
  }

  /**
   * Procesa un QR detectado
   * Retorna null si el QR no es para este estudiante o round
   */
  async processQR(encryptedText: string, studentId: number): Promise<ValidationResult | null> {
    try {
      // 1. Intentar desencriptar
      console.log('[AttendanceService] Desencriptando QR...');
      const payloadJson = await decryptQR(encryptedText);
      const payload: QRPayload = JSON.parse(payloadJson);

      // 2. Verificar formato básico
      if (typeof payload.r !== 'number' || typeof payload.uid !== 'number') {
        console.log('[AttendanceService] Formato inválido');
        return null;
      }

      // 3. Verificar que el QR es para este estudiante
      if (payload.uid !== studentId) {
        // No es nuestro QR, ignorar silenciosamente
        return null;
      }

      // 4. Verificar round esperado
      if (payload.r !== this.expectedRound) {
        console.log(`[AttendanceService] Round incorrecto: esperado=${this.expectedRound}, recibido=${payload.r}`);
        return null;
      }

      console.log(`[AttendanceService] QR válido! uid=${payload.uid}, r=${payload.r}`);

      // 5. Construir y enviar respuesta
      return await this.sendValidation(payload, studentId);

    } catch (error) {
      // Error de desencriptación = no es nuestro QR
      console.warn('[AttendanceService] Error procesando QR:', error);
      return null;
    }
  }

  /**
   * Envía la validación al servidor
   */
  private async sendValidation(payload: QRPayload, studentId: number): Promise<ValidationResult> {
    try {
      // Construir respuesta con payload original
      const responsePayload = {
        original: payload,
        studentId,
        receivedAt: Date.now(),
        totpu: this.sessionKeyStore.getTotpu(),
      };

      // Encriptar respuesta
      const encrypted = await encryptPayload(JSON.stringify(responsePayload));

      // Enviar al servidor
      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ encrypted, studentId }),
      });

      if (response.status === 429) {
        return {
          valid: false,
          message: 'Demasiados intentos. Espera un momento.',
          errorCode: 'RATE_LIMIT',
        };
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMessages: Record<string, string> = {
          INVALID_PAYLOAD_FORMAT: 'Formato inválido',
          DECRYPTION_FAILED: 'Error de seguridad',
          INVALID_ROUND: 'Ronda incorrecta',
          ROUND_TIMEOUT: 'Tiempo agotado',
          SESSION_EXPIRED: 'Sesión expirada',
          ALREADY_COMPLETED: 'Ya registraste asistencia',
        };

        return {
          valid: false,
          message: errorMessages[result.error?.code] || result.error?.message || 'Error de validación',
          errorCode: result.error?.code,
        };
      }

      // Actualizar round esperado
      if (result.data.next_round) {
        this.expectedRound = result.data.next_round;
      }

      return {
        valid: true,
        message: result.data.status === 'completed' 
          ? '¡Asistencia completada!' 
          : `Ronda ${payload.r} completada`,
        status: result.data.status,
        nextRound: result.data.next_round,
        sessionId: result.data.sessionId,
      };

    } catch (error) {
      console.error('[AttendanceService] Error:', error);
      return {
        valid: false,
        message: 'Error de conexión',
        errorCode: 'CONNECTION_ERROR',
      };
    }
  }

  /**
   * Obtiene el estado actual del estudiante en la sesión
   */
  async getStatus(sessionId: string, studentId: number): Promise<{
    registered: boolean;
    currentRound: number;
    completedRounds: number;
    isComplete: boolean;
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/status?sessionId=${sessionId}&studentId=${studentId}`
      );
      const result = await response.json();

      if (!result.success) {
        return {
          registered: false,
          currentRound: 1,
          completedRounds: 0,
          isComplete: false,
        };
      }

      return {
        registered: true,
        currentRound: result.data.currentRound || 1,
        completedRounds: result.data.completedRounds || 0,
        isComplete: result.data.isComplete || false,
      };
    } catch (error) {
      console.error('[AttendanceService] Error:', error);
      return {
        registered: false,
        currentRound: 1,
        completedRounds: 0,
        isComplete: false,
      };
    }
  }

  /**
   * Obtiene el round esperado actual
   */
  getExpectedRound(): number {
    return this.expectedRound;
  }

  /**
   * Resetea el contador de rounds (para reintentos)
   */
  resetRounds(): void {
    this.expectedRound = 1;
  }
}

/**
 * Singleton para uso global
 */
let instance: AttendanceService | null = null;

export function getAttendanceService(): AttendanceService {
  if (!instance) {
    instance = new AttendanceService();
  }
  return instance;
}
