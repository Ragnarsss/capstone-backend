/**
 * Servicio de ciclo de vida de QRs: generar, almacenar y proyectar.
 * 
 * Implementa IQRLifecycleManager para permitir inyección en CompleteScanUseCase.
 */
import type { 
  IQRGenerator, 
  IQRPayloadRepository, 
  IPoolBalancer, 
  StoredPayload,
  IQRLifecycleManager,
  NextQROptions,
  NextQRResult
} from '../../../../shared/ports';
import type { QRPayloadV1 } from '../../../../shared/types';
import { ProjectionPoolRepository } from '../../../../shared/infrastructure/valkey';
import { logger } from '../../../../shared/infrastructure/logger';

export class QRLifecycleService implements IQRLifecycleManager {
  constructor(
    private readonly qrGenerator: IQRGenerator,
    private readonly payloadRepo: IQRPayloadRepository,
    private readonly poolRepo: ProjectionPoolRepository = new ProjectionPoolRepository(),
    private readonly poolBalancer: IPoolBalancer | null = null,
    private readonly defaultHostUserId: number = 1
  ) {}

  /**
   * Implementación de IQRLifecycleManager.generateAndPublish
   * Genera y publica el siguiente QR para un estudiante
   */
  async generateAndPublish(options: NextQROptions): Promise<NextQRResult> {
    const { sessionId, studentId, round, qrTTL } = options;

    logger.debug(`[QRLifecycle] Generando QR para student=${studentId}, session=${sessionId}, round=${round}`);

    const { payload, encrypted } = await this.generateAndProject({
      sessionId,
      studentId,
      round,
      hostUserId: this.defaultHostUserId,
      ttl: qrTTL,
    });

    logger.debug(`[QRLifecycle] QR publicado: nonce=${payload.n.substring(0, 8)}...`);

    return {
      encrypted,
      nonce: payload.n,
      round,
      qrTTL,
    };
  }

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
