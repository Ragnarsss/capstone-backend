import type { QRPayload } from './models';
import { SessionId } from './session-id';

/**
 * Domain service: Generación de payloads QR
 * Responsabilidad: Generar el mensaje/payload que será codificado en QR
 * 
 * Nota: El renderizado visual del QR se realiza en el frontend para reducir
 * carga del servidor y mejorar escalabilidad
 */
export class QRGenerator {
  private generateUniqueMessage(sessionId: SessionId): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `ASISTENCIA:${sessionId.toString()}:${timestamp}:${random}`;
  }

  generate(sessionId: SessionId): QRPayload {
    const message = this.generateUniqueMessage(sessionId);

    return {
      message,
      timestamp: Date.now(),
      sessionId,
    };
  }
}
