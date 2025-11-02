// Tipos base para el servicio de asistencia

export interface QRMessage {
  qrData: string;
  timestamp: number;
  sessionId: string;
}

export interface WebSocketMessage {
  type: 'qr-update' | 'countdown' | 'error';
  payload: unknown;
}

export interface CountdownMessage extends WebSocketMessage {
  type: 'countdown';
  payload: {
    seconds: number;
  };
}

export interface QRUpdateMessage extends WebSocketMessage {
  type: 'qr-update';
  payload: QRMessage;
}
