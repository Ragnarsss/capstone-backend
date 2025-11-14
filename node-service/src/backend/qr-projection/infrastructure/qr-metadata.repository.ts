import type { QRMetadata } from '../domain/models';
import { SessionId } from '../domain/session-id';
import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';

/**
 * Repository para QR Metadata
 * Responsabilidad única: Persistencia de metadatos de QR en Valkey
 */
export class QRMetadataRepository {
  private client = ValkeyClient.getInstance().getClient();

  async save(metadata: QRMetadata, ttlSeconds = 120): Promise<void> {
    const key = this.buildKey(metadata.sessionId.toString(), metadata.userId, metadata.ronda);
    const data = {
      userId: metadata.userId.toString(),
      sessionId: metadata.sessionId.toString(),
      ronda: metadata.ronda.toString(),
      timestampEnvio: metadata.timestampEnvio.toString(),
      mostradoCount: metadata.mostradoCount.toString(),
      intentosFallidos: metadata.intentosFallidos.toString(),
      valido: metadata.valido.toString(),
      payloadEncrypted: metadata.payloadEncrypted,
    };

    await this.client.hmset(key, data as any);
    await this.client.expire(key, ttlSeconds);
  }

  async findByKey(sessionId: string, userId: number, ronda: number): Promise<QRMetadata | null> {
    const key = this.buildKey(sessionId, userId, ronda);
    const exists = await this.client.exists(key);

    if (!exists) {
      return null;
    }

    const data = await this.client.hgetall(key);

    return {
      userId: parseInt(data.userId, 10),
      sessionId: SessionId.create(data.sessionId),
      ronda: parseInt(data.ronda, 10),
      timestampEnvio: parseInt(data.timestampEnvio, 10),
      mostradoCount: parseInt(data.mostradoCount, 10),
      intentosFallidos: parseInt(data.intentosFallidos, 10),
      valido: data.valido === 'true',
      payloadEncrypted: data.payloadEncrypted,
    };
  }

  async incrementDisplayCount(sessionId: string, userId: number, ronda: number): Promise<number> {
    const key = this.buildKey(sessionId, userId, ronda);
    return await this.client.hincrby(key, 'mostradoCount', 1);
  }

  async incrementFailedAttempts(sessionId: string, userId: number, ronda: number): Promise<number> {
    const key = this.buildKey(sessionId, userId, ronda);
    return await this.client.hincrby(key, 'intentosFallidos', 1);
  }

  async markAsInvalid(sessionId: string, userId: number, ronda: number): Promise<void> {
    const key = this.buildKey(sessionId, userId, ronda);
    await this.client.hset(key, 'valido', 'false');
  }

  async delete(sessionId: string, userId: number, ronda: number): Promise<void> {
    const key = this.buildKey(sessionId, userId, ronda);
    await this.client.del(key);
  }

  private buildKey(sessionId: string, userId: number, ronda: number): string {
    return `qr:${sessionId}:${userId}:${ronda}`;
  }
}
