/**
 * WebSocket Client Module
 * Responsabilidad: Gestión de conexiones WebSocket con autenticación JWT
 */
import { AuthService } from '../auth/auth.service';

interface WebSocketMessage {
  type: string;
  payload?: unknown;
  username?: string;
  message?: string;
}

interface AuthMessage {
  type: 'AUTH';
  token: string;
}

type MessageHandler = (payload: unknown) => void;

export class WebSocketClient {
  private readonly authService: AuthService;
  private ws: WebSocket | null;
  private readonly reconnectTimeout: number;
  private readonly messageHandlers: Map<string, MessageHandler[]>;
  private isAuthenticated: boolean;
  private authTimeout: ReturnType<typeof setTimeout> | null;

  constructor(authService: AuthService) {
    this.authService = authService;
    this.ws = null;
    this.reconnectTimeout = 3000;
    this.messageHandlers = new Map();
    this.isAuthenticated = false;
    this.authTimeout = null;
  }

  connect(): void {
    if (!this.authService.isUserAuthenticated()) {
      console.log('[WebSocket] Esperando autenticación JWT del padre...');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Detectar si estamos en contexto /asistencia/ (iframe de Apache)
    // Si pathname comienza con /asistencia, usar /asistencia/ws
    // Si no, usar /ws directo (desarrollo o root)
    let wsPath = '/ws';
    if (window.location.pathname.startsWith('/asistencia')) {
      wsPath = '/asistencia/ws';
      console.log('[WebSocket] Contexto /asistencia/ detectado, usando /asistencia/ws');
    }
    
    const wsUrl = protocol + '//' + window.location.host + wsPath;

    console.log('[WebSocket] Estableciendo conexion...', wsUrl);
    this.ws = new WebSocket(wsUrl);
    this.isAuthenticated = false;

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (event: MessageEvent) => this.handleMessage(event);
    this.ws.onerror = (error: Event) => this.handleError(error);
    this.ws.onclose = () => this.handleClose();
  }

  private handleOpen(): void {
    console.log('[WebSocket] Conectado, enviando autenticación...');

    // Enviar token JWT como primer mensaje
    const token = this.authService.getToken();
    if (!token || !this.ws) {
      console.error('[WebSocket] No hay token disponible');
      this.ws?.close();
      return;
    }

    const authMessage: AuthMessage = {
      type: 'AUTH',
      token: token
    };

    this.ws.send(JSON.stringify(authMessage));

    // Timeout de autenticación: 5 segundos
    this.authTimeout = setTimeout(() => {
      if (!this.isAuthenticated) {
        console.error('[WebSocket] Timeout de autenticación');
        this.ws?.close();
      }
    }, 5000);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      // Manejar respuesta de autenticación
      if (message.type === 'auth-ok') {
        console.log('[WebSocket] Autenticación exitosa:', message.username || 'usuario');
        this.isAuthenticated = true;
        if (this.authTimeout) {
          clearTimeout(this.authTimeout);
        }
        this.notifyHandlers('connection', { status: 'authenticated' });
        return;
      }

      if (message.type === 'error') {
        console.error('[WebSocket] Error del servidor:', message.message);
        this.ws?.close();
        return;
      }

      // Mensajes normales (solo después de autenticar)
      if (this.isAuthenticated) {
        this.notifyHandlers(message.type, message.payload);
      } else {
        console.warn('[WebSocket] Mensaje recibido antes de autenticar, ignorado:', message.type);
      }
    } catch (error) {
      console.error('[WebSocket] Error parseando mensaje:', error);
    }
  }

  private handleError(error: Event): void {
    console.error('[WebSocket] Error:', error);
    this.notifyHandlers('error', { message: 'Error de conexion' });
  }

  private handleClose(): void {
    console.log('[WebSocket] Conexion cerrada. Reintentando en', this.reconnectTimeout, 'ms');
    this.isAuthenticated = false;
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
    }
    setTimeout(() => this.connect(), this.reconnectTimeout);
  }

  on(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  private notifyHandlers(messageType: string, payload?: unknown): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => handler(payload));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
