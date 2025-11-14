import { QRGenerator } from '../domain/qr-generator';
import type { QRPayload } from '../domain/models';
import { QRMetadataRepository } from '../infrastructure/qr-metadata.repository';
import { ProjectionQueueRepository } from '../infrastructure/projection-queue.repository';
import { SessionId } from '../domain/session-id';

/**
 * Configuración requerida por QRProjectionService
 */
export interface QRProjectionConfig {
  countdownSeconds: number;
  regenerationInterval: number;
}

/**
 * Callbacks para eventos de proyección
 */
export interface ProjectionCallbacks {
  onCountdown(seconds: number): Promise<void>;
  onQRUpdate(payload: QRPayload): Promise<void>;
  shouldStop(): boolean;
}

/**
 * Application Service para QR Projection
 * Responsabilidad: Orquestar casos de uso de proyección de QR
 * 
 * Nota: Este servicio genera solo el payload/mensaje del QR.
 * El renderizado visual se realiza en el frontend.
 */
export class QRProjectionService {
  private qrGenerator: QRGenerator;
  private metadataRepository: QRMetadataRepository;
  private queueRepository: ProjectionQueueRepository;
  private readonly config: QRProjectionConfig;
  private activeIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config: QRProjectionConfig,
    metadataRepository: QRMetadataRepository,
    queueRepository: ProjectionQueueRepository
  ) {
    this.config = config;
    this.qrGenerator = new QRGenerator();
    this.metadataRepository = metadataRepository;
    this.queueRepository = queueRepository;
  }

  generateSessionId(): SessionId {
    return SessionId.generate();
  }

  /**
   * Inicia una proyección completa: countdown + rotación de QR
   */
  async startProjection(sessionId: SessionId, callbacks: ProjectionCallbacks): Promise<void> {
    // Fase 1: Countdown
    await this.runCountdownPhase(sessionId, callbacks);

    // Verificar si debemos continuar después del countdown
    if (callbacks.shouldStop()) {
      return;
    }

    // Fase 2: Rotación de QR
    await this.startQRRotation(sessionId, callbacks);
  }

  /**
   * Detiene la rotación de QR para una sesión
   */
  stopProjection(sessionId: SessionId): void {
    const key = sessionId.toString();
    const interval = this.activeIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.activeIntervals.delete(key);
      console.log(`[QRProjectionService] Rotación detenida para ${key}`);
    }
  }

  private async runCountdownPhase(
    sessionId: SessionId,
    callbacks: ProjectionCallbacks
  ): Promise<void> {
    const duration = this.config.countdownSeconds;

    for (let i = duration; i > 0; i--) {
      if (callbacks.shouldStop()) {
        console.log(`[QRProjectionService] Countdown cancelado para ${sessionId.toString()}`);
        return;
      }

      try {
        await callbacks.onCountdown(i);
      } catch (error) {
        console.error(`[QRProjectionService] Error en countdown para ${sessionId.toString()}:`, error);
        return;
      }

      await this.sleep(1000);
    }
  }

  private async startQRRotation(
    sessionId: SessionId,
    callbacks: ProjectionCallbacks
  ): Promise<void> {
    const interval = setInterval(() => {
      if (callbacks.shouldStop()) {
        this.stopProjection(sessionId);
        return;
      }

      try {
        const qrPayload = this.qrGenerator.generate(sessionId);
        callbacks.onQRUpdate(qrPayload);
      } catch (error) {
        console.error(`[QRProjectionService] Error generando payload QR para ${sessionId.toString()}:`, error);
        this.stopProjection(sessionId);
      }
    }, this.config.regenerationInterval);

    this.activeIntervals.set(sessionId.toString(), interval);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
