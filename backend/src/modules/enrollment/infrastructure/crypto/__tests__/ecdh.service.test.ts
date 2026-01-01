import { describe, it, expect, beforeEach } from 'vitest';
import { EcdhService } from '../ecdh.service';
import { createECDH } from 'node:crypto';

describe('EcdhService - Tests de Key Exchange', () => {
    let ecdhService: EcdhService;

    beforeEach(() => {
        ecdhService = new EcdhService();
    });

    describe('generateKeyPair() - Generar par de claves efímeras', () => {
        it('Debe generar par de claves con publicKey en base64 y privateKey como Buffer', () => {
            // Act
            const keyPair = ecdhService.generateKeyPair();

            // Assert
            expect(keyPair).toBeDefined();
            expect(keyPair.publicKey).toBeDefined();
            expect(keyPair.privateKey).toBeDefined();

            // Verificar tipos
            expect(typeof keyPair.publicKey).toBe('string');
            expect(Buffer.isBuffer(keyPair.privateKey)).toBe(true);

            // Verificar longitud de clave pública P-256 en base64
            // P-256 uncompressed: 65 bytes (04 + 32 + 32) → base64 ~88 caracteres
            const publicKeyBuffer = Buffer.from(keyPair.publicKey, 'base64');
            expect(publicKeyBuffer.length).toBe(65);

            // Verificar primer byte es 04 (uncompressed point)
            expect(publicKeyBuffer[0]).toBe(0x04);
        });

        it('Debe generar pares de claves diferentes en cada llamada', () => {
            // Act
            const keyPair1 = ecdhService.generateKeyPair();
            const keyPair2 = ecdhService.generateKeyPair();

            // Assert - Perfect Forward Secrecy
            expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
            expect(keyPair1.privateKey.equals(keyPair2.privateKey)).toBe(false);
        });

        it('Debe generar claves privadas de longitud correcta para P-256', () => {
            // Act
            const keyPair = ecdhService.generateKeyPair();

            // Assert - P-256 private key es 32 bytes
            expect(keyPair.privateKey.length).toBe(32);
        });

        it('Debe generar clave pública válida decodificable en base64', () => {
            // Act
            const keyPair = ecdhService.generateKeyPair();

            // Assert - No debe lanzar error al decodificar
            expect(() => {
                Buffer.from(keyPair.publicKey, 'base64');
            }).not.toThrow();
        });
    });

    describe('performKeyExchange() - Key exchange completo', () => {
        it('Debe realizar key exchange y retornar sharedSecret y serverPublicKey', () => {
            // Arrange - Generar par del cliente
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');

            // Act
            const result = ecdhService.performKeyExchange(clientPublicKey);

            // Assert
            expect(result).toBeDefined();
            expect(result.sharedSecret).toBeDefined();
            expect(result.serverPublicKey).toBeDefined();

            // Verificar tipos
            expect(Buffer.isBuffer(result.sharedSecret)).toBe(true);
            expect(typeof result.serverPublicKey).toBe('string');

            // Verificar longitud de shared secret P-256 (32 bytes)
            expect(result.sharedSecret.length).toBe(32);
        });

        it('Debe generar serverPublicKey diferente en cada key exchange (Perfect Forward Secrecy)', () => {
            // Arrange - Generar par del cliente
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');

            // Act
            const result1 = ecdhService.performKeyExchange(clientPublicKey);
            const result2 = ecdhService.performKeyExchange(clientPublicKey);

            // Assert - Cada exchange usa pares efímeros diferentes
            expect(result1.serverPublicKey).not.toBe(result2.serverPublicKey);
            expect(result1.sharedSecret.equals(result2.sharedSecret)).toBe(false);
        });

        it('Debe producir mismo sharedSecret en cliente y servidor', () => {
            // Arrange - Generar par del cliente
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');
            const clientPrivateKey = clientEcdh.getPrivateKey();

            // Act - Server realiza key exchange
            const serverResult = ecdhService.performKeyExchange(clientPublicKey);

            // Cliente computa shared secret con su clave privada y la pública del servidor
            const clientEcdh2 = createECDH('prime256v1');
            clientEcdh2.setPrivateKey(clientPrivateKey);
            const serverPublicKeyBuffer = Buffer.from(serverResult.serverPublicKey, 'base64');
            const clientSharedSecret = clientEcdh2.computeSecret(serverPublicKeyBuffer);

            // Assert - Ambos shared secrets deben ser idénticos
            expect(serverResult.sharedSecret.equals(clientSharedSecret)).toBe(true);
        });

        it('Debe manejar clave pública del cliente en formato base64 válido', () => {
            // Arrange - Generar clave pública válida
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');

            // Act & Assert - No debe lanzar error
            expect(() => {
                ecdhService.performKeyExchange(clientPublicKey);
            }).not.toThrow();
        });

        it('Debe lanzar error con clave pública inválida', () => {
            // Arrange
            const invalidPublicKey = 'invalid-base64-key';

            // Act & Assert
            expect(() => {
                ecdhService.performKeyExchange(invalidPublicKey);
            }).toThrow();
        });

        it('Debe lanzar error con clave pública de longitud incorrecta', () => {
            // Arrange - Base64 válido pero no es clave ECDH P-256
            const invalidPublicKey = Buffer.from('too-short').toString('base64');

            // Act & Assert
            expect(() => {
                ecdhService.performKeyExchange(invalidPublicKey);
            }).toThrow();
        });
    });

    describe('Vectores de prueba con valores determinísticos', () => {
        it('Debe producir sharedSecret que cliente puede verificar independientemente', () => {
            // Arrange - Generar par del cliente
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');
            const clientPrivateKey = clientEcdh.getPrivateKey();

            // Act - Server realiza key exchange (genera par efímero diferente cada vez)
            const serverResult = ecdhService.performKeyExchange(clientPublicKey);

            // Cliente computa su lado del shared secret con el mismo par de claves
            const clientEcdh2 = createECDH('prime256v1');
            clientEcdh2.setPrivateKey(clientPrivateKey);
            const serverPublicKeyBuffer = Buffer.from(serverResult.serverPublicKey, 'base64');
            const clientSharedSecret = clientEcdh2.computeSecret(serverPublicKeyBuffer);

            // Assert - Ambos shared secrets deben ser idénticos (esto valida ECDH)
            expect(serverResult.sharedSecret.equals(clientSharedSecret)).toBe(true);

            // Verificar propiedades del shared secret
            expect(serverResult.sharedSecret.length).toBe(32);
            expect(clientSharedSecret.length).toBe(32);
        });
    });

    describe('Seguridad y validaciones', () => {
        it('Debe usar curva P-256 (prime256v1)', () => {
            // Arrange
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');

            // Act
            const result = ecdhService.performKeyExchange(clientPublicKey);

            // Assert - Verificar que la clave pública del servidor es P-256 (65 bytes uncompressed)
            const serverPublicKeyBuffer = Buffer.from(result.serverPublicKey, 'base64');
            expect(serverPublicKeyBuffer.length).toBe(65);
            expect(serverPublicKeyBuffer[0]).toBe(0x04); // Uncompressed point
        });

        it('Debe generar sharedSecret de 32 bytes (256 bits)', () => {
            // Arrange
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');

            // Act
            const result = ecdhService.performKeyExchange(clientPublicKey);

            // Assert - P-256 produce shared secrets de 32 bytes
            expect(result.sharedSecret.length).toBe(32);
        });

        it('Debe generar sharedSecret con alta entropía (no todos ceros)', () => {
            // Arrange
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');

            // Act
            const result = ecdhService.performKeyExchange(clientPublicKey);

            // Assert - Verificar que no es todo ceros
            const allZeros = Buffer.alloc(32, 0);
            expect(result.sharedSecret.equals(allZeros)).toBe(false);

            // Verificar que tiene al menos algunos bits diferentes
            const nonZeroBytes = result.sharedSecret.filter(byte => byte !== 0);
            expect(nonZeroBytes.length).toBeGreaterThan(20); // Al menos 20 bytes no-cero
        });
    });

    describe('Interoperabilidad con cliente frontend', () => {
        it('Debe producir resultado compatible con Web Crypto API del frontend', () => {
            // Este test documenta que el servicio es compatible con:
            // - Frontend: crypto.subtle.deriveKey() con ECDH
            // - Backend: createECDH('prime256v1')

            // Arrange - Simular clave pública desde frontend
            const clientEcdh = createECDH('prime256v1');
            clientEcdh.generateKeys();
            const clientPublicKey = clientEcdh.getPublicKey('base64');

            // Act - Backend procesa key exchange
            const result = ecdhService.performKeyExchange(clientPublicKey);

            // Assert - Formato esperado por frontend
            expect(typeof result.serverPublicKey).toBe('string'); // Base64 string
            expect(Buffer.isBuffer(result.sharedSecret)).toBe(true);

            // El frontend puede decodificar la clave pública del servidor
            expect(() => {
                Buffer.from(result.serverPublicKey, 'base64');
            }).not.toThrow();
        });
    });
});
