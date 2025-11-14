/**
 * QR Reader Service
 * Responsabilidad: Orquestar el flujo de lectura y estado del lector
 */
import type { ScannerResult } from '../domain/qr-reader.types';
import { CameraManager } from '../infrastructure/camera-manager';
import { QRReaderComponent } from '../presentation/qr-reader.component';

export class QRReaderService {
  private readonly component: QRReaderComponent;
  private readonly cameraManager: CameraManager;
  private authReady: boolean;
  private scanning: boolean;

  constructor(component: QRReaderComponent, cameraManager: CameraManager) {
    this.component = component;
    this.cameraManager = cameraManager;
    this.authReady = false;
    this.scanning = false;
  }

  initialize(): void {
    this.component.mount();
    this.component.resetResult();
    this.component.showWaitingAuth();

    this.component.onStart(() => {
      void this.start();
    });

    this.component.onStop(() => {
      void this.stop();
    });
  }

  markAuthReady(): void {
    this.authReady = true;
    this.component.showReady();
  }

  async start(): Promise<void> {
    if (!this.authReady) {
      this.component.showError('Aún no se valida la sesión');
      return;
    }
    if (this.scanning) return;
    this.scanning = true;
    this.component.showScanning();
    this.component.resetResult();

    try {
      await this.cameraManager.start(
        (result: ScannerResult) => {
          this.component.showResult(result.text);
        },
        (message: string) => {
          this.component.showError(message);
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al iniciar el lector';
      this.component.showError(message);
      this.scanning = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.scanning) return;
    await this.cameraManager.stop();
    this.component.showReady();
    this.scanning = false;
  }
}
