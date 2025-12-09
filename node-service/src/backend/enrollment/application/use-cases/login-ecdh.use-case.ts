import { 
  DeviceRepository, 
  SessionKeyRepository, 
  EcdhService, 
  HkdfService
} from '../../infrastructure';
import type { SessionKey } from '../../domain/models';

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
  totpu: string; // TOTP de usuario para validación
  deviceId: number;
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
    const { userId, credentialId, clientPublicKey } = input;

    // 1. Buscar dispositivo por credentialId
    const device = await this.deviceRepository.findByCredentialId(credentialId);
    if (!device) {
      throw new Error('DEVICE_NOT_FOUND: Dispositivo no encontrado');
    }

    // Verificar que el dispositivo pertenece al usuario
    if (device.userId !== userId) {
      throw new Error('DEVICE_NOT_OWNED: El dispositivo no pertenece a este usuario');
    }

    // Verificar que el dispositivo está activo
    if (!device.isActive) {
      throw new Error('DEVICE_REVOKED: El dispositivo ha sido revocado');
    }

    // 2. Realizar ECDH key exchange
    const keyExchangeResult = this.ecdhService.performKeyExchange(clientPublicKey);

    // 3. Derivar session_key con HKDF
    const sessionKeyBuffer = await this.hkdfService.deriveSessionKey(
      keyExchangeResult.sharedSecret
    );

    // 4. Guardar session_key en Valkey (TTL 2 horas)
    const sessionKey: SessionKey = {
      sessionKey: sessionKeyBuffer,
      userId,
      deviceId: device.deviceId,
      createdAt: Date.now(),
    };
    await this.sessionKeyRepository.save(sessionKey, 7200);

    // 5. Generar TOTPu con handshake_secret
    const handshakeSecretBuffer = Buffer.from(device.handshakeSecret, 'base64');
    const totpu = this.hkdfService.generateTotp(handshakeSecretBuffer);

    // 6. Actualizar last_used_at del dispositivo
    await this.deviceRepository.updateLastUsed(device.deviceId);

    // 7. Retornar respuesta
    return {
      serverPublicKey: keyExchangeResult.serverPublicKey,
      totpu,
      deviceId: device.deviceId,
    };
  }
}
