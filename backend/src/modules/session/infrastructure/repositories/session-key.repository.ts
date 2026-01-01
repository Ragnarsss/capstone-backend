import { ValkeyClient } from '../../../../shared/infrastructure/valkey/valkey-client';
import type { SessionKey } from '../../domain/models';

/**
 * Repository para Session Keys
 * Responsabilidad única: Persistencia de session keys en Valkey
 */
export class SessionKeyRepository {
  private client = ValkeyClient.getInstance().getClient();

  async save(sessionKey: SessionKey, ttlSeconds = 7200): Promise<void> {
    const key = this.buildKey(sessionKey.userId);
    const data = {
      sessionKey: sessionKey.sessionKey.toString('base64'),
      userId: sessionKey.userId.toString(),
      deviceId: sessionKey.deviceId.toString(),
      credentialId: sessionKey.credentialId,
      createdAt: sessionKey.createdAt.toString(),
    };

    await this.client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  }

  async findByUserId(userId: number): Promise<SessionKey | null> {
    const key = this.buildKey(userId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);
    return {
      sessionKey: Buffer.from(parsed.sessionKey, 'base64'),
      userId: parseInt(parsed.userId, 10),
      deviceId: parseInt(parsed.deviceId, 10),
      credentialId: parsed.credentialId || '',
      createdAt: parseInt(parsed.createdAt, 10),
    };
  }

  async delete(userId: number): Promise<void> {
    const key = this.buildKey(userId);
    await this.client.del(key);
  }

  private buildKey(userId: number): string {
    return `session:${userId}:key`;
  }
}
