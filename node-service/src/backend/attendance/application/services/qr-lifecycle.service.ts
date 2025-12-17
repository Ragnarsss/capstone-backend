/**
 * Servicio de ciclo de vida de QRs: generar, almacenar y proyectar.
 */
import type { IQRGenerator, IQRPayloadRepository, IPoolBalancer, StoredPayload } from '../../../../shared/ports';
import type { QRPayloadV1 } from '../../../../shared/types';
import { ProjectionPoolRepository } from '../../../../shared/infrastructure/valkey';

export class QRLifecycleService {
  constructor(
    private readonly qrGenerator: IQRGenerator,
    private readonly payloadRepo: IQRPayloadRepository,
    private readonly poolRepo: ProjectionPoolRepository = new ProjectionPoolRepository(),
    private readonly poolBalancer: IPoolBalancer | null = null
  ) {}

  async generateAndProject(options: {
    sessionId: string;
    studentId: number;
    round: number;
    hostUserId: number;
    ttl: number;
  }): Promise<{ payload: QRPayloadV1; encrypted: string }> {
    const { sessionId, studentId, round, hostUserId, ttl } = options;

    const { payload, encrypted } = this.qrGenerator.generateForStudent({
      sessionId,
      userId: studentId,
      round,
      hostUserId,
    });

    await this.payloadRepo.store(payload, encrypted, ttl);
    await this.poolRepo.upsertStudentQR(sessionId, studentId, encrypted, round);

    return { payload, encrypted };
  }

  async getStoredPayload(nonce: string): Promise<StoredPayload | null> {
    return this.payloadRepo.findByNonce(nonce);
  }

  async balancePool(sessionId: string): Promise<void> {
    if (!this.poolBalancer) return;
    await this.poolBalancer.balance(sessionId);
  }
}
