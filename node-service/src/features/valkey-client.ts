import Redis from 'ioredis';
import { config } from '../config';

// Slice vertical: cliente de Valkey (Redis compatible)
export class ValkeyClient {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: config.valkey.host,
      port: config.valkey.port,
      retryStrategy: (times) => {
        // Reintenta cada 2 segundos hasta 10 intentos
        if (times > 10) {
          console.error('[Valkey] Max reintentos alcanzado');
          return null;
        }
        return 2000;
      },
    });

    this.setupEventHandlers();
  }

  // Configura los event handlers del cliente
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('[Valkey] Conectado exitosamente');
    });

    this.client.on('error', (error) => {
      console.error('[Valkey] Error:', error);
    });

    this.client.on('close', () => {
      console.log('[Valkey] Conexion cerrada');
    });
  }

  // Guarda un QR generado con TTL
  async saveQR(sessionId: string, qrData: string, ttlSeconds = 300): Promise<void> {
    const key = `qr:${sessionId}`;
    await this.client.setex(key, ttlSeconds, qrData);
  }

  // Recupera un QR guardado
  async getQR(sessionId: string): Promise<string | null> {
    const key = `qr:${sessionId}`;
    return await this.client.get(key);
  }

  // Cierra la conexion
  async close(): Promise<void> {
    await this.client.quit();
  }

  // Retorna el cliente para operaciones custom
  getClient(): Redis {
    return this.client;
  }
}
