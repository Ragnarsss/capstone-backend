/**
 * Value Object: UserId
 * Responsabilidad: Encapsular validación y semántica de identificadores de usuario
 */
export class UserId {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static create(value: number): UserId {
    if (!Number.isInteger(value)) {
      throw new Error('UserId debe ser un entero');
    }

    if (value <= 0) {
      throw new Error('UserId debe ser mayor que 0');
    }

    return new UserId(value);
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value.toString();
  }
}
