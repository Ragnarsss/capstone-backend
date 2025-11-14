import { SessionId } from './session-id';

/**
 * Domain models para QR Projection
 * Sin dependencias externas, lógica de negocio pura
 */

/**
 * Payload del QR (solo datos, sin renderizado)
 * El frontend se encarga de convertir el mensaje en imagen QR
 */
export interface QRPayload {
  readonly message: string;
  readonly timestamp: number;
  readonly sessionId: SessionId;
}

/**
 * @deprecated Usar QRPayload en su lugar
 * Mantenido por compatibilidad temporal
 */
export interface QRCode {
  readonly data: string;
  readonly timestamp: number;
  readonly sessionId: SessionId;
}

export interface QRMetadata {
  readonly userId: number;
  readonly sessionId: SessionId;
  readonly ronda: number;
  readonly timestampEnvio: number;
  readonly mostradoCount: number;
  readonly intentosFallidos: number;
  readonly valido: boolean;
  readonly payloadEncrypted: string;
}

export interface CountdownState {
  readonly secondsRemaining: number;
}

export interface ProjectionSession {
  readonly sessionId: SessionId;
  readonly startedAt: number;
  readonly isActive: boolean;
}
