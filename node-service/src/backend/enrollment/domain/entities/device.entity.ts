import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';

/**
 * Entidad Device
 * Representa un dispositivo FIDO2 enrolado
 * Mapea directamente a enrollment.devices en PostgreSQL
 */
export interface Device {
  readonly deviceId: number;
  readonly userId: number;
  readonly credentialId: string; // Base64URL
  readonly publicKey: string; // Base64URL
  readonly handshakeSecret: string; // Base64
  readonly aaguid: string;
  readonly deviceFingerprint: string;
  readonly attestationFormat: string | null;
  readonly signCount: number;
  readonly enrolledAt: Date;
  readonly lastUsedAt: Date | null;
  readonly isActive: boolean;
  readonly transports?: AuthenticatorTransportFuture[];
}

/**
 * DTO para crear un nuevo dispositivo
 */
export interface CreateDeviceDto {
  userId: number;
  credentialId: string;
  publicKey: string;
  handshakeSecret: string;
  aaguid: string;
  deviceFingerprint: string;
  attestationFormat?: string;
  signCount?: number;
  transports?: AuthenticatorTransportFuture[];
}

/**
 * DTO para actualizar contador de firmas
 */
export interface UpdateCounterDto {
  deviceId: number;
  newCounter: number;
}
