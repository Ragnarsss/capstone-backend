/**
 * Main Application Entry Point
 * Responsabilidad: Orquestación e inicialización de módulos
 */
import { AuthService } from '../modules/auth/auth.service';
import { WebSocketClient } from '../modules/websocket/websocket.client';
import { QRProjectionComponent } from '../modules/qr-projection/qr-projection.component';
import { QRProjectionService } from '../modules/qr-projection/qr-projection.service';

class Application {
  private authService: AuthService | null;
  private wsClient: WebSocketClient | null;
  private qrComponent: QRProjectionComponent | null;
  private qrService: QRProjectionService | null;

  constructor() {
    this.authService = null;
    this.wsClient = null;
    this.qrComponent = null;
    this.qrService = null;
  }

  async initialize(): Promise<void> {
    this.authService = new AuthService();
    this.authService.initialize();

    this.qrComponent = new QRProjectionComponent();
    this.qrComponent.mount();

    this.wsClient = new WebSocketClient(this.authService);

    this.qrService = new QRProjectionService(this.qrComponent, this.wsClient);
    this.qrService.initialize();

    if (this.authService.isUserAuthenticated()) {
      this.start();
    } else {
      this.qrComponent.showWaitingAuth();
      this.authService.onAuthenticated(() => this.start());
    }
  }

  private start(): void {
    console.log('[App] Iniciando aplicación');
    this.qrService?.start();
    this.wsClient?.connect();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new Application();
  app.initialize();
});
