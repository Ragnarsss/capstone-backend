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
}

export interface FinishEnrollmentResponseDTO {
  success: boolean;
  deviceId?: number;
  aaguid?: string;
  message?: string;
  error?: string;
}

export interface LoginECDHRequestDTO {
  publicKey: string;
  assertion: any;
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
