import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { Fido2Service, DeviceRepository, EnrollmentChallengeRepository, HkdfService, PenaltyService } from '../../infrastructure';
import type { CreateDeviceDto } from '../../domain/entities';

/**
 * Input DTO para Finish Enrollment
 */
export interface FinishEnrollmentInput {
  userId: number;
  credential: RegistrationResponseJSON;
  deviceFingerprint: string;
}

/**
 * Output DTO para Finish Enrollment
 */
export interface FinishEnrollmentOutput {
  deviceId: number;
  credentialId: string;
  aaguid: string;
  success: true;
  penaltyInfo?: {
    newEnrollmentCount: number;
    nextDelayMinutes: number;
  };
}

/**
 * Use Case: Completar proceso de enrollment FIDO2
 * 
 * Flujo:
 * 1. Recuperar challenge almacenado en Valkey
 * 2. Verificar respuesta WebAuthn con SimpleWebAuthn
 * 3. Extraer credentialId, publicKey, aaguid
 * 4. Derivar handshake_secret con HKDF
 * 5. Guardar dispositivo en PostgreSQL
 * 6. Registrar penalización (incrementar contador)
 * 7. Eliminar challenge de Valkey
 * 8. Retornar deviceId y metadata
 */
export class FinishEnrollmentUseCase {
  constructor(
    private readonly fido2Service: Fido2Service,
    private readonly deviceRepository: DeviceRepository,
    private readonly challengeRepository: EnrollmentChallengeRepository,
    private readonly hkdfService: HkdfService,
    private readonly penaltyService?: PenaltyService
  ) {}

  async execute(input: FinishEnrollmentInput): Promise<FinishEnrollmentOutput> {
    const { userId, credential, deviceFingerprint } = input;

    // 1. Recuperar y validar challenge
    const storedChallenge = await this.challengeRepository.findByUserId(userId);
    if (!storedChallenge) {
      throw new Error('CHALLENGE_NOT_FOUND: No se encontró challenge para este usuario');
    }

    // Verificar que no haya expirado
    if (Date.now() > storedChallenge.expiresAt) {
      await this.challengeRepository.delete(userId);
      throw new Error('CHALLENGE_EXPIRED: El challenge ha expirado');
    }

    // 2. Verificar respuesta WebAuthn
    let verificationResult;
    try {
      verificationResult = await this.fido2Service.verifyRegistration(
        credential,
        storedChallenge.challenge
      );
    } catch (error) {
      await this.challengeRepository.delete(userId);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`VERIFICATION_FAILED: ${message}`);
    }

    if (!verificationResult.verified) {
      await this.challengeRepository.delete(userId);
      throw new Error('VERIFICATION_FAILED: La verificación de WebAuthn falló');
    }

    // 3. Extraer información de la credencial verificada
    const credentialInfo = this.fido2Service.extractCredentialInfo(verificationResult);

    // 4. Verificar que no exista ya este credentialId (evitar duplicados)
    const existingDevice = await this.deviceRepository.findByCredentialId(
      credentialInfo.credentialId
    );
    if (existingDevice) {
      await this.challengeRepository.delete(userId);
      throw new Error('CREDENTIAL_ALREADY_EXISTS: Este dispositivo ya está enrolado');
    }

    // 5. Derivar handshake_secret con HKDF
    const handshakeSecretBuffer = await this.hkdfService.deriveHandshakeSecret(
      credentialInfo.credentialId,
      userId
    );
    const handshakeSecret = handshakeSecretBuffer.toString('base64');

    // 6. Guardar dispositivo en PostgreSQL
    const deviceDto: CreateDeviceDto = {
      userId,
      credentialId: credentialInfo.credentialId,
      publicKey: credentialInfo.publicKey,
      handshakeSecret,
      aaguid: credentialInfo.aaguid,
      deviceFingerprint,
      attestationFormat: verificationResult.registrationInfo?.fmt,
      signCount: credentialInfo.counter,
      transports: credentialInfo.transports,
    };

    const device = await this.deviceRepository.create(deviceDto);

    // 7. Registrar enrollment en sistema de penalizaciones
    let penaltyInfo: { newEnrollmentCount: number; nextDelayMinutes: number } | undefined;
    
    if (this.penaltyService) {
      const penaltyResult = await this.penaltyService.recordEnrollment(userId.toString());
      penaltyInfo = {
        newEnrollmentCount: penaltyResult.newCount,
        nextDelayMinutes: penaltyResult.nextDelayMinutes,
      };
    }

    // 8. Eliminar challenge de Valkey (ya fue consumido)
    await this.challengeRepository.delete(userId);

    // 9. Retornar información del dispositivo enrolado
    return {
      deviceId: device.deviceId,
      credentialId: device.credentialId,
      aaguid: device.aaguid,
      success: true,
      penaltyInfo,
    };
  }
}
