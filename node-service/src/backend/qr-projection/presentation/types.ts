/**
 * DTOs para la capa de presentación del módulo QR Projection
 */

export interface WebSocketMessage {
  type: 'qr-update' | 'countdown' | 'error' | 'auth-ok' | 'AUTH';
  payload?: unknown;
}

export interface AuthMessageDTO {
  type: 'AUTH';
  token: string;
}

export interface AuthOkMessageDTO {
  type: 'auth-ok';
  username: string;
}

export interface CountdownMessageDTO extends WebSocketMessage {
  type: 'countdown';
  payload: {
    seconds: number;
  };
}

/**
 * Mensaje de actualización de QR
 * Ahora envía solo el mensaje/payload, no la imagen renderizada
 * El frontend se encarga de generar la imagen QR
 */
export interface QRUpdateMessageDTO extends WebSocketMessage {
  type: 'qr-update';
  payload: {
    message: string;
    timestamp: number;
    sessionId: string;
  };
}

export interface ErrorMessageDTO extends WebSocketMessage {
  type: 'error';
  message: string;
  payload?: {
    message: string;
    code?: string;
  };
}
