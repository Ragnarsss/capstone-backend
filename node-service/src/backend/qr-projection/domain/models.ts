import { SessionId } from './session-id';
import type { QRPayloadV1 } from '../../../shared/types';

/**
 * Domain models para QR Projection
 * Sin dependencias externas, lógica de negocio pura
 */

// Re-exportar QRPayloadV1 desde shared para mantener compatibilidad
// Los módulos que importan desde aquí seguirán funcionando
export { QRPayloadV1, isQRPayloadV1, PAYLOAD_VERSION, NONCE_LENGTH } from '../../../shared/types';

/**
 * Wrapper con metadata para el payload
 * Incluye datos que NO van en el QR pero son útiles internamente
 */
export interface QRPayloadEnvelope {
  readonly payload: QRPayloadV1;
  readonly payloadString: string;
  readonly sessionId: SessionId;
}
