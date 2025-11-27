import { QRGenerator } from '../domain/qr-generator';
import type { QRPayload, QRPayloadEnvelope } from '../domain/models';
import { QRMetadataRepository } from '../infrastructure/qr-metadata.repository';
import { ProjectionQueueRepository } from '../infrastructure/projection-queue.repository';
import { QRPayloadRepository } from '../infrastructure/qr-payload.repository';
import { SessionId } from '../domain/session-id';
import { CryptoService } from '../../../shared/infrastructure/crypto';

/**
 * Configuración requerida por QRProjectionService
 */
export interface QRProjectionConfig {
  countdownSeconds: number;
  regenerationInterval: number;
  /** TTL de payloads en Valkey (segundos). Default: 30 */
  payloadTTL?: number;
}

/**
 * Contexto de proyección - información del usuario autenticado
 */
export interface ProjectionContext {
  userId: number;
  username: string;
}

/**
 * Callbacks para eventos de proyección (V1)
 */
export interface ProjectionCallbacks {
  onCountdown(seconds: number): Promise<void>;
  onQRUpdate(envelope: QRPayloadEnvelope): Promise<void>;
  shouldStop(): boolean;
}

/**
 * @deprecated Usar ProjectionCallbacks con QRPayloadEnvelope
 */
export interface ProjectionCallbacksLegacy {
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
  private payloadRepository: QRPayloadRepository;
  private readonly config: QRProjectionConfig;
  private activeIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config: QRProjectionConfig,
    metadataRepository: QRMetadataRepository,
    queueRepository: ProjectionQueueRepository,
    cryptoService?: CryptoService,
    payloadRepository?: QRPayloadRepository
  ) {
    this.config = config;
    // Inyectar CryptoService al QRGenerator
    this.qrGenerator = new QRGenerator(cryptoService ?? new CryptoService());
    this.metadataRepository = metadataRepository;
    this.queueRepository = queueRepository;
    // Crear PayloadRepository con TTL configurado
    this.payloadRepository = payloadRepository ?? new QRPayloadRepository(config.payloadTTL ?? 30);
  }

  generateSessionId(): SessionId {
    return SessionId.generate();
  }

  /**
   * Inicia una proyección completa: countdown + rotación de QR (V1)
   * @param sessionId - ID de sesión generado
   * @param context - Contexto con información del usuario
   * @param callbacks - Callbacks para eventos
   */
  async startProjection(
    sessionId: SessionId, 
    callbacks: ProjectionCallbacks,
    context?: ProjectionContext
  ): Promise<void> {
    // Fase 1: Countdown
    await this.runCountdownPhase(sessionId, callbacks);

    // Verificar si debemos continuar después del countdown
    if (callbacks.shouldStop()) {
      return;
    }

    // Fase 2: Rotación de QR
    await this.startQRRotation(sessionId, callbacks, context);
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
      // Limpiar contador de rondas
      this.qrGenerator.resetRoundCounter(sessionId);
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
    callbacks: ProjectionCallbacks,
    context?: ProjectionContext
  ): Promise<void> {
    // Usar userId del contexto o 0 como fallback (desarrollo)
    const userId = context?.userId ?? 0;

    const interval = setInterval(async () => {
      if (callbacks.shouldStop()) {
        this.stopProjection(sessionId);
        return;
      }

      try {
        // Generar nuevo payload V1 encriptado
        const envelope = this.qrGenerator.generateV1(sessionId, userId);
        
        // Almacenar en Valkey para validación posterior
        await this.payloadRepository.store(
          envelope.payload,
          envelope.payloadString,
          this.config.payloadTTL
        );
        
        // Enviar al frontend
        callbacks.onQRUpdate(envelope);
      } catch (error) {
        console.error(`[QRProjectionService] Error generando payload QR para ${sessionId.toString()}:`, error);
        this.stopProjection(sessionId);
      }
    }, this.config.regenerationInterval);

    this.activeIntervals.set(sessionId.toString(), interval);
  }

  /**
   * Valida un payload escaneado
   * @param payload - Payload V1 desencriptado
   * @returns Resultado de validación
   */
  async validatePayload(payload: import('../domain/models').QRPayloadV1): Promise<{ valid: boolean; reason?: string }> {
    return this.payloadRepository.validate(payload);
  }

  /**
   * Marca un payload como consumido (escaneado exitosamente)
   * @param nonce - Nonce del payload
   * @param studentId - ID del estudiante que escaneo
   * @returns true si se marco exitosamente
   */
  async consumePayload(nonce: string, studentId: number): Promise<boolean> {
    return this.payloadRepository.markAsConsumed(nonce, studentId);
  }

  /**
   * Obtiene el repositorio de payloads (para testing/debug)
   */
  getPayloadRepository(): QRPayloadRepository {
    return this.payloadRepository;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
