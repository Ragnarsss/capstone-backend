/**
 * Auth Service Module
 * Responsabilidad: Lógica de autenticación y manejo de tokens JWT
 */
import { TokenStorage } from './token-storage.js';

export class AuthService {
  constructor() {
    this.tokenStorage = new TokenStorage();
    this.isAuthenticated = false;
    this.onAuthCallbacks = [];
  }

  initialize() {
    const storedToken = this.tokenStorage.get();
    if (storedToken) {
      this.isAuthenticated = true;
      console.log('[Auth] Token recuperado de sessionStorage');
    }

    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) {
        console.warn('[Auth] Mensaje de origen no confiable:', event.origin);
        return;
      }

      console.log('[Auth] Mensaje recibido:', event.data);

      if (event.data.type === 'AUTH_TOKEN') {
        this.handleAuthToken(event.data.token);
      }

      if (event.data.type === 'TOKEN_REFRESH') {
        this.handleTokenRefresh(event.data.token);
      }
    });
  }

  handleAuthToken(token) {
    this.tokenStorage.save(token);
    this.isAuthenticated = true;
    console.log('[Auth] Token recibido y almacenado');
    this.notifyAuthentication();
  }

  handleTokenRefresh(token) {
    this.tokenStorage.save(token);
    console.log('[Auth] Token renovado');
  }

  onAuthenticated(callback) {
    this.onAuthCallbacks.push(callback);
    if (this.isAuthenticated) {
      callback();
    }
  }

  notifyAuthentication() {
    this.onAuthCallbacks.forEach(callback => callback());
  }

  getToken() {
    return this.tokenStorage.get();
  }

  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  logout() {
    this.tokenStorage.clear();
    this.isAuthenticated = false;
  }
}
