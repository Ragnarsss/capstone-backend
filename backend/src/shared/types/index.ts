// Tipos compartidos entre módulos

// QR Payload types - compartidos entre qr-projection y attendance
export type { QRPayloadV1 } from './qr-payload.types';
export {
  isQRPayloadV1,
  PAYLOAD_VERSION,
  NONCE_LENGTH,
} from './qr-payload.types';
