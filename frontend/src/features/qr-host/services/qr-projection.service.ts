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

/**
 * Payload V1 - Estructura preparada para encriptación
 */
interface QRPayloadV1 {
  v: 1;
  sid: string;
  uid: number;
  r: number;
  ts: number;
  n: string;
}

/**
 * Formato de mensaje QR Update V1
 */
interface QRUpdatePayloadV1 {
  data: QRPayloadV1;
  qrContent: string;
  sessionId: string;
}

/**
 * @deprecated Formato legacy - será removido en Fase 3
 */
interface QRUpdatePayloadLegacy {
  message: string;
  timestamp: number;
  sessionId: string;
}

type QRUpdatePayload = QRUpdatePayloadV1 | QRUpdatePayloadLegacy;

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

  /**
   * Extrae el contenido para el QR, soportando ambos formatos
   */
  private extractQRContent(payload: QRUpdatePayload): string {
    // V1: usa qrContent directamente
    if ('qrContent' in payload && payload.qrContent) {
      return payload.qrContent;
    }
    // Legacy: usa message
    if ('message' in payload && payload.message) {
      return payload.message;
    }
    throw new Error('Formato de payload no reconocido');
  }

  /**
   * Verifica si el payload es de tipo "waiting" (pool vacio)
   */
  private isWaitingPayload(payload: QRUpdatePayload): boolean {
    if ('data' in payload && payload.data) {
      return payload.data.uid === -1 && payload.data.n === 'waiting';
    }
    return false;
  }

  private async handleQRUpdate(payload: unknown): Promise<void> {
    const qrPayload = payload as QRUpdatePayload;
    
    try {
      // Verificar si es payload de espera (pool vacio)
      if (this.isWaitingPayload(qrPayload)) {
        this.component.showWaiting();
        console.debug('[QRProjectionService] Pool vacio, mostrando estado de espera');
        return;
      }

      const content = this.extractQRContent(qrPayload);
      
      // Usar nivel de correccion alto (H) para payloads encriptados
      // y tamaño mayor para mejor lectura con camara
      const qrImageDataURL = await QRCode.toDataURL(content, {
        errorCorrectionLevel: 'H', // Maximo nivel de correccion
        margin: 2,
        width: 400, // Mayor tamaño para mejor deteccion
      });
      
      this.component.showQRCode(qrImageDataURL);
      
      // Debug: mostrar contenido encriptado en consola
      console.log('[QRProjectionService] QR Content (encriptado):', content);
      console.log('[QRProjectionService] Longitud:', content.length, 'chars');
      
      // Log para debug (solo en desarrollo)
      if ('data' in qrPayload) {
        console.debug('[QRProjectionService] V1 payload:', {
          version: qrPayload.data.v,
          round: qrPayload.data.r,
          timestamp: qrPayload.data.ts,
        });
      }
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
