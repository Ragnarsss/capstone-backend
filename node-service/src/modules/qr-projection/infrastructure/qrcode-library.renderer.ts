import QRCode from 'qrcode';
import type { QRCodeRenderer } from '../domain/qr-generator';

/**
 * Configuración para el renderizado de QR codes
 */
export interface QRCodeRenderConfig {
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  margin: number;
  width: number;
}

/**
 * Implementación de QRCodeRenderer usando la librería 'qrcode'
 * Responsabilidad: Detalle técnico de cómo se genera el QR usando una librería específica
 */
export class QRCodeLibraryRenderer implements QRCodeRenderer {
  private readonly config: QRCodeRenderConfig;

  constructor(config: QRCodeRenderConfig) {
    this.config = config;
  }

  async renderToDataURL(message: string): Promise<string> {
    return await QRCode.toDataURL(message, {
      errorCorrectionLevel: this.config.errorCorrectionLevel,
      margin: this.config.margin,
      width: this.config.width,
    });
  }
}
