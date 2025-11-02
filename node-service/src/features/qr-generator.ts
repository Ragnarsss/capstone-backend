import QRCode from 'qrcode';
import type { QRMessage } from '../types';

// Slice vertical: generacion de codigos QR
export class QRGenerator {
  // Genera un mensaje unico basado en timestamp y session
  private generateUniqueMessage(sessionId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `ASISTENCIA:${sessionId}:${timestamp}:${random}`;
  }

  // Crea un QR message completo con data y metadata
  async createQRMessage(sessionId: string): Promise<QRMessage> {
    const message = this.generateUniqueMessage(sessionId);

    // Genera el QR como data URL (base64 embebido)
    const qrData = await QRCode.toDataURL(message, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
    });

    return {
      qrData,
      timestamp: Date.now(),
      sessionId,
    };
  }
}
