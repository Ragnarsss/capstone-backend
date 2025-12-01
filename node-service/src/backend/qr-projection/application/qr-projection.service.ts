import { QRGenerator } from '../domain/qr-generator';
import type { QRPayload, QRPayloadEnvelope, QRPayloadV1 } from '../domain/models';
import { QRMetadataRepository } from '../infrastructure/qr-metadata.repository';
import { ProjectionQueueRepository } from '../infrastructure/projection-queue.repository';
import { QRPayloadRepository } from '../infrastructure/qr-payload.repository';
import { ProjectionPoolRepository, type PoolEntry } from '../../attendance/infrastructure/projection-pool.repository';
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
  /** Cantidad de QRs falsos a agregar al pool */
  fakeQRCount?: number;
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
  private poolRepository: ProjectionPoolRepository;
  private readonly config: QRProjectionConfig;
  private activeIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config: QRProjectionConfig,
    metadataRepository: QRMetadataRepository,
    queueRepository: ProjectionQueueRepository,
    cryptoService?: CryptoService,
    payloadRepository?: QRPayloadRepository,
    poolRepository?: ProjectionPoolRepository
  ) {
    this.config = config;
    // Inyectar CryptoService al QRGenerator
    this.qrGenerator = new QRGenerator(cryptoService ?? new CryptoService());
    this.metadataRepository = metadataRepository;
    this.queueRepository = queueRepository;
    // Crear PayloadRepository con TTL configurado
    this.payloadRepository = payloadRepository ?? new QRPayloadRepository(config.payloadTTL ?? 30);
    this.poolRepository = poolRepository ?? new ProjectionPoolRepository();
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
    const sessionIdStr = sessionId.toString();
    
    // Agregar QRs falsos iniciales al pool si está configurado
    const fakeCount = this.config.fakeQRCount ?? 3;
    if (fakeCount > 0) {
      await this.poolRepository.addFakeQRs(sessionIdStr, fakeCount, () => 
        this.generateFakeQR(sessionId)
      );
    }

    console.log(`[QRProjectionService] Iniciando rotación de pool para sesión ${sessionIdStr.substring(0, 8)}...`);

    const interval = setInterval(async () => {
      if (callbacks.shouldStop()) {
        this.stopProjection(sessionId);
        return;
      }

      try {
        // Obtener siguiente entrada del pool (round-robin)
        const entry = await this.poolRepository.getNextEntry(sessionIdStr);
        
        if (!entry) {
          // Pool vacío - generar QR de espera
          const waitingEnvelope = this.createWaitingQREnvelope(sessionId);
          callbacks.onQRUpdate(waitingEnvelope);
          return;
        }

        // Crear envelope desde la entrada del pool
        const envelope = this.createEnvelopeFromPoolEntry(sessionId, entry);
        
        // Enviar al frontend
        callbacks.onQRUpdate(envelope);
      } catch (error) {
        console.error(`[QRProjectionService] Error en rotación para ${sessionIdStr}:`, error);
        this.stopProjection(sessionId);
      }
    }, this.config.regenerationInterval);

    this.activeIntervals.set(sessionIdStr, interval);
  }

  /**
   * Genera un QR falso encriptado con clave ALEATORIA
   * 
   * Los QRs falsos:
   * - Tienen formato válido (longitud, estructura base64)
   * - NO pueden ser desencriptados por NADIE
   * - La clave se descarta inmediatamente
   * 
   * Esto confunde a quienes intenten escanear QRs ajenos.
   */
  private generateFakeQR(sessionId: SessionId): string {
    const fakePayload: QRPayloadV1 = {
      v: 1,
      sid: sessionId.toString(),
      uid: 0, // ID 0 indica QR falso (irrelevante, no se puede descifrar)
      r: Math.ceil(Math.random() * 3), // Round aleatorio 1-3
      ts: Date.now(),
      n: this.qrGenerator.generateNonce(),
    };
    // Encriptar con clave aleatoria - nadie puede descifrar
    return this.qrGenerator.encryptPayloadWithRandomKey(fakePayload);
  }

  /**
   * Crea un envelope desde una entrada del pool
   */
  private createEnvelopeFromPoolEntry(sessionId: SessionId, entry: PoolEntry): QRPayloadEnvelope {
    // Nota: El payload real está encriptado, aquí creamos un "mock" para el envelope
    // El frontend solo usa payloadString para renderizar el QR
    const mockPayload: QRPayloadV1 = {
      v: 1,
      sid: sessionId.toString(),
      uid: entry.studentId,
      r: entry.round,
      ts: entry.createdAt,
      n: entry.id, // Usamos el ID como nonce para el mock
    };

    return {
      payload: mockPayload,
      payloadString: entry.encrypted,
      sessionId,
    };
  }

  /**
   * Crea un envelope de espera cuando no hay estudiantes registrados
   */
  private createWaitingQREnvelope(sessionId: SessionId): QRPayloadEnvelope {
    // Generar QR de "espera" que indica que no hay estudiantes
    const waitingPayload: QRPayloadV1 = {
      v: 1,
      sid: sessionId.toString(),
      uid: -1, // ID -1 indica "esperando estudiantes"
      r: 0,
      ts: Date.now(),
      n: 'waiting',
    };
    
    return {
      payload: waitingPayload,
      payloadString: this.qrGenerator.encryptPayload(waitingPayload),
      sessionId,
    };
  }

  /**
   * Obtiene estadísticas del pool de una sesión
   */
  async getPoolStats(sessionId: SessionId): Promise<{ total: number; students: number; fakes: number }> {
    return this.poolRepository.getPoolStats(sessionId.toString());
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
