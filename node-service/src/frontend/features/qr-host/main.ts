/**
 * QR Host Application
 * Responsabilidad: Bootstrap y orquestacion del feature proyeccion QR
 */
import { AuthClient } from '../../shared/auth/auth-client';
import { WebSocketClient } from '../../shared/websocket/ws-client';
import { QRDisplayComponent } from './ui/qr-display.component';
import { QRProjectionService } from './services/qr-projection.service';

class QRHostApplication {
  private authClient: AuthClient | null;
  private wsClient: WebSocketClient | null;
  private qrComponent: QRDisplayComponent | null;
  private qrService: QRProjectionService | null;

  constructor() {
    this.authClient = null;
    this.wsClient = null;
    this.qrComponent = null;
    this.qrService = null;
  }

  async initialize(): Promise<void> {
    this.authClient = new AuthClient();
    this.authClient.initialize();

    this.qrComponent = new QRDisplayComponent();
    this.qrComponent.mount();

    this.wsClient = new WebSocketClient(this.authClient);

    this.qrService = new QRProjectionService(this.qrComponent, this.wsClient);
    this.qrService.initialize();

    if (this.authClient.isUserAuthenticated()) {
      this.start();
    } else {
      this.qrComponent.showWaitingAuth();
      this.authClient.onAuthenticated(() => this.start());
    }
  }

  private start(): void {
    console.log('[QRHost] Iniciando aplicacion');
    this.qrService?.start();
    this.wsClient?.connect();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new QRHostApplication();
  app.initialize();
});
