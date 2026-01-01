/**
 * Value Object: SessionId
 * Responsabilidad: Encapsular validación y semántica de identificadores de sesión
 */
export class SessionId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): SessionId {
    if (!value || value.trim().length === 0) {
      throw new Error('SessionId no puede estar vacío');
    }

    if (value.length > 100) {
      throw new Error('SessionId no puede exceder 100 caracteres');
    }

    return new SessionId(value);
  }

  static generate(): SessionId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const value = `session-${timestamp}-${random}`;
    return new SessionId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }
}
