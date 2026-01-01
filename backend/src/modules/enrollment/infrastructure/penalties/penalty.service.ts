import { ValkeyClient } from '../../../../shared/infrastructure/valkey/valkey-client';

/**
 * PenaltyService - Sistema de penalizaciones para enrollment
 * 
 * Implementa delays exponenciales para prevenir abuso del sistema:
 * - Device 1: 0 minutos (primer enrollment inmediato)
 * - Device 2: 5 minutos
 * - Device 3: 30 minutos  
 * - Device 4+: Exponencial (max 24 horas)
 * 
 * Los contadores se almacenan en Valkey con TTL de 24 horas.
 */
export class PenaltyService {
  private readonly PREFIX = 'enrollment:penalty:';
  private readonly COUNTER_TTL = 86400; // 24 horas en segundos
  
  // Escala de delays en minutos
  private readonly DELAY_SCALE: number[] = [
    0,      // Device 1: sin delay
    5,      // Device 2: 5 min
    30,     // Device 3: 30 min
    120,    // Device 4: 2 horas
    480,    // Device 5: 8 horas
    1440,   // Device 6+: 24 horas (máximo)
  ];

  constructor(private readonly valkeyClient: ValkeyClient) {}

  /**
   * Obtiene la clave de Valkey para un usuario
   */
  private getKey(userId: string): string {
    return `${this.PREFIX}${userId}`;
  }

  /**
   * Obtiene el número de enrollments del usuario en las últimas 24h
   */
  async getEnrollmentCount(userId: string): Promise<number> {
    const redis = this.valkeyClient.getClient();
    const count = await redis.get(this.getKey(userId));
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Incrementa el contador de enrollments y retorna el nuevo valor
   */
  async incrementEnrollmentCount(userId: string): Promise<number> {
    const redis = this.valkeyClient.getClient();
    const key = this.getKey(userId);
    
    const newCount = await redis.incr(key);
    
    // Establecer TTL solo si es el primer increment (cuando count = 1)
    if (newCount === 1) {
      await redis.expire(key, this.COUNTER_TTL);
    }
    
    return newCount;
  }

  /**
   * Obtiene el delay en minutos para el siguiente enrollment
   * basado en el número de enrollments previos
   */
  getDelayMinutes(enrollmentCount: number): number {
    if (enrollmentCount <= 0) return 0;
    
    const index = Math.min(enrollmentCount - 1, this.DELAY_SCALE.length - 1);
    return this.DELAY_SCALE[index];
  }

  /**
   * Verifica si el usuario puede hacer enrollment ahora o debe esperar
   * Retorna { canEnroll: boolean, waitMinutes: number, enrollmentCount: number }
   */
  async checkEnrollmentEligibility(userId: string): Promise<{
    canEnroll: boolean;
    waitMinutes: number;
    enrollmentCount: number;
    nextEnrollmentAt?: Date;
  }> {
    const redis = this.valkeyClient.getClient();
    const key = this.getKey(userId);
    
    // Obtener contador actual
    const count = await this.getEnrollmentCount(userId);
    
    // Para el primer enrollment, siempre permitido
    if (count === 0) {
      return {
        canEnroll: true,
        waitMinutes: 0,
        enrollmentCount: 0,
      };
    }

    // Obtener timestamp del último enrollment
    const lastEnrollmentKey = `${key}:last`;
    const lastEnrollmentStr = await redis.get(lastEnrollmentKey);
    
    if (!lastEnrollmentStr) {
      // No hay registro de cuándo fue el último, permitir
      return {
        canEnroll: true,
        waitMinutes: 0,
        enrollmentCount: count,
      };
    }

    const lastEnrollment = parseInt(lastEnrollmentStr, 10);
    const requiredDelayMs = this.getDelayMinutes(count) * 60 * 1000;
    const now = Date.now();
    const elapsed = now - lastEnrollment;
    
    if (elapsed >= requiredDelayMs) {
      return {
        canEnroll: true,
        waitMinutes: 0,
        enrollmentCount: count,
      };
    }

    const remainingMs = requiredDelayMs - elapsed;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    
    return {
      canEnroll: false,
      waitMinutes: remainingMinutes,
      enrollmentCount: count,
      nextEnrollmentAt: new Date(lastEnrollment + requiredDelayMs),
    };
  }

  /**
   * Registra un enrollment exitoso (incrementa contador y guarda timestamp)
   */
  async recordEnrollment(userId: string): Promise<{
    newCount: number;
    nextDelayMinutes: number;
  }> {
    const redis = this.valkeyClient.getClient();
    const key = this.getKey(userId);
    const lastEnrollmentKey = `${key}:last`;
    
    // Incrementar contador
    const newCount = await this.incrementEnrollmentCount(userId);
    
    // Guardar timestamp del enrollment actual
    await redis.set(lastEnrollmentKey, Date.now().toString(), 'EX', this.COUNTER_TTL);
    
    // Calcular delay para el próximo enrollment
    const nextDelayMinutes = this.getDelayMinutes(newCount);
    
    return {
      newCount,
      nextDelayMinutes,
    };
  }

  /**
   * Resetea el contador de penalizaciones para un usuario
   * (usar solo en casos excepcionales por administrador)
   */
  async resetPenalty(userId: string): Promise<void> {
    const redis = this.valkeyClient.getClient();
    const key = this.getKey(userId);
    
    await redis.del(key, `${key}:last`);
  }

  /**
   * Obtiene información completa del estado de penalización
   */
  async getPenaltyStatus(userId: string): Promise<{
    enrollmentCount: number;
    lastEnrollmentAt: Date | null;
    nextDelayMinutes: number;
    ttlSeconds: number | null;
  }> {
    const redis = this.valkeyClient.getClient();
    const key = this.getKey(userId);
    
    const [count, lastEnrollmentStr, ttl] = await Promise.all([
      this.getEnrollmentCount(userId),
      redis.get(`${key}:last`),
      redis.ttl(key),
    ]);
    
    return {
      enrollmentCount: count,
      lastEnrollmentAt: lastEnrollmentStr ? new Date(parseInt(lastEnrollmentStr, 10)) : null,
      nextDelayMinutes: this.getDelayMinutes(count),
      ttlSeconds: ttl > 0 ? ttl : null,
    };
  }
}
