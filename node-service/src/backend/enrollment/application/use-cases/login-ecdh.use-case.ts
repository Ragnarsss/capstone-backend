import { 
  DeviceRepository, 
  SessionKeyRepository, 
  EcdhService, 
  HkdfService
} from '../../infrastructure';
import type { SessionKey } from '../../domain/models';
import { DeviceStateMachine } from '../../domain/state-machines';

/**
 * Input DTO para Login ECDH
 */
export interface LoginEcdhInput {
  userId: number;
  credentialId: string;
  clientPublicKey: string; // Base64 - clave ECDH del cliente
  deviceFingerprint?: string; // Opcional - para verificacion de dispositivo
}

/**
 * Output DTO para Login ECDH
 */
export interface LoginEcdhOutput {
  serverPublicKey: string; // Base64 - clave ECDH del servidor
  totpu: string; // TOTP de usuario para validacion
  deviceId: number;
  fingerprintUpdated?: boolean; // True si el fingerprint fue actualizado (probable OS update)
}

/**
 * Use Case: Login con ECDH key exchange
 * 
 * Flujo:
 * 1. Verificar que el dispositivo existe y está activo
 * 2. Realizar ECDH key exchange
 * 3. Derivar session_key con HKDF
 * 4. Guardar session_key en Valkey (TTL 2 horas)
 * 5. Generar TOTPu con handshake_secret
 * 6. Retornar serverPublicKey + TOTPu
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
    const { userId, credentialId, clientPublicKey, deviceFingerprint } = input;

    // 1. Buscar dispositivo por credentialId
    const device = await this.deviceRepository.findByCredentialId(credentialId);
    if (!device) {
      throw new Error('DEVICE_NOT_FOUND: Dispositivo no encontrado');
    }

    // Verificar que el dispositivo pertenece al usuario
    if (device.userId !== userId) {
      throw new Error('DEVICE_NOT_OWNED: El dispositivo no pertenece a este usuario');
    }

    // Validar que el estado permite iniciar sesion
    if (!DeviceStateMachine.canStartSession(device.status)) {
      throw new Error(
        `SESSION_NOT_ALLOWED: No se puede iniciar sesion en estado '${device.status}'. ` +
        `Solo dispositivos 'enrolled' pueden iniciar sesion.`
      );
    }

    // 2. Verificar y actualizar deviceFingerprint si es necesario
    // Si el fingerprint cambio pero credentialId coincide, es probable update de OS
    let fingerprintUpdated = false;
    if (deviceFingerprint && deviceFingerprint !== device.deviceFingerprint) {
      // credentialId ya coincide (lo buscamos por el), asi que actualizamos el fingerprint
      await this.deviceRepository.updateDeviceFingerprint(device.deviceId, deviceFingerprint);
      fingerprintUpdated = true;
      console.log(`[LoginEcdh] DeviceFingerprint actualizado para device ${device.deviceId} (probable OS update)`);
    }

    // 3. Realizar ECDH key exchange
    const keyExchangeResult = this.ecdhService.performKeyExchange(clientPublicKey);

    // 4. Derivar session_key con HKDF
    const sessionKeyBuffer = await this.hkdfService.deriveSessionKey(
      keyExchangeResult.sharedSecret
    );

    // 5. Guardar session_key en Valkey (TTL 2 horas)
    const sessionKey: SessionKey = {
      sessionKey: sessionKeyBuffer,
      userId,
      deviceId: device.deviceId,
      createdAt: Date.now(),
    };
    await this.sessionKeyRepository.save(sessionKey, 7200);

    // 6. Generar TOTPu con handshake_secret
    const handshakeSecretBuffer = Buffer.from(device.handshakeSecret, 'base64');
    const totpu = this.hkdfService.generateTotp(handshakeSecretBuffer);

    // 7. Actualizar last_used_at del dispositivo
    await this.deviceRepository.updateLastUsed(device.deviceId);

    // 8. Retornar respuesta
    return {
      serverPublicKey: keyExchangeResult.serverPublicKey,
      totpu,
      deviceId: device.deviceId,
      fingerprintUpdated,
    };
  }
}
