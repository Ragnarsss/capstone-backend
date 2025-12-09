import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types';
import { Fido2Service, DeviceRepository, EnrollmentChallengeRepository, PenaltyService } from '../../infrastructure';
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
  penaltyInfo?: {
    enrollmentCount: number;
    nextDelayMinutes: number;
  };
}

/**
 * Use Case: Iniciar proceso de enrollment FIDO2
 * 
 * Política 1:1 estricta:
 * - 1 usuario = máximo 1 dispositivo activo
 * - No bloqueamos el enrollment si ya tiene dispositivo (se revocará en finish)
 * - Penalizaciones aplican por cada re-enrollment
 * 
 * Flujo:
 * 1. Verificar penalización (delays exponenciales)
 * 2. Obtener dispositivos existentes (para excludeCredentials - evitar re-register del mismo)
 * 3. Generar challenge y opciones WebAuthn
 * 4. Guardar challenge en Valkey con TTL 5 minutos
 * 5. Retornar opciones para navigator.credentials.create()
 */
export class StartEnrollmentUseCase {
  constructor(
    private readonly fido2Service: Fido2Service,
    private readonly deviceRepository: DeviceRepository,
    private readonly challengeRepository: EnrollmentChallengeRepository,
    private readonly penaltyService?: PenaltyService
  ) {}

  async execute(input: StartEnrollmentInput): Promise<StartEnrollmentOutput> {
    const { userId, username, displayName } = input;

    // 1. Verificar penalización (si el servicio está configurado)
    let penaltyInfo: { enrollmentCount: number; nextDelayMinutes: number } | undefined;
    
    if (this.penaltyService) {
      const eligibility = await this.penaltyService.checkEnrollmentEligibility(userId.toString());
      
      if (!eligibility.canEnroll) {
        throw new Error(
          `PENALTY_ACTIVE: Debe esperar ${eligibility.waitMinutes} minutos antes de enrolar otro dispositivo. ` +
          `Próximo intento permitido: ${eligibility.nextEnrollmentAt?.toISOString()}`
        );
      }
      
      penaltyInfo = {
        enrollmentCount: eligibility.enrollmentCount,
        nextDelayMinutes: this.penaltyService.getDelayMinutes(eligibility.enrollmentCount + 1),
      };
    }

    // 2. Obtener dispositivos existentes para excludeCredentials
    // Nota: Con política 1:1, esto normalmente será 0-1 dispositivos
    // excludeCredentials evita que el MISMO dispositivo se re-registre (error WebAuthn)
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
    return { options, penaltyInfo };
  }
}
