import { ProjectionPoolRepository, type PoolEntry } from '../../../../shared/infrastructure/valkey';
import type { QRPayloadV1, QRPayloadEnvelope } from '../../domain/models';
import { SessionId } from '../../domain/session-id';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * Callback para emision de QR
 */
export type EmitCallback = (envelope: QRPayloadEnvelope) => Promise<void>;

/**
 * Callback para verificar si debe detenerse
 */
export type ShouldStopCallback = () => boolean;

/**
 * Configuracion del QREmitter
 */
export interface QREmitterConfig {
  /** Intervalo de emision en ms. Default: 333 (3 QRs/seg) */
  readonly intervalMs: number;
}

/**
 * Estado de una sesion de emision
 */
interface EmissionState {
  readonly sessionId: string;
  readonly interval: NodeJS.Timeout;
  readonly startedAt: number;
}

const DEFAULT_CONFIG: QREmitterConfig = {
  intervalMs: 333, // ~3 QRs por segundo
};

/**
 * QREmitter - Application Service
 * 
 * Responsabilidad UNICA: Emitir QRs del pool a intervalos regulares
 * 
 * Flujo:
 * 1. Lee la siguiente entrada del pool (round-robin)
 * 2. Convierte a QRPayloadEnvelope
 * 3. Invoca el callback de emision
 * 4. Repite cada intervalMs
 * 
 * Caracteristicas:
 * - Maneja multiples sesiones simultaneas
 * - Round-robin automatico via ProjectionPoolRepository
 * - Genera QR de espera si pool vacio
 * - Limpieza automatica al detener
 * 
 * Este servicio NO maneja:
 * - Generacion de QRs (responsabilidad de PoolFeeder)
 * - Balanceo de fakes (responsabilidad de PoolBalancer)
 * - Protocolo WebSocket (responsabilidad de WebSocketController)
 */
export class QREmitter {
  private readonly poolRepo: ProjectionPoolRepository;
  private readonly config: QREmitterConfig;
  private readonly activeEmissions: Map<string, EmissionState> = new Map();

  constructor(
    poolRepo?: ProjectionPoolRepository,
    config?: Partial<QREmitterConfig>
  ) {
    this.poolRepo = poolRepo ?? new ProjectionPoolRepository();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Inicia la emision de QRs para una sesion
   * 
   * @param sessionId - ID de la sesion
   * @param onEmit - Callback invocado con cada QR
   * @param shouldStop - Callback para verificar si debe detenerse
   */
  start(
    sessionId: string | SessionId,
    onEmit: EmitCallback,
    shouldStop: ShouldStopCallback
  ): void {
    const sessionIdStr = sessionId.toString();

    // Detener emision anterior si existe
    if (this.activeEmissions.has(sessionIdStr)) {
      this.stop(sessionIdStr);
    }

    logger.debug(
      `[QREmitter] Starting emission for session=${sessionIdStr.substring(0, 8)}... ` +
      `interval=${this.config.intervalMs}ms`
    );

    const interval = setInterval(async () => {
      // Verificar si debe detenerse
      if (shouldStop()) {
        this.stop(sessionIdStr);
        return;
      }

      try {
        await this.emitNext(sessionIdStr, onEmit);
      } catch (error) {
        logger.error(`[QREmitter] Error emitting for session=${sessionIdStr.substring(0, 8)}:`, error);
        this.stop(sessionIdStr);
      }
    }, this.config.intervalMs);

    this.activeEmissions.set(sessionIdStr, {
      sessionId: sessionIdStr,
      interval,
      startedAt: Date.now(),
    });
  }

  /**
   * Detiene la emision para una sesion
   * 
   * @param sessionId - ID de la sesion
   * @returns true si habia una emision activa
   */
  stop(sessionId: string | SessionId): boolean {
    const sessionIdStr = sessionId.toString();
    const state = this.activeEmissions.get(sessionIdStr);

    if (!state) {
      return false;
    }

    clearInterval(state.interval);
    this.activeEmissions.delete(sessionIdStr);

    const duration = Date.now() - state.startedAt;
    logger.debug(
      `[QREmitter] Stopped emission for session=${sessionIdStr.substring(0, 8)}... ` +
      `duration=${Math.round(duration / 1000)}s`
    );

    return true;
  }

  /**
   * Detiene todas las emisiones activas
   */
  stopAll(): void {
    for (const sessionId of this.activeEmissions.keys()) {
      this.stop(sessionId);
    }
  }

  /**
   * Verifica si hay una emision activa para una sesion
   * 
   * @param sessionId - ID de la sesion
   */
  isEmitting(sessionId: string | SessionId): boolean {
    return this.activeEmissions.has(sessionId.toString());
  }

  /**
   * Obtiene las sesiones con emisiones activas
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeEmissions.keys());
  }

  /**
   * Emite el siguiente QR del pool
   */
  private async emitNext(sessionId: string, onEmit: EmitCallback): Promise<void> {
    // Obtener siguiente entrada del pool (round-robin)
    const entry = await this.poolRepo.getNextEntry(sessionId);

    if (!entry) {
      // Pool vacio - emitir QR de espera
      const waitingEnvelope = this.createWaitingEnvelope(sessionId);
      await onEmit(waitingEnvelope);
      return;
    }

    // Crear envelope desde la entrada del pool
    const envelope = this.createEnvelopeFromEntry(sessionId, entry);
    await onEmit(envelope);
  }

  /**
   * Crea un envelope desde una entrada del pool
   */
  private createEnvelopeFromEntry(sessionId: string, entry: PoolEntry): QRPayloadEnvelope {
    // El payload real esta encriptado, creamos metadata para el envelope
    const payload: QRPayloadV1 = {
      v: 1,
      sid: sessionId,
      uid: entry.studentId,
      r: entry.round,
      ts: entry.createdAt,
      n: entry.id,
    };

    return {
      payload,
      payloadString: entry.encrypted,
      sessionId: SessionId.create(sessionId),
    };
  }

  /**
   * Crea un envelope de espera cuando el pool esta vacio
   */
  private createWaitingEnvelope(sessionId: string): QRPayloadEnvelope {
    const payload: QRPayloadV1 = {
      v: 1,
      sid: sessionId,
      uid: -1, // -1 indica "esperando estudiantes"
      r: 0,
      ts: Date.now(),
      n: 'waiting',
    };

    // Para el QR de espera, usamos el payload serializado sin encriptar
    // (o podriamos encriptarlo, pero no es necesario para "waiting")
    const payloadString = JSON.stringify(payload);

    return {
      payload,
      payloadString,
      sessionId: SessionId.create(sessionId),
    };
  }

  /**
   * Obtiene la configuracion actual
   */
  getConfig(): QREmitterConfig {
    return { ...this.config };
  }
}
