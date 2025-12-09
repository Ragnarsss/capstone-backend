/**
 * QR Host Application
 * Responsabilidad: Bootstrap y orquestacion del feature proyeccion QR
 */
import { AuthClient } from '../../shared/auth/auth-client';
import { WebSocketClient } from '../../shared/websocket/ws-client';
import { QRDisplayComponent } from './ui/qr-display.component';
import { QRProjectionService } from './services/qr-projection.service';
import { LegacyBridge } from '../../shared/services/legacy-bridge.service';
import { LegacyContextStore } from '../../shared/stores/legacy-context.store';

class QRHostApplication {
  private authClient: AuthClient | null;
  private wsClient: WebSocketClient | null;
  private qrComponent: QRDisplayComponent | null;
  private qrService: QRProjectionService | null;
  private legacyBridge: LegacyBridge | null;
  private contextStore: LegacyContextStore | null;

  constructor() {
    this.authClient = null;
    this.wsClient = null;
    this.qrComponent = null;
    this.qrService = null;
    this.legacyBridge = null;
    this.contextStore = null;
  }

  async initialize(): Promise<void> {
    // Inicializar auth y context store
    this.authClient = new AuthClient();
    this.contextStore = new LegacyContextStore();
    
    // Inicializar bridge para comunicacion con PHP legacy
    this.legacyBridge = new LegacyBridge(this.authClient, this.contextStore);
    this.legacyBridge.initialize();
    
    // Inicializar auth client (escucha postMessage AUTH_TOKEN)
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
    
    // Log contexto si esta disponible
    if (this.contextStore?.hasContext()) {
      const ctx = this.contextStore.getAsProfesor();
      if (ctx) {
        console.log('[QRHost] Contexto profesor:', ctx.curso.nombre);
      }
    }
    
    this.qrService?.start();
    this.wsClient?.connect();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new QRHostApplication();
  app.initialize();
});
