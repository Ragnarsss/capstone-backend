/**
 * QR Scan Service
 * Responsabilidad: Orquestar el flujo de lectura y estado del lector
 */
import type { ScannerResult } from './camera-manager';
import { CameraManager } from './camera-manager';
import type { CameraViewComponent } from '../ui/camera-view.component';

export class QRScanService {
  private readonly component: CameraViewComponent;
  private readonly cameraManager: CameraManager;
  private authReady: boolean;
  private scanning: boolean;

  constructor(component: CameraViewComponent, cameraManager: CameraManager) {
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
      this.component.showError('Aun no se valida la sesion');
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
