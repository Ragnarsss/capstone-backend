import Redis from 'ioredis';
import { config } from '../../config';

/**
 * Cliente base de Valkey (Redis compatible)
 * Responsabilidad única: Gestión de conexión y operaciones básicas
 */
export class ValkeyClient {
  private client: Redis;
  private static instance: ValkeyClient;

  private constructor() {
    this.client = new Redis({
      host: config.valkey.host,
      port: config.valkey.port,
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('[Valkey] Max reintentos alcanzado');
          return null;
        }
        return 2000;
      },
    });

    this.setupEventHandlers();
  }

  static getInstance(): ValkeyClient {
    if (!ValkeyClient.instance) {
      ValkeyClient.instance = new ValkeyClient();
    }
    return ValkeyClient.instance;
  }

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

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
