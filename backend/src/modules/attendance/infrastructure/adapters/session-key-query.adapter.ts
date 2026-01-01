import type { ISessionKeyQuery, SessionKeyData } from '../../../../shared/ports';
import { SessionKeyRepository } from '../../../session/infrastructure/repositories/session-key.repository';

/**
 * Adapter que implementa ISessionKeyQuery usando SessionKeyRepository
 *
 * Permite que stages del pipeline en attendance/domain/ accedan a session_key
 * sin acoplar directamente a session/infrastructure/
 */
export class SessionKeyQueryAdapter implements ISessionKeyQuery {
  constructor(private readonly repository: SessionKeyRepository) {}

  async findByUserId(userId: number): Promise<SessionKeyData | null> {
    return this.repository.findByUserId(userId);
  }
}
