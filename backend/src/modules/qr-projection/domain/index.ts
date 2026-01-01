/**
 * Domain Layer - QR Projection
 * 
 * Modelos y servicios de dominio para proyección de QR
 */

// Models
export type {
  QRPayloadV1,
  QRPayloadEnvelope,
} from './models';

// Value Objects
export { SessionId } from './session-id';

// Domain Services
export { PayloadBuilder } from './services';
export type { StudentPayloadInput, FakePayloadInput } from './services';

// QRGenerator - implementa IQRGenerator
export { QRGenerator } from './qr-generator';
