import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Fido2Service } from '../fido2.service';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import crypto from 'crypto';

// Mock de @simplewebauthn/server
vi.mock('@simplewebauthn/server', () => ({
    generateRegistrationOptions: vi.fn(),
    verifyRegistrationResponse: vi.fn(),
    generateAuthenticationOptions: vi.fn(),
    verifyAuthenticationResponse: vi.fn(),
}));

// Mock de config
vi.mock('../../../../../shared/config', () => ({
    config: {
        crypto: {
            rpName: 'Sistema Asistencia UCN',
            rpId: 'mantochrisal.cl',
            origin: 'https://mantochrisal.cl',
        },
    },
}));

describe('Fido2Service - Tests de WebAuthn', () => {
    let fido2Service: Fido2Service;
    let mockGenerateRegistrationOptions: any;
    let mockVerifyRegistrationResponse: any;
    let mockGenerateAuthenticationOptions: any;
    let mockVerifyAuthenticationResponse: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        const simpleWebAuthn = await import('@simplewebauthn/server');
        mockGenerateRegistrationOptions = simpleWebAuthn.generateRegistrationOptions as any;
        mockVerifyRegistrationResponse = simpleWebAuthn.verifyRegistrationResponse as any;
        mockGenerateAuthenticationOptions = simpleWebAuthn.generateAuthenticationOptions as any;
        mockVerifyAuthenticationResponse = simpleWebAuthn.verifyAuthenticationResponse as any;

        fido2Service = new Fido2Service();
    });

    describe('generateRegistrationOptions() - Generar challenge de registro', () => {
        it('Debe generar opciones de registro con datos del usuario', async () => {
            // Arrange
            const input = {
                userId: 123,
                username: 'jperez',
                displayName: 'Juan Pérez',
            };

            const mockOptions = {
                challenge: 'test-challenge',
                rp: { name: 'Sistema Asistencia UCN', id: 'mantochrisal.cl' },
                user: {
                    id: '123',
                    name: 'jperez',
                    displayName: 'Juan Pérez',
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },
                    { alg: -257, type: 'public-key' },
                ],
                timeout: 300000,
                attestation: 'direct',
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    requireResidentKey: false,
                    residentKey: 'discouraged',
                    userVerification: 'required',
                },
                excludeCredentials: [],
            };

            mockGenerateRegistrationOptions.mockResolvedValue(mockOptions);

            // Act
            const result = await fido2Service.generateRegistrationOptions(input);

            // Assert
            expect(result).toBeDefined();
            expect(result.challenge).toBe('test-challenge');
            expect(result.rp.name).toBe('Sistema Asistencia UCN');
            expect(result.user.name).toBe('jperez');
            expect(result.user.displayName).toBe('Juan Pérez');

            // Verificar que se llamó con los parámetros correctos
            expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    rpName: 'Sistema Asistencia UCN',
                    rpID: 'mantochrisal.cl',
                    userName: 'jperez',
                    userDisplayName: 'Juan Pérez',
                    attestationType: 'direct',
                })
            );
        });

        it('Debe configurar authenticatorSelection para platform authenticator', async () => {
            // Arrange
            const input = {
                userId: 123,
                username: 'jperez',
                displayName: 'Juan Pérez',
            };

            mockGenerateRegistrationOptions.mockResolvedValue({
                challenge: 'test',
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'discouraged',
                    requireResidentKey: false,
                },
            });

            // Act
            await fido2Service.generateRegistrationOptions(input);

            // Assert - Verificar configuración de autenticador de plataforma
            expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                        residentKey: 'discouraged',
                        requireResidentKey: false,
                    },
                })
            );
        });

        it('Debe excluir credenciales existentes para evitar duplicados', async () => {
            // Arrange
            const existingCredentials = [
                {
                    credentialId: 'cred-1',
                    publicKey: 'pubkey-1',
                    counter: 5,
                    transports: ['internal' as const],
                },
                {
                    credentialId: 'cred-2',
                    publicKey: 'pubkey-2',
                    counter: 10,
                    transports: ['usb' as const, 'nfc' as const],
                },
            ];

            const input = {
                userId: 123,
                username: 'jperez',
                displayName: 'Juan Pérez',
                existingCredentials,
            };

            mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'test' });

            // Act
            await fido2Service.generateRegistrationOptions(input);

            // Assert
            expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    excludeCredentials: [
                        {
                            id: 'cred-1',
                            type: 'public-key',
                            transports: ['internal'],
                        },
                        {
                            id: 'cred-2',
                            type: 'public-key',
                            transports: ['usb', 'nfc'],
                        },
                    ],
                })
            );
        });

        it('Debe soportar algoritmos ES256 (-7) y RS256 (-257)', async () => {
            // Arrange
            const input = {
                userId: 123,
                username: 'jperez',
                displayName: 'Juan Pérez',
            };

            mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'test' });

            // Act
            await fido2Service.generateRegistrationOptions(input);

            // Assert
            expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    supportedAlgorithmIDs: [-7, -257],
                })
            );
        });

        it('Debe configurar timeout de 5 minutos (300000ms)', async () => {
            // Arrange
            const input = {
                userId: 123,
                username: 'jperez',
                displayName: 'Juan Pérez',
            };

            mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'test' });

            // Act
            await fido2Service.generateRegistrationOptions(input);

            // Assert
            expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    timeout: 300000,
                })
            );
        });
    });

    describe('verifyRegistration() - Verificar respuesta de registro', () => {
        it('Debe verificar registro exitosamente', async () => {
            // Arrange
            const mockResponse: RegistrationResponseJSON = {
                id: 'test-credential-id',
                rawId: 'test-credential-id',
                type: 'public-key',
                response: {
                    clientDataJSON: 'mock-client-data',
                    attestationObject: 'mock-attestation',
                },
                clientExtensionResults: {},
            };

            const expectedChallenge = 'test-challenge';

            const mockVerified = {
                verified: true,
                registrationInfo: {
                    credentialID: Buffer.from('test-credential-id'),
                    credentialPublicKey: Buffer.from('mock-public-key'),
                    counter: 0,
                    aaguid: '00000000-0000-0000-0000-000000000000',
                    credential: {
                        id: 'test-credential-id',
                        publicKey: Buffer.from('mock-public-key'),
                        counter: 0,
                    },
                },
            };

            mockVerifyRegistrationResponse.mockResolvedValue(mockVerified);

            // Act
            const result = await fido2Service.verifyRegistration(mockResponse, expectedChallenge);

            // Assert
            expect(result).toBeDefined();
            expect(result.verified).toBe(true);
            expect(result.registrationInfo).toBeDefined();

            // Verificar que se llamó con los parámetros correctos
            expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith({
                response: mockResponse,
                expectedChallenge,
                expectedOrigin: 'https://mantochrisal.cl',
                expectedRPID: 'mantochrisal.cl',
                requireUserVerification: true,
            });
        });

        it('Debe rechazar registro con challenge incorrecto', async () => {
            // Arrange
            const mockResponse: RegistrationResponseJSON = {
                id: 'test-credential-id',
                rawId: 'test-credential-id',
                type: 'public-key',
                response: {
                    clientDataJSON: 'mock-client-data',
                    attestationObject: 'mock-attestation',
                },
                clientExtensionResults: {},
            };

            mockVerifyRegistrationResponse.mockRejectedValue(
                new Error('Challenge mismatch')
            );

            // Act & Assert
            await expect(
                fido2Service.verifyRegistration(mockResponse, 'wrong-challenge')
            ).rejects.toThrow('Challenge mismatch');
        });

        it('Debe requerir user verification', async () => {
            // Arrange
            const mockResponse: RegistrationResponseJSON = {
                id: 'test-credential-id',
                rawId: 'test-credential-id',
                type: 'public-key',

                response: {
                    clientDataJSON: 'mock-client-data',
                    attestationObject: 'mock-attestation',
                },
                clientExtensionResults: {},
            };

            mockVerifyRegistrationResponse.mockResolvedValue({ verified: true });

            // Act
            await fido2Service.verifyRegistration(mockResponse, 'challenge');

            // Assert
            expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    requireUserVerification: true,
                })
            );
        });
    });

    describe('extractCredentialInfo() - Extraer información de credencial', () => {
        it('Debe extraer credentialId, publicKey, counter y aaguid', () => {
            // Arrange
            const mockVerified = {
                verified: true,
                registrationInfo: {
                    credentialID: Buffer.from('test-cred-id', 'utf-8'),
                    credentialPublicKey: Buffer.from('test-public-key', 'utf-8'),
                    counter: 0,
                    aaguid: '08987058-cadc-4b81-b6e1-30de50dcbe96',
                    credential: {
                        id: 'test-credential-id',
                        publicKey: new Uint8Array([1, 2, 3, 4, 5]),
                        counter: 0,
                        transports: ['internal' as const],
                    },
                },
            };

            // Act
            const result = fido2Service.extractCredentialInfo(mockVerified as any);

            // Assert
            expect(result).toBeDefined();
            expect(result.credentialId).toBe('test-credential-id');
            expect(result.counter).toBe(0);
            expect(result.aaguid).toBe('08987058-cadc-4b81-b6e1-30de50dcbe96');
            expect(result.transports).toEqual(['internal']);

            // Verificar que publicKey es string (base64url)
            expect(typeof result.publicKey).toBe('string');
        });

        it('Debe lanzar error si falta registrationInfo', () => {
            // Arrange
            const mockVerified = {
                verified: true,
                registrationInfo: undefined,
            };

            // Act & Assert
            expect(() => {
                fido2Service.extractCredentialInfo(mockVerified as any);
            }).toThrow('Missing registration info');
        });

        it('Debe lanzar error si falta credential.id', () => {
            // Arrange
            const mockVerified = {
                verified: true,
                registrationInfo: {
                    credentialID: Buffer.from('test'),
                    credentialPublicKey: Buffer.from('test'),
                    counter: 0,
                    aaguid: 'test-aaguid',
                    credential: {
                        id: undefined,
                        publicKey: new Uint8Array([1, 2, 3]),
                        counter: 0,
                    },
                },
            };

            // Act & Assert
            expect(() => {
                fido2Service.extractCredentialInfo(mockVerified as any);
            }).toThrow('Missing credential ID');
        });
    });

    describe('generateAuthenticationOptions() - Generar challenge de autenticación', () => {
        it('Debe generar opciones de autenticación con allowCredentials', async () => {
            // Arrange
            const allowCredentials = [
                {
                    credentialId: 'cred-1',
                    publicKey: 'pubkey-1',
                    counter: 5,
                    transports: ['internal' as const],
                },
            ];

            const mockOptions = {
                challenge: 'auth-challenge',
                rpId: 'mantochrisal.cl',
                timeout: 300000,
                userVerification: 'required',
                allowCredentials: [
                    {
                        id: 'cred-1',
                        type: 'public-key',
                        transports: ['internal'],
                    },
                ],
            };

            mockGenerateAuthenticationOptions.mockResolvedValue(mockOptions);

            // Act
            const result = await fido2Service.generateAuthenticationOptions({
                allowCredentials,
            });

            // Assert
            expect(result).toBeDefined();
            expect(result.challenge).toBe('auth-challenge');
            expect(result.allowCredentials).toHaveLength(1);

            // Verificar llamada
            expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith({
                rpID: 'mantochrisal.cl',
                userVerification: 'required',
                timeout: 300000,
                allowCredentials: [
                    {
                        id: 'cred-1',
                        type: 'public-key',
                        transports: ['internal'],
                    },
                ],
            });
        });
    });

    describe('verifyAuthentication() - Verificar respuesta de autenticación', () => {
        it('Debe verificar autenticación exitosamente', async () => {
            // Arrange
            const mockResponse = {
                id: 'cred-1',
                rawId: 'cred-1',
                type: 'public-key' as const,
                response: {
                    clientDataJSON: 'mock-client-data',
                    authenticatorData: 'mock-auth-data',
                    signature: 'mock-signature',
                },
            };

            const expectedChallenge = 'auth-challenge';
            const credential = {
                credentialId: 'cred-1',
                publicKey: 'AQIDBA', // Base64URL
                counter: 5,
            };

            const mockVerified = {
                verified: true,
                authenticationInfo: {
                    newCounter: 6,
                    credentialID: Buffer.from('cred-1'),
                },
            };

            mockVerifyAuthenticationResponse.mockResolvedValue(mockVerified);

            // Act
            const result = await fido2Service.verifyAuthentication(
                mockResponse,
                expectedChallenge,
                credential
            );

            // Assert
            expect(result).toBeDefined();
            expect(result.verified).toBe(true);

            // Verificar que se llamó correctamente
            expect(mockVerifyAuthenticationResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    response: mockResponse,
                    expectedChallenge,
                    expectedOrigin: 'https://mantochrisal.cl',
                    expectedRPID: 'mantochrisal.cl',
                    requireUserVerification: true,
                })
            );
        });
    });

    describe('Conversiones Base64URL y Uint8Array', () => {
        it('Debe convertir userId numérico a Uint8Array', async () => {
            // Arrange
            const input = {
                userId: 12345,
                username: 'test',
                displayName: 'Test User',
            };

            mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'test' });

            // Act
            await fido2Service.generateRegistrationOptions(input);

            // Assert - userId debe ser convertido a string y luego a bytes
            expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    userID: expect.any(Uint8Array),
                })
            );

            // Verificar que el userID contiene "12345" como bytes
            const call = mockGenerateRegistrationOptions.mock.calls[0][0];
            const userIdBytes = call.userID;
            const userIdString = new TextDecoder().decode(userIdBytes);
            expect(userIdString).toBe('12345');
        });
    });
});
