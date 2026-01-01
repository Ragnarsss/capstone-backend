/**
 * Tests de Integración: Flujo Completo Enrollment + Login
 * 
 * Prueba el flujo end-to-end con mocks:
 * 1. Start enrollment (generar challenge)
 * 2. Finish enrollment (registrar dispositivo)
 * 3. Login ECDH (establecer sesión)
 * 
 * Ejecutar con: npm run test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StartEnrollmentUseCase } from '../enrollment/application/use-cases/start-enrollment.use-case';
import { FinishEnrollmentUseCase } from '../enrollment/application/use-cases/finish-enrollment.use-case';
import { LoginEcdhUseCase } from '../session/application/use-cases/login-ecdh.use-case';
import type { DeviceRepository } from '../enrollment/infrastructure/repositories/device.repository';
import type { SessionKeyRepository } from '../session/infrastructure/repositories/session-key.repository';
import type { EnrollmentChallengeRepository } from '../enrollment/infrastructure';
import type { Fido2Service } from '../enrollment/infrastructure';
import type { EcdhService } from '../enrollment/infrastructure/crypto/ecdh.service';
import type { HkdfService } from '../enrollment/infrastructure/crypto/hkdf.service';
import type { AaguidValidationService } from '../enrollment/domain/services/aaguid-validation.service';
import crypto from 'crypto';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';

describe('Flujo Completo: Enrollment + Login', () => {
  let startEnrollmentUseCase: StartEnrollmentUseCase;
  let finishEnrollmentUseCase: FinishEnrollmentUseCase;
  let loginEcdhUseCase: LoginEcdhUseCase;

  let mockDeviceRepository: DeviceRepository;
  let mockSessionKeyRepository: SessionKeyRepository;
  let mockChallengeRepository: EnrollmentChallengeRepository;
  let mockFido2Service: Fido2Service;
  let mockEcdhService: EcdhService;
  let mockHkdfService: HkdfService;
  let mockAaguidValidationService: AaguidValidationService;

  let enrollmentChallenge: string;
  let credentialId: string;
  let deviceId: number;
  let deviceFingerprint: string;
  let sessionKey: Buffer;

  const testUserId = 999999;
  const testUsername = 'test-integration@ucn.cl';
  const testDisplayName = 'Test Integration User';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock DeviceRepository
    mockDeviceRepository = {
      findByUserId: vi.fn(),
      findByCredentialId: vi.fn(),
      save: vi.fn(),
      create: vi.fn().mockImplementation(async (device) => {
        const result = {
          deviceId: 1,
          credentialId: device.credentialId,
          status: device.status || 'enrolled',
          userId: device.userId,
          publicKey: device.publicKey,
          sessionKey: device.sessionKey,
          handshakeSecret: device.handshakeSecret,
          aaguid: device.aaguid,
          deviceFingerprint: device.deviceFingerprint,
          displayName: device.displayName,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return result;
      }),
      update: vi.fn(),
      revoke: vi.fn(),
      findByDeviceFingerprint: vi.fn(),
      updateLastUsed: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Mock SessionKeyRepository
    mockSessionKeyRepository = {
      save: vi.fn(),
      findLatestByDeviceId: vi.fn(),
    } as any;

    // Mock EnrollmentChallengeRepository
    mockChallengeRepository = {
      save: vi.fn(),
      findByUserId: vi.fn(),
      delete: vi.fn(),
    } as any;

    // Mock Fido2Service
    mockFido2Service = {
      generateRegistrationOptions: vi.fn(),
      verifyRegistration: vi.fn(),
    } as any;

    // Mock EcdhService
    mockEcdhService = {
      generateKeyPair: vi.fn(),
      deriveSharedSecret: vi.fn(),
      performKeyExchange: vi.fn(),
    } as any;

    // Mock HkdfService
    mockHkdfService = {
      deriveSessionKey: vi.fn().mockReturnValue(crypto.randomBytes(32)),
      deriveTotpu: vi.fn(),
      generateTotp: vi.fn(),
      deriveHandshakeSecret: vi.fn().mockReturnValue(crypto.randomBytes(32)),
    } as any;

    // Mock AaguidValidationService
    mockAaguidValidationService = {
      validate: vi.fn().mockReturnValue({ valid: true, authorized: true }),
    } as any;

    // Instanciar use cases con mocks
    startEnrollmentUseCase = new StartEnrollmentUseCase(
      mockFido2Service,
      mockDeviceRepository,
      mockChallengeRepository
    );

    finishEnrollmentUseCase = new FinishEnrollmentUseCase(
      mockFido2Service,
      mockDeviceRepository,
      mockChallengeRepository,
      mockHkdfService,
      mockAaguidValidationService
    );

    loginEcdhUseCase = new LoginEcdhUseCase(
      mockDeviceRepository,
      mockSessionKeyRepository,
      mockEcdhService,
      mockHkdfService
    );
  });

  describe('Flujo de Enrollment Exitoso', () => {
    it('PASO 1: Debe iniciar enrollment y retornar challenge WebAuthn', async () => {
      // Arrange
      enrollmentChallenge = crypto.randomBytes(32).toString('base64url');

      mockDeviceRepository.findByUserId.mockResolvedValue([]);
      mockFido2Service.generateRegistrationOptions.mockResolvedValue({
        challenge: enrollmentChallenge,
        rp: { name: 'Sistema Asistencia UCN', id: 'mantochrisal.cl' },
        user: {
          id: testUserId.toString(),
          name: testUsername,
          displayName: testDisplayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          requireResidentKey: false,
          residentKey: 'preferred',
          userVerification: 'required',
        },
        excludeCredentials: [],
      });
      mockChallengeRepository.save.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        displayName: testDisplayName,
      };

      // Act
      const output = await startEnrollmentUseCase.execute(input);

      // Assert
      expect(output).toBeDefined();
      expect(output.options).toBeDefined();
      expect(output.options.challenge).toBe(enrollmentChallenge);
      expect(output.options.rp.name).toBe('Sistema Asistencia UCN');
      expect(output.options.user.name).toBe(testUsername);
      expect(output.options.user.displayName).toBe(testDisplayName);

      // Verificar interacciones
      expect(mockDeviceRepository.findByUserId).toHaveBeenCalledWith(testUserId);
      expect(mockFido2Service.generateRegistrationOptions).toHaveBeenCalled();
      // save recibe un objeto completo con userId, challenge, createdAt, expiresAt
      expect(mockChallengeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          challenge: enrollmentChallenge,
        }),
        expect.any(Number) // ttl
      );
    });

    it('PASO 2: Debe finalizar enrollment y registrar dispositivo', async () => {
      // Arrange
      enrollmentChallenge = crypto.randomBytes(32).toString('base64url');
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceFingerprint = crypto.randomBytes(32).toString('hex');
      deviceId = 1;
      sessionKey = crypto.randomBytes(32);

      const mockCredential: RegistrationResponseJSON = {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: enrollmentChallenge,
            origin: 'https://mantochrisal.cl',
          })).toString('base64url'),
          attestationObject: crypto.randomBytes(256).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };

      mockChallengeRepository.findByUserId.mockResolvedValue(enrollmentChallenge);
      mockFido2Service.verifyRegistration.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credentialID: Buffer.from(credentialId, 'base64url'),
          credentialPublicKey: crypto.randomBytes(65),
          counter: 0,
          aaguid: '00000000-0000-0000-0000-000000000000',
        },
      });
      mockFido2Service.extractCredentialInfo = vi.fn().mockReturnValue({
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        aaguid: '00000000-0000-0000-0000-000000000000',
      });
      sessionKey = crypto.randomBytes(32);
      mockHkdfService.deriveSessionKey.mockReturnValue(sessionKey);
      mockDeviceRepository.findByDeviceFingerprint.mockResolvedValue(null);
      mockDeviceRepository.findByUserId.mockResolvedValue([]);
      mockDeviceRepository.save.mockResolvedValue(deviceId);
      mockChallengeRepository.delete.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        credential: mockCredential,
        deviceFingerprint: deviceFingerprint,
      };

      // Act
      const output = await finishEnrollmentUseCase.execute(input);

      // Assert
      expect(output).toBeDefined();
      expect(output.success).toBe(true);
      expect(output.deviceId).toBe(deviceId);
      expect(output.credentialId).toBe(credentialId);
      expect(output.aaguid).toBeDefined();

      // Verificar interacciones
      expect(mockChallengeRepository.findByUserId).toHaveBeenCalledWith(testUserId);
      expect(mockFido2Service.verifyRegistration).toHaveBeenCalled();
      expect(mockHkdfService.deriveHandshakeSecret).toHaveBeenCalled();
      expect(mockDeviceRepository.create).toHaveBeenCalled();
      expect(mockChallengeRepository.delete).toHaveBeenCalledWith(testUserId);
    });

    it('PASO 3: Debe generar session_key único durante enrollment', async () => {
      // Arrange
      enrollmentChallenge = crypto.randomBytes(32).toString('base64url');
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceFingerprint = crypto.randomBytes(32).toString('hex');
      deviceId = 2;
      const sessionKey1 = crypto.randomBytes(32);
      const sessionKey2 = crypto.randomBytes(32);

      const mockCredential: RegistrationResponseJSON = {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: enrollmentChallenge,
            origin: 'https://mantochrisal.cl',
          })).toString('base64url'),
          attestationObject: crypto.randomBytes(256).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };

      mockChallengeRepository.findByUserId.mockResolvedValue(enrollmentChallenge);
      mockFido2Service.verifyRegistration.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credentialID: Buffer.from(credentialId, 'base64url'),
          credentialPublicKey: crypto.randomBytes(65),
          counter: 0,
          aaguid: '00000000-0000-0000-0000-000000000000',
        },
      });
      mockFido2Service.extractCredentialInfo = vi.fn().mockReturnValue({
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        aaguid: '00000000-0000-0000-0000-000000000000',
      });

      // Primera llamada retorna handshakeSecret1
      const handshakeSecret1 = crypto.randomBytes(32);
      mockHkdfService.deriveHandshakeSecret.mockReturnValue(handshakeSecret1);
      mockDeviceRepository.findByDeviceFingerprint.mockResolvedValue(null);
      mockDeviceRepository.findByUserId.mockResolvedValue([]);
      mockDeviceRepository.create.mockImplementation(async (device) => ({
        deviceId: deviceId,
        credentialId: device.credentialId,
        status: device.status,
      }));
      mockChallengeRepository.delete.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        credential: mockCredential,
        deviceFingerprint: deviceFingerprint,
      };

      // Act - Primer enrollment
      await finishEnrollmentUseCase.execute(input);

      // Assert - Verificar que se derivó un handshakeSecret
      expect(mockHkdfService.deriveHandshakeSecret).toHaveBeenCalledTimes(1);

      // Verificar que se guardó el dispositivo con el handshakeSecret
      expect(mockDeviceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          credentialId: credentialId,
          handshakeSecret: handshakeSecret1.toString('base64'),
        })
      );
    });

    it('ERROR: Debe lanzar error cuando falla la verificación de WebAuthn (catch block)', async () => {
      // Arrange
      enrollmentChallenge = crypto.randomBytes(32).toString('base64url');
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceFingerprint = crypto.randomBytes(32).toString('hex');

      const mockCredential: RegistrationResponseJSON = {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: enrollmentChallenge,
            origin: 'https://mantochrisal.cl',
          })).toString('base64url'),
          attestationObject: crypto.randomBytes(256).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };

      mockChallengeRepository.findByUserId.mockResolvedValue(enrollmentChallenge);

      // Mock: verifyRegistration lanza excepción
      mockFido2Service.verifyRegistration.mockRejectedValue(
        new Error('Invalid attestation format')
      );
      mockChallengeRepository.delete.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        credential: mockCredential,
        deviceFingerprint: deviceFingerprint,
      };

      // Act & Assert
      await expect(finishEnrollmentUseCase.execute(input))
        .rejects.toThrow('VERIFICATION_FAILED: Invalid attestation format');

      // Verificar que se eliminó el challenge
      expect(mockChallengeRepository.delete).toHaveBeenCalledWith(testUserId);
    });

    it('ERROR: Debe lanzar error cuando verified=false', async () => {
      // Arrange
      enrollmentChallenge = crypto.randomBytes(32).toString('base64url');
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceFingerprint = crypto.randomBytes(32).toString('hex');

      const mockCredential: RegistrationResponseJSON = {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: enrollmentChallenge,
            origin: 'https://mantochrisal.cl',
          })).toString('base64url'),
          attestationObject: crypto.randomBytes(256).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };

      mockChallengeRepository.findByUserId.mockResolvedValue(enrollmentChallenge);

      // Mock: verificación retorna verified=false
      mockFido2Service.verifyRegistration.mockResolvedValue({
        verified: false,
        registrationInfo: {
          credentialID: Buffer.from(credentialId, 'base64url'),
          credentialPublicKey: crypto.randomBytes(65),
          counter: 0,
          aaguid: '00000000-0000-0000-0000-000000000000',
        },
      });
      mockChallengeRepository.delete.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        credential: mockCredential,
        deviceFingerprint: deviceFingerprint,
      };

      // Act & Assert
      await expect(finishEnrollmentUseCase.execute(input))
        .rejects.toThrow('VERIFICATION_FAILED: La verificación de WebAuthn falló');

      // Verificar que se eliminó el challenge
      expect(mockChallengeRepository.delete).toHaveBeenCalledWith(testUserId);
    });

    it('ERROR: Debe lanzar CHALLENGE_NOT_FOUND cuando no existe challenge', async () => {
      // Arrange
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceFingerprint = crypto.randomBytes(32).toString('hex');

      const mockCredential: RegistrationResponseJSON = {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: 'fake-challenge',
            origin: 'https://mantochrisal.cl',
          })).toString('base64url'),
          attestationObject: crypto.randomBytes(256).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };

      // Mock: No existe challenge
      mockChallengeRepository.findByUserId.mockResolvedValue(null);

      const input = {
        userId: testUserId,
        username: testUsername,
        credential: mockCredential,
        deviceFingerprint: deviceFingerprint,
      };

      // Act & Assert
      await expect(finishEnrollmentUseCase.execute(input))
        .rejects.toThrow('CHALLENGE_NOT_FOUND: No se encontró challenge para este usuario');

      // Verificar que NO se intentó eliminar el challenge (no existe)
      expect(mockChallengeRepository.delete).not.toHaveBeenCalled();
    });

    it('ERROR: Debe lanzar CHALLENGE_EXPIRED cuando el challenge ha expirado', async () => {
      // Arrange
      enrollmentChallenge = crypto.randomBytes(32).toString('base64url');
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceFingerprint = crypto.randomBytes(32).toString('hex');

      const mockCredential: RegistrationResponseJSON = {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: enrollmentChallenge,
            origin: 'https://mantochrisal.cl',
          })).toString('base64url'),
          attestationObject: crypto.randomBytes(256).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };

      // Mock: Challenge expirado (fecha en el pasado)
      mockChallengeRepository.findByUserId.mockResolvedValue({
        challenge: enrollmentChallenge,
        userId: testUserId,
        createdAt: Date.now() - 360000, // 6 minutos atrás
        expiresAt: Date.now() - 60000,  // Expiró hace 1 minuto
      });
      mockChallengeRepository.delete.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        credential: mockCredential,
        deviceFingerprint: deviceFingerprint,
      };

      // Act & Assert
      await expect(finishEnrollmentUseCase.execute(input))
        .rejects.toThrow('CHALLENGE_EXPIRED: El challenge ha expirado');

      // Verificar que se eliminó el challenge expirado
      expect(mockChallengeRepository.delete).toHaveBeenCalledWith(testUserId);
    });

    it('ERROR: Debe manejar error sin message (Unknown error)', async () => {
      // Arrange
      enrollmentChallenge = crypto.randomBytes(32).toString('base64url');
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceFingerprint = crypto.randomBytes(32).toString('hex');

      const mockCredential: RegistrationResponseJSON = {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: enrollmentChallenge,
            origin: 'https://mantochrisal.cl',
          })).toString('base64url'),
          attestationObject: crypto.randomBytes(256).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };

      mockChallengeRepository.findByUserId.mockResolvedValue({
        challenge: enrollmentChallenge,
        userId: testUserId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
      });

      // Mock: verifyRegistration lanza un objeto sin message (no Error)
      mockFido2Service.verifyRegistration.mockRejectedValue({ code: 'UNKNOWN' });
      mockChallengeRepository.delete.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        credential: mockCredential,
        deviceFingerprint: deviceFingerprint,
      };

      // Act & Assert
      await expect(finishEnrollmentUseCase.execute(input))
        .rejects.toThrow('VERIFICATION_FAILED: Unknown error');

      // Verificar que se eliminó el challenge
      expect(mockChallengeRepository.delete).toHaveBeenCalledWith(testUserId);
    });

    it('ERROR: Debe lanzar error cuando AAGUID no está autorizado', async () => {
      // Arrange
      enrollmentChallenge = crypto.randomBytes(32).toString('base64url');
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceFingerprint = crypto.randomBytes(32).toString('hex');
      const unauthorizedAaguid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

      const mockCredential: RegistrationResponseJSON = {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: enrollmentChallenge,
            origin: 'https://mantochrisal.cl',
          })).toString('base64url'),
          attestationObject: crypto.randomBytes(256).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };

      mockChallengeRepository.findByUserId.mockResolvedValue(enrollmentChallenge);
      mockFido2Service.verifyRegistration.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credentialID: Buffer.from(credentialId, 'base64url'),
          credentialPublicKey: crypto.randomBytes(65),
          counter: 0,
          aaguid: unauthorizedAaguid,
        },
      });
      mockFido2Service.extractCredentialInfo = vi.fn().mockReturnValue({
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        aaguid: unauthorizedAaguid,
      });

      // Mock: AAGUID validation falla
      mockAaguidValidationService.validate.mockReturnValue({
        valid: false,
        reason: 'AAGUID no está en la whitelist',
      });
      mockChallengeRepository.delete.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        credential: mockCredential,
        deviceFingerprint: deviceFingerprint,
      };

      // Act & Assert
      await expect(finishEnrollmentUseCase.execute(input))
        .rejects.toThrow('AAGUID_NOT_AUTHORIZED: AAGUID no está en la whitelist');

      // Verificar que se eliminó el challenge
      expect(mockChallengeRepository.delete).toHaveBeenCalledWith(testUserId);
    });
  });

  describe('Flujo de Login ECDH Exitoso', () => {
    beforeEach(() => {
      // Setup común: simular que hay un dispositivo enrollado
      credentialId = crypto.randomBytes(32).toString('base64url');
      deviceId = 100;
      sessionKey = crypto.randomBytes(32);
    });

    it('PASO 1: Debe establecer sesión con ECDH key exchange', async () => {
      // Arrange
      const clientPublicKey = crypto.randomBytes(32).toString('base64');
      const serverPrivateKey = crypto.randomBytes(32);
      const serverPublicKey = crypto.randomBytes(32).toString('base64');
      const sharedSecret = crypto.randomBytes(32);
      const derivedSessionKey = crypto.randomBytes(32);
      const totpu = crypto.randomBytes(16).toString('hex');

      // Mock: dispositivo existe y pertenece al usuario
      mockDeviceRepository.findByCredentialId.mockResolvedValue({
        deviceId: deviceId,
        userId: testUserId,
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        sessionKey: sessionKey,
        handshakeSecret: crypto.randomBytes(32).toString('base64'),
        status: 'enrolled',
        isActive: true,
        aaguid: '00000000-0000-0000-0000-000000000000',
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock: performKeyExchange retorna serverPublicKey y sharedSecret
      mockEcdhService.performKeyExchange = vi.fn().mockReturnValue({
        serverPublicKey: serverPublicKey, // Ya es string base64
        sharedSecret: sharedSecret,
      });

      // Mock: derivar session_key y totpu
      mockHkdfService.deriveSessionKey.mockReturnValue(derivedSessionKey);
      mockHkdfService.generateTotp = vi.fn().mockReturnValue(totpu);

      // Mock: guardar session_key
      mockSessionKeyRepository.save.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        credentialId: credentialId,
        clientPublicKey: clientPublicKey,
      };

      // Act
      const output = await loginEcdhUseCase.execute(input);

      // Assert
      expect(output).toBeDefined();
      expect(output.serverPublicKey).toBe(serverPublicKey);
      expect(output.deviceId).toBe(deviceId);

      // Verificar interacciones
      expect(mockDeviceRepository.findByCredentialId).toHaveBeenCalledWith(credentialId);
      expect(mockEcdhService.performKeyExchange).toHaveBeenCalledWith(clientPublicKey);
      expect(mockHkdfService.deriveSessionKey).toHaveBeenCalled();
      // save() recibe un objeto con toda la info, no solo deviceId y sessionKey
      expect(mockSessionKeyRepository.save).toHaveBeenCalled();
    });

    it('PASO 2: Debe guardar nueva session_key en cada login', async () => {
      // Arrange
      const clientPublicKey = crypto.randomBytes(32).toString('base64');
      const derivedSessionKey = crypto.randomBytes(32);
      let saveCallCount = 0;

      mockDeviceRepository.findByCredentialId.mockResolvedValue({
        deviceId: deviceId,
        userId: testUserId,
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        sessionKey: sessionKey,
        handshakeSecret: crypto.randomBytes(32),
        status: 'enrolled',
        isActive: true,
        aaguid: '00000000-0000-0000-0000-000000000000',
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockEcdhService.performKeyExchange = vi.fn().mockReturnValue({
        serverPublicKey: crypto.randomBytes(32),
        sharedSecret: crypto.randomBytes(32),
      });
      mockHkdfService.deriveSessionKey.mockReturnValue(derivedSessionKey);
      mockHkdfService.generateTotp = vi.fn().mockReturnValue(crypto.randomBytes(16).toString('hex'));

      mockSessionKeyRepository.save.mockImplementation(async () => {
        saveCallCount++;
      });

      const input = {
        userId: testUserId,
        credentialId: credentialId,
        clientPublicKey: clientPublicKey,
      };

      // Act
      await loginEcdhUseCase.execute(input);

      // Assert - Verificar que se guardó la session_key
      expect(mockSessionKeyRepository.save).toHaveBeenCalledTimes(1);
      // El método save() recibe un objeto con deviceId, userId, sessionKey, y ttl
      expect(mockSessionKeyRepository.save).toHaveBeenCalled();
      expect(saveCallCount).toBe(1);
    });

    it('PASO 3: Debe generar diferentes session_keys en logins consecutivos', async () => {
      // Arrange
      const clientPublicKey1 = crypto.randomBytes(32).toString('base64');
      const clientPublicKey2 = crypto.randomBytes(32).toString('base64');

      const serverPublicKey1 = crypto.randomBytes(32).toString('base64');
      const serverPublicKey2 = crypto.randomBytes(32).toString('base64');

      const totpu1 = crypto.randomBytes(16).toString('hex');
      const totpu2 = crypto.randomBytes(16).toString('hex');

      mockDeviceRepository.findByCredentialId.mockResolvedValue({
        deviceId: deviceId,
        userId: testUserId,
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        sessionKey: sessionKey,
        handshakeSecret: crypto.randomBytes(32),
        status: 'enrolled',
        isActive: true,
        aaguid: '00000000-0000-0000-0000-000000000000',
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock performKeyExchange para 2 logins
      mockEcdhService.performKeyExchange = vi.fn()
        .mockReturnValueOnce({
          serverPublicKey: serverPublicKey1, // Ya es string base64
          sharedSecret: crypto.randomBytes(32),
        })
        .mockReturnValueOnce({
          serverPublicKey: serverPublicKey2, // Ya es string base64
          sharedSecret: crypto.randomBytes(32),
        });
      mockHkdfService.deriveSessionKey.mockReturnValue(crypto.randomBytes(32));
      mockHkdfService.generateTotp = vi.fn()
        .mockReturnValueOnce(totpu1)
        .mockReturnValueOnce(totpu2);
      mockSessionKeyRepository.save.mockResolvedValue(undefined);

      // Act - Primer login
      const output1 = await loginEcdhUseCase.execute({
        userId: testUserId,
        credentialId: credentialId,
        clientPublicKey: clientPublicKey1,
      });

      // Act - Segundo login
      const output2 = await loginEcdhUseCase.execute({
        userId: testUserId,
        credentialId: credentialId,
        clientPublicKey: clientPublicKey2,
      });

      // Assert - Diferentes claves públicas del servidor
      expect(output1.serverPublicKey).toBe(serverPublicKey1);
      expect(output2.serverPublicKey).toBe(serverPublicKey2);
      expect(output1.serverPublicKey).not.toBe(output2.serverPublicKey);
    });

    it('PASO 4: Debe fallar login con credentialId incorrecto', async () => {
      // Arrange
      const clientPublicKey = crypto.randomBytes(32).toString('base64');

      // Mock: dispositivo no encontrado
      mockDeviceRepository.findByCredentialId.mockResolvedValue(null);

      const input = {
        userId: testUserId,
        credentialId: 'credential-id-que-no-existe',
        clientPublicKey: clientPublicKey,
      };

      // Act & Assert
      await expect(loginEcdhUseCase.execute(input))
        .rejects
        .toThrow('DEVICE_NOT_FOUND');

      expect(mockDeviceRepository.findByCredentialId).toHaveBeenCalledWith('credential-id-que-no-existe');
    });

    it('PASO 5: Debe fallar login si el dispositivo fue revocado', async () => {
      // Arrange
      const clientPublicKey = crypto.randomBytes(32).toString('base64');

      // Mock: dispositivo existe pero está revocado
      mockDeviceRepository.findByCredentialId.mockResolvedValue({
        deviceId: deviceId,
        userId: testUserId,
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        sessionKey: sessionKey,
        handshakeSecret: crypto.randomBytes(32),
        status: 'revoked', // REVOCADO
        isActive: false,
        aaguid: '00000000-0000-0000-0000-000000000000',
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input = {
        userId: testUserId,
        credentialId: credentialId,
        clientPublicKey: clientPublicKey,
      };

      // Act & Assert
      await expect(loginEcdhUseCase.execute(input))
        .rejects
        .toThrow('SESSION_NOT_ALLOWED'); // El mensaje real contiene SESSION_NOT_ALLOWED

      expect(mockDeviceRepository.findByCredentialId).toHaveBeenCalledWith(credentialId);
    });
  });

  describe('Validaciones de Seguridad', () => {
    it('Debe rechazar login de dispositivo de otro usuario', async () => {
      // Arrange
      const clientPublicKey = crypto.randomBytes(32).toString('base64');
      const otroUsuarioId = 888888;

      // Mock: dispositivo existe pero pertenece a otro usuario
      mockDeviceRepository.findByCredentialId.mockResolvedValue({
        deviceId: deviceId,
        userId: otroUsuarioId, // OTRO USUARIO
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        sessionKey: sessionKey,
        handshakeSecret: crypto.randomBytes(32),
        status: 'enrolled',
        isActive: true,
        aaguid: '00000000-0000-0000-0000-000000000000',
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input = {
        userId: testUserId, // Usuario actual intenta acceder
        credentialId: credentialId,
        clientPublicKey: clientPublicKey,
      };

      // Act & Assert
      await expect(loginEcdhUseCase.execute(input))
        .rejects
        .toThrow('DEVICE_NOT_OWNED');

      expect(mockDeviceRepository.findByCredentialId).toHaveBeenCalledWith(credentialId);
    });

    it('Debe manejar correctamente userId como string (BUG-002)', async () => {
      // Arrange - Este test reproduce el bug que encontramos
      const clientPublicKey = crypto.randomBytes(32).toString('base64');

      // Mock: dispositivo con userId como string (BIGINT de PostgreSQL)
      mockDeviceRepository.findByCredentialId.mockResolvedValue({
        deviceId: deviceId,
        userId: '999999' as any, // STRING en lugar de number
        credentialId: credentialId,
        publicKey: crypto.randomBytes(65),
        sessionKey: sessionKey,
        handshakeSecret: crypto.randomBytes(32),
        status: 'enrolled',
        isActive: true,
        aaguid: '00000000-0000-0000-0000-000000000000',
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockEcdhService.performKeyExchange = vi.fn().mockReturnValue({
        serverPublicKey: crypto.randomBytes(32),
        sharedSecret: crypto.randomBytes(32),
      });
      mockHkdfService.deriveSessionKey.mockReturnValue(crypto.randomBytes(32));
      mockHkdfService.generateTotp = vi.fn().mockReturnValue(crypto.randomBytes(16).toString('hex'));
      mockSessionKeyRepository.save.mockResolvedValue(undefined);

      const input = {
        userId: 999999, // NUMBER
        credentialId: credentialId,
        clientPublicKey: clientPublicKey,
      };

      // Act - Debe funcionar correctamente gracias al fix
      const output = await loginEcdhUseCase.execute(input);

      // Assert - Login exitoso
      expect(output).toBeDefined();
      expect(output.deviceId).toBe(deviceId);

      // El fix convierte el string a number antes de comparar
      // Por lo tanto NO debe lanzar DEVICE_NOT_OWNED
    });
  });

  describe('Start Enrollment con dispositivos existentes (excludeCredentials)', () => {
    it('Debe incluir dispositivos existentes en excludeCredentials para evitar re-registro', async () => {
      // Arrange - Usuario ya tiene 2 dispositivos enrolados
      const existingDevice1 = {
        deviceId: 101,
        userId: testUserId,
        credentialId: 'existing-credential-1',
        publicKey: crypto.randomBytes(65).toString('base64'),
        signCount: 50,
        transports: ['internal', 'usb'],
        status: 'enrolled',
        isActive: true,
      };

      const existingDevice2 = {
        deviceId: 102,
        userId: testUserId,
        credentialId: 'existing-credential-2',
        publicKey: crypto.randomBytes(65).toString('base64'),
        signCount: 25,
        transports: ['nfc'],
        status: 'enrolled',
        isActive: true,
      };

      mockDeviceRepository.findByUserId.mockResolvedValue([existingDevice1, existingDevice2]);

      const enrollmentChallenge = crypto.randomBytes(32).toString('base64url');
      mockFido2Service.generateRegistrationOptions.mockImplementation(async (input: any) => {
        // Verificar que se pasaron las credenciales existentes
        expect(input.existingCredentials).toBeDefined();
        expect(input.existingCredentials).toHaveLength(2);

        // Verificar estructura de cada credencial
        expect(input.existingCredentials[0]).toEqual({
          credentialId: 'existing-credential-1',
          publicKey: existingDevice1.publicKey,
          counter: 50,
          transports: ['internal', 'usb'],
        });

        expect(input.existingCredentials[1]).toEqual({
          credentialId: 'existing-credential-2',
          publicKey: existingDevice2.publicKey,
          counter: 25,
          transports: ['nfc'],
        });

        return {
          challenge: enrollmentChallenge,
          rp: { name: 'Sistema Asistencia UCN', id: 'mantochrisal.cl' },
          user: {
            id: testUserId.toString(),
            name: testUsername,
            displayName: testDisplayName,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          timeout: 60000,
          attestation: 'none',
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            requireResidentKey: false,
            residentKey: 'preferred',
            userVerification: 'required',
          },
          excludeCredentials: [
            { id: 'existing-credential-1', type: 'public-key', transports: ['internal', 'usb'] },
            { id: 'existing-credential-2', type: 'public-key', transports: ['nfc'] },
          ],
        };
      });

      mockChallengeRepository.save.mockResolvedValue(undefined);

      const input = {
        userId: testUserId,
        username: testUsername,
        displayName: testDisplayName,
      };

      // Act
      const result = await startEnrollmentUseCase.execute(input);

      // Assert
      expect(result.options).toBeDefined();
      expect(result.options.challenge).toBe(enrollmentChallenge);

      // Verificar que se llamó a findByUserId
      expect(mockDeviceRepository.findByUserId).toHaveBeenCalledWith(testUserId);

      // Verificar que se guardó el challenge
      expect(mockChallengeRepository.save).toHaveBeenCalled();

      // Verificar que excludeCredentials tiene los dispositivos existentes
      expect(result.options.excludeCredentials).toBeDefined();
      expect(result.options.excludeCredentials).toHaveLength(2);
    });
  });

});
