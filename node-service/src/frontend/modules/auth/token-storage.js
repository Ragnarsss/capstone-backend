/**
 * Token Storage Module
 * Responsabilidad: Gestión de almacenamiento de tokens JWT
 */
export class TokenStorage {
  constructor() {
    this.storageKey = 'jwt_token';
  }

  save(token) {
    sessionStorage.setItem(this.storageKey, token);
  }

  get() {
    return sessionStorage.getItem(this.storageKey);
  }

  clear() {
    sessionStorage.removeItem(this.storageKey);
  }

  exists() {
    return this.get() !== null;
  }
}
