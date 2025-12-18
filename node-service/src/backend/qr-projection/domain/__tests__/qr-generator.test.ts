import { describe, it, expect, beforeEach } from 'vitest';
import { QRGenerator } from '../qr-generator';
import { SessionId } from '../session-id';
import type { QRPayloadV1 } from '../models';

/**
 * Tests para QRGenerator
 * 
 * Verifica que el generador:
 * - Construye payloads V1 con estructura correcta
 * - Genera nonces criptográficos válidos
 * - Incrementa round counter correctamente
 * - Encripta payloads con AES-GCM
 * - Genera QRs decoy indistinguibles
 */
describe('QRGenerator', () => {
  let qrGenerator: QRGenerator;
  const testSessionId = SessionId.create('proj-123');
  const testUserId = 42;

  beforeEach(() => {
    qrGenerator = new QRGenerator();
  });

  describe('Generación de nonce', () => {
    it('debe generar nonce de 32 caracteres hex', () => {
      // Act
      const nonce = qrGenerator.generateNonce();

      // Assert
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
      expect(nonce.length).toBe(32);
    });

    it('debe generar nonces diferentes en cada llamada', () => {
      // Act
      const nonce1 = qrGenerator.generateNonce();
      const nonce2 = qrGenerator.generateNonce();
      const nonce3 = qrGenerator.generateNonce();

      // Assert
      expect(nonce1).not.toBe(nonce2);
      expect(nonce2).not.toBe(nonce3);
      expect(nonce1).not.toBe(nonce3);
    });
  });

  describe('Construcción de payload V1', () => {
    it('debe construir payload con estructura correcta', () => {
      // Act
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert - Verificar estructura completa
      expect(payload).toHaveProperty('v');
      expect(payload).toHaveProperty('sid');
      expect(payload).toHaveProperty('uid');
      expect(payload).toHaveProperty('r');
      expect(payload).toHaveProperty('ts');
      expect(payload).toHaveProperty('n');
    });

    it('debe incluir version 1', () => {
      // Act
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      expect(payload.v).toBe(1);
    });

    it('debe incluir sessionId como string', () => {
      // Act
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      expect(payload.sid).toBe(testSessionId.toString());
      expect(typeof payload.sid).toBe('string');
    });

    it('debe incluir userId', () => {
      // Act
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      expect(payload.uid).toBe(testUserId);
      expect(typeof payload.uid).toBe('number');
    });

    it('debe incluir timestamp reciente', () => {
      // Arrange
      const before = Date.now();

      // Act
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      const after = Date.now();
      expect(payload.ts).toBeGreaterThanOrEqual(before);
      expect(payload.ts).toBeLessThanOrEqual(after);
    });

    it('debe incluir nonce de 32 caracteres hex', () => {
      // Act
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      expect(payload.n).toMatch(/^[0-9a-f]{32}$/);
    });

    it('debe incluir round number positivo', () => {
      // Act
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      expect(payload.r).toBeGreaterThan(0);
      expect(typeof payload.r).toBe('number');
    });
  });

  describe('Round counter', () => {
    it('debe iniciar en round 1', () => {
      // Act
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      expect(payload.r).toBe(1);
    });

    it('debe incrementar round en cada llamada para misma sesión', () => {
      // Act
      const payload1 = qrGenerator.buildPayloadV1(testSessionId, testUserId);
      const payload2 = qrGenerator.buildPayloadV1(testSessionId, testUserId);
      const payload3 = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      expect(payload1.r).toBe(1);
      expect(payload2.r).toBe(2);
      expect(payload3.r).toBe(3);
    });

    it('debe mantener contadores independientes por sesión', () => {
      // Arrange
      const session1 = SessionId.create('proj-100');
      const session2 = SessionId.create('proj-200');

      // Act
      const payload1a = qrGenerator.buildPayloadV1(session1, testUserId);
      const payload2a = qrGenerator.buildPayloadV1(session2, testUserId);
      const payload1b = qrGenerator.buildPayloadV1(session1, testUserId);
      const payload2b = qrGenerator.buildPayloadV1(session2, testUserId);

      // Assert - Cada sesión mantiene su propio contador
      expect(payload1a.r).toBe(1);
      expect(payload2a.r).toBe(1);
      expect(payload1b.r).toBe(2);
      expect(payload2b.r).toBe(2);
    });

    it('debe reiniciar contador tras resetRoundCounter', () => {
      // Arrange
      qrGenerator.buildPayloadV1(testSessionId, testUserId); // r=1
      qrGenerator.buildPayloadV1(testSessionId, testUserId); // r=2

      // Act
      qrGenerator.resetRoundCounter(testSessionId);
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Assert
      expect(payload.r).toBe(1);
    });
  });

  describe('Conversión a string JSON', () => {
    it('debe convertir payload a JSON válido', () => {
      // Arrange
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Act
      const jsonString = qrGenerator.toQRString(payload);

      // Assert
      expect(() => JSON.parse(jsonString)).not.toThrow();
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(payload);
    });

    it('debe incluir todos los campos en el JSON', () => {
      // Arrange
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Act
      const jsonString = qrGenerator.toQRString(payload);
      const parsed = JSON.parse(jsonString);

      // Assert
      expect(parsed.v).toBe(payload.v);
      expect(parsed.sid).toBe(payload.sid);
      expect(parsed.uid).toBe(payload.uid);
      expect(parsed.r).toBe(payload.r);
      expect(parsed.ts).toBe(payload.ts);
      expect(parsed.n).toBe(payload.n);
    });
  });

  describe('Encriptación con AES-GCM', () => {
    it('debe encriptar payload generando string no vacío', () => {
      // Arrange
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Act
      const encrypted = qrGenerator.encryptPayload(payload);

      // Assert
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('debe generar formato iv.ciphertext.authTag (partes separadas por punto)', () => {
      // Arrange
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Act
      const encrypted = qrGenerator.encryptPayload(payload);

      // Assert - Formato esperado: "iv.ciphertext.authTag" (3 partes en base64)
      const parts = encrypted.split('.');
      expect(parts.length).toBe(3);
      parts.forEach(part => {
        expect(part.length).toBeGreaterThan(0);
      });
    });

    it('debe generar ciphertexts diferentes para payloads idénticos', () => {
      // Arrange - Mismo payload
      const payload1 = qrGenerator.buildPayloadV1(testSessionId, testUserId);
      const payload2 = { ...payload1 }; // Copia idéntica

      // Act
      const encrypted1 = qrGenerator.encryptPayload(payload1);
      const encrypted2 = qrGenerator.encryptPayload(payload2);

      // Assert - AES-GCM usa IV aleatorio, por lo que ciphertexts son diferentes
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('Encriptación con clave aleatoria (QRs decoy)', () => {
    it('debe generar payload encriptado con formato válido', () => {
      // Arrange
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Act
      const encrypted = qrGenerator.encryptPayloadWithRandomKey(payload);

      // Assert
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      const parts = encrypted.split('.');
      expect(parts.length).toBe(3);
    });

    it('debe generar ciphertexts diferentes en cada llamada (claves aleatorias)', () => {
      // Arrange
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Act
      const encrypted1 = qrGenerator.encryptPayloadWithRandomKey(payload);
      const encrypted2 = qrGenerator.encryptPayloadWithRandomKey(payload);
      const encrypted3 = qrGenerator.encryptPayloadWithRandomKey(payload);

      // Assert
      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypted2).not.toBe(encrypted3);
      expect(encrypted1).not.toBe(encrypted3);
    });

    it('QR decoy debe ser indistinguible de QR real (mismo formato)', () => {
      // Arrange
      const payload = qrGenerator.buildPayloadV1(testSessionId, testUserId);

      // Act
      const realQR = qrGenerator.encryptPayload(payload);
      const decoyQR = qrGenerator.encryptPayloadWithRandomKey(payload);

      // Assert - Ambos tienen 3 partes separadas por punto
      const realParts = realQR.split('.');
      const decoyParts = decoyQR.split('.');
      
      expect(realParts.length).toBe(3);
      expect(decoyParts.length).toBe(3);
      
      // Longitudes similares (no revelan diferencia)
      expect(Math.abs(realQR.length - decoyQR.length)).toBeLessThan(50);
    });
  });

  describe('generateV1 (método principal)', () => {
    it('debe generar envelope con payload y payloadString encriptado', () => {
      // Act
      const envelope = qrGenerator.generateV1(testSessionId, testUserId);

      // Assert
      expect(envelope).toHaveProperty('payload');
      expect(envelope).toHaveProperty('payloadString');
      expect(envelope).toHaveProperty('sessionId');
    });

    it('debe incluir payload V1 estructurado', () => {
      // Act
      const envelope = qrGenerator.generateV1(testSessionId, testUserId);

      // Assert
      expect(envelope.payload.v).toBe(1);
      expect(envelope.payload.sid).toBe(testSessionId.toString());
      expect(envelope.payload.uid).toBe(testUserId);
      expect(envelope.payload.r).toBeGreaterThan(0);
    });

    it('debe incluir payloadString encriptado', () => {
      // Act
      const envelope = qrGenerator.generateV1(testSessionId, testUserId);

      // Assert
      expect(envelope.payloadString).toBeTruthy();
      expect(typeof envelope.payloadString).toBe('string');
      expect(envelope.payloadString.split('.').length).toBe(3);
    });

    it('debe incluir sessionId original', () => {
      // Act
      const envelope = qrGenerator.generateV1(testSessionId, testUserId);

      // Assert
      expect(envelope.sessionId).toBe(testSessionId);
    });
  });

  describe('generateForStudent (implementación IQRGenerator)', () => {
    it('debe generar payload para round específico', () => {
      // Arrange
      const options = {
        sessionId: 'proj-456',
        hostUserId: 99,
        round: 3,
      };

      // Act
      const result = qrGenerator.generateForStudent(options);

      // Assert
      expect(result.payload.r).toBe(3);
    });

    it('debe incluir sessionId y hostUserId correctos', () => {
      // Arrange
      const options = {
        sessionId: 'proj-789',
        hostUserId: 77,
        round: 1,
      };

      // Act
      const result = qrGenerator.generateForStudent(options);

      // Assert
      expect(result.payload.sid).toBe('proj-789');
      expect(result.payload.uid).toBe(77);
    });

    it('debe retornar payload y encrypted', () => {
      // Arrange
      const options = {
        sessionId: 'proj-123',
        hostUserId: 42,
        round: 2,
      };

      // Act
      const result = qrGenerator.generateForStudent(options);

      // Assert
      expect(result).toHaveProperty('payload');
      expect(result).toHaveProperty('encrypted');
      expect(result.encrypted).toBeTruthy();
    });

    it('debe generar nonce único en cada llamada', () => {
      // Arrange
      const options = {
        sessionId: 'proj-100',
        hostUserId: 10,
        round: 1,
      };

      // Act
      const result1 = qrGenerator.generateForStudent(options);
      const result2 = qrGenerator.generateForStudent(options);

      // Assert
      expect(result1.payload.n).not.toBe(result2.payload.n);
    });
  });
});
