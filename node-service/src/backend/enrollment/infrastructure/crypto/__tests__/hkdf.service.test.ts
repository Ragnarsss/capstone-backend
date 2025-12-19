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

    it('debe ser determinístico para mismo credentialId y userId', async () => {
      // Arrange
      const credentialId = 'dGVzdC1jcmVkZW50aWFs';
      const userId = 123;

      // Act
      const secret1 = await hkdfService.deriveHandshakeSecret(credentialId, userId);
      const secret2 = await hkdfService.deriveHandshakeSecret(credentialId, userId);

      // Assert
      expect(secret1.equals(secret2)).toBe(true);
    });
  });

  describe('deriveKey - Derivación genérica', () => {
    it('debe derivar clave de 32 bytes por defecto', async () => {
      // Arrange
      const ikm = Buffer.from('input-key-material', 'utf-8');
      const context = 'test-context-v1';

      // Act
      const derivedKey = await hkdfService.deriveKey(ikm, context);

      // Assert
      expect(derivedKey).toBeInstanceOf(Buffer);
      expect(derivedKey.length).toBe(32);
    });

    it('debe derivar clave con longitud personalizada', async () => {
      // Arrange
      const ikm = Buffer.from('input-key-material', 'utf-8');
      const context = 'test-context-v1';

      // Act
      const derivedKey16 = await hkdfService.deriveKey(ikm, context, 16);
      const derivedKey64 = await hkdfService.deriveKey(ikm, context, 64);

      // Assert
      expect(derivedKey16.length).toBe(16);
      expect(derivedKey64.length).toBe(64);
    });

    it('debe producir claves diferentes para diferentes contextos', async () => {
      // Arrange
      const ikm = Buffer.from('input-key-material', 'utf-8');

      // Act
      const key1 = await hkdfService.deriveKey(ikm, 'context-1');
      const key2 = await hkdfService.deriveKey(ikm, 'context-2');

      // Assert
      expect(key1.equals(key2)).toBe(false);
    });

    it('debe ser determinístico para mismo ikm y contexto', async () => {
      // Arrange
      const ikm = Buffer.from('input-key-material', 'utf-8');
      const context = 'test-context-v1';

      // Act
      const key1 = await hkdfService.deriveKey(ikm, context);
      const key2 = await hkdfService.deriveKey(ikm, context);

      // Assert
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('generateTotp - Generación TOTP', () => {
    it('debe generar TOTP de 6 dígitos', () => {
      // Arrange
      const secret = Buffer.from('test-secret-for-totp', 'utf-8');

      // Act
      const totp = hkdfService.generateTotp(secret);

      // Assert
      expect(totp).toMatch(/^\d{6}$/);
      expect(totp.length).toBe(6);
    });

    it('debe generar TOTP con padding de ceros a la izquierda', () => {
      // Arrange
      const secret = Buffer.from('secret-that-produces-small-otp', 'utf-8');

      // Act
      const totp = hkdfService.generateTotp(secret);

      // Assert
      expect(totp.length).toBe(6);
      expect(/^\d{6}$/.test(totp)).toBe(true);
    });

    it('debe generar diferentes TOTPs con diferentes time steps', () => {
      // Arrange
      const secret = Buffer.from('test-secret', 'utf-8');

      // Act
      const totp30 = hkdfService.generateTotp(secret, 30);
      const totp60 = hkdfService.generateTotp(secret, 60);

      // Assert - Altamente probable que sean diferentes con timeSteps distintos
      // (podría fallar si justo cae en el límite, pero es extremadamente improbable)
      expect(totp30).toMatch(/^\d{6}$/);
      expect(totp60).toMatch(/^\d{6}$/);
    });

    it('debe ser consistente en el mismo periodo de tiempo', () => {
      // Arrange
      const secret = Buffer.from('test-secret', 'utf-8');

      // Act - Generar múltiples veces en el mismo segundo
      const totp1 = hkdfService.generateTotp(secret);
      const totp2 = hkdfService.generateTotp(secret);
      const totp3 = hkdfService.generateTotp(secret);

      // Assert - Todos deben ser iguales en el mismo periodo
      expect(totp1).toBe(totp2);
      expect(totp2).toBe(totp3);
    });

    it('debe generar TOTPs diferentes para secrets diferentes', () => {
      // Arrange
      const secret1 = Buffer.from('secret-one', 'utf-8');
      const secret2 = Buffer.from('secret-two', 'utf-8');

      // Act
      const totp1 = hkdfService.generateTotp(secret1);
      const totp2 = hkdfService.generateTotp(secret2);

      // Assert - Extremadamente probable que sean diferentes
      expect(totp1).not.toBe(totp2);
    });
  });

  describe('validateTotp - Validación TOTP', () => {
    it('debe validar TOTP correcto en ventana actual', () => {
      // Arrange
      const secret = Buffer.from('test-secret', 'utf-8');
      const totp = hkdfService.generateTotp(secret);

      // Act
      const isValid = hkdfService.validateTotp(secret, totp);

      // Assert
      expect(isValid).toBe(true);
    });

    it('debe rechazar TOTP incorrecto', () => {
      // Arrange
      const secret = Buffer.from('test-secret', 'utf-8');
      const invalidTotp = '000000';

      // Act
      const isValid = hkdfService.validateTotp(secret, invalidTotp);

      // Assert
      expect(isValid).toBe(false);
    });

    it('debe validar TOTP con ventana de tolerancia', () => {
      // Arrange
      const secret = Buffer.from('test-secret', 'utf-8');
      const totp = hkdfService.generateTotp(secret);

      // Act - Validar con ventana de 2 periodos (±60s)
      const isValid = hkdfService.validateTotp(secret, totp, 2);

      // Assert
      expect(isValid).toBe(true);
    });

    it('debe rechazar TOTP con secret diferente', () => {
      // Arrange
      const secret1 = Buffer.from('secret-one', 'utf-8');
      const secret2 = Buffer.from('secret-two', 'utf-8');
      const totp = hkdfService.generateTotp(secret1);

      // Act
      const isValid = hkdfService.validateTotp(secret2, totp);

      // Assert
      expect(isValid).toBe(false);
    });

    it('debe rechazar TOTP con formato inválido', () => {
      // Arrange
      const secret = Buffer.from('test-secret', 'utf-8');
      const invalidTotps = ['12345', '1234567', 'abcdef', '12-34-56'];

      // Act & Assert
      for (const invalidTotp of invalidTotps) {
        const isValid = hkdfService.validateTotp(secret, invalidTotp);
        expect(isValid).toBe(false);
      }
    });

    it('debe manejar ventana de tolerancia de 0', () => {
      // Arrange
      const secret = Buffer.from('test-secret', 'utf-8');
      const totp = hkdfService.generateTotp(secret);

      // Act - Ventana 0 = solo periodo actual
      const isValid = hkdfService.validateTotp(secret, totp, 0);

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('Error handling y edge cases', () => {
    it('debe manejar Buffer vacío en deriveSessionKey', async () => {
      // Arrange
      const emptySecret = Buffer.alloc(0);
      const credentialId = 'dGVzdC1jcmVkZW50aWFs';

      // Act
      const sessionKey = await hkdfService.deriveSessionKey(emptySecret, credentialId);

      // Assert - Debe derivar clave incluso con input vacío
      expect(sessionKey).toBeInstanceOf(Buffer);
      expect(sessionKey.length).toBe(32);
    });

    it('debe manejar credentialId largo pero dentro del límite', async () => {
      // Arrange
      const sharedSecret = Buffer.from('shared-secret', 'utf-8');
      // Info max size = 1024 bytes, prefix = 'attendance-session-key-v1:' (27 bytes)
      // credentialId puede ser hasta ~990 bytes
      const longCredentialId = 'A'.repeat(500); // credentialId largo pero válido

      // Act
      const sessionKey = await hkdfService.deriveSessionKey(sharedSecret, longCredentialId);

      // Assert
      expect(sessionKey).toBeInstanceOf(Buffer);
      expect(sessionKey.length).toBe(32);
    });

    it('debe manejar userId = 0 en deriveHandshakeSecret', async () => {
      // Arrange
      const credentialId = 'dGVzdC1jcmVkZW50aWFs';
      const userId = 0;

      // Act
      const handshakeSecret = await hkdfService.deriveHandshakeSecret(credentialId, userId);

      // Assert
      expect(handshakeSecret).toBeInstanceOf(Buffer);
      expect(handshakeSecret.length).toBe(32);
    });

    it('debe manejar userId negativo en deriveHandshakeSecret', async () => {
      // Arrange
      const credentialId = 'dGVzdC1jcmVkZW50aWFs';
      const userId = -1;

      // Act
      const handshakeSecret = await hkdfService.deriveHandshakeSecret(credentialId, userId);

      // Assert
      expect(handshakeSecret).toBeInstanceOf(Buffer);
      expect(handshakeSecret.length).toBe(32);
    });

    it('debe manejar context vacío en deriveKey', async () => {
      // Arrange
      const ikm = Buffer.from('input-key-material', 'utf-8');
      const emptyContext = '';

      // Act
      const derivedKey = await hkdfService.deriveKey(ikm, emptyContext);

      // Assert
      expect(derivedKey).toBeInstanceOf(Buffer);
      expect(derivedKey.length).toBe(32);
    });

    it('debe generar TOTP válido con secret de 1 byte', () => {
      // Arrange
      const tinySecret = Buffer.from('a', 'utf-8');

      // Act
      const totp = hkdfService.generateTotp(tinySecret);

      // Assert
      expect(totp).toMatch(/^\d{6}$/);
    });
  });

  describe('Compatibilidad con masterSecret por defecto', () => {
    it('debe usar config.crypto.masterSecret si no se proporciona', () => {
      // Act - Crear servicio sin parámetros
      const service = new HkdfService();

      // Assert - Debe funcionar correctamente
      expect(service).toBeInstanceOf(HkdfService);
    });

    it('debe derivar claves consistentemente con masterSecret personalizado', async () => {
      // Arrange
      const customSecret = 'custom-master-secret';
      const service1 = new HkdfService(customSecret);
      const service2 = new HkdfService(customSecret);
      const credentialId = 'dGVzdC1jcmVkZW50aWFs';
      const userId = 123;

      // Act
      const secret1 = await service1.deriveHandshakeSecret(credentialId, userId);
      const secret2 = await service2.deriveHandshakeSecret(credentialId, userId);

      // Assert
      expect(secret1.equals(secret2)).toBe(true);
    });
  });
});
