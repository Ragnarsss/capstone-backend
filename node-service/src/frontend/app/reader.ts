/**
 * QR Reader Application Entry
 * Responsabilidad: Bootstrap del lector QR
 */
import { AuthService } from '../modules/auth/application/auth.service';
import { QRReaderComponent } from '../modules/qr-reader/presentation/qr-reader.component';
import { CameraManager } from '../modules/qr-reader/infrastructure/camera-manager';
import { QRReaderService } from '../modules/qr-reader/application/qr-reader.service';

class QRReaderApplication {
  private authService: AuthService;
  private readerService: QRReaderService;

  constructor() {
    this.authService = new AuthService();
    const component = new QRReaderComponent();
    const cameraManager = new CameraManager('camera-feed');
    this.readerService = new QRReaderService(component, cameraManager);
  }

  initialize(): void {
    this.readerService.initialize();
    this.authService.initialize();

    if (this.authService.isUserAuthenticated()) {
      this.handleAuthReady();
    } else {
      this.authService.onAuthenticated(() => this.handleAuthReady());
    }
  }

  private handleAuthReady(): void {
    this.readerService.markAuthReady();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new QRReaderApplication();
  app.initialize();
});
