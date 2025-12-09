import type { QRPayloadEnvelope } from '../domain/models';
import { QRPayloadRepository } from '../infrastructure/qr-payload.repository';
import { SessionId } from '../domain/session-id';
import { PoolBalancer } from './services/pool-balancer.service';
import { QREmitter } from './services/qr-emitter.service';
import { logger } from '../../../shared/infrastructure/logger';

/**
 * Configuracion requerida por QRProjectionService
 */
export interface QRProjectionConfig {
  /** Segundos de countdown antes de iniciar proyeccion */
  countdownSeconds: number;
  /** Intervalo de regeneracion/emision en ms */
  regenerationInterval: number;
  /** TTL de payloads en Valkey (segundos). Default: 60 */
  payloadTTL?: number;
  /** Tamano minimo del pool (incluyendo fakes). Default: 10 */
  minPoolSize?: number;
}

/**
 * Contexto de proyeccion - informacion del usuario autenticado
 */
export interface ProjectionContext {
  userId: number;
  username: string;
}

/**
 * Callbacks para eventos de proyeccion
 */
export interface ProjectionCallbacks {
  onCountdown(seconds: number): Promise<void>;
  onQRUpdate(envelope: QRPayloadEnvelope): Promise<void>;
  shouldStop(): boolean;
}

/**
 * QRProjectionService - Application Service (Orquestador)
 * 
 * Responsabilidad: Orquestar el ciclo de vida de una proyeccion QR
 * 
 * Delega a servicios especializados:
 * - PoolBalancer: Mantiene el pool con QRs falsos
 * - QREmitter: Emite QRs del pool a intervalos regulares
 * 
 * Este servicio maneja:
 * - Fase de countdown
 * - Inicio/parada de proyeccion
 * - Coordinacion entre servicios
 * 
 * Este servicio NO maneja:
 * - Generacion de QRs de estudiantes (PoolFeeder via ParticipationService)
 * - Logica de balanceo de fakes (PoolBalancer)
 * - Logica de emision (QREmitter)
 */
export class QRProjectionService {
  private readonly config: QRProjectionConfig;
  private readonly payloadRepository: QRPayloadRepository;
  private readonly poolBalancer: PoolBalancer;
  private readonly qrEmitter: QREmitter;

  constructor(
    config: QRProjectionConfig,
    poolBalancer?: PoolBalancer,
    qrEmitter?: QREmitter,
    payloadRepository?: QRPayloadRepository
  ) {
    this.config = config;
    this.payloadRepository = payloadRepository ?? new QRPayloadRepository(config.payloadTTL ?? 60);
    
    // Inicializar servicios con configuracion
    this.poolBalancer = poolBalancer ?? new PoolBalancer(undefined, undefined, {
      minPoolSize: config.minPoolSize ?? 10,
    });
    
    this.qrEmitter = qrEmitter ?? new QREmitter(undefined, {
      intervalMs: config.regenerationInterval,
    });
  }

  /**
   * Genera un nuevo SessionId
   */
  generateSessionId(): SessionId {
    return SessionId.generate();
  }

  /**
   * Inicia una proyeccion completa: countdown + emision de QRs
   * 
   * @param sessionId - ID de sesion generado
   * @param callbacks - Callbacks para eventos
   * @param context - Contexto con informacion del usuario (opcional)
   */
  async startProjection(
    sessionId: SessionId,
    callbacks: ProjectionCallbacks,
    context?: ProjectionContext
  ): Promise<void> {
    const sessionIdStr = sessionId.toString();

    // Fase 1: Countdown
    await this.runCountdownPhase(sessionId, callbacks);

    // Verificar si debemos continuar despues del countdown
    if (callbacks.shouldStop()) {
      return;
    }

    // Fase 2: Balancear pool inicial con fakes
    await this.poolBalancer.balance(sessionIdStr);

    // Fase 3: Iniciar emision de QRs
    logger.debug(`[QRProjectionService] Iniciando proyeccion para sesion ${sessionIdStr.substring(0, 8)}...`);
    
    this.qrEmitter.start(
      sessionIdStr,
      callbacks.onQRUpdate,
      callbacks.shouldStop
    );
  }

  /**
   * Detiene la proyeccion para una sesion
   */
  stopProjection(sessionId: SessionId): void {
    const sessionIdStr = sessionId.toString();
    
    if (this.qrEmitter.stop(sessionIdStr)) {
      logger.debug(`[QRProjectionService] Proyeccion detenida para ${sessionIdStr.substring(0, 8)}...`);
    }
  }

  /**
   * Ejecuta la fase de countdown
   */
  private async runCountdownPhase(
    sessionId: SessionId,
    callbacks: ProjectionCallbacks
  ): Promise<void> {
    const duration = this.config.countdownSeconds;

    for (let i = duration; i > 0; i--) {
      if (callbacks.shouldStop()) {
        logger.debug(`[QRProjectionService] Countdown cancelado para ${sessionId.toString()}`);
        return;
      }

      try {
        await callbacks.onCountdown(i);
      } catch (error) {
        logger.error(`[QRProjectionService] Error en countdown para ${sessionId.toString()}:`, error);
        return;
      }

      await this.sleep(1000);
    }
  }

  /**
   * Obtiene estadisticas del pool de una sesion
   */
  async getPoolStats(sessionId: SessionId): Promise<{ total: number; students: number; fakes: number }> {
    return this.poolBalancer.getPoolStats(sessionId.toString());
  }

  /**
   * Balancea el pool de una sesion (agrega/quita fakes segun necesidad)
   */
  async balancePool(sessionId: SessionId): Promise<{ added: number; removed: number; total: number }> {
    const result = await this.poolBalancer.balance(sessionId.toString());
    return {
      added: result.added,
      removed: result.removed,
      total: result.total,
    };
  }

  /**
   * Valida un payload escaneado
   * @param payload - Payload V1 desencriptado
   * @returns Resultado de validacion
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

  /**
   * Verifica si hay una emision activa para una sesion
   */
  isProjectionActive(sessionId: SessionId): boolean {
    return this.qrEmitter.isEmitting(sessionId.toString());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
