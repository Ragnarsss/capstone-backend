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
  /** Info de política 1:1: usuario anterior desvinculado */
  previousUserUnlinked?: {
    userId: number;
    reason: string;
  };
  /** Info de política 1:1: dispositivos propios revocados */
  ownDevicesRevoked?: number;
}

/**
 * Use Case: Completar proceso de enrollment FIDO2
 * 
 * Política 1:1 estricta:
 * - 1 usuario = máximo 1 dispositivo activo
 * - 1 dispositivo = máximo 1 usuario activo
 * - Si el dispositivo estaba enrolado por otro usuario → auto-desvincular
 * - Si el usuario tenía otros dispositivos → auto-revocar
 * 
 * Flujo:
 * 1. Recuperar challenge almacenado en Valkey
 * 2. Verificar respuesta WebAuthn con SimpleWebAuthn
 * 3. Extraer credentialId, publicKey, aaguid
 * 4. [1:1] Si dispositivo existe con otro usuario → revocar ese enrollment
 * 5. [1:1] Si usuario tiene otros dispositivos → revocar todos
 * 6. Derivar handshake_secret con HKDF
 * 7. Guardar dispositivo en PostgreSQL
 * 8. Registrar penalización (incrementar contador)
 * 9. Eliminar challenge de Valkey
 * 10. Retornar deviceId y metadata
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

    // 4. [Política 1:1] Verificar si este dispositivo ya está enrolado
    // Incluye dispositivos inactivos para detectar re-enrollment
    let previousUserUnlinked: { userId: number; reason: string } | undefined;
    
    const existingDevice = await this.deviceRepository.findByCredentialIdIncludingInactive(
      credentialInfo.credentialId
    );
    
    if (existingDevice) {
      if (existingDevice.isActive && existingDevice.userId === userId) {
        // Mismo usuario, mismo dispositivo activo → ya está enrolado
        await this.challengeRepository.delete(userId);
        throw new Error('CREDENTIAL_ALREADY_EXISTS: Este dispositivo ya está enrolado por ti');
      }
      
      if (existingDevice.isActive && existingDevice.userId !== userId) {
        // Dispositivo activo de OTRO usuario → auto-desvincular (política 1:1)
        await this.deviceRepository.revoke(
          existingDevice.deviceId, 
          `Auto-revoked: Device re-enrolled by user ${userId} (1:1 policy)`
        );
        previousUserUnlinked = {
          userId: existingDevice.userId,
          reason: 'Device re-enrolled by another user',
        };
      }
      // Si está inactivo, permitimos re-enrollment sin acción adicional
    }

    // 5. [Política 1:1] Revocar todos los dispositivos previos del usuario
    let ownDevicesRevoked = 0;
    const existingUserDevices = await this.deviceRepository.countByUserId(userId);
    
    if (existingUserDevices > 0) {
      ownDevicesRevoked = await this.deviceRepository.revokeAllByUserId(
        userId,
        'Auto-revoked: New device enrolled (1:1 policy)'
      );
    }

    // 6. Derivar handshake_secret con HKDF
    const handshakeSecretBuffer = await this.hkdfService.deriveHandshakeSecret(
      credentialInfo.credentialId,
      userId
    );
    const handshakeSecret = handshakeSecretBuffer.toString('base64');

    // 7. Guardar dispositivo en PostgreSQL
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

    // 8. Registrar enrollment en sistema de penalizaciones
    let penaltyInfo: { newEnrollmentCount: number; nextDelayMinutes: number } | undefined;
    
    if (this.penaltyService) {
      const penaltyResult = await this.penaltyService.recordEnrollment(userId.toString());
      penaltyInfo = {
        newEnrollmentCount: penaltyResult.newCount,
        nextDelayMinutes: penaltyResult.nextDelayMinutes,
      };
    }

    // 9. Eliminar challenge de Valkey (ya fue consumido)
    await this.challengeRepository.delete(userId);

    // 10. Retornar información del dispositivo enrolado
    return {
      deviceId: device.deviceId,
      credentialId: device.credentialId,
      aaguid: device.aaguid,
      success: true,
      penaltyInfo,
      previousUserUnlinked,
      ownDevicesRevoked: ownDevicesRevoked > 0 ? ownDevicesRevoked : undefined,
    };
  }
}
