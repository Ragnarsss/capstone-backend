import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types';
import {
  StartEnrollmentUseCase,
  FinishEnrollmentUseCase,
  GetEnrollmentStatusUseCase,
  LoginEcdhUseCase,
} from './use-cases';
import {
  Fido2Service,
  DeviceRepository,
  EnrollmentChallengeRepository,
  SessionKeyRepository,
  HkdfService,
  EcdhService,
  PenaltyService,
} from '../infrastructure';
import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';

/**
 * Application Service para Enrollment
 * Responsabilidad: Orquestar casos de uso de enrollment FIDO2
 * 
 * Este servicio actua como facade para los Use Cases,
 * manteniendo compatibilidad con el controller existente.
 */
export class EnrollmentService {
  private readonly startEnrollmentUseCase: StartEnrollmentUseCase;
  private readonly finishEnrollmentUseCase: FinishEnrollmentUseCase;
  private readonly getEnrollmentStatusUseCase: GetEnrollmentStatusUseCase;
  private readonly loginEcdhUseCase: LoginEcdhUseCase;

  constructor(
    fido2Service?: Fido2Service,
    deviceRepository?: DeviceRepository,
    challengeRepository?: EnrollmentChallengeRepository,
    sessionKeyRepository?: SessionKeyRepository,
    hkdfService?: HkdfService,
    ecdhService?: EcdhService,
    penaltyService?: PenaltyService
  ) {
    // Instanciar dependencias si no se proveen
    const fido2 = fido2Service ?? new Fido2Service();
    const deviceRepo = deviceRepository ?? new DeviceRepository();
    const challengeRepo = challengeRepository ?? new EnrollmentChallengeRepository();
    const sessionKeyRepo = sessionKeyRepository ?? new SessionKeyRepository();
    const hkdf = hkdfService ?? new HkdfService();
    const ecdh = ecdhService ?? new EcdhService();
    const penalty = penaltyService ?? new PenaltyService(ValkeyClient.getInstance());

    // Crear Use Cases con dependencias
    // Nota: PenaltyService se movio al orchestrator (SoC refactor fase 17.6)
    this.startEnrollmentUseCase = new StartEnrollmentUseCase(
      fido2,
      deviceRepo,
      challengeRepo
    );

    // Nota: PenaltyService y 1:1 policy se movieron al orchestrator (SoC refactor fase 17.7)
    this.finishEnrollmentUseCase = new FinishEnrollmentUseCase(
      fido2,
      deviceRepo,
      challengeRepo,
      hkdf
    );

    this.getEnrollmentStatusUseCase = new GetEnrollmentStatusUseCase(deviceRepo);

    this.loginEcdhUseCase = new LoginEcdhUseCase(
      deviceRepo,
      sessionKeyRepo,
      ecdh,
      hkdf
    );
  }

  /**
   * Inicia el proceso de enrollment FIDO2
   * Genera challenge y opciones WebAuthn para el cliente
   */
  async createEnrollmentChallenge(
    userId: number,
    username: string,
    displayName?: string
  ): Promise<{
    challenge: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }> {
    const result = await this.startEnrollmentUseCase.execute({
      userId,
      username,
      displayName: displayName || username,
    });

    // Extraer challenge de las opciones
    return {
      challenge: result.options.challenge,
      options: result.options,
    };
  }

  /**
   * Completa el enrollment verificando la respuesta WebAuthn
   */
  async verifyAndCompleteEnrollment(
    userId: number,
    credential: any,
    deviceFingerprint?: string
  ): Promise<{
    deviceId: number;
    aaguid: string;
  }> {
    const result = await this.finishEnrollmentUseCase.execute({
      userId,
      credential,
      deviceFingerprint: deviceFingerprint || 'unknown',
    });

    return {
      deviceId: result.deviceId,
      aaguid: result.aaguid,
    };
  }

  /**
   * Verifica el estado de enrollment del usuario
   */
  async checkEnrollmentStatus(userId: number): Promise<{
    enrolled: boolean;
    deviceCount: number;
  }> {
    const result = await this.getEnrollmentStatusUseCase.execute({ userId });

    return {
      enrolled: result.isEnrolled,
      deviceCount: result.deviceCount,
    };
  }

  /**
   * Realiza login ECDH para derivar session_key
   */
  async performECDHLogin(
    userId: number,
    clientPublicKey: string,
    credentialId: string
  ): Promise<{
    serverPublicKey: string;
    TOTPu: string;
  }> {
    const result = await this.loginEcdhUseCase.execute({
      userId,
      clientPublicKey,
      credentialId,
    });

    return {
      serverPublicKey: result.serverPublicKey,
      TOTPu: result.totpu,
    };
  }
}
