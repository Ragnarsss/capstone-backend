import QRCode from 'qrcode';
import type { QRCode as QRCodeModel } from './models';

/**
 * Domain service: Generación de códigos QR
 * Responsabilidad única: Lógica de generación de QR codes
 */
export class QRGenerator {
  private generateUniqueMessage(sessionId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `ASISTENCIA:${sessionId}:${timestamp}:${random}`;
  }

  async generate(sessionId: string): Promise<QRCodeModel> {
    const message = this.generateUniqueMessage(sessionId);

    const qrData = await QRCode.toDataURL(message, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
    });

    return {
      data: qrData,
      timestamp: Date.now(),
      sessionId,
    };
  }
}
