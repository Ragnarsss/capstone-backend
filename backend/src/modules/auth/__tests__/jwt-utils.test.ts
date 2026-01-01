/**
 * Tests unitarios para JWTUtils
 * 
 * Ejecutar con: npm run test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JWTUtils, type JWTConfig } from '../domain/jwt-utils';
import type { JWTPayload } from '../domain/models';

describe('JWTUtils', () => {
    let jwtUtils: JWTUtils;
    let config: JWTConfig;

    beforeEach(() => {
        config = {
            secret: 'test-secret-key-for-jwt',
            expiresIn: '1h',
            issuer: 'test-issuer',
            audience: 'test-audience',
        };
        jwtUtils = new JWTUtils(config);
    });

    describe('verify', () => {
        it('debe verificar JWT válido correctamente', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@example.com',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            const result = jwtUtils.verify(token);

            expect(result.userId).toBe(42);
            expect(result.username).toBe('test@example.com');
            expect(result.nombreCompleto).toBe('Test User');
            expect(result.rol).toBe('profesor');
        });

        it('debe fallar con token expirado', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@example.com',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            // Token con expiración negativa (ya expirado)
            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: '-1s', // Expira 1 segundo en el pasado
            });

            expect(() => jwtUtils.verify(token)).toThrow('Token expirado');
        });

        it('debe fallar con secret incorrecta', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@example.com',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            // Token firmado con otra secret
            const token = jwt.sign(payload, 'wrong-secret', {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            expect(() => jwtUtils.verify(token)).toThrow('Token inválido');
        });

        it('debe fallar con issuer incorrecto', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@example.com',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: 'wrong-issuer',
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            expect(() => jwtUtils.verify(token)).toThrow('Token inválido');
        });

        it('debe fallar con audience incorrecta', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@example.com',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: 'wrong-audience',
                expiresIn: config.expiresIn,
            });

            expect(() => jwtUtils.verify(token)).toThrow('Token inválido');
        });

        it('debe fallar con payload sin userId', () => {
            const payload = {
                // userId faltante
                username: 'test@example.com',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            expect(() => jwtUtils.verify(token)).toThrow('JWT payload inválido: falta userId o username');
        });

        it('debe fallar con payload sin username', () => {
            const payload = {
                userId: 42,
                // username faltante
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            expect(() => jwtUtils.verify(token)).toThrow('JWT payload inválido: falta userId o username');
        });

        it('debe fallar con token malformado', () => {
            const token = 'not.a.valid.jwt.token';
            expect(() => jwtUtils.verify(token)).toThrow('Token inválido');
        });

        it('debe fallar con string vacío', () => {
            expect(() => jwtUtils.verify('')).toThrow('Token inválido');
        });

        it('debe verificar token con campos opcionales', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@example.com',
                nombreCompleto: 'Test User',
                rol: 'estudiante',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            const result = jwtUtils.verify(token);
            // Verificar solo los campos del payload, no los campos añadidos por JWT (aud, iss, exp, iat)
            expect(result.userId).toBe(payload.userId);
            expect(result.username).toBe(payload.username);
            expect(result.nombreCompleto).toBe(payload.nombreCompleto);
            expect(result.rol).toBe(payload.rol);
        });
    });

    describe('extractFromHeader', () => {
        it('debe extraer token de header válido', () => {
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyfQ.test';
            const header = `Bearer ${token}`;

            const result = jwtUtils.extractFromHeader(header);
            expect(result).toBe(token);
        });

        it('debe fallar sin header Authorization', () => {
            expect(() => jwtUtils.extractFromHeader(undefined)).toThrow(
                'Header Authorization no proporcionado'
            );
        });

        it('debe fallar con header vacío', () => {
            expect(() => jwtUtils.extractFromHeader('')).toThrow(
                'Header Authorization no proporcionado'
            );
        });

        it('debe fallar sin esquema Bearer', () => {
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyfQ.test';
            expect(() => jwtUtils.extractFromHeader(token)).toThrow(
                'Formato de Authorization inválido. Esperado: "Bearer <token>"'
            );
        });

        it('debe fallar con esquema incorrecto', () => {
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyfQ.test';
            const header = `Basic ${token}`;

            expect(() => jwtUtils.extractFromHeader(header)).toThrow(
                'Formato de Authorization inválido. Esperado: "Bearer <token>"'
            );
        });

        it('debe fallar con múltiples espacios', () => {
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyfQ.test';
            const header = `Bearer  ${token}`; // Doble espacio

            expect(() => jwtUtils.extractFromHeader(header)).toThrow(
                'Formato de Authorization inválido. Esperado: "Bearer <token>"'
            );
        });

        it('debe fallar con solo "Bearer" sin token', () => {
            expect(() => jwtUtils.extractFromHeader('Bearer')).toThrow(
                'Formato de Authorization inválido. Esperado: "Bearer <token>"'
            );
        });

        it('debe extraer token largo correctamente', () => {
            const longToken = 'a'.repeat(500);
            const header = `Bearer ${longToken}`;

            const result = jwtUtils.extractFromHeader(header);
            expect(result).toBe(longToken);
            expect(result.length).toBe(500);
        });

        it('debe manejar token con puntos (formato JWT real)', () => {
            const realishToken = 'header.payload.signature';
            const header = `Bearer ${realishToken}`;

            const result = jwtUtils.extractFromHeader(header);
            expect(result).toBe(realishToken);
        });
    });

    describe('integración verify + extractFromHeader', () => {
        it('debe extraer y verificar token de header completo', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test@example.com',
                nombreCompleto: 'Test User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            const header = `Bearer ${token}`;

            // Extraer token del header
            const extractedToken = jwtUtils.extractFromHeader(header);

            // Verificar token extraído
            const result = jwtUtils.verify(extractedToken);

            expect(result.userId).toBe(42);
            expect(result.username).toBe('test@example.com');
        });
    });

    describe('edge cases', () => {
        it('debe manejar token con caracteres especiales en payload', () => {
            const payload: JWTPayload = {
                userId: 42,
                username: 'test+special@example.com',
                nombreCompleto: 'Test "User" & Co.',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            const result = jwtUtils.verify(token);
            expect(result.username).toBe('test+special@example.com');
            expect(result.nombreCompleto).toBe('Test "User" & Co.');
        });

        it('debe manejar userId = 1', () => {
            const payload: JWTPayload = {
                userId: 1,
                username: 'first@example.com',
                nombreCompleto: 'First User',
                rol: 'estudiante',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            const result = jwtUtils.verify(token);
            expect(result.userId).toBe(1);
        });

        it('debe manejar números grandes en userId', () => {
            const payload: JWTPayload = {
                userId: 999999999,
                username: 'big@example.com',
                nombreCompleto: 'Big User',
                rol: 'profesor',
            };

            const token = jwt.sign(payload, config.secret, {
                issuer: config.issuer,
                audience: config.audience,
                expiresIn: config.expiresIn,
            });

            const result = jwtUtils.verify(token);
            expect(result.userId).toBe(999999999);
        });
    });
});
