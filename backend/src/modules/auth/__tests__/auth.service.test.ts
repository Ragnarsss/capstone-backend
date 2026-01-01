/**
 * Tests unitarios para AuthService
 * 
 * Ejecutar con: npm run test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthService } from '../application/auth.service';
import { JWTUtils, type JWTConfig } from '../domain/jwt-utils';
import type { JWTPayload } from '../domain/models';

describe('AuthService', () => {
    let authService: AuthService;
    let jwtUtils: JWTUtils;
    let config: JWTConfig;

    beforeEach(() => {
        config = {
            secret: 'test-secret-key',
            expiresIn: '1h',
            issuer: 'test-issuer',
            audience: 'test-audience',
        };
        jwtUtils = new JWTUtils(config);
        authService = new AuthService(jwtUtils);
    });

    /**
     * Helper para generar un token JWT válido
     */
    function generateValidToken(payload: JWTPayload): string {
        return jwt.sign(payload, config.secret, {
            issuer: config.issuer,
            audience: config.audience,
            expiresIn: config.expiresIn,
        });
    }

    describe('authenticateFromHeader', () => {
        it('debe autenticar correctamente con header válido', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'profesor@ucn.cl',
                nombreCompleto: 'Juan Pérez',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const header = `Bearer ${token}`;

            const result = authService.authenticateFromHeader(header);

            expect(result.userId.toNumber()).toBe(42);
            expect(result.username).toBe('profesor@ucn.cl');
            expect(result.nombreCompleto).toBe('Juan Pérez');
            expect(result.rol).toBe('profesor');
        });

        it('debe autenticar estudiante correctamente', () => {
            const payload: JWTPayload = {
                userId: 99,
                username: '18687505-2',
                nombreCompleto: 'María González',
                rol: 'estudiante',
            };

            const token = generateValidToken(payload);
            const header = `Bearer ${token}`;

            const result = authService.authenticateFromHeader(header);

            expect(result.userId.toNumber()).toBe(99);
            expect(result.username).toBe('18687505-2');
            expect(result.rol).toBe('estudiante');
        });

        it('debe fallar sin header Authorization', () => {
            expect(() => authService.authenticateFromHeader(undefined)).toThrow(
                'Header Authorization no proporcionado'
            );
        });

        it('debe fallar con header malformado', () => {
            expect(() => authService.authenticateFromHeader('InvalidHeader')).toThrow(
                'Formato de Authorization inválido'
            );
        });

        it('debe fallar con token inválido', () => {
            const header = 'Bearer invalid.token.here';
            expect(() => authService.authenticateFromHeader(header)).toThrow('Token inválido');
        });

        it('debe fallar con token expirado', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@ucn.cl',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: '-1s', // Expirado
            });

            const header = `Bearer ${token}`;
            expect(() => authService.authenticateFromHeader(header)).toThrow('Token expirado');
        });

        it('debe crear UserId válido desde payload', () => {
            const payload: JWTPayload = {
                userId: 1,
                username: 'test@ucn.cl',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const header = `Bearer ${token}`;

            const result = authService.authenticateFromHeader(header);

            // UserId debe ser un Value Object válido
            expect(result.userId.toNumber()).toBe(1);
            expect(() => result.userId.toNumber()).not.toThrow();
        });

        it('debe preservar caracteres especiales en nombreCompleto', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@ucn.cl',
                nombreCompleto: 'José María Pérez-García',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const header = `Bearer ${token}`;

            const result = authService.authenticateFromHeader(header);
            expect(result.nombreCompleto).toBe('José María Pérez-García');
        });
    });

    describe('verifyToken', () => {
        it('debe verificar token válido directamente', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'profesor@ucn.cl',
                nombreCompleto: 'Juan Pérez',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const result = authService.verifyToken(token);

            expect(result.userId.toNumber()).toBe(42);
            expect(result.username).toBe('profesor@ucn.cl');
            expect(result.nombreCompleto).toBe('Juan Pérez');
            expect(result.rol).toBe('profesor');
        });

        it('debe fallar con token inválido', () => {
            const token = 'invalid.token.here';
            expect(() => authService.verifyToken(token)).toThrow('Token inválido');
        });

        it('debe fallar con token expirado', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@ucn.cl',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: '-1s',
            });

            expect(() => authService.verifyToken(token)).toThrow('Token expirado');
        });

        it('debe fallar con token firmado con otra secret', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@ucn.cl',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, 'different-secret', {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            expect(() => authService.verifyToken(token)).toThrow('Token inválido');
        });
    });

    describe('mapToAuthenticatedUser', () => {
        it('debe mapear payload completo correctamente', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'profesor@ucn.cl',
                nombreCompleto: 'Juan Pérez',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const result = authService.verifyToken(token);

            // Verificar que todos los campos están presentes
            expect(result).toHaveProperty('userId');
            expect(result).toHaveProperty('username');
            expect(result).toHaveProperty('nombreCompleto');
            expect(result).toHaveProperty('rol');
        });

        it('debe crear UserId como Value Object', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@ucn.cl',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const result = authService.verifyToken(token);

            // UserId debe tener métodos del Value Object
            expect(result.userId.toNumber).toBeDefined();
            expect(result.userId.toString).toBeDefined();
            expect(result.userId.equals).toBeDefined();
        });
    });

    describe('integración authenticateFromHeader vs verifyToken', () => {
        it('debe producir mismo resultado con ambos métodos', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'profesor@ucn.cl',
                nombreCompleto: 'Juan Pérez',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const header = `Bearer ${token}`;

            const fromHeader = authService.authenticateFromHeader(header);
            const fromToken = authService.verifyToken(token);

            expect(fromHeader.userId.toNumber()).toBe(fromToken.userId.toNumber());
            expect(fromHeader.username).toBe(fromToken.username);
            expect(fromHeader.nombreCompleto).toBe(fromToken.nombreCompleto);
            expect(fromHeader.rol).toBe(fromToken.rol);
        });
    });

    describe('edge cases', () => {
        it('debe manejar userId = 1 correctamente', () => {
            const payload: JWTPayload = {
                userId: 1,
                username: 'first@ucn.cl',
                nombreCompleto: 'First User',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const result = authService.verifyToken(token);

            expect(result.userId.toNumber()).toBe(1);
        });

        it('debe manejar números grandes en userId', () => {
            const payload: JWTPayload = {
                userId: 999999999,
                username: 'big@ucn.cl',
                nombreCompleto: 'Big User',
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const result = authService.verifyToken(token);

            expect(result.userId.toNumber()).toBe(999999999);
        });

        it('debe manejar username con caracteres especiales', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test+special@example.com',
                nombreCompleto: 'Test User',
                rol: 'estudiante',
            };

            const token = generateValidToken(payload);
            const result = authService.verifyToken(token);

            expect(result.username).toBe('test+special@example.com');
        });

        it('debe manejar todos los roles válidos', () => {
            const roles = ['profesor', 'estudiante', 'admin'] as const;

            for (const rol of roles) {
                const payload: JWTPayload = {
                    userId: 42,
                    username: 'test@ucn.cl',
                    nombreCompleto: 'Test User',
                    rol,
                };

                const token = generateValidToken(payload);
                const result = authService.verifyToken(token);

                expect(result.rol).toBe(rol);
            }
        });

        it('debe preservar espacios múltiples en nombreCompleto', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@ucn.cl',
                nombreCompleto: 'Juan   Carlos   Pérez', // Espacios múltiples
                rol: 'profesor',
            };

            const token = generateValidToken(payload);
            const result = authService.verifyToken(token);

            expect(result.nombreCompleto).toBe('Juan   Carlos   Pérez');
        });
    });
});
