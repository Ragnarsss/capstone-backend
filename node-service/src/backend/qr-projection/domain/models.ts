import { SessionId } from './session-id';

/**
 * Domain models para QR Projection
 * Sin dependencias externas, lógica de negocio pura
 */

/**
 * Payload V1 - Estructura preparada para encriptación
 * Formato JSON que será encriptado con AES-256-GCM en fases posteriores
 * 
 * @property v - Versión del protocolo (1 para esta estructura)
 * @property sid - Session ID de proyección
 * @property uid - User ID del anfitrión (docente)
 * @property r - Número de ronda (contador incremental por estudiante)
 * @property ts - Timestamp Unix en milisegundos
 * @property n - Nonce criptográfico (16 bytes hex)
 */
export interface QRPayloadV1 {
  readonly v: 1;
  readonly sid: string;
  readonly uid: number;
  readonly r: number;
  readonly ts: number;
  readonly n: string;
}

/**
 * Wrapper con metadata para el payload
 * Incluye datos que NO van en el QR pero son útiles internamente
 */
export interface QRPayloadEnvelope {
  readonly payload: QRPayloadV1;
  readonly payloadString: string;
  readonly sessionId: SessionId;
}

/**
 * @deprecated Usar QRPayloadEnvelope en su lugar
 * Mantenido por compatibilidad temporal - será removido en Fase 3
 */
export interface QRPayload {
  readonly message: string;
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
