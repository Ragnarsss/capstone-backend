/**
 * Domain models para QR Projection
 * Sin dependencias externas, lógica de negocio pura
 */

export interface QRCode {
  readonly data: string;
  readonly timestamp: number;
  readonly sessionId: string;
}

export interface QRMetadata {
  readonly userId: number;
  readonly sessionId: string;
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
  readonly sessionId: string;
  readonly startedAt: number;
  readonly isActive: boolean;
}
