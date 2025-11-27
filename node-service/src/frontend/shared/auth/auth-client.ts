/**
 * Auth Client
 * Responsabilidad: Autenticacion JWT via postMessage y almacenamiento
 */
import { TokenStorage } from './token-storage';

interface AuthMessage {
  type: 'AUTH_TOKEN' | 'TOKEN_REFRESH';
  token: string;
}

interface JWTPayload {
  sub?: string;
  user_id?: number;
  userId?: number;
  exp?: number;
  iat?: number;
}

type AuthCallback = () => void;

export class AuthClient {
  private readonly tokenStorage: TokenStorage;
  private isAuthenticated: boolean;
  private readonly onAuthCallbacks: AuthCallback[];
  private cachedUserId: number | null;

  constructor() {
    this.tokenStorage = new TokenStorage();
    this.isAuthenticated = false;
    this.onAuthCallbacks = [];
    this.cachedUserId = null;
  }

  initialize(): void {
    const storedToken = this.tokenStorage.get();
    if (storedToken) {
      this.isAuthenticated = true;
      console.log('[Auth] Token recuperado de sessionStorage');
    }

    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent<AuthMessage>) => {
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

  private handleAuthToken(token: string): void {
    this.tokenStorage.save(token);
    this.isAuthenticated = true;
    this.cachedUserId = this.extractUserIdFromToken(token);
    console.log('[Auth] Token recibido y almacenado');
    this.notifyAuthentication();
  }

  private handleTokenRefresh(token: string): void {
    this.tokenStorage.save(token);
    this.cachedUserId = this.extractUserIdFromToken(token);
    console.log('[Auth] Token renovado');
  }

  private extractUserIdFromToken(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1])) as JWTPayload;
      // Try different common claim names for user ID
      const userId = payload.user_id ?? payload.userId ?? (payload.sub ? parseInt(payload.sub, 10) : null);
      return typeof userId === 'number' && !isNaN(userId) ? userId : null;
    } catch {
      console.warn('[Auth] Error extrayendo userId del token');
      return null;
    }
  }

  onAuthenticated(callback: AuthCallback): void {
    this.onAuthCallbacks.push(callback);
    if (this.isAuthenticated) {
      callback();
    }
  }

  private notifyAuthentication(): void {
    this.onAuthCallbacks.forEach(callback => callback());
  }

  getToken(): string | null {
    return this.tokenStorage.get();
  }

  isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  logout(): void {
    this.tokenStorage.clear();
    this.isAuthenticated = false;
    this.cachedUserId = null;
  }

  getUserId(): number | null {
    if (this.cachedUserId !== null) {
      return this.cachedUserId;
    }
    
    const token = this.tokenStorage.get();
    if (token) {
      this.cachedUserId = this.extractUserIdFromToken(token);
      return this.cachedUserId;
    }
    
    return null;
  }
}
