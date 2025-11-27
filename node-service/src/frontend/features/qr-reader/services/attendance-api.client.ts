/**
 * Attendance API Client
 * Cliente para endpoint de validación de asistencia
 */

interface ValidatePayloadRequest {
  encrypted: string;
  studentId: number;
}

interface ValidatePayloadSuccess {
  success: true;
  data: {
    sessionId: string;
    hostUserId: number;
    round: number;
    validatedAt: string;
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
  data?: {
    sessionId: string;
    round: number;
    validatedAt: string;
  };
}

export class AttendanceApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '/asistencia/api/attendance') {
    this.baseUrl = baseUrl;
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

      const result: ValidatePayloadResponse = await response.json();

      if (result.success) {
        return {
          valid: true,
          message: `Asistencia registrada - Ronda ${result.data.round}`,
          data: {
            sessionId: result.data.sessionId,
            round: result.data.round,
            validatedAt: result.data.validatedAt,
          },
        };
      }

      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        INVALID_PAYLOAD_FORMAT: 'Codigo QR invalido',
        DECRYPTION_FAILED: 'Error al descifrar codigo',
        PAYLOAD_NOT_FOUND: 'Codigo QR expirado',
        PAYLOAD_ALREADY_CONSUMED: 'Codigo ya utilizado',
        STUDENT_MISMATCH: 'Este codigo no te pertenece',
        PAYLOAD_EXPIRED: 'Codigo QR expirado',
        VALIDATION_ERROR: 'Error de validacion',
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
        message: 'Error de conexion. Intenta de nuevo.',
      };
    }
  }
}
