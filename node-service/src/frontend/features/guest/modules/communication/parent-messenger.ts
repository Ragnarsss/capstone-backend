/**
 * ParentMessenger Service
 * 
 * Responsabilidad: Comunicación con el iframe padre (PHP)
 * 
 * Este servicio maneja la comunicación bidireccional entre el modal
 * de Node.js (guest) y el sistema PHP que lo contiene via postMessage.
 * 
 * Mensajes enviados al padre:
 * - ENROLLMENT_COMPLETE: El usuario completó enrollment exitosamente
 * - ATTENDANCE_COMPLETE: El usuario completó asistencia
 * - REQUEST_CLOSE: Solicita cerrar el modal
 * - ERROR: Ocurrió un error que requiere atención
 * 
 * Mensajes recibidos del padre:
 * - INIT: Datos iniciales (userId, sessionId, etc.)
 * - CLOSE_CONFIRMED: El padre confirma que cerrará el modal
 */

export interface ParentMessage {
  type: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

export interface EnrollmentCompletePayload {
  deviceId: number;
  penaltyMinutes: number;
  message: string;
}

export interface AttendanceCompletePayload {
  sessionId: string;
  status: 'PRESENT' | 'DOUBTFUL' | 'ABSENT';
  certainty: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
  recoverable: boolean;
}

type MessageHandler = (payload: Record<string, unknown>) => void;

export class ParentMessenger {
  private readonly targetOrigin: string;
  private readonly handlers: Map<string, MessageHandler[]> = new Map();
  private isInIframe: boolean;

  constructor(targetOrigin?: string) {
    // En producción, usar el origen del servidor PHP
    // En desarrollo, aceptar cualquier origen
    this.targetOrigin = targetOrigin || '*';
    this.isInIframe = window.parent !== window;
    
    // Escuchar mensajes del padre
    window.addEventListener('message', this.handleIncomingMessage.bind(this));
  }

  /**
   * Verifica si estamos dentro de un iframe
   */
  isEmbedded(): boolean {
    return this.isInIframe;
  }

  /**
   * Envía mensaje al padre
   */
  private sendMessage(type: string, payload?: Record<string, unknown>): void {
    if (!this.isInIframe) {
      console.log('[ParentMessenger] No en iframe, mensaje ignorado:', type, payload);
      return;
    }

    const message: ParentMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };

    console.log('[ParentMessenger] Enviando:', message);
    window.parent.postMessage(message, this.targetOrigin);
  }

  /**
   * Maneja mensajes entrantes del padre
   */
  private handleIncomingMessage(event: MessageEvent): void {
    // Validar origen si se especificó uno concreto
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) {
      console.warn('[ParentMessenger] Origen no autorizado:', event.origin);
      return;
    }

    const message = event.data as ParentMessage;
    
    if (!message || typeof message.type !== 'string') {
      return; // No es un mensaje válido para nosotros
    }

    console.log('[ParentMessenger] Recibido:', message);

    // Ejecutar handlers registrados
    const handlers = this.handlers.get(message.type) || [];
    handlers.forEach(handler => handler(message.payload || {}));
  }

  /**
   * Registra un handler para un tipo de mensaje
   */
  on(messageType: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(messageType) || [];
    handlers.push(handler);
    this.handlers.set(messageType, handlers);
  }

  /**
   * Elimina un handler
   */
  off(messageType: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(messageType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.handlers.set(messageType, handlers);
    }
  }

  // =====================================================
  // Métodos específicos para cada tipo de mensaje
  // =====================================================

  /**
   * Notifica al padre que el enrollment fue exitoso
   * El padre debería mostrar un mensaje y/o cerrar el modal
   */
  notifyEnrollmentComplete(payload: EnrollmentCompletePayload): void {
    this.sendMessage('ENROLLMENT_COMPLETE', payload as unknown as Record<string, unknown>);
  }

  /**
   * Notifica al padre que la asistencia fue registrada
   */
  notifyAttendanceComplete(payload: AttendanceCompletePayload): void {
    this.sendMessage('ATTENDANCE_COMPLETE', payload as unknown as Record<string, unknown>);
  }

  /**
   * Notifica al padre que ocurrió un error
   */
  notifyError(payload: ErrorPayload): void {
    this.sendMessage('ERROR', payload as unknown as Record<string, unknown>);
  }

  /**
   * Solicita al padre cerrar el modal
   * Usado después de enrollment exitoso o cuando el usuario quiere salir
   */
  requestClose(reason?: string): void {
    this.sendMessage('REQUEST_CLOSE', { reason });
  }

  /**
   * Solicita al padre que recargue la página
   * Útil después de enrollment para re-verificar estado
   */
  requestReload(): void {
    this.sendMessage('REQUEST_RELOAD', {});
  }

  /**
   * Envía un ping para verificar comunicación
   */
  ping(): void {
    this.sendMessage('PING', { timestamp: Date.now() });
  }

  /**
   * Limpia los handlers y deja de escuchar
   */
  destroy(): void {
    window.removeEventListener('message', this.handleIncomingMessage.bind(this));
    this.handlers.clear();
  }
}

/**
 * Singleton para uso global
 */
let instance: ParentMessenger | null = null;

export function getParentMessenger(): ParentMessenger {
  if (!instance) {
    instance = new ParentMessenger();
  }
  return instance;
}
