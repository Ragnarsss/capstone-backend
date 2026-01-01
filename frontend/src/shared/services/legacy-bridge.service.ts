/**
 * Legacy Bridge Service
 * Responsabilidad: Orquestar comunicacion postMessage entre PHP legacy y modulo Node
 * 
 * Maneja dos tipos de mensajes:
 * 1. AUTH_TOKEN - Token JWT para autenticacion
 * 2. SESSION_CONTEXT - Contexto de sesion (curso, profesor, alumno, etc.)
 * 
 * Uso:
 *   const bridge = new LegacyBridge(authClient, contextStore);
 *   bridge.initialize();
 */
import { AuthClient } from '../auth/auth-client';
import { LegacyContextStore, LegacyContext } from '../stores/legacy-context.store';

interface AuthTokenMessage {
  type: 'AUTH_TOKEN';
  token: string;
}

interface TokenRefreshMessage {
  type: 'TOKEN_REFRESH';
  token: string;
}

interface SessionContextMessage {
  type: 'SESSION_CONTEXT';
  context: LegacyContext;
}

interface CloseIframeMessage {
  type: 'CLOSE_IFRAME';
}

type LegacyMessage = AuthTokenMessage | TokenRefreshMessage | SessionContextMessage | CloseIframeMessage;

type BridgeReadyCallback = () => void;

export class LegacyBridge {
  private readonly authClient: AuthClient;
  private readonly contextStore: LegacyContextStore;
  private readonly onReadyCallbacks: BridgeReadyCallback[];
  private initialized: boolean;
  private authReceived: boolean;
  private contextReceived: boolean;

  constructor(authClient: AuthClient, contextStore: LegacyContextStore) {
    this.authClient = authClient;
    this.contextStore = contextStore;
    this.onReadyCallbacks = [];
    this.initialized = false;
    this.authReceived = false;
    this.contextReceived = false;
  }

  /**
   * Inicializa el bridge y comienza a escuchar mensajes postMessage
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('[LegacyBridge] Ya inicializado');
      return;
    }

    // Verificar si ya hay datos en storage
    if (this.authClient.isUserAuthenticated()) {
      this.authReceived = true;
      console.log('[LegacyBridge] Auth ya presente en storage');
    }

    if (this.contextStore.hasContext()) {
      this.contextReceived = true;
      console.log('[LegacyBridge] Context ya presente en storage');
    }

    this.setupMessageListener();
    this.initialized = true;
    console.log('[LegacyBridge] Inicializado, esperando mensajes de legacy...');

    // Si ya tenemos todo, notificar
    this.checkReady();
  }

  /**
   * Configura el listener de mensajes postMessage
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      // Validar origen del mensaje
      if (!this.isValidOrigin(event.origin)) {
        console.warn('[LegacyBridge] Mensaje de origen no confiable:', event.origin);
        return;
      }

      const data = event.data as LegacyMessage;
      if (!data || typeof data !== 'object' || !data.type) {
        return;
      }

      console.log('[LegacyBridge] Mensaje recibido:', data.type);

      switch (data.type) {
        case 'AUTH_TOKEN':
          this.handleAuthToken(data as AuthTokenMessage);
          break;
        case 'TOKEN_REFRESH':
          this.handleTokenRefresh(data as TokenRefreshMessage);
          break;
        case 'SESSION_CONTEXT':
          this.handleSessionContext(data as SessionContextMessage);
          break;
        case 'CLOSE_IFRAME':
          this.handleCloseIframe();
          break;
        default:
          // Mensaje no reconocido, ignorar
          break;
      }
    });
  }

  /**
   * Valida que el origen del mensaje sea confiable
   */
  private isValidOrigin(origin: string): boolean {
    // En desarrollo, aceptar mismo origen
    if (origin === window.location.origin) {
      return true;
    }

    // En produccion, tambien podria venir del parent frame
    // El parent siempre deberia ser el mismo origen en este caso
    return false;
  }

  /**
   * Maneja recepcion de token JWT
   */
  private handleAuthToken(message: AuthTokenMessage): void {
    console.log('[LegacyBridge] Procesando AUTH_TOKEN');
    // AuthClient ya tiene su propio listener, pero lo manejamos aqui tambien
    // para tracking del estado del bridge
    this.authReceived = true;
    this.checkReady();
  }

  /**
   * Maneja refresh de token JWT
   */
  private handleTokenRefresh(message: TokenRefreshMessage): void {
    console.log('[LegacyBridge] Procesando TOKEN_REFRESH');
    // El AuthClient ya maneja esto internamente
  }

  /**
   * Maneja recepcion de contexto de sesion
   */
  private handleSessionContext(message: SessionContextMessage): void {
    console.log('[LegacyBridge] Procesando SESSION_CONTEXT:', message.context.tipo);
    this.contextStore.save(message.context);
    this.contextReceived = true;
    this.checkReady();
  }

  /**
   * Maneja solicitud de cerrar iframe
   */
  private handleCloseIframe(): void {
    console.log('[LegacyBridge] Recibido CLOSE_IFRAME');
    // Limpiar estado si es necesario
    this.contextStore.clear();
  }

  /**
   * Verifica si el bridge esta listo (auth + context recibidos)
   */
  private checkReady(): void {
    if (this.authReceived && this.contextReceived) {
      console.log('[LegacyBridge] Bridge listo - auth y context disponibles');
      this.notifyReady();
    }
  }

  /**
   * Registra callback para cuando el bridge este completamente listo
   */
  onReady(callback: BridgeReadyCallback): void {
    this.onReadyCallbacks.push(callback);
    if (this.isReady()) {
      callback();
    }
  }

  /**
   * Verifica si el bridge esta completamente listo
   */
  isReady(): boolean {
    return this.authReceived && this.contextReceived;
  }

  /**
   * Verifica si solo la auth esta lista (para casos donde context es opcional)
   */
  isAuthReady(): boolean {
    return this.authReceived;
  }

  /**
   * Notifica a los callbacks registrados
   */
  private notifyReady(): void {
    this.onReadyCallbacks.forEach(callback => callback());
  }

  /**
   * Envia mensaje al parent frame (PHP legacy)
   */
  sendToParent(message: object): void {
    if (window.parent !== window) {
      window.parent.postMessage(message, window.location.origin);
      console.log('[LegacyBridge] Mensaje enviado al parent:', message);
    } else {
      console.warn('[LegacyBridge] No hay parent frame, mensaje ignorado');
    }
  }

  /**
   * Notifica al parent que la asistencia fue completada
   */
  notifyAttendanceComplete(data: {
    studentId: number;
    studentName?: string;
    sessionId: string;
    completedAt: string;
    certainty?: number;
  }): void {
    this.sendToParent({
      type: 'ATTENDANCE_COMPLETE',
      ...data
    });
  }

  /**
   * Solicita al parent cerrar el iframe
   */
  requestClose(): void {
    this.sendToParent({
      type: 'CLOSE_IFRAME'
    });
  }
}
