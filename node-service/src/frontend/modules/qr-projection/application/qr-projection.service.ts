/**
 * QR Projection Service
 * Responsabilidad: Lógica de negocio para proyección de QR
 */
import { QRProjectionComponent } from '../presentation/qr-projection.component';
import { WebSocketClient } from '../../websocket/infrastructure/websocket.client';

interface ConnectionPayload {
  status: string;
}

interface CountdownPayload {
  seconds: number;
}

interface QRUpdatePayload {
  qrData: string;
}

interface ErrorPayload {
  message?: string;
}

export class QRProjectionService {
  private readonly component: QRProjectionComponent;
  private readonly wsClient: WebSocketClient;

  constructor(component: QRProjectionComponent, wsClient: WebSocketClient) {
    this.component = component;
    this.wsClient = wsClient;
  }

  initialize(): void {
    this.wsClient.on('connection', (data) => this.handleConnection(data));
    this.wsClient.on('countdown', (payload) => this.handleCountdown(payload));
    this.wsClient.on('qr-update', (payload) => this.handleQRUpdate(payload));
    this.wsClient.on('error', (payload) => this.handleError(payload));
  }

  private handleConnection(data: unknown): void {
    const payload = data as ConnectionPayload;
    if (payload.status === 'connected') {
      this.component.showConnected();
    }
  }

  private handleCountdown(payload: unknown): void {
    const countdownPayload = payload as CountdownPayload;
    this.component.showCountdown(countdownPayload.seconds);
  }

  private handleQRUpdate(payload: unknown): void {
    const qrPayload = payload as QRUpdatePayload;
    this.component.showQRCode(qrPayload.qrData);
  }

  private handleError(payload: unknown): void {
    const errorPayload = payload as ErrorPayload;
    this.component.showError(errorPayload.message || 'Error de conexion. Reintentando...');
  }

  start(): void {
    this.component.showConnecting();
  }
}
