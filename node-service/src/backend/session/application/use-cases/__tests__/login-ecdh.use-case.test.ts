import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoginEcdhUseCase } from '../login-ecdh.use-case';
import type { Device } from '../../../../enrollment/domain/models';
import type { SessionKey } from '../../../domain/models';

/**
 * Tests para LoginEcdhUseCase
 * 
 * Verifica que el use case:
 * - Deriva session_key correctamente con HKDF + credentialId binding
 * - Guarda session_key en Valkey con TTL 2 horas (7200 segundos)
 * - Maneja errores apropiadamente (dispositivo no encontrado, no pertenece al usuario, revocado)
 * - Actualiza last_used_at del dispositivo
 */
describe('LoginEcdhUseCase', () => {
  let loginEcdhUseCase: LoginEcdhUseCase;
  let mockDeviceRepository: any;
  let mockSessionKeyRepository: any;
  let mockEcdhService: any;
  let mockHkdfService: any;

  const mockDevice: Device = {
    deviceId: 100,
    userId: 42,
    credentialId: 'Y3JlZGVudGlhbC0xMjM0NQ==',
    publicKey: 'cHVibGljLWtleS1kYXRh',
    handshakeSecret: Buffer.from('handshake-secret-32-bytes-mock').toString('base64'),
    status: 'enrolled',
    createdAt: new Date('2025-01-01'),
    lastUsedAt: new Date('2025-01-10'),
  };

  const mockInput = {
    userId: 42,
    credentialId: 'Y3JlZGVudGlhbC0xMjM0NQ==',
    clientPublicKey: 'Y2xpZW50LXB1YmxpYy1rZXk=',
  };

  beforeEach(() => {
    // Mock DeviceRepository
    mockDeviceRepository = {
      findByCredentialId: vi.fn(),
      updateLastUsed: vi.fn(),
    };

    // Mock SessionKeyRepository
    mockSessionKeyRepository = {
      save: vi.fn(),
    };

    // Mock EcdhService
    mockEcdhService = {
      performKeyExchange: vi.fn().mockReturnValue({
        sharedSecret: Buffer.from('shared-secret-from-ecdh-32bytes'),
        serverPublicKey: 'c2VydmVyLXB1YmxpYy1rZXk=',
      }),
    };

    // Mock HkdfService
    mockHkdfService = {
      deriveSessionKey: vi.fn().mockResolvedValue(Buffer.from('session-key-derived-32-bytes-mock')),
      generateTotp: vi.fn().mockReturnValue('123456'),
    };

    loginEcdhUseCase = new LoginEcdhUseCase(
      mockDeviceRepository,
      mockSessionKeyRepository,
      mockEcdhService,
      mockHkdfService
    );
  });

  describe('Casos de error', () => {
    it('debe lanzar error DEVICE_NOT_FOUND si dispositivo no existe', async () => {
      // Arrange
      mockDeviceRepository.findByCredentialId.mockResolvedValue(null);

      // Act & Assert
      await expect(loginEcdhUseCase.execute(mockInput)).rejects.toThrow('DEVICE_NOT_FOUND');
    });

    it('debe lanzar error DEVICE_NOT_OWNED si dispositivo pertenece a otro usuario', async () => {
      // Arrange
      const deviceOtroUsuario = { ...mockDevice, userId: 999 };
      mockDeviceRepository.findByCredentialId.mockResolvedValue(deviceOtroUsuario);

      // Act & Assert
      await expect(loginEcdhUseCase.execute(mockInput)).rejects.toThrow('DEVICE_NOT_OWNED');
    });

    it('debe lanzar error SESSION_NOT_ALLOWED si dispositivo está revocado', async () => {
      // Arrange
      const deviceRevocado = { ...mockDevice, status: 'revoked' };
      mockDeviceRepository.findByCredentialId.mockResolvedValue(deviceRevocado);

      // Act & Assert
      await expect(loginEcdhUseCase.execute(mockInput)).rejects.toThrow('SESSION_NOT_ALLOWED');
    });

    it('debe lanzar error SESSION_NOT_ALLOWED si dispositivo está pending', async () => {
      // Arrange
      const devicePending = { ...mockDevice, status: 'pending' };
      mockDeviceRepository.findByCredentialId.mockResolvedValue(devicePending);

      // Act & Assert
      await expect(loginEcdhUseCase.execute(mockInput)).rejects.toThrow('SESSION_NOT_ALLOWED');
    });
  });

  describe('Flujo exitoso', () => {
    beforeEach(() => {
      mockDeviceRepository.findByCredentialId.mockResolvedValue(mockDevice);
    });

    it('debe derivar session_key con HKDF incluyendo credentialId', async () => {
      // Act
      await loginEcdhUseCase.execute(mockInput);

      // Assert
      expect(mockHkdfService.deriveSessionKey).toHaveBeenCalledWith(
        expect.any(Buffer), // sharedSecret de ECDH
        mockInput.credentialId
      );
    });

    it('debe guardar session_key en Valkey con TTL de 7200 segundos (2 horas)', async () => {
      // Act
      await loginEcdhUseCase.execute(mockInput);

      // Assert
      expect(mockSessionKeyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockInput.userId,
          deviceId: mockDevice.deviceId,
          sessionKey: expect.any(Buffer),
        }),
        7200 // TTL en segundos
      );
    });

    it('debe generar TOTPu con handshake_secret del dispositivo', async () => {
      // Act
      await loginEcdhUseCase.execute(mockInput);

      // Assert
      expect(mockHkdfService.generateTotp).toHaveBeenCalledWith(
        expect.any(Buffer) // handshakeSecret decodificado de Base64
      );
    });

    it('debe actualizar last_used_at del dispositivo', async () => {
      // Act
      await loginEcdhUseCase.execute(mockInput);

      // Assert
      expect(mockDeviceRepository.updateLastUsed).toHaveBeenCalledWith(mockDevice.deviceId);
    });

    it('debe retornar serverPublicKey, TOTPu y deviceId', async () => {
      // Act
      const result = await loginEcdhUseCase.execute(mockInput);

      // Assert
      expect(result).toEqual({
        serverPublicKey: 'c2VydmVyLXB1YmxpYy1rZXk=',
        totpu: '123456',
        deviceId: mockDevice.deviceId,
      });
    });

    it('debe vincular session_key al dispositivo específico (1:1)', async () => {
      // Act
      await loginEcdhUseCase.execute(mockInput);

      // Assert
      const savedSessionKey = mockSessionKeyRepository.save.mock.calls[0][0] as SessionKey;
      expect(savedSessionKey.deviceId).toBe(mockDevice.deviceId);
      expect(savedSessionKey.userId).toBe(mockInput.userId);
    });
  });

  describe('Integracion ECDH + HKDF', () => {
    beforeEach(() => {
      mockDeviceRepository.findByCredentialId.mockResolvedValue(mockDevice);
    });

    it('debe usar sharedSecret de ECDH como input para HKDF', async () => {
      // Arrange
      const sharedSecretMock = Buffer.from('shared-secret-especifico-test');
      mockEcdhService.performKeyExchange.mockReturnValue({
        sharedSecret: sharedSecretMock,
        serverPublicKey: 'c2VydmVyLXB1YmxpYy1rZXk=',
      });

      // Act
      await loginEcdhUseCase.execute(mockInput);

      // Assert
      expect(mockHkdfService.deriveSessionKey).toHaveBeenCalledWith(
        sharedSecretMock,
        mockInput.credentialId
      );
    });

    it('debe derivar session_keys diferentes para diferentes credentialId (binding)', async () => {
      // Arrange
      const sessionKey1 = Buffer.from('session-key-1');
      const sessionKey2 = Buffer.from('session-key-2');
      
      mockHkdfService.deriveSessionKey
        .mockResolvedValueOnce(sessionKey1)
        .mockResolvedValueOnce(sessionKey2);

      // Act - Primera llamada con credentialId1
      await loginEcdhUseCase.execute(mockInput);

      // Arrange - Segunda llamada con credentialId2
      const mockInput2 = { ...mockInput, credentialId: 'b3Ryby1jcmVkZW50aWFs' };
      const mockDevice2 = { ...mockDevice, credentialId: 'b3Ryby1jcmVkZW50aWFs' };
      mockDeviceRepository.findByCredentialId.mockResolvedValue(mockDevice2);

      // Act
      await loginEcdhUseCase.execute(mockInput2);

      // Assert - Verificar que se llamó con diferentes credentialId
      expect(mockHkdfService.deriveSessionKey).toHaveBeenNthCalledWith(
        1,
        expect.any(Buffer),
        mockInput.credentialId
      );
      expect(mockHkdfService.deriveSessionKey).toHaveBeenNthCalledWith(
        2,
        expect.any(Buffer),
        mockInput2.credentialId
      );
    });
  });

  describe('Validacion de estado del dispositivo', () => {
    it('debe permitir login solo si dispositivo está enrolled', async () => {
      // Arrange
      const deviceEnrolled = { ...mockDevice, status: 'enrolled' };
      mockDeviceRepository.findByCredentialId.mockResolvedValue(deviceEnrolled);

      // Act
      const result = await loginEcdhUseCase.execute(mockInput);

      // Assert
      expect(result).toBeDefined();
      expect(result.totpu).toBe('123456');
    });

    it('debe rechazar login si dispositivo no está en estado válido', async () => {
      // Arrange - Intentar con cada estado no válido
      const estadosInvalidos = ['pending', 'revoked', 'not_enrolled'];

      for (const status of estadosInvalidos) {
        const deviceInvalido = { ...mockDevice, status };
        mockDeviceRepository.findByCredentialId.mockResolvedValue(deviceInvalido);

        // Act & Assert
        await expect(loginEcdhUseCase.execute(mockInput)).rejects.toThrow('SESSION_NOT_ALLOWED');
      }
    });
  });

  describe('Manejo de timestamps', () => {
    beforeEach(() => {
      mockDeviceRepository.findByCredentialId.mockResolvedValue(mockDevice);
    });

    it('debe incluir createdAt en session_key guardada', async () => {
      // Arrange
      const beforeTimestamp = Date.now();

      // Act
      await loginEcdhUseCase.execute(mockInput);

      // Assert
      const savedSessionKey = mockSessionKeyRepository.save.mock.calls[0][0] as SessionKey;
      const afterTimestamp = Date.now();

      expect(savedSessionKey.createdAt).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(savedSessionKey.createdAt).toBeLessThanOrEqual(afterTimestamp);
    });
  });
});
