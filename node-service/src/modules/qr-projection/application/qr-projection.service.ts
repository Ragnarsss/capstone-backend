import { QRGenerator } from '../domain/qr-generator';
import type { QRCode, CountdownState } from '../domain/models';
import { QRMetadataRepository } from '../infrastructure/qr-metadata.repository';
import { ProjectionQueueRepository } from '../infrastructure/projection-queue.repository';
import { config } from '../../../shared/config';

/**
 * Application Service para QR Projection
 * Responsabilidad: Orquestar casos de uso de proyección de QR
 */
export class QRProjectionService {
  private qrGenerator: QRGenerator;
  private metadataRepository: QRMetadataRepository;
  private queueRepository: ProjectionQueueRepository;

  constructor() {
    this.qrGenerator = new QRGenerator();
    this.metadataRepository = new QRMetadataRepository();
    this.queueRepository = new ProjectionQueueRepository();
  }

  async generateQRCode(sessionId: string): Promise<QRCode> {
    return await this.qrGenerator.generate(sessionId);
  }

  async createCountdownState(secondsRemaining: number): Promise<CountdownState> {
    return { secondsRemaining };
  }

  getCountdownDuration(): number {
    return config.qr.countdownSeconds;
  }

  getRegenerationInterval(): number {
    return config.qr.regenerationInterval;
  }

  generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
