/**
 * Scanner Service
 * Responsabilidad: Detección y decodificación de códigos QR
 * 
 * Este servicio:
 * - Usa ZXing para detectar QR en el stream de video
 * - Emite eventos cuando detecta un QR
 * - NO valida ni procesa el contenido del QR
 */

import {
  BrowserMultiFormatReader,
  IScannerControls,
} from '@zxing/browser';
import { NotFoundException, Result, Exception } from '@zxing/library';

export interface QRDetection {
  text: string;
  timestamp: number;
}

export type QRDetectionCallback = (detection: QRDetection) => void;
export type ScannerErrorCallback = (error: string) => void;

export class ScannerService {
  private reader: BrowserMultiFormatReader | null = null;
  private controls: IScannerControls | null = null;
  private isScanning: boolean = false;
  private onDetection: QRDetectionCallback | null = null;
  private onError: ScannerErrorCallback | null = null;

  /**
   * Inicia el escaneo de QR en el elemento video especificado
   */
  async start(
    videoElementId: string,
    onDetection: QRDetectionCallback,
    onError?: ScannerErrorCallback
  ): Promise<void> {
    if (this.isScanning) {
      console.warn('[ScannerService] Ya está escaneando');
      return;
    }

    this.onDetection = onDetection;
    this.onError = onError || null;
    this.reader = new BrowserMultiFormatReader();

    try {
      // Listar dispositivos de video
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      
      if (!devices.length) {
        throw new Error('No se encontraron cámaras disponibles');
      }

      // Preferir cámara trasera
      const preferredDevice = devices.find(
        (device: MediaDeviceInfo) => /back|rear|environment/i.test(device.label)
      );
      const deviceId = preferredDevice?.deviceId || devices[0].deviceId;

      console.log('[ScannerService] Usando cámara:', preferredDevice?.label || devices[0].label);

      // Iniciar decodificación continua
      this.controls = await this.reader.decodeFromVideoDevice(
        deviceId,
        videoElementId,
        (result: Result | undefined, error: Exception | undefined) => {
          if (result) {
            this.handleDetection(result.getText());
          }

          if (error && !(error instanceof NotFoundException)) {
            this.handleError(error);
          }
        }
      );

      this.isScanning = true;
      console.log('[ScannerService] Escaneo iniciado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al iniciar scanner';
      console.error('[ScannerService] Error:', message);
      this.onError?.(message);
      throw error;
    }
  }

  /**
   * Detiene el escaneo
   */
  stop(): void {
    if (this.controls) {
      this.controls.stop();
      this.controls = null;
    }

    this.reader = null;
    this.isScanning = false;
    this.onDetection = null;
    this.onError = null;

    console.log('[ScannerService] Escaneo detenido');
  }

  /**
   * Verifica si está escaneando
   */
  isActive(): boolean {
    return this.isScanning;
  }

  /**
   * Maneja una detección de QR
   */
  private handleDetection(text: string): void {
    if (!this.onDetection) return;

    const detection: QRDetection = {
      text,
      timestamp: Date.now(),
    };

    console.log('[ScannerService] QR detectado, longitud:', text.length);
    this.onDetection(detection);
  }

  /**
   * Maneja errores del scanner
   */
  private handleError(error: unknown): void {
    if (!this.onError) return;

    const message = error instanceof Error 
      ? error.message 
      : 'Error desconocido en scanner';
    
    this.onError(message);
  }
}

/**
 * Singleton para uso global
 */
let instance: ScannerService | null = null;

export function getScannerService(): ScannerService {
  if (!instance) {
    instance = new ScannerService();
  }
  return instance;
}
