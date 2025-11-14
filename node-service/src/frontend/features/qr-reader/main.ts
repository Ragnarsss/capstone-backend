/**
 * QR Reader Application
 * Responsabilidad: Bootstrap del feature lectura QR
 */
import { AuthClient } from '../../shared/auth/auth-client';
import { CameraViewComponent } from './ui/camera-view.component';
import { CameraManager } from './services/camera-manager';
import { QRScanService } from './services/qr-scan.service';

class QRReaderApplication {
  private authClient: AuthClient;
  private scanService: QRScanService;

  constructor() {
    this.authClient = new AuthClient();
    const component = new CameraViewComponent();
    const cameraManager = new CameraManager('camera-feed');
    this.scanService = new QRScanService(component, cameraManager);
  }

  initialize(): void {
    this.scanService.initialize();
    this.authClient.initialize();

    if (this.authClient.isUserAuthenticated()) {
      this.handleAuthReady();
    } else {
      this.authClient.onAuthenticated(() => this.handleAuthReady());
    }
  }

  private handleAuthReady(): void {
    this.scanService.markAuthReady();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new QRReaderApplication();
  app.initialize();
});
