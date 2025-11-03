/**
 * WebSocket Client Module
 * Responsabilidad: Gestión de conexiones WebSocket
 */
export class WebSocketClient {
  constructor(authService) {
    this.authService = authService;
    this.ws = null;
    this.reconnectTimeout = 3000;
    this.messageHandlers = new Map();
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

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onerror = (error) => this.handleError(error);
    this.ws.onclose = () => this.handleClose();
  }

  handleOpen() {
    console.log('[WebSocket] Conectado');
    this.notifyHandlers('connection', { status: 'connected' });
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      this.notifyHandlers(message.type, message.payload);
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
