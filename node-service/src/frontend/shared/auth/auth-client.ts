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
  name?: string;
  nombre?: string;
  nombre_completo?: string;
  nombreCompleto?: string;
  exp?: number;
  iat?: number;
}

type AuthCallback = () => void;

export class AuthClient {
  private readonly tokenStorage: TokenStorage;
  private isAuthenticated: boolean;
  private readonly onAuthCallbacks: AuthCallback[];
  private cachedUserId: number | null;
  private cachedUserName: string | null;

  constructor() {
    this.tokenStorage = new TokenStorage();
    this.isAuthenticated = false;
    this.onAuthCallbacks = [];
    this.cachedUserId = null;
    this.cachedUserName = null;
  }

  initialize(): void {
    const storedToken = this.tokenStorage.get();
    if (storedToken) {
      this.isAuthenticated = true;
      // Extraer userId del token almacenado para poder detectar cambios de usuario
      this.cachedUserId = this.extractUserIdFromToken(storedToken);
      this.cachedUserName = this.extractUserNameFromToken(storedToken);
      console.log('[Auth] Token recuperado de sessionStorage para userId:', this.cachedUserId);
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
    // Extraer userId del nuevo token
    const newUserId = this.extractUserIdFromToken(token);
    
    // Si hay un token anterior y el userId cambió, limpiar estado
    if (this.cachedUserId !== null && newUserId !== null && this.cachedUserId !== newUserId) {
      console.log('[Auth] Usuario cambió de', this.cachedUserId, 'a', newUserId, '- Limpiando estado anterior');
      this.clearAuthState();
    }
    
    this.tokenStorage.save(token);
    this.isAuthenticated = true;
    this.cachedUserId = newUserId;
    this.cachedUserName = this.extractUserNameFromToken(token);
    console.log('[Auth] Token recibido y almacenado para userId:', newUserId);
    this.notifyAuthentication();
  }

  /**
   * Limpia todo el estado de autenticación cuando el usuario cambia
   */
  private clearAuthState(): void {
    // Limpiar token antiguo
    this.tokenStorage.clear();
    
    // Limpiar SOLO session_key de sessionStorage (no todo el sessionStorage)
    // El session_key está vinculado al JWT anterior y no será válido con el nuevo JWT
    sessionStorage.removeItem('session_key');
    
    // Limpiar cookies relacionadas con autenticación
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    
    console.log('[Auth] Estado de autenticación limpiado (JWT y session_key removidos)');
  }

  private handleTokenRefresh(token: string): void {
    this.tokenStorage.save(token);
    this.cachedUserId = this.extractUserIdFromToken(token);
    this.cachedUserName = this.extractUserNameFromToken(token);
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

  private extractUserNameFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1])) as JWTPayload;
      // Try different common claim names for user name
      return payload.nombreCompleto ?? payload.nombre_completo ?? payload.nombre ?? payload.name ?? null;
    } catch {
      console.warn('[Auth] Error extrayendo nombre del token');
      return null;
    }
  }

  /**
   * Registra un callback que se ejecutará cuando se reciba un token via postMessage.
   * 
   * NOTA: El callback se dispara SOLO cuando llega un AUTH_TOKEN via postMessage,
   * NO inmediatamente si hay un token en sessionStorage. Esto evita race conditions
   * donde el sessionStorage tiene un token obsoleto de otro usuario.
   * 
   * @param callback - Función a ejecutar cuando se reciba el token
   */
  onAuthenticated(callback: AuthCallback): void {
    this.onAuthCallbacks.push(callback);
    // NO disparar inmediatamente - esperar siempre al postMessage
    // Esto evita usar tokens obsoletos del sessionStorage
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
    this.cachedUserName = null;
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

  getUserName(): string | null {
    if (this.cachedUserName !== null) {
      return this.cachedUserName;
    }
    
    const token = this.tokenStorage.get();
    if (token) {
      this.cachedUserName = this.extractUserNameFromToken(token);
      return this.cachedUserName;
    }
    
    return null;
  }
}
