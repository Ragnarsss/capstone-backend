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
 * Payload V1 para QR Update
 * Estructura preparada para encriptación AES-256-GCM
 */
export interface QRPayloadV1DTO {
  v: 1;
  sid: string;
  uid: number;
  r: number;
  ts: number;
  n: string;
}

/**
 * Mensaje de actualización de QR (V1)
 * Envía el payload estructurado para el frontend
 * El frontend se encarga de generar la imagen QR
 */
export interface QRUpdateMessageDTO extends WebSocketMessage {
  type: 'qr-update';
  payload: {
    /** Payload estructurado V1 */
    data: QRPayloadV1DTO;
    /** String a codificar en el QR (JSON del payload) */
    qrContent: string;
    /** Session ID para referencia */
    sessionId: string;
  };
}

/**
 * @deprecated Usar QRUpdateMessageDTO con payload.data
 * Mantenido para referencia durante migración
 */
export interface QRUpdateMessageLegacyDTO extends WebSocketMessage {
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
