import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';
import { logger } from '../../../shared/infrastructure/logger';

/**
 * Tipos de intento fraudulento detectado
 */
export type FraudType = 
  | 'DECRYPT_FAILED'      // QR no se pudo desencriptar (probablemente falso o ajeno)
  | 'INVALID_FORMAT'      // Formato de payload invalido
  | 'QR_NOT_FOUND'        // QR no existe en el sistema
  | 'QR_EXPIRED'          // QR expirado
  | 'QR_ALREADY_USED'     // QR ya fue consumido
  | 'WRONG_OWNER'         // QR de otro estudiante
  | 'ROUND_MISMATCH';     // Round incorrecto

/**
 * Registro de intento fraudulento
 */
export interface FraudAttempt {
  type: FraudType;
  studentId: number;
  timestamp: number;
  /** Primeros 20 chars del payload para debug */
  payloadPreview: string;
}

/**
 * Estadisticas de fraude por sesion
 */
export interface FraudStats {
  /** Total de intentos fraudulentos */
  total: number;
  /** Desglose por tipo */
  byType: Record<FraudType, number>;
  /** Ultimos N intentos */
  recentAttempts: FraudAttempt[];
}

/**
 * Repository para metricas de intentos fraudulentos
 * 
 * Almacena en Valkey:
 * - fraud:count:{sessionId}:{type} → contador por tipo
 * - fraud:attempts:{sessionId} → lista de ultimos intentos (max 100)
 * - fraud:students:{sessionId} → set de estudiantes con intentos
 */
export class FraudMetricsRepository {
  private client = ValkeyClient.getInstance().getClient();
  
  /** TTL de metricas (4 horas) */
  private readonly metricsTTL = 14400;
  /** Maximo de intentos recientes a guardar */
  private readonly maxRecentAttempts = 100;

  private static readonly COUNT_PREFIX = 'fraud:count:';
  private static readonly ATTEMPTS_PREFIX = 'fraud:attempts:';
  private static readonly STUDENTS_PREFIX = 'fraud:students:';

  /**
   * Registra un intento fraudulento
   */
  async recordAttempt(
    sessionId: string,
    type: FraudType,
    studentId: number,
    encryptedPayload: string
  ): Promise<void> {
    const attempt: FraudAttempt = {
      type,
      studentId,
      timestamp: Date.now(),
      payloadPreview: encryptedPayload.substring(0, 20) + '...',
    };

    // Incrementar contador por tipo
    const countKey = this.buildCountKey(sessionId, type);
    await this.client.incr(countKey);
    await this.client.expire(countKey, this.metricsTTL);

    // Agregar a lista de intentos recientes
    const attemptsKey = this.buildAttemptsKey(sessionId);
    await this.client.lpush(attemptsKey, JSON.stringify(attempt));
    await this.client.ltrim(attemptsKey, 0, this.maxRecentAttempts - 1);
    await this.client.expire(attemptsKey, this.metricsTTL);

    // Agregar estudiante al set de sospechosos
    const studentsKey = this.buildStudentsKey(sessionId);
    await this.client.sadd(studentsKey, String(studentId));
    await this.client.expire(studentsKey, this.metricsTTL);

    logger.debug(`[FraudMetrics] Recorded ${type} for student=${studentId} session=${sessionId.substring(0, 8)}...`);
  }

  /**
   * Obtiene estadisticas de fraude para una sesion
   */
  async getStats(sessionId: string): Promise<FraudStats> {
    const types: FraudType[] = [
      'DECRYPT_FAILED',
      'INVALID_FORMAT',
      'QR_NOT_FOUND',
      'QR_EXPIRED',
      'QR_ALREADY_USED',
      'WRONG_OWNER',
      'ROUND_MISMATCH',
    ];

    // Obtener contadores por tipo
    const byType: Record<FraudType, number> = {} as Record<FraudType, number>;
    let total = 0;

    for (const type of types) {
      const countKey = this.buildCountKey(sessionId, type);
      const count = parseInt(await this.client.get(countKey) || '0', 10);
      byType[type] = count;
      total += count;
    }

    // Obtener intentos recientes
    const attemptsKey = this.buildAttemptsKey(sessionId);
    const rawAttempts = await this.client.lrange(attemptsKey, 0, 9); // Ultimos 10
    const recentAttempts = rawAttempts.map(raw => {
      try {
        return JSON.parse(raw) as FraudAttempt;
      } catch {
        return null;
      }
    }).filter((a): a is FraudAttempt => a !== null);

    return {
      total,
      byType,
      recentAttempts,
    };
  }

  /**
   * Obtiene lista de estudiantes con intentos sospechosos
   */
  async getSuspiciousStudents(sessionId: string): Promise<number[]> {
    const studentsKey = this.buildStudentsKey(sessionId);
    const members = await this.client.smembers(studentsKey);
    return members.map(m => parseInt(m, 10));
  }

  /**
   * Obtiene el conteo de intentos de un tipo especifico
   */
  async getCountByType(sessionId: string, type: FraudType): Promise<number> {
    const countKey = this.buildCountKey(sessionId, type);
    return parseInt(await this.client.get(countKey) || '0', 10);
  }

  /**
   * Limpia las metricas de una sesion
   */
  async clearSession(sessionId: string): Promise<void> {
    const types: FraudType[] = [
      'DECRYPT_FAILED',
      'INVALID_FORMAT',
      'QR_NOT_FOUND',
      'QR_EXPIRED',
      'QR_ALREADY_USED',
      'WRONG_OWNER',
      'ROUND_MISMATCH',
    ];

    const keys = types.map(t => this.buildCountKey(sessionId, t));
    keys.push(this.buildAttemptsKey(sessionId));
    keys.push(this.buildStudentsKey(sessionId));

    await this.client.del(...keys);
  }

  private buildCountKey(sessionId: string, type: FraudType): string {
    return `${FraudMetricsRepository.COUNT_PREFIX}${sessionId}:${type}`;
  }

  private buildAttemptsKey(sessionId: string): string {
    return `${FraudMetricsRepository.ATTEMPTS_PREFIX}${sessionId}`;
  }

  private buildStudentsKey(sessionId: string): string {
    return `${FraudMetricsRepository.STUDENTS_PREFIX}${sessionId}`;
  }
}
