import type { SessionKey } from '../../domain/models';
import { SessionStateMachine } from '../../domain/state-machines';
import { SessionKeyRepository } from '../../infrastructure/repositories/session-key.repository';
import { DeviceRepository } from '../../../enrollment/infrastructure/repositories/device.repository';
import { EcdhService, HkdfService } from '../../../enrollment/infrastructure/crypto';

/**
 * Input DTO para Login ECDH
 */
export interface LoginEcdhInput {
  userId: number;
  credentialId: string;
  clientPublicKey: string; // Base64 - clave ECDH del cliente
}

/**
 * Output DTO para Login ECDH
 */
export interface LoginEcdhOutput {
  serverPublicKey: string; // Base64 - clave ECDH del servidor
  totpu: string; // TOTP de usuario para validacion
  deviceId: number;
}

/**
 * Use Case: Login con ECDH key exchange
 *
 * Responsabilidad UNICA (SoC):
 * - Realizar ECDH key exchange
 * - Derivar session_key con HKDF
 * - Guardar session_key en Valkey
 * - Generar TOTPu
 *
 * NO hace (responsabilidad del Orchestrator):
 * - Verificacion/actualizacion de fingerprint (EnrollmentFlowOrchestrator)
 * - Validacion de politica 1:1 (OneToOnePolicyService)
 *
 * Flujo:
 * 1. Buscar dispositivo por credentialId
 * 2. Verificar que el dispositivo pertenece al usuario
 * 3. Validar estado con SessionStateMachine.isEnabled()
 * 4. Realizar ECDH key exchange
 * 5. Derivar session_key con HKDF
 * 6. Guardar session_key en Valkey (TTL 2 horas)
 * 7. Generar TOTPu con handshake_secret
 * 8. Actualizar last_used_at
 * 9. Retornar serverPublicKey + TOTPu
 *
 * Seguridad:
 * - El credentialId identifica unívocamente al dispositivo enrolado
 * - ECDH garantiza que solo quien tiene la clave privada puede derivar session_key
 * - session_key es efímera (2 horas) y única por sesión
 */
export class LoginEcdhUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly sessionKeyRepository: SessionKeyRepository,
    private readonly ecdhService: EcdhService,
    private readonly hkdfService: HkdfService
  ) {}

  async execute(input: LoginEcdhInput): Promise<LoginEcdhOutput> {
    const { userId, credentialId, clientPublicKey } = input;

    // 1. Buscar dispositivo por credentialId
    const device = await this.deviceRepository.findByCredentialId(credentialId);
    if (!device) {
      throw new Error('DEVICE_NOT_FOUND: Dispositivo no encontrado');
    }

    // 2. Verificar que el dispositivo pertenece al usuario
    // IMPORTANTE: Convertir a número para evitar problemas con BIGINT que PostgreSQL puede retornar como string
    const deviceUserId = typeof device.userId === 'string' ? parseInt(device.userId, 10) : device.userId;
    if (deviceUserId !== userId) {
      throw new Error('DEVICE_NOT_OWNED: El dispositivo no pertenece a este usuario');
    }

    // 3. Validar que el estado permite iniciar sesion (SoC: SessionStateMachine decide)
    if (!SessionStateMachine.isEnabled(device.status)) {
      throw new Error(
        `SESSION_NOT_ALLOWED: No se puede iniciar sesion en estado '${device.status}'. ` +
        `Solo dispositivos 'enrolled' pueden iniciar sesion.`
      );
    }

    // 4. Realizar ECDH key exchange
    const keyExchangeResult = this.ecdhService.performKeyExchange(clientPublicKey);

    // 5. Derivar session_key con HKDF (vinculada al credentialId para prevenir replay attacks)
    const sessionKeyBuffer = await this.hkdfService.deriveSessionKey(
      keyExchangeResult.sharedSecret,
      credentialId
    );

    // 6. Guardar session_key en Valkey (TTL 2 horas)
    const sessionKey: SessionKey = {
      sessionKey: sessionKeyBuffer,
      userId,
      deviceId: device.deviceId,
      createdAt: Date.now(),
    };
    await this.sessionKeyRepository.save(sessionKey, 7200);

    // 7. Generar TOTPu con handshake_secret
    const handshakeSecretBuffer = Buffer.from(device.handshakeSecret, 'base64');
    const totpu = this.hkdfService.generateTotp(handshakeSecretBuffer);

    // 8. Actualizar last_used_at del dispositivo
    await this.deviceRepository.updateLastUsed(device.deviceId);

    // 9. Retornar respuesta
    return {
      serverPublicKey: keyExchangeResult.serverPublicKey,
      totpu,
      deviceId: device.deviceId,
    };
  }
}
