import Redis from 'ioredis';
import { config } from '../../config';
import { logger } from '../logger';

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
          logger.error('[Valkey] Max reintentos alcanzado');
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
      logger.info('[Valkey] Conectado exitosamente');
    });

    this.client.on('error', (error) => {
      logger.error('[Valkey] Error:', error);
    });

    this.client.on('close', () => {
      logger.info('[Valkey] Conexion cerrada');
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
