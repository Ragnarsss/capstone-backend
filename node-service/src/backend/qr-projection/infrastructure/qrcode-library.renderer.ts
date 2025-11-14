/**
 * @deprecated Este archivo ya no se utiliza
 * 
 * La generación de imágenes QR ahora se realiza en el frontend
 * para reducir carga del servidor y mejorar escalabilidad.
 * 
 * Backend solo genera el payload/mensaje del QR.
 * Frontend usa la librería qrcode para renderizar la imagen.
 * 
 * Mantenido como referencia histórica.
 */

/*
import QRCode from 'qrcode';
import type { QRCodeRenderer } from '../domain/qr-generator';

export interface QRCodeRenderConfig {
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  margin: number;
  width: number;
}

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
*/
