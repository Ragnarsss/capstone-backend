import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyAuthenticationResponseOpts,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';
import { config } from '../../../../shared/config';

/**
 * Credencial almacenada en la base de datos
 */
export interface StoredCredential {
  credentialId: string; // Base64URL encoded
  publicKey: string; // Base64URL encoded
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  aaguid?: string;
}

/**
 * Opciones para generar challenge de registro
 */
export interface RegistrationOptionsInput {
  userId: number;
  username: string;
  displayName: string;
  existingCredentials?: StoredCredential[];
}

/**
 * Opciones para generar challenge de autenticación
 */
export interface AuthenticationOptionsInput {
  allowCredentials: StoredCredential[];
}

/**
 * Servicio FIDO2/WebAuthn
 * Wrapper sobre @simplewebauthn/server
 * Responsabilidad única: Operaciones WebAuthn (registro y autenticación)
 */
export class Fido2Service {
  private readonly rpName: string;
  private readonly rpId: string;
  private readonly origin: string;

  constructor() {
    this.rpName = config.crypto.rpName;
    this.rpId = config.crypto.rpId;
    this.origin = config.crypto.origin;
  }

  /**
   * Genera opciones para iniciar el registro de una credencial
   * El cliente usará estas opciones en navigator.credentials.create()
   */
  async generateRegistrationOptions(
    input: RegistrationOptionsInput
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const { userId, username, displayName, existingCredentials = [] } = input;

    const opts: GenerateRegistrationOptionsOpts = {
      rpName: this.rpName,
      rpID: this.rpId,
      userID: this.userIdToUint8Array(userId),
      userName: username,
      userDisplayName: displayName,
      // Solicitar attestation directa para obtener el certificado del dispositivo
      attestationType: 'direct',
      // Excluir credenciales existentes para evitar duplicados
      excludeCredentials: existingCredentials.map((cred) => ({
        id: cred.credentialId,
        type: 'public-key' as const,
        transports: cred.transports,
      })),
      // Forzar autenticador de plataforma (hardware del dispositivo)
      // Esto vincula la credencial al dispositivo físico
      authenticatorSelection: {
        authenticatorAttachment: 'platform',  // Solo autenticador del dispositivo
        userVerification: 'required',
        residentKey: 'discouraged',  // No crear passkey sincronizable
        requireResidentKey: false,
      },
      // Algoritmos soportados: ES256 (preferido), RS256 (fallback)
      supportedAlgorithmIDs: [-7, -257],
      // Timeout de 5 minutos
      timeout: 300000,
    };

    return await generateRegistrationOptions(opts);
  }

  /**
   * Verifica la respuesta del registro
   * Valida el challenge, origen, y extrae la clave pública
   */
  async verifyRegistration(
    response: RegistrationResponseJSON,
    expectedChallenge: string
  ): Promise<VerifiedRegistrationResponse> {
    const opts: VerifyRegistrationResponseOpts = {
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      requireUserVerification: true,
    };

    return await verifyRegistrationResponse(opts);
  }

  /**
   * Genera opciones para iniciar la autenticación
   * El cliente usará estas opciones en navigator.credentials.get()
   */
  async generateAuthenticationOptions(
    input: AuthenticationOptionsInput
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const { allowCredentials } = input;

    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: this.rpId,
      userVerification: 'required',
      timeout: 300000,
      allowCredentials: allowCredentials.map((cred) => ({
        id: cred.credentialId,
        type: 'public-key' as const,
        transports: cred.transports,
      })),
    };

    return await generateAuthenticationOptions(opts);
  }

  /**
   * Verifica la respuesta de autenticación
   * Valida la firma usando la clave pública almacenada
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    credential: StoredCredential
  ): Promise<VerifiedAuthenticationResponse> {
    const opts: VerifyAuthenticationResponseOpts = {
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: this.base64UrlToUint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports,
      },
    };

    return await verifyAuthenticationResponse(opts);
  }

  /**
   * Extrae información de una credencial verificada
   */
  extractCredentialInfo(verified: VerifiedRegistrationResponse): {
    credentialId: string;
    publicKey: string;
    counter: number;
    aaguid: string;
    transports?: AuthenticatorTransportFuture[];
  } {
    if (!verified.registrationInfo) {
      throw new Error('Missing registration info');
    }
    
    const { credential } = verified.registrationInfo;
    
    if (!credential || !credential.id) {
      throw new Error('Missing credential ID');
    }

    return {
      credentialId: credential.id,
      publicKey: this.uint8ArrayToBase64Url(credential.publicKey),
      counter: credential.counter,
      aaguid: verified.registrationInfo.aaguid,
      transports: credential.transports,
    };
  }

  /**
   * Convierte userId numérico a Uint8Array para WebAuthn
   */
  private userIdToUint8Array(userId: number): Uint8Array {
    // Usar representación string del userId convertida a bytes
    const userIdStr = String(userId);
    return new TextEncoder().encode(userIdStr);
  }

  /**
   * Convierte Base64URL a Uint8Array
   */
  private base64UrlToUint8Array(base64url: string): Uint8Array {
    // Reemplazar caracteres Base64URL por Base64 estándar
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    // Añadir padding si es necesario
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convierte Uint8Array a Base64URL
   */
  private uint8ArrayToBase64Url(bytes: Uint8Array): string {
    const binary = String.fromCharCode(...bytes);
    const base64 = btoa(binary);
    // Convertir a Base64URL
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
