import { describe, it, expect } from 'vitest';
import { UserId } from '../user-id';

describe('UserId', () => {
  describe('create', () => {
    it('debe crear UserId válido con entero positivo', () => {
      // Arrange
      const value = 12345;

      // Act
      const userId = UserId.create(value);

      // Assert
      expect(userId).toBeDefined();
      expect(userId.toNumber()).toBe(12345);
    });

    it('debe rechazar número decimal', () => {
      // Act & Assert
      expect(() => UserId.create(12.5)).toThrow('UserId debe ser un entero');
    });

    it('debe rechazar cero', () => {
      // Act & Assert
      expect(() => UserId.create(0)).toThrow('UserId debe ser mayor que 0');
    });

    it('debe rechazar número negativo', () => {
      // Act & Assert
      expect(() => UserId.create(-1)).toThrow('UserId debe ser mayor que 0');
    });

    it('debe aceptar 1 como mínimo válido', () => {
      // Act
      const userId = UserId.create(1);

      // Assert
      expect(userId.toNumber()).toBe(1);
    });

    it('debe aceptar números grandes', () => {
      // Arrange
      const largeId = 999999999;

      // Act
      const userId = UserId.create(largeId);

      // Assert
      expect(userId.toNumber()).toBe(largeId);
    });

    it('debe rechazar NaN', () => {
      // Act & Assert
      expect(() => UserId.create(NaN)).toThrow('UserId debe ser un entero');
    });

    it('debe rechazar Infinity', () => {
      // Act & Assert
      expect(() => UserId.create(Infinity)).toThrow('UserId debe ser un entero');
    });
  });

  describe('toNumber', () => {
    it('debe retornar el valor numérico', () => {
      // Arrange
      const userId = UserId.create(42);

      // Act
      const result = userId.toNumber();

      // Assert
      expect(result).toBe(42);
      expect(typeof result).toBe('number');
    });
  });

  describe('toString', () => {
    it('debe convertir a string', () => {
      // Arrange
      const userId = UserId.create(123);

      // Act
      const result = userId.toString();

      // Assert
      expect(result).toBe('123');
      expect(typeof result).toBe('string');
    });

    it('debe convertir números grandes correctamente', () => {
      // Arrange
      const userId = UserId.create(999999);

      // Act
      const result = userId.toString();

      // Assert
      expect(result).toBe('999999');
    });
  });

  describe('equals', () => {
    it('debe retornar true para UserIds con el mismo valor', () => {
      // Arrange
      const userId1 = UserId.create(100);
      const userId2 = UserId.create(100);

      // Act
      const result = userId1.equals(userId2);

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar false para UserIds con valores diferentes', () => {
      // Arrange
      const userId1 = UserId.create(100);
      const userId2 = UserId.create(200);

      // Act
      const result = userId1.equals(userId2);

      // Assert
      expect(result).toBe(false);
    });

    it('debe ser reflexivo (x.equals(x) === true)', () => {
      // Arrange
      const userId = UserId.create(50);

      // Act
      const result = userId.equals(userId);

      // Assert
      expect(result).toBe(true);
    });

    it('debe ser simétrico (x.equals(y) === y.equals(x))', () => {
      // Arrange
      const userId1 = UserId.create(75);
      const userId2 = UserId.create(75);

      // Act
      const result1 = userId1.equals(userId2);
      const result2 = userId2.equals(userId1);

      // Assert
      expect(result1).toBe(result2);
    });
  });

  describe('Casos edge', () => {
    it('debe manejar el valor 1 correctamente', () => {
      // Arrange
      const userId = UserId.create(1);

      // Assert
      expect(userId.toNumber()).toBe(1);
      expect(userId.toString()).toBe('1');
    });

    it('debe manejar valores muy grandes', () => {
      // Arrange
      const maxSafeInt = Number.MAX_SAFE_INTEGER;
      const userId = UserId.create(maxSafeInt);

      // Assert
      expect(userId.toNumber()).toBe(maxSafeInt);
    });

    it('debe rechazar -Infinity', () => {
      // Act & Assert
      expect(() => UserId.create(-Infinity)).toThrow();
    });

    it('debe validar múltiples instancias independientes', () => {
      // Arrange
      const userId1 = UserId.create(10);
      const userId2 = UserId.create(20);
      const userId3 = UserId.create(10);

      // Assert
      expect(userId1.equals(userId2)).toBe(false);
      expect(userId1.equals(userId3)).toBe(true);
      expect(userId2.equals(userId3)).toBe(false);
    });
  });

  describe('Inmutabilidad', () => {
    it('debe ser inmutable (value es readonly)', () => {
      // Arrange
      const userId = UserId.create(100);

      // Act & Assert
      // El valor es private readonly, garantizado por TypeScript
      expect(userId.toNumber()).toBe(100);
      
      // Crear otra instancia no afecta la primera
      const userId2 = UserId.create(200);
      expect(userId.toNumber()).toBe(100); // Sigue siendo 100
      expect(userId2.toNumber()).toBe(200);
    });
  });
});
