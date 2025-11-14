/**
 * Camera Manager
 * Responsabilidad: Administrar el ciclo de vida del lector ZXing
 */
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import type { ScannerCallback } from '../domain/qr-reader.types';

export class CameraManager {
  private readonly reader: BrowserMultiFormatReader;
  private controls: IScannerControls | null;
  private videoElementId: string;

  constructor(videoElementId: string) {
    this.reader = new BrowserMultiFormatReader();
    this.controls = null;
    this.videoElementId = videoElementId;
  }

  async start(onResult: ScannerCallback, onError: (message: string) => void): Promise<void> {
    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices.length) {
        onError('No se encontraron cámaras disponibles');
        return;
      }

      const preferredDeviceId = devices.find((device: MediaDeviceInfo) => /back|rear/i.test(device.label))?.deviceId;

      this.controls = await this.reader.decodeFromVideoDevice(
        preferredDeviceId ?? devices[0].deviceId,
        this.videoElementId,
        (result: unknown, error: unknown) => {
          if (result) {
            onResult({
              text: (result as { getText: () => string }).getText(),
              timestamp: Date.now(),
            });
          }

          if (error && !(error instanceof NotFoundException)) {
            const message =
              error instanceof Error
                ? error.message
                : 'Error desconocido al leer el QR';
            onError(message);
          }
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar la cámara';
      onError(message);
    }
  }

  async stop(): Promise<void> {
    this.controls?.stop();
    this.reader.reset();
    this.controls = null;
  }
}
