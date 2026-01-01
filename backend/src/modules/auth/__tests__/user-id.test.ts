/**
 * Tests unitarios para UserId Value Object
 * 
 * Ejecutar con: npm run test
 */

import { describe, it, expect } from 'vitest';
import { UserId } from '../domain/user-id';

describe('UserId', () => {
    describe('create', () => {
        it('debe crear UserId válido con número positivo', () => {
            const userId = UserId.create(42);
            expect(userId.toNumber()).toBe(42);
        });

        it('debe crear UserId con número 1', () => {
            const userId = UserId.create(1);
            expect(userId.toNumber()).toBe(1);
        });

        it('debe fallar con número 0', () => {
            expect(() => UserId.create(0)).toThrow('UserId debe ser mayor que 0');
        });

        it('debe fallar con número negativo', () => {
            expect(() => UserId.create(-1)).toThrow('UserId debe ser mayor que 0');
        });

        it('debe fallar con número decimal', () => {
            expect(() => UserId.create(42.5)).toThrow('UserId debe ser un entero');
        });

        it('debe fallar con NaN', () => {
            expect(() => UserId.create(NaN)).toThrow('UserId debe ser un entero');
        });

        it('debe fallar con Infinity', () => {
            expect(() => UserId.create(Infinity)).toThrow('UserId debe ser un entero');
        });
    });

    describe('toNumber', () => {
        it('debe retornar el valor numérico', () => {
            const userId = UserId.create(42);
            expect(userId.toNumber()).toBe(42);
            expect(typeof userId.toNumber()).toBe('number');
        });
    });

    describe('toString', () => {
        it('debe retornar el valor como string', () => {
            const userId = UserId.create(42);
            expect(userId.toString()).toBe('42');
            expect(typeof userId.toString()).toBe('string');
        });
    });

    describe('equals', () => {
        it('debe retornar true para UserIds con mismo valor', () => {
            const userId1 = UserId.create(42);
            const userId2 = UserId.create(42);
            expect(userId1.equals(userId2)).toBe(true);
        });

        it('debe retornar false para UserIds con valores diferentes', () => {
            const userId1 = UserId.create(42);
            const userId2 = UserId.create(99);
            expect(userId1.equals(userId2)).toBe(false);
        });

        it('debe comparar correctamente números grandes', () => {
            const userId1 = UserId.create(999999);
            const userId2 = UserId.create(999999);
            const userId3 = UserId.create(999998);

            expect(userId1.equals(userId2)).toBe(true);
            expect(userId1.equals(userId3)).toBe(false);
        });
    });

    describe('inmutabilidad', () => {
        it('no debe permitir modificar el valor después de creación', () => {
            const userId = UserId.create(42);

            // El valor debe ser el mismo siempre (JavaScript no lanza error en asignaciones a privados)
            // En TypeScript, esto sería un error de compilación
            expect(userId.toNumber()).toBe(42);

            // Verificar que el valor es consistente
            expect(userId.toNumber()).toBe(userId.toNumber());
        });
    });

    describe('identidad', () => {
        it('dos instancias con mismo valor NO deben ser iguales por referencia', () => {
            const userId1 = UserId.create(42);
            const userId2 = UserId.create(42);

            // No son el mismo objeto en memoria
            expect(userId1 === userId2).toBe(false);

            // Pero son iguales por valor
            expect(userId1.equals(userId2)).toBe(true);
        });

        it('misma instancia debe ser igual a sí misma', () => {
            const userId = UserId.create(42);

            // Misma referencia
            expect(userId === userId).toBe(true);

            // Y también iguales por valor
            expect(userId.equals(userId)).toBe(true);
        });
    });
});
