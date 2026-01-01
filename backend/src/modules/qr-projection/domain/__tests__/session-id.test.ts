import { describe, it, expect } from "vitest";
import { SessionId } from "../session-id";

describe("SessionId", () => {
  describe("create", () => {
    it("debe crear un SessionId válido con string no vacío", () => {
      // Arrange
      const value = "session-123-abc";

      // Act
      const sessionId = SessionId.create(value);

      // Assert
      expect(sessionId).toBeDefined();
      expect(sessionId.toString()).toBe(value);
    });

    it("debe rechazar string vacío", () => {
      // Act & Assert
      expect(() => SessionId.create("")).toThrow(
        "SessionId no puede estar vacío"
      );
    });

    it("debe rechazar string con solo espacios", () => {
      // Act & Assert
      expect(() => SessionId.create("   ")).toThrow(
        "SessionId no puede estar vacío"
      );
    });

    it("debe rechazar string que excede 100 caracteres", () => {
      // Arrange
      const longValue = "a".repeat(101);

      // Act & Assert
      expect(() => SessionId.create(longValue)).toThrow(
        "SessionId no puede exceder 100 caracteres"
      );
    });

    it("debe aceptar string de exactamente 100 caracteres", () => {
      // Arrange
      const maxValue = "a".repeat(100);

      // Act
      const sessionId = SessionId.create(maxValue);

      // Assert
      expect(sessionId.toString()).toBe(maxValue);
    });

    it("debe aceptar string con espacios al inicio y final (después de trim)", () => {
      // Arrange
      const value = "  session-123  ";

      // Act
      const sessionId = SessionId.create(value);

      // Assert
      // Nota: El código actual NO hace trim en el valor, solo en la validación
      // Por lo tanto el valor debe incluir los espacios
      expect(sessionId.toString()).toBe(value);
    });

    it("debe aceptar caracteres especiales", () => {
      // Arrange
      const value = "session-123_abc-XYZ.test";

      // Act
      const sessionId = SessionId.create(value);

      // Assert
      expect(sessionId.toString()).toBe(value);
    });

    it("debe aceptar números y letras", () => {
      // Arrange
      const value = "abc123XYZ789";

      // Act
      const sessionId = SessionId.create(value);

      // Assert
      expect(sessionId.toString()).toBe(value);
    });
  });

  describe("generate", () => {
    it("debe generar un SessionId con formato correcto", () => {
      // Act
      const sessionId = SessionId.generate();

      // Assert
      expect(sessionId.toString()).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it("debe generar SessionIds únicos en llamadas sucesivas", () => {
      // Act
      const sessionId1 = SessionId.generate();
      const sessionId2 = SessionId.generate();

      // Assert
      expect(sessionId1.toString()).not.toBe(sessionId2.toString());
    });

    it("debe generar SessionId con timestamp válido", () => {
      // Arrange
      const beforeTimestamp = Date.now();

      // Act
      const sessionId = SessionId.generate();

      // Assert
      const afterTimestamp = Date.now();
      const sessionValue = sessionId.toString();
      const timestampPart = sessionValue.split("-")[1];
      const timestamp = parseInt(timestampPart, 10);

      expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it("debe generar SessionId con parte aleatoria no vacía", () => {
      // Act
      const sessionId = SessionId.generate();

      // Assert
      const parts = sessionId.toString().split("-");
      expect(parts).toHaveLength(3);
      expect(parts[2]).not.toBe("");
      expect(parts[2].length).toBeGreaterThan(0);
    });
  });

  describe("toString", () => {
    it("debe retornar el valor original", () => {
      // Arrange
      const value = "test-session-id";
      const sessionId = SessionId.create(value);

      // Act
      const result = sessionId.toString();

      // Assert
      expect(result).toBe(value);
    });
  });

  describe("equals", () => {
    it("debe retornar true para SessionIds con el mismo valor", () => {
      // Arrange
      const value = "session-123";
      const sessionId1 = SessionId.create(value);
      const sessionId2 = SessionId.create(value);

      // Act
      const result = sessionId1.equals(sessionId2);

      // Assert
      expect(result).toBe(true);
    });

    it("debe retornar false para SessionIds con valores diferentes", () => {
      // Arrange
      const sessionId1 = SessionId.create("session-123");
      const sessionId2 = SessionId.create("session-456");

      // Act
      const result = sessionId1.equals(sessionId2);

      // Assert
      expect(result).toBe(false);
    });

    it("debe ser sensible a mayúsculas/minúsculas", () => {
      // Arrange
      const sessionId1 = SessionId.create("Session-123");
      const sessionId2 = SessionId.create("session-123");

      // Act
      const result = sessionId1.equals(sessionId2);

      // Assert
      expect(result).toBe(false);
    });

    it("debe distinguir valores con espacios", () => {
      // Arrange
      const sessionId1 = SessionId.create("session-123");
      const sessionId2 = SessionId.create("session-123 ");

      // Act
      const result = sessionId1.equals(sessionId2);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("Casos edge adicionales", () => {
    it("debe manejar caracteres Unicode", () => {
      // Arrange
      const value = "session-你好-世界";

      // Act
      const sessionId = SessionId.create(value);

      // Assert
      expect(sessionId.toString()).toBe(value);
    });

    it("debe manejar emojis", () => {
      // Arrange
      const value = "session-123-😀";

      // Act
      const sessionId = SessionId.create(value);

      // Assert
      expect(sessionId.toString()).toBe(value);
    });

    it("debe manejar string con solo un carácter", () => {
      // Arrange
      const value = "a";

      // Act
      const sessionId = SessionId.create(value);

      // Assert
      expect(sessionId.toString()).toBe(value);
    });

    it("debe rechazar null como undefined (por TypeScript)", () => {
      // Este test valida que TypeScript previene pasar null
      // En runtime si se pasa null se comportará como string 'null'
      // @ts-expect-error - Probando comportamiento con null
      expect(() => SessionId.create(null)).toThrow();
    });

    it("debe rechazar undefined (por TypeScript)", () => {
      // @ts-expect-error - Probando comportamiento con undefined
      expect(() => SessionId.create(undefined)).toThrow();
    });
  });
});
