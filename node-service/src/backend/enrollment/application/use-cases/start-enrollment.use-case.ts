import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types';
import { Fido2Service, DeviceRepository, EnrollmentChallengeRepository } from '../../infrastructure';
import type { RegistrationOptionsInput } from '../../infrastructure';
import type { Device } from '../../domain/entities';

/**
 * Input DTO para Start Enrollment
 */
export interface StartEnrollmentInput {
  userId: number;
  username: string;
  displayName: string;
}

/**
 * Output DTO para Start Enrollment
 */
export interface StartEnrollmentOutput {
  options: PublicKeyCredentialCreationOptionsJSON;
}

/**
 * Use Case: Iniciar proceso de enrollment FIDO2
 * 
 * Flujo:
 * 1. Verificar que el usuario no tenga el máximo de dispositivos
 * 2. Obtener dispositivos existentes (para excludeCredentials)
 * 3. Generar challenge y opciones WebAuthn
 * 4. Guardar challenge en Valkey con TTL 5 minutos
 * 5. Retornar opciones para navigator.credentials.create()
 */
export class StartEnrollmentUseCase {
  constructor(
    private readonly fido2Service: Fido2Service,
    private readonly deviceRepository: DeviceRepository,
    private readonly challengeRepository: EnrollmentChallengeRepository
  ) {}

  async execute(input: StartEnrollmentInput): Promise<StartEnrollmentOutput> {
    const { userId, username, displayName } = input;

    // 1. Verificar límite de dispositivos (máximo 5 por usuario)
    const deviceCount = await this.deviceRepository.countByUserId(userId);
    if (deviceCount >= 5) {
      throw new Error('MAX_DEVICES_REACHED: El usuario ya tiene 5 dispositivos enrolados');
    }

    // 2. Obtener dispositivos existentes para excludeCredentials
    const existingDevices = await this.deviceRepository.findByUserId(userId);
    const existingCredentials = existingDevices.map((device: Device) => ({
      credentialId: device.credentialId,
      publicKey: device.publicKey,
      counter: device.signCount,
      transports: device.transports,
    }));

    // 3. Generar opciones WebAuthn con SimpleWebAuthn
    const registrationInput: RegistrationOptionsInput = {
      userId,
      username,
      displayName,
      existingCredentials,
    };

    const options = await this.fido2Service.generateRegistrationOptions(registrationInput);

    // 4. Guardar challenge en Valkey (TTL 5 minutos)
    const now = Date.now();
    await this.challengeRepository.save(
      {
        challenge: options.challenge,
        userId,
        createdAt: now,
        expiresAt: now + 5 * 60 * 1000,
      },
      300 // TTL en segundos
    );

    // 5. Retornar opciones para el cliente
    return { options };
  }
}
