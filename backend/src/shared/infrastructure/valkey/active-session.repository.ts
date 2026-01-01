import { ValkeyClient } from './valkey-client';
import { logger } from '../logger';

/**
 * Información de la sesión activa
 */
export interface ActiveSessionInfo {
  /** ID de la sesión */
  sessionId: string;
  /** ID del host (profesor) */
  hostUserId: number;
  /** Nombre del host */
  hostUsername: string;
  /** Timestamp de inicio */
  startedAt: number;
}

/**
 * Repository para la sesión activa global
 * 
 * Responsabilidad: Rastrear qué sesión de QR está activa actualmente.
 * Solo puede haber UNA sesión activa a la vez (simplificación para MVP).
 * 
 * NOTA: Este repositorio es COMPARTIDO entre módulos:
 * - qr-projection: WebSocketController registra/limpia la sesión activa
 * - attendance: Rutas de validación consultan la sesión activa
 * 
 * Por eso vive en shared/infrastructure/valkey/
 * 
 * Clave en Valkey:
 * - active:session → ActiveSessionInfo (con TTL)
 */
export class ActiveSessionRepository {
  private client = ValkeyClient.getInstance().getClient();
  
  /** Clave única para la sesión activa */
  private static readonly ACTIVE_KEY = 'active:session';
  
  /** TTL de la sesión (2 horas) */
  private readonly sessionTTL = 7200;

  /**
   * Registra una sesión como activa
   * Reemplaza cualquier sesión anterior
   */
  async setActiveSession(info: ActiveSessionInfo): Promise<void> {
    await this.client.setex(
      ActiveSessionRepository.ACTIVE_KEY,
      this.sessionTTL,
      JSON.stringify(info)
    );
    
    logger.info(`[ActiveSession] Sesión activa: ${info.sessionId.substring(0, 16)}... por ${info.hostUsername}`);
  }

  /**
   * Obtiene la sesión activa actual
   * @returns La sesión activa o null si no hay ninguna
   */
  async getActiveSession(): Promise<ActiveSessionInfo | null> {
    const data = await this.client.get(ActiveSessionRepository.ACTIVE_KEY);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as ActiveSessionInfo;
    } catch (error) {
      logger.error('[ActiveSession] Error parsing session:', error);
      return null;
    }
  }

  /**
   * Limpia la sesión activa (cuando el host desconecta)
   * Solo limpia si coincide el sessionId
   */
  async clearActiveSession(sessionId: string): Promise<boolean> {
    const current = await this.getActiveSession();
    
    if (!current || current.sessionId !== sessionId) {
      return false;
    }

    await this.client.del(ActiveSessionRepository.ACTIVE_KEY);
    logger.info(`[ActiveSession] Sesión terminada: ${sessionId.substring(0, 16)}...`);
    return true;
  }

  /**
   * Extiende el TTL de la sesión activa
   * (llamar periódicamente mientras haya actividad)
   */
  async refreshTTL(): Promise<boolean> {
    const result = await this.client.expire(
      ActiveSessionRepository.ACTIVE_KEY,
      this.sessionTTL
    );
    return result === 1;
  }
}
