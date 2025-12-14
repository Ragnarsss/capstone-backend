import type { ISessionQuery } from '../../domain/interfaces';
import type { SessionKeyRepository } from '../session-key.repository';

/**
 * Adapter para SessionQuery
 * Wrappea SessionKeyRepository para implementar ISessionQuery
 * Responsabilidad: Proporcionar interfaz read-only para Access Gateway
 */
export class SessionQueryAdapter implements ISessionQuery {
  constructor(private readonly sessionKeyRepository: SessionKeyRepository) {}

  async hasActiveSession(userId: number): Promise<boolean> {
    const sessionKey = await this.sessionKeyRepository.findByUserId(userId);
    return sessionKey !== null;
  }
}
