/**
 * Domain models para QR Projection frontend
 */

export interface QRProjectionState {
  readonly status: ProjectionStatus;
  readonly countdownSeconds?: number;
  readonly qrCodeData?: string;
  readonly error?: string;
}

export enum ProjectionStatus {
  Connecting = 'connecting',
  Connected = 'connected',
  WaitingAuth = 'waiting-auth',
  Countdown = 'countdown',
  ShowingQR = 'showing-qr',
  Error = 'error',
}

export interface WSMessage {
  readonly type: MessageType;
  readonly payload: unknown;
}

export enum MessageType {
  Connection = 'connection',
  Countdown = 'countdown',
  QRUpdate = 'qr-update',
  Error = 'error',
}

export interface ConnectionPayload {
  readonly status: string;
}

export interface CountdownPayload {
  readonly seconds: number;
}

export interface QRUpdatePayload {
  readonly qrData: string;
  readonly timestamp: number;
  readonly sessionId: string;
}

export interface ErrorPayload {
  readonly message?: string;
}
