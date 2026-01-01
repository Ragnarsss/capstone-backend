/**
 * Token Storage
 * Responsabilidad: Gestion de almacenamiento de tokens JWT
 */
export class TokenStorage {
  private readonly storageKey: string;

  constructor() {
    this.storageKey = 'jwt_token';
  }

  save(token: string): void {
    sessionStorage.setItem(this.storageKey, token);
  }

  get(): string | null {
    return sessionStorage.getItem(this.storageKey);
  }

  clear(): void {
    sessionStorage.removeItem(this.storageKey);
  }

  exists(): boolean {
    return this.get() !== null;
  }
}
