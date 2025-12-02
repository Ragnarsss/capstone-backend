/**
 * Attendance API Client
 * Cliente para endpoint de validación de asistencia
 */

/**
 * Respuesta de sesión activa
 */
interface ActiveSessionResponse {
  success: true;
  data: {
    hasActiveSession: boolean;
    sessionId?: string;
    hostUsername?: string;
    startedAt?: number;
    message?: string;
  };
}

export interface ActiveSessionResult {
  hasActiveSession: boolean;
  sessionId?: string;
  hostUsername?: string;
  message?: string;
}

interface RegisterRequest {
  sessionId: string;
  studentId: number;
}

interface RegisterSuccess {
  success: true;
  data: {
    currentRound: number;
    qrPayload?: string;
  };
}

interface RegisterError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type RegisterResponse = RegisterSuccess | RegisterError;

export interface RegisterResult {
  success: boolean;
  message: string;
  currentRound?: number;
}

interface ValidatePayloadRequest {
  encrypted: string;
  studentId: number;
}

interface ValidatePayloadSuccess {
  success: true;
  data: {
    status: 'partial' | 'completed';
    next_round?: number;
    message?: string;
    sessionId?: string;
  };
}

interface ValidatePayloadError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type ValidatePayloadResponse = ValidatePayloadSuccess | ValidatePayloadError;

export interface ValidationResult {
  valid: boolean;
  message: string;
  status?: 'partial' | 'completed';
  nextRound?: number;
  sessionId?: string;
}

export class AttendanceApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '/asistencia/api/attendance') {
    this.baseUrl = baseUrl;
  }

  /**
   * Consulta si hay una sesión de QR activa
   */
  async getActiveSession(): Promise<ActiveSessionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/active-session`);
      const result: ActiveSessionResponse = await response.json();

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
      console.error('[AttendanceApiClient] Error fetching active session:', error);
      return {
        hasActiveSession: false,
        message: 'Error de conexión',
      };
    }
  }

  /**
   * Registra la participación del estudiante en una sesión
   * Esto genera el QR inicial y lo agrega al pool de proyección
   */
  async registerParticipation(sessionId: string, studentId: number): Promise<RegisterResult> {
    try {
      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          studentId,
        } satisfies RegisterRequest),
      });

      const result: RegisterResponse = await response.json();

      if (!response.ok || !result.success) {
        const errorMessage = !result.success 
          ? result.error.message 
          : `Error del servidor (${response.status})`;
        return {
          success: false,
          message: errorMessage,
        };
      }

      return {
        success: true,
        message: 'Registrado exitosamente',
        currentRound: result.data.currentRound,
      };
    } catch (error) {
      console.error('[AttendanceApiClient] Error registering:', error);
      return {
        success: false,
        message: 'Error de conexión',
      };
    }
  }

  async validatePayload(encrypted: string, studentId: number): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encrypted,
          studentId,
        } satisfies ValidatePayloadRequest),
      });

      if (response.status === 429) {
        return {
          valid: false,
          message: 'Demasiados intentos. Por favor espera un momento.',
        };
      }

      const result: ValidatePayloadResponse = await response.json();

      if (!response.ok) {
        // Si el status no es 2xx, tratamos de extraer el mensaje de error del body
        if (!result.success && result.error) {
             const errorMessages: Record<string, string> = {
                INVALID_PAYLOAD_FORMAT: 'Formato inválido',
                DECRYPTION_FAILED: 'Error de seguridad',
                INVALID_ROUND: 'Ronda incorrecta',
                ROUND_TIMEOUT: 'Tiempo agotado para la ronda',
                SESSION_EXPIRED: 'Sesión expirada',
                ALREADY_COMPLETED: 'Asistencia ya registrada',
                RATE_LIMIT_EXCEEDED: 'Demasiados intentos',
              };
            const userMessage = errorMessages[result.error.code] || result.error.message;
            return {
                valid: false,
                message: userMessage
            };
        }
        
        return {
            valid: false,
            message: `Error del servidor (${response.status})`
        };
      }

      if (result.success) {
        return {
          valid: true,
          message: result.data.message || 'Validación exitosa',
          status: result.data.status,
          nextRound: result.data.next_round,
          sessionId: result.data.sessionId,
        };
      }

      // Fallback for 200 OK but success: false (legacy or specific logic)
      const errorMessages: Record<string, string> = {
        INVALID_PAYLOAD_FORMAT: 'Formato inválido',
        DECRYPTION_FAILED: 'Error de seguridad',
        INVALID_ROUND: 'Ronda incorrecta',
        ROUND_TIMEOUT: 'Tiempo agotado para la ronda',
        SESSION_EXPIRED: 'Sesión expirada',
        ALREADY_COMPLETED: 'Asistencia ya registrada',
      };

      const userMessage = errorMessages[result.error.code] || result.error.message;
      return {
        valid: false,
        message: userMessage,
      };
    } catch (error) {
      console.error('[AttendanceApiClient] Error validating payload:', error);
      return {
        valid: false,
        message: 'Error de conexión',
      };
    }
  }
}
