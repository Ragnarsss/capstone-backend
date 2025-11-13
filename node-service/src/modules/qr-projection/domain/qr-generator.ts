import type { QRCode as QRCodeModel } from './models';

/**
 * Interfaz para renderizado de códigos QR
 * Abstracción que permite cambiar la implementación sin afectar el dominio
 */
export interface QRCodeRenderer {
  /**
   * Renderiza un mensaje como código QR en formato Data URL
   * @param message Mensaje a codificar
   * @returns Promise con el Data URL del QR generado
   */
  renderToDataURL(message: string): Promise<string>;
}

/**
 * Domain service: Generación de códigos QR
 * Responsabilidad: Orquestar la lógica de negocio de generación de QR codes
 */
export class QRGenerator {
  private readonly renderer: QRCodeRenderer;

  constructor(renderer: QRCodeRenderer) {
    this.renderer = renderer;
  }

  private generateUniqueMessage(sessionId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `ASISTENCIA:${sessionId}:${timestamp}:${random}`;
  }

  async generate(sessionId: string): Promise<QRCodeModel> {
    const message = this.generateUniqueMessage(sessionId);
    const qrData = await this.renderer.renderToDataURL(message);

    return {
      data: qrData,
      timestamp: Date.now(),
      sessionId,
    };
  }
}
