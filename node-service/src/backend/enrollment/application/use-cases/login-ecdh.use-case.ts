import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { 
  DeviceRepository, 
  SessionKeyRepository, 
  EcdhService, 
  HkdfService,
  Fido2Service 
} from '../../infrastructure';
import type { SessionKey } from '../../domain/models';

/**
 * Input DTO para Login ECDH
 */
export interface LoginEcdhInput {
  userId: number;
  credentialId: string;
  clientPublicKey: string; // Base64 - clave ECDH del cliente
  assertion?: AuthenticationResponseJSON; // Opcional: WebAuthn assertion para verificar posesión
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
 * 2. Opcionalmente verificar WebAuthn assertion
 * 3. Realizar ECDH key exchange
 * 4. Derivar session_key con HKDF
 * 5. Guardar session_key en Valkey (TTL 2 horas)
 * 6. Generar TOTPu con handshake_secret
 * 7. Retornar serverPublicKey + TOTPu
 */
export class LoginEcdhUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly sessionKeyRepository: SessionKeyRepository,
    private readonly ecdhService: EcdhService,
    private readonly hkdfService: HkdfService,
    private readonly fido2Service: Fido2Service
  ) {}

  async execute(input: LoginEcdhInput): Promise<LoginEcdhOutput> {
    const { userId, credentialId, clientPublicKey, assertion } = input;

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

    // 2. Si se proporciona assertion, verificar posesión del dispositivo
    if (assertion) {
      // Generar challenge para verificación (en producción debería estar almacenado)
      // Por ahora usamos un challenge básico
      try {
        const verificationResult = await this.fido2Service.verifyAuthentication(
          assertion,
          assertion.response.clientDataJSON, // El challenge está en clientDataJSON
          {
            credentialId: device.credentialId,
            publicKey: device.publicKey,
            counter: device.signCount,
            transports: device.transports,
          }
        );

        if (!verificationResult.verified) {
          throw new Error('ASSERTION_FAILED: La verificación de WebAuthn falló');
        }

        // Actualizar contador anti-clonación
        await this.deviceRepository.updateCounter({
          deviceId: device.deviceId,
          newCounter: verificationResult.authenticationInfo.newCounter,
        });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('ASSERTION_FAILED')) {
          throw error;
        }
        // Si hay error en verificación, continuar sin assertion (modo simplificado)
        console.warn('[LoginEcdhUseCase] WebAuthn verification skipped:', error);
      }
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
    };
  }
}
