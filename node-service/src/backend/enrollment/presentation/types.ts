/**
 * DTOs para la capa de presentación del módulo Enrollment
 */

export interface StartEnrollmentRequestDTO {
  displayName?: string;
}

export interface StartEnrollmentResponseDTO {
  success: boolean;
  challenge?: string;
  options?: any;
  error?: string;
  message?: string;
}

export interface FinishEnrollmentRequestDTO {
  credential: any;
  deviceFingerprint?: string;
}

export interface FinishEnrollmentResponseDTO {
  success: boolean;
  deviceId?: number;
  aaguid?: string;
  message?: string;
  error?: string;
}

export interface LoginECDHRequestDTO {
  credentialId: string;  // ID del dispositivo enrolado (base64url)
  publicKey: string;     // Clave publica ECDH del cliente (base64)
}

export interface LoginECDHResponseDTO {
  success: boolean;
  serverPublicKey?: string;
  TOTPu?: string;
  error?: string;
  message?: string;
}

export interface EnrollmentStatusResponseDTO {
  success: boolean;
  enrolled?: boolean;
  deviceCount?: number;
  message?: string;
  error?: string;
}
