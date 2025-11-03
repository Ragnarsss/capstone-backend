import type { WebAuthnOptions, EnrollmentChallenge } from '../domain/models';
import { EnrollmentChallengeRepository } from '../infrastructure/enrollment-challenge.repository';
import { SessionKeyRepository } from '../infrastructure/session-key.repository';

/**
 * Application Service para Enrollment
 * Responsabilidad: Orquestar casos de uso de enrollment FIDO2
 */
export class EnrollmentService {
  private challengeRepository: EnrollmentChallengeRepository;
  private sessionKeyRepository: SessionKeyRepository;

  constructor() {
    this.challengeRepository = new EnrollmentChallengeRepository();
    this.sessionKeyRepository = new SessionKeyRepository();
  }

  async createEnrollmentChallenge(userId: number, username: string, displayName?: string): Promise<{
    challenge: string;
    options: WebAuthnOptions;
  }> {
    const challenge = Buffer.from(crypto.randomUUID()).toString('base64url');
    const now = Date.now();

    const enrollmentChallenge: EnrollmentChallenge = {
      challenge,
      userId,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000, // 5 minutos
    };

    await this.challengeRepository.save(enrollmentChallenge);

    const options: WebAuthnOptions = {
      rp: {
        name: 'Sistema de Asistencia UCN',
        id: 'asistencia.ucn.cl',
      },
      user: {
        id: Buffer.from(userId.toString()).toString('base64url'),
        name: username,
        displayName: displayName || username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
      attestation: 'direct',
      timeout: 60000,
    };

    return { challenge, options };
  }

  async verifyAndCompleteEnrollment(userId: number, credential: any): Promise<{
    deviceId: number;
    aaguid: string;
  }> {
    // TODO: Implementar lógica real de WebAuthn
    // - Validar attestation
    // - Verificar challenge
    // - Extraer public key
    // - Derivar handshake_secret con HKDF
    // - Almacenar en PostgreSQL (schema enrollment.devices)

    await this.challengeRepository.delete(userId);

    return {
      deviceId: Math.floor(Math.random() * 10000),
      aaguid: 'stub-aaguid-placeholder',
    };
  }

  async checkEnrollmentStatus(userId: number): Promise<{
    enrolled: boolean;
    deviceCount: number;
  }> {
    // TODO: Consultar PostgreSQL para verificar si el usuario tiene dispositivo enrolado
    // SELECT * FROM enrollment.devices WHERE user_id = ?

    return {
      enrolled: false,
      deviceCount: 0,
    };
  }

  async performECDHLogin(userId: number, clientPublicKey: string, assertion: any): Promise<{
    serverPublicKey: string;
    TOTPu: string;
  }> {
    // TODO: Implementar lógica real de ECDH
    // - Validar assertion WebAuthn
    // - Generar par ECDH servidor
    // - Derivar shared_secret
    // - Derivar session_key con HKDF
    // - Generar TOTPu basado en handshake_secret
    // - Retornar serverPublicKey y TOTPu

    const serverPublicKey = Buffer.from(crypto.randomUUID()).toString('base64url');
    const TOTPu = Math.floor(100000 + Math.random() * 900000).toString();

    return { serverPublicKey, TOTPu };
  }
}
