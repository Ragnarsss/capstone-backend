/**
 * WebSocket Client Module
 * Responsabilidad: Gestión de conexiones WebSocket con autenticación JWT
 */
export class WebSocketClient {
  constructor(authService) {
    this.authService = authService;
    this.ws = null;
    this.reconnectTimeout = 3000;
    this.messageHandlers = new Map();
    this.isAuthenticated = false;
    this.authTimeout = null;
  }

  connect() {
    if (!this.authService.isUserAuthenticated()) {
      console.log('[WebSocket] Esperando autenticación JWT del padre...');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/asistencia/ws';

    console.log('[WebSocket] Estableciendo conexion...', wsUrl);
    this.ws = new WebSocket(wsUrl);
    this.isAuthenticated = false;

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onerror = (error) => this.handleError(error);
    this.ws.onclose = () => this.handleClose();
  }

  handleOpen() {
    console.log('[WebSocket] Conectado, enviando autenticación...');
    
    // Enviar token JWT como primer mensaje
    const token = this.authService.getToken();
    if (!token) {
      console.error('[WebSocket] No hay token disponible');
      this.ws.close();
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'AUTH',
      token: token
    }));

    // Timeout de autenticación: 5 segundos
    this.authTimeout = setTimeout(() => {
      if (!this.isAuthenticated) {
        console.error('[WebSocket] Timeout de autenticación');
        this.ws.close();
      }
    }, 5000);
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      // Manejar respuesta de autenticación
      if (message.type === 'auth-ok') {
        console.log('[WebSocket] Autenticación exitosa:', message.username || 'usuario');
        this.isAuthenticated = true;
        clearTimeout(this.authTimeout);
        this.notifyHandlers('connection', { status: 'authenticated' });
        return;
      }

      if (message.type === 'error') {
        console.error('[WebSocket] Error del servidor:', message.message);
        this.ws.close();
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

  handleError(error) {
    console.error('[WebSocket] Error:', error);
    this.notifyHandlers('error', { message: 'Error de conexion' });
  }

  handleClose() {
    console.log('[WebSocket] Conexion cerrada. Reintentando en', this.reconnectTimeout, 'ms');
    this.isAuthenticated = false;
    clearTimeout(this.authTimeout);
    setTimeout(() => this.connect(), this.reconnectTimeout);
  }

  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  notifyHandlers(messageType, payload) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => handler(payload));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
