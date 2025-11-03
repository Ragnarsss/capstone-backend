/**
 * DTOs para la capa de presentación del módulo QR Projection
 */

export interface WebSocketMessage {
  type: 'qr-update' | 'countdown' | 'error';
  payload: unknown;
}

export interface CountdownMessageDTO extends WebSocketMessage {
  type: 'countdown';
  payload: {
    seconds: number;
  };
}

export interface QRUpdateMessageDTO extends WebSocketMessage {
  type: 'qr-update';
  payload: {
    qrData: string;
    timestamp: number;
    sessionId: string;
  };
}

export interface ErrorMessageDTO extends WebSocketMessage {
  type: 'error';
  payload: {
    message: string;
    code?: string;
  };
}
