/**
 * Puerto: IPoolBalancer
 * 
 * Interface para balanceo de pool de QRs.
 * Mantiene el pool con un tamaño mínimo usando QRs falsos (honeypots).
 * 
 * Implementaciones:
 * - PoolBalancer (qr-projection/application/services) - Implementación real
 * - MockPoolBalancer (tests) - Para testing
 */

/**
 * Configuración del PoolBalancer
 */
export interface PoolBalancerConfig {
  /** Tamaño mínimo del pool (falsos + reales). Default: 10 */
  readonly minPoolSize: number;
}

/**
 * Resultado de una operación de balanceo
 */
export interface BalanceResult {
  /** QRs falsos agregados */
  readonly added: number;
  /** QRs falsos removidos */
  readonly removed: number;
  /** Total de QRs en el pool */
  readonly total: number;
  /** QRs de estudiantes reales */
  readonly students: number;
  /** QRs falsos (honeypots) */
  readonly fakes: number;
}

/**
 * Estadísticas del pool
 */
export interface PoolStats {
  /** Total de QRs en el pool */
  readonly total: number;
  /** QRs de estudiantes reales */
  readonly students: number;
  /** QRs falsos (honeypots) */
  readonly fakes: number;
}

/**
 * Puerto: Balanceador de Pool de QRs
 * 
 * Abstracción para mantener el pool de QRs con tamaño mínimo.
 * Los QRs falsos tienen formato válido pero están encriptados
 * con claves aleatorias que se descartan - imposibles de descifrar.
 */
export interface IPoolBalancer {
  /**
   * Balancea el pool para mantener el tamaño mínimo
   * 
   * - Si hay menos QRs que minPoolSize, agrega falsos
   * - Si hay más falsos de los necesarios, los remueve
   * 
   * @param sessionId - ID de la sesión
   * @returns Resultado del balanceo
   * 
   * @example
   * ```typescript
   * const result = await balancer.balance('session-123');
   * console.log(`Pool tiene ${result.total} QRs (${result.students} reales, ${result.fakes} falsos)`);
   * ```
   */
  balance(sessionId: string): Promise<BalanceResult>;

  /**
   * Inyecta una cantidad específica de QRs falsos
   * Útil para testing o inicialización manual
   * 
   * @param sessionId - ID de la sesión
   * @param count - Cantidad de falsos a inyectar
   */
  injectFakes(sessionId: string, count: number): Promise<void>;

  /**
   * Obtiene estadísticas del pool
   * 
   * @param sessionId - ID de la sesión
   * @returns Estadísticas del pool
   */
  getPoolStats(sessionId: string): Promise<PoolStats>;

  /**
   * Calcula cuántos QRs falsos se necesitan
   * 
   * @param realCount - Cantidad de QRs reales en el pool
   * @returns Cantidad de falsos necesarios (puede ser 0)
   */
  calculateFakesNeeded(realCount: number): number;

  /**
   * Obtiene la configuración actual
   */
  getConfig(): PoolBalancerConfig;

  /**
   * Actualiza la configuración en runtime
   * 
   * @param newConfig - Nueva configuración parcial
   */
  updateConfig(newConfig: Partial<PoolBalancerConfig>): void;
}
