import { describe, it, expect, beforeEach } from 'vitest';
import { HkdfService } from '../hkdf.service';

/**
 * Tests para HkdfService - Derivación de claves HKDF
 * 
 * Enfoque: Verificar binding de session_key con credentialId
 */
describe('HkdfService', () => {
  let hkdfService: HkdfService;
  const testMasterSecret = 'test-master-secret-32-bytes-long';

  beforeEach(() => {
    hkdfService = new HkdfService(testMasterSecret);
  });

  describe('deriveSessionKey con credentialId binding', () => {
    const sharedSecret = Buffer.from('shared-secret-from-ecdh-exchange', 'utf-8');
    const credentialId1 = 'Y3JlZGVudGlhbC0xMjM0NQ=='; // "credential-12345" en base64
    const credentialId2 = 'Y3JlZGVudGlhbC02Nzg5MA=='; // "credential-67890" en base64

    it('debe derivar session_key de 32 bytes', async () => {
      // Act
      const sessionKey = await hkdfService.deriveSessionKey(sharedSecret, credentialId1);

      // Assert
      expect(sessionKey).toBeInstanceOf(Buffer);
      expect(sessionKey.length).toBe(32);
    });

    it('debe producir session_keys diferentes para diferentes credentialId', async () => {
      // Act
      const sessionKey1 = await hkdfService.deriveSessionKey(sharedSecret, credentialId1);
      const sessionKey2 = await hkdfService.deriveSessionKey(sharedSecret, credentialId2);

      // Assert - las claves deben ser diferentes
      expect(sessionKey1.equals(sessionKey2)).toBe(false);
    });

    it('debe producir session_key idéntica para mismo sharedSecret y credentialId', async () => {
      // Act
      const sessionKey1 = await hkdfService.deriveSessionKey(sharedSecret, credentialId1);
      const sessionKey2 = await hkdfService.deriveSessionKey(sharedSecret, credentialId1);

      // Assert - las claves deben ser idénticas (determinístico)
      expect(sessionKey1.equals(sessionKey2)).toBe(true);
    });

    it('debe producir session_keys diferentes para diferentes sharedSecret', async () => {
      // Arrange
      const sharedSecret2 = Buffer.from('another-shared-secret-ecdh-data', 'utf-8');

      // Act
      const sessionKey1 = await hkdfService.deriveSessionKey(sharedSecret, credentialId1);
      const sessionKey2 = await hkdfService.deriveSessionKey(sharedSecret2, credentialId1);

      // Assert
      expect(sessionKey1.equals(sessionKey2)).toBe(false);
    });
  });

  describe('deriveHandshakeSecret', () => {
    it('debe derivar handshake_secret de 32 bytes', async () => {
      // Arrange
      const credentialId = 'dGVzdC1jcmVkZW50aWFs'; // "test-credential" en base64
      const userId = 123;

      // Act
      const handshakeSecret = await hkdfService.deriveHandshakeSecret(credentialId, userId);

      // Assert
      expect(handshakeSecret).toBeInstanceOf(Buffer);
      expect(handshakeSecret.length).toBe(32);
    });

    it('debe producir secrets diferentes para diferentes usuarios', async () => {
      // Arrange
      const credentialId = 'dGVzdC1jcmVkZW50aWFs';

      // Act
      const secret1 = await hkdfService.deriveHandshakeSecret(credentialId, 123);
      const secret2 = await hkdfService.deriveHandshakeSecret(credentialId, 456);

      // Assert
      expect(secret1.equals(secret2)).toBe(false);
    });
  });
});
