import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';
import type { EnrollmentChallenge } from '../domain/models';

/**
 * Repository para Enrollment Challenges
 * Responsabilidad única: Persistencia de challenges de enrollment en Valkey
 */
export class EnrollmentChallengeRepository {
  private client = ValkeyClient.getInstance().getClient();

  async save(challenge: EnrollmentChallenge, ttlSeconds = 300): Promise<void> {
    const key = this.buildKey(challenge.userId);
    const data = {
      challenge: challenge.challenge,
      userId: challenge.userId.toString(),
      createdAt: challenge.createdAt.toString(),
      expiresAt: challenge.expiresAt.toString(),
    };

    await this.client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  }

  async findByUserId(userId: number): Promise<EnrollmentChallenge | null> {
    const key = this.buildKey(userId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);
    return {
      challenge: parsed.challenge,
      userId: parseInt(parsed.userId, 10),
      createdAt: parseInt(parsed.createdAt, 10),
      expiresAt: parseInt(parsed.expiresAt, 10),
    };
  }

  async delete(userId: number): Promise<void> {
    const key = this.buildKey(userId);
    await this.client.del(key);
  }

  private buildKey(userId: number): string {
    return `enrollment:challenge:${userId}`;
  }
}
