import { describe, it, expect } from 'vitest';
import { hkdf as nodeHkdf } from 'node:crypto';
import { HkdfService } from '../hkdf.service';

/**
 * Tests de Compatibilidad HKDF Frontend-Backend
 * 
 * PROPÓSITO CRÍTICO:
 * El frontend (Web Crypto API) y backend (Node.js crypto) derivan session_key
 * independientemente. Si los algoritmos no son idénticos, el alumno NO podrá
 * descifrar su QR (fallo silencioso).
 * 
 * Este test verifica que:
 * 1. Ambos usan el mismo algoritmo: HKDF-SHA256
 * 2. Ambos usan el mismo info string: 'attendance-session-key-v1:' + credentialId
 * 3. Ambos usan salt vacío
 * 4. El output es determinístico y documentado
 * 
 * VECTORES DE PRUEBA:
 * Los valores hexadecimales documentados aquí son la "fuente de verdad".
 * Si el frontend deriva un valor diferente, hay incompatibilidad.
 */
describe('HKDF Compatibilidad Frontend-Backend', () => {
  /**
   * Vector de prueba 1: Valores fijos para verificación cruzada
   * 
   * Estos valores pueden usarse para verificar manualmente en el frontend:
   * 1. Importar sharedSecret como HKDF base key
   * 2. Derivar con info = 'attendance-session-key-v1:' + credentialId
   * 3. El resultado debe coincidir con expectedSessionKeyHex
   */
  const TEST_VECTOR_1 = {
    // 32 bytes de shared secret simulando resultado de ECDH
    sharedSecretHex: 'a1b2c3d4e5f6071829304150617283940a1b2c3d4e5f6071829304150617283',
    // credentialId típico (Base64 de 32 bytes)
    credentialId: 'dGVzdC1jcmVkZW50aWFsLWZvci1oZGtmLWNvbXBhdA==',
    // Info string que ambos lados deben usar
    expectedInfoString: 'attendance-session-key-v1:dGVzdC1jcmVkZW50aWFsLWZvci1oZGtmLWNvbXBhdA==',
  };

  /**
   * Vector de prueba 2: Otro credentialId para verificar binding
   */
  const TEST_VECTOR_2 = {
    sharedSecretHex: 'a1b2c3d4e5f6071829304150617283940a1b2c3d4e5f6071829304150617283',
    credentialId: 'b3Ryby1jcmVkZW50aWFsLWRpZmVyZW50ZQ==',
    expectedInfoString: 'attendance-session-key-v1:b3Ryby1jcmVkZW50aWFsLWRpZmVyZW50ZQ==',
  };

  describe('Derivación con HkdfService (Backend)', () => {
    it('debe derivar session_key determinística con vector 1', async () => {
      // Arrange
      const hkdfService = new HkdfService('test-master-secret');
      const sharedSecret = Buffer.from(TEST_VECTOR_1.sharedSecretHex, 'hex');

      // Act
      const sessionKey = await hkdfService.deriveSessionKey(
        sharedSecret,
        TEST_VECTOR_1.credentialId
      );

      // Assert - documentar el valor para verificación en frontend
      expect(sessionKey).toBeInstanceOf(Buffer);
      expect(sessionKey.length).toBe(32);
      
      // Guardar el hex para referencia
      const sessionKeyHex = sessionKey.toString('hex');
      console.log('[VECTOR 1] session_key hex:', sessionKeyHex);
      
      // Verificar que es determinístico (re-derivar produce mismo resultado)
      const sessionKey2 = await hkdfService.deriveSessionKey(
        sharedSecret,
        TEST_VECTOR_1.credentialId
      );
      expect(sessionKey.equals(sessionKey2)).toBe(true);
    });

    it('debe producir session_key diferente con vector 2 (diferente credentialId)', async () => {
      // Arrange
      const hkdfService = new HkdfService('test-master-secret');
      const sharedSecret = Buffer.from(TEST_VECTOR_1.sharedSecretHex, 'hex');

      // Act
      const sessionKey1 = await hkdfService.deriveSessionKey(
        sharedSecret,
        TEST_VECTOR_1.credentialId
      );
      const sessionKey2 = await hkdfService.deriveSessionKey(
        sharedSecret,
        TEST_VECTOR_2.credentialId
      );

      // Assert - mismo sharedSecret, diferente credentialId = diferentes claves
      expect(sessionKey1.equals(sessionKey2)).toBe(false);
      
      console.log('[VECTOR 1] session_key hex:', sessionKey1.toString('hex'));
      console.log('[VECTOR 2] session_key hex:', sessionKey2.toString('hex'));
    });
  });

  describe('Compatibilidad con Web Crypto API (simulación)', () => {
    /**
     * Este test simula lo que hace el frontend usando la misma primitiva HKDF
     * de Node.js pero con los mismos parámetros que Web Crypto API usaría.
     * 
     * Web Crypto API: crypto.subtle.deriveKey({
     *   name: 'HKDF',
     *   hash: 'SHA-256',
     *   salt: new Uint8Array(0),
     *   info: new TextEncoder().encode('attendance-session-key-v1:' + credentialId)
     * }, baseKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
     * 
     * Equivalente Node.js: hkdf('sha256', ikm, salt, info, 32)
     */
    it('HKDF nativo debe producir mismo resultado que HkdfService', async () => {
      // Arrange
      const sharedSecret = Buffer.from(TEST_VECTOR_1.sharedSecretHex, 'hex');
      const info = Buffer.from(TEST_VECTOR_1.expectedInfoString, 'utf-8');
      const salt = Buffer.alloc(0); // Salt vacío como Web Crypto

      // Act - derivar directamente con nodeHkdf (simula Web Crypto)
      const directSessionKey = await new Promise<Buffer>((resolve, reject) => {
        nodeHkdf('sha256', sharedSecret, salt, info, 32, (err, derivedKey) => {
          if (err) reject(err);
          else resolve(Buffer.from(derivedKey));
        });
      });

      // Act - derivar con HkdfService (lo que usa el backend)
      const hkdfService = new HkdfService('test-master-secret');
      const serviceSessionKey = await hkdfService.deriveSessionKey(
        sharedSecret,
        TEST_VECTOR_1.credentialId
      );

      // Assert - DEBEN ser idénticos
      expect(directSessionKey.equals(serviceSessionKey)).toBe(true);
      
      console.log('[COMPATIBILIDAD] Ambos métodos producen:', directSessionKey.toString('hex'));
    });

    it('info string debe formarse correctamente', () => {
      // Arrange
      const credentialId = TEST_VECTOR_1.credentialId;
      
      // Act - simular lo que hace el frontend
      const frontendInfo = 'attendance-session-key-v1:' + credentialId;
      
      // Assert
      expect(frontendInfo).toBe(TEST_VECTOR_1.expectedInfoString);
    });

    it('salt vacío debe ser equivalente entre Uint8Array y Buffer', () => {
      // Web Crypto usa: new Uint8Array(0)
      // Node.js usa: Buffer.alloc(0)
      
      const webCryptoSalt = new Uint8Array(0);
      const nodeSalt = Buffer.alloc(0);
      
      // Ambos deben tener longitud 0
      expect(webCryptoSalt.length).toBe(0);
      expect(nodeSalt.length).toBe(0);
      
      // Buffer.from(Uint8Array) debe ser equivalente
      const converted = Buffer.from(webCryptoSalt);
      expect(converted.equals(nodeSalt)).toBe(true);
    });
  });

  describe('Documentación de Vectores de Prueba', () => {
    /**
     * IMPORTANTE: Este test documenta los valores exactos que el frontend
     * debe producir. Si este test pasa pero el frontend produce valores
     * diferentes, hay un bug en el frontend.
     */
    it('debe documentar session_key esperada para vector 1', async () => {
      // Arrange
      const sharedSecret = Buffer.from(TEST_VECTOR_1.sharedSecretHex, 'hex');
      const info = Buffer.from(TEST_VECTOR_1.expectedInfoString, 'utf-8');
      const salt = Buffer.alloc(0);

      // Act
      const sessionKey = await new Promise<Buffer>((resolve, reject) => {
        nodeHkdf('sha256', sharedSecret, salt, info, 32, (err, derivedKey) => {
          if (err) reject(err);
          else resolve(Buffer.from(derivedKey));
        });
      });

      // Documentar el valor esperado
      const expectedHex = sessionKey.toString('hex');
      
      /**
       * VECTOR DE PRUEBA PARA FRONTEND:
       * 
       * Input:
       *   sharedSecret (hex): a1b2c3d4e5f6071829304150617283940a1b2c3d4e5f6071829304150617283
       *   credentialId: dGVzdC1jcmVkZW50aWFsLWZvci1oZGtmLWNvbXBhdA==
       *   salt: (vacío)
       *   info: attendance-session-key-v1:dGVzdC1jcmVkZW50aWFsLWZvci1oZGtmLWNvbXBhdA==
       * 
       * Output esperado (session_key hex):
       *   [Se documenta en el log del test]
       */
      console.log('\n========== VECTOR DE COMPATIBILIDAD FRONTEND ==========');
      console.log('sharedSecret (hex):', TEST_VECTOR_1.sharedSecretHex);
      console.log('credentialId:', TEST_VECTOR_1.credentialId);
      console.log('info:', TEST_VECTOR_1.expectedInfoString);
      console.log('salt: (vacío)');
      console.log('algorithm: HKDF-SHA256');
      console.log('output length: 32 bytes (256 bits)');
      console.log('');
      console.log('>>> session_key ESPERADA (hex):', expectedHex);
      console.log('=========================================================\n');

      // El test pasa si podemos derivar sin error
      expect(sessionKey.length).toBe(32);
    });
  });

  describe('Edge Cases', () => {
    it('debe manejar credentialId con caracteres especiales Base64', async () => {
      // Base64 puede contener +, /, =
      const credentialIdWithSpecialChars = 'YWJj+def/ghi=';
      const sharedSecret = Buffer.from(TEST_VECTOR_1.sharedSecretHex, 'hex');
      
      const hkdfService = new HkdfService('test-master-secret');
      const sessionKey = await hkdfService.deriveSessionKey(
        sharedSecret,
        credentialIdWithSpecialChars
      );
      
      expect(sessionKey.length).toBe(32);
    });

    it('debe manejar credentialId largo', async () => {
      // Algunos authenticators generan credentialIds muy largos
      const longCredentialId = 'YQ=='.repeat(100); // ~400 caracteres
      const sharedSecret = Buffer.from(TEST_VECTOR_1.sharedSecretHex, 'hex');
      
      const hkdfService = new HkdfService('test-master-secret');
      const sessionKey = await hkdfService.deriveSessionKey(
        sharedSecret,
        longCredentialId
      );
      
      expect(sessionKey.length).toBe(32);
    });

    it('debe manejar sharedSecret de exactamente 32 bytes (P-256 ECDH)', async () => {
      // P-256 ECDH produce exactamente 32 bytes de shared secret
      const sharedSecret32 = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        sharedSecret32[i] = i;
      }
      
      const hkdfService = new HkdfService('test-master-secret');
      const sessionKey = await hkdfService.deriveSessionKey(
        sharedSecret32,
        TEST_VECTOR_1.credentialId
      );
      
      expect(sessionKey.length).toBe(32);
    });
  });
});
