/**
 * QR Projection Service
 * Responsabilidad: Lógica de negocio para proyección de QR
 */
export class QRProjectionService {
  constructor(component, wsClient) {
    this.component = component;
    this.wsClient = wsClient;
  }

  initialize() {
    this.wsClient.on('connection', (data) => this.handleConnection(data));
    this.wsClient.on('countdown', (payload) => this.handleCountdown(payload));
    this.wsClient.on('qr-update', (payload) => this.handleQRUpdate(payload));
    this.wsClient.on('error', (payload) => this.handleError(payload));
  }

  handleConnection(data) {
    if (data.status === 'connected') {
      this.component.showConnected();
    }
  }

  handleCountdown(payload) {
    this.component.showCountdown(payload.seconds);
  }

  handleQRUpdate(payload) {
    this.component.showQRCode(payload.qrData);
  }

  handleError(payload) {
    this.component.showError(payload.message || 'Error de conexion. Reintentando...');
  }

  start() {
    this.component.showConnecting();
  }
}
