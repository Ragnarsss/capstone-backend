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
 * Responsabilidad UNICA (SoC):
 * - Generar challenge y opciones WebAuthn
 * - Guardar challenge en Valkey con TTL 5 minutos
 *
 * NO hace (responsabilidad del Orchestrator):
 * - Inferencia de estado (DeviceStateMachine.inferState)
 * - Validacion de transiciones (DeviceStateMachine.assertTransition)
 * - Verificacion de penalizaciones (PenaltyService)
 * - Evaluacion de politica 1:1 (OneToOnePolicyService)
 *
 * Flujo:
 * 1. Obtener credenciales existentes (para excludeCredentials)
 * 2. Generar opciones WebAuthn con SimpleWebAuthn
 * 3. Guardar challenge en Valkey con TTL 5 minutos
 * 4. Retornar opciones para navigator.credentials.create()
 */
export class StartEnrollmentUseCase {
  constructor(
    private readonly fido2Service: Fido2Service,
    private readonly deviceRepository: DeviceRepository,
    private readonly challengeRepository: EnrollmentChallengeRepository
  ) {}

  async execute(input: StartEnrollmentInput): Promise<StartEnrollmentOutput> {
    const { userId, username, displayName } = input;

    // 1. Obtener credenciales para excludeCredentials
    // excludeCredentials evita que el MISMO dispositivo se re-registre (error WebAuthn)
    const existingDevices = await this.deviceRepository.findByUserId(userId);
    const existingCredentials = existingDevices.map((device: Device) => ({
      credentialId: device.credentialId,
      publicKey: device.publicKey,
      counter: device.signCount,
      transports: device.transports,
    }));

    // 2. Generar opciones WebAuthn con SimpleWebAuthn
    const registrationInput: RegistrationOptionsInput = {
      userId,
      username,
      displayName,
      existingCredentials,
    };

    const options = await this.fido2Service.generateRegistrationOptions(registrationInput);

    // 3. Guardar challenge en Valkey (TTL 5 minutos)
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

    // 4. Retornar opciones para el cliente
    return { options };
  }
}
