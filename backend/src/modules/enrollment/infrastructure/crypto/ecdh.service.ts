import { createECDH, ECDH } from 'node:crypto';

/**
 * Par de claves ECDH efímeras
 */
export interface EcdhKeyPair {
  publicKey: string; // Base64
  privateKey: Buffer;
}

/**
 * Resultado del key exchange
 */
export interface EcdhKeyExchangeResult {
  sharedSecret: Buffer;
  serverPublicKey: string; // Base64
}

/**
 * Servicio ECDH para key exchange
 * Responsabilidad única: Generar pares de claves y derivar shared secrets
 * 
 * Curva: P-256 (secp256r1) - misma que FIDO2 ES256
 * Perfect Forward Secrecy: cada sesión usa pares efímeros diferentes
 */
export class EcdhService {
  private readonly curve = 'prime256v1'; // P-256

  /**
   * Genera un par de claves ECDH efímeras
   */
  generateKeyPair(): EcdhKeyPair {
    const ecdh = createECDH(this.curve);
    ecdh.generateKeys();

    return {
      publicKey: ecdh.getPublicKey('base64'),
      privateKey: ecdh.getPrivateKey(),
    };
  }

  /**
   * Realiza key exchange con la clave pública del cliente
   * Genera un par efímero del servidor y computa shared secret
   * 
   * @param clientPublicKeyBase64 - Clave pública del cliente en Base64
   * @returns Shared secret y clave pública del servidor
   */
  performKeyExchange(clientPublicKeyBase64: string): EcdhKeyExchangeResult {
    // Generar par efímero del servidor
    const serverKeyPair = this.generateKeyPair();

    // Computar shared secret usando la clave privada del servidor y pública del cliente
    const sharedSecret = this.computeSharedSecret(
      serverKeyPair.privateKey,
      clientPublicKeyBase64
    );

    return {
      sharedSecret,
      serverPublicKey: serverKeyPair.publicKey,
    };
  }

  /**
   * Computa shared secret a partir de clave privada local y pública remota
   */
  private computeSharedSecret(privateKey: Buffer, remotePublicKeyBase64: string): Buffer {
    const ecdh = createECDH(this.curve);
    ecdh.setPrivateKey(privateKey);

    const remotePublicKey = Buffer.from(remotePublicKeyBase64, 'base64');
    return ecdh.computeSecret(remotePublicKey);
  }
}
