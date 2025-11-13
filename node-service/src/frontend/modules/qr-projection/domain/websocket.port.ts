/**
 * Port (interface) para WebSocket
 * Permite que la capa de aplicacion dependa de abstraccion en lugar de implementacion concreta
 */

export interface WebSocketPort {
  on(event: string, handler: (data: unknown) => void): void;
  send(message: unknown): void;
  connect(url: string, token: string): void;
  disconnect(): void;
}
