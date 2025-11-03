import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';

/**
 * Repository para Projection Queue
 * Responsabilidad única: Gestión de cola de proyección en Valkey
 */
export class ProjectionQueueRepository {
  private client = ValkeyClient.getInstance().getClient();

  async addPayload(sessionId: string, payloadEncrypted: string): Promise<void> {
    const key = this.buildKey(sessionId);
    await this.client.lpush(key, payloadEncrypted);
    await this.client.expire(key, 7200); // 2 horas
  }

  async getAll(sessionId: string): Promise<string[]> {
    const key = this.buildKey(sessionId);
    return await this.client.lrange(key, 0, -1);
  }

  async removePayload(sessionId: string, payloadEncrypted: string): Promise<void> {
    const key = this.buildKey(sessionId);
    await this.client.lrem(key, 1, payloadEncrypted);
  }

  async clear(sessionId: string): Promise<void> {
    const key = this.buildKey(sessionId);
    await this.client.del(key);
  }

  private buildKey(sessionId: string): string {
    return `proyeccion:${sessionId}`;
  }
}
