/**
 * QR Projection Service
 * Responsabilidad: Coordinacion entre WebSocket y renderizado de QR
 */
import QRCode from 'qrcode';
import type { QRDisplayComponent } from '../ui/qr-display.component';
import type { WebSocketClient } from '../../../shared/websocket/ws-client';

interface ConnectionPayload {
  status: string;
}

interface CountdownPayload {
  seconds: number;
}

interface QRUpdatePayload {
  message: string;
  timestamp: number;
  sessionId: string;
}

interface ErrorPayload {
  message?: string;
}

export class QRProjectionService {
  private readonly component: QRDisplayComponent;
  private readonly wsClient: WebSocketClient;

  constructor(component: QRDisplayComponent, wsClient: WebSocketClient) {
    this.component = component;
    this.wsClient = wsClient;
  }

  initialize(): void {
    this.wsClient.on('connection', (data: unknown) => this.handleConnection(data));
    this.wsClient.on('countdown', (payload: unknown) => this.handleCountdown(payload));
    this.wsClient.on('qr-update', (payload: unknown) => this.handleQRUpdate(payload));
    this.wsClient.on('error', (payload: unknown) => this.handleError(payload));
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

  private async handleQRUpdate(payload: unknown): Promise<void> {
    const qrPayload = payload as QRUpdatePayload;
    
    try {
      const qrImageDataURL = await QRCode.toDataURL(qrPayload.message, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300,
      });
      
      this.component.showQRCode(qrImageDataURL);
    } catch (error) {
      console.error('[QRProjectionService] Error generando imagen QR:', error);
      this.component.showError('Error al generar codigo QR');
    }
  }

  private handleError(payload: unknown): void {
    const errorPayload = payload as ErrorPayload;
    this.component.showError(errorPayload.message || 'Error de conexion. Reintentando...');
  }

  start(): void {
    this.component.showConnecting();
  }
}
