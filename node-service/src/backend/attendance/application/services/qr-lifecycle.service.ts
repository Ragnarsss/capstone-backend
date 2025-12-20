/**
 * Servicio de ciclo de vida de QRs: generar, almacenar, proyectar y activar.
 * 
 * Implementa IQRLifecycleManager para permitir inyección en CompleteScanUseCase.
 * Responsabilidad completa: genera QR, lo almacena, lo proyecta Y actualiza el nonce activo.
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
import type { StudentEncryptionService } from './student-encryption.service';
import type { StudentStateService } from './student-state.service';

export class QRLifecycleService implements IQRLifecycleManager {
  constructor(
    private readonly qrGenerator: IQRGenerator,
    private readonly payloadRepo: IQRPayloadRepository,
    private readonly poolRepo: ProjectionPoolRepository = new ProjectionPoolRepository(),
    private readonly poolBalancer: IPoolBalancer | null = null,
    private readonly defaultHostUserId: number = 1,
    private readonly encryptionService?: StudentEncryptionService,
    private readonly studentStateService?: StudentStateService
  ) {}

  /**
   * Implementación de IQRLifecycleManager.generateAndPublish
   * Genera, publica y ACTIVA el siguiente QR para un estudiante.
   * Responsabilidad completa: el caller no necesita llamar setActiveQR() por separado.
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

    // Actualizar el nonce activo del estudiante para que la validación funcione
    if (this.studentStateService) {
      await this.studentStateService.setActiveQR(sessionId, studentId, payload.n);
      logger.debug(`[QRLifecycle] Nonce activo actualizado: ${payload.n.substring(0, 8)}...`);
    } else {
      logger.warn(`[QRLifecycle] Sin StudentStateService, nonce activo NO actualizado`);
    }

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

    // Generar payload (retorna plaintext y encrypted con mock key)
    const { payload, plaintext, encrypted: mockEncrypted } = this.qrGenerator.generateForStudent({
      sessionId,
      userId: studentId,
      round,
      hostUserId,
    });

    // Encriptar con session_key real del estudiante si está disponible
    let encrypted: string;
    if (this.encryptionService) {
      const result = await this.encryptionService.encryptForStudent(studentId, plaintext);
      encrypted = result.encrypted;
    } else {
      // Sin servicio de encriptación, usar mock encrypted
      encrypted = mockEncrypted;
      logger.warn(`[QRLifecycle] Sin StudentEncryptionService, usando mock key`);
    }

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
