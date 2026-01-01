import { PayloadBuilder } from '../../domain/services';
import { AesGcmService } from '../../../../shared/infrastructure/crypto';
import { ProjectionPoolRepository } from '../../../../shared/infrastructure/valkey';
import type { IPoolBalancer, BalanceResult, PoolStats, PoolBalancerConfig } from '../../../../shared/ports';
import { logger } from '../../../../shared/infrastructure/logger';

// Re-exportamos los tipos desde shared/ports para compatibilidad
// con código existente que importa desde aquí
export type { BalanceResult, PoolStats, PoolBalancerConfig } from '../../../../shared/ports';

const DEFAULT_CONFIG: PoolBalancerConfig = {
  minPoolSize: 10,
};

/**
 * PoolBalancer - Application Service
 * 
 * Responsabilidad UNICA: Mantener el pool con un tamano minimo usando QRs falsos
 * 
 * Estrategia "Pool de tamano fijo":
 * - El pool siempre tiene al menos `minPoolSize` QRs
 * - Los falsos "llenan" los espacios que no ocupan estudiantes reales
 * - Cuando hay mas estudiantes que minPoolSize, no hay falsos
 * 
 * Caracteristicas de los QRs falsos:
 * - Formato identico a QRs reales (iv.ciphertext.authTag)
 * - Encriptados con clave ALEATORIA que se descarta
 * - Imposibles de descifrar por cualquier cliente
 * - Mezclados aleatoriamente en el pool de proyeccion
 * 
 * Este servicio NO maneja:
 * - Generacion de QRs de estudiantes (responsabilidad de PoolFeeder)
 * - Emision por WebSocket (responsabilidad de QREmitter)
 * - Estado de estudiantes (responsabilidad de StudentSessionRepository)
 * 
 * @implements {IPoolBalancer} - Interface definida en shared/ports
 */
export class PoolBalancer implements IPoolBalancer {
  private readonly aesGcmService: AesGcmService;
  private readonly poolRepo: ProjectionPoolRepository;
  private config: PoolBalancerConfig;

  constructor(
    aesGcmService?: AesGcmService,
    poolRepo?: ProjectionPoolRepository,
    config?: Partial<PoolBalancerConfig>
  ) {
    this.aesGcmService = aesGcmService ?? new AesGcmService();
    this.poolRepo = poolRepo ?? new ProjectionPoolRepository();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Genera un QR falso encriptado con clave aleatoria
   * 
   * @param sessionId - ID de la sesion
   * @returns String encriptado indescifrable
   */
  private generateFakeEncrypted(sessionId: string): string {
    // Construir payload falso usando PayloadBuilder
    const fakePayload = PayloadBuilder.buildFakePayload({
      sessionId,
      roundNumber: Math.ceil(Math.random() * 3), // Round aleatorio 1-3
    });

    // Encriptar con clave aleatoria (indescifrable)
    const plaintext = PayloadBuilder.toJsonString(fakePayload);
    return this.aesGcmService.encryptWithRandomKey(plaintext);
  }

  /**
   * Calcula cuantos QRs falsos se necesitan
   * 
   * @param realCount - Cantidad de QRs reales en el pool
   * @returns Cantidad de falsos necesarios (puede ser 0)
   */
  calculateFakesNeeded(realCount: number): number {
    return Math.max(0, this.config.minPoolSize - realCount);
  }

  /**
   * Balancea el pool para mantener el tamano minimo
   * 
   * - Si hay menos QRs que minPoolSize, agrega falsos
   * - Si hay mas falsos de los necesarios, los remueve
   * 
   * @param sessionId - ID de la sesion
   * @returns Resultado del balanceo
   */
  async balance(sessionId: string): Promise<BalanceResult> {
    const stats = await this.poolRepo.getPoolStats(sessionId);
    const fakesNeeded = this.calculateFakesNeeded(stats.students);
    
    let added = 0;
    let removed = 0;

    if (stats.fakes < fakesNeeded) {
      // Faltan falsos, agregar
      const toAdd = fakesNeeded - stats.fakes;
      await this.poolRepo.addFakeQRs(
        sessionId,
        toAdd,
        () => this.generateFakeEncrypted(sessionId)
      );
      added = toAdd;
    } else if (stats.fakes > fakesNeeded) {
      // Sobran falsos, remover
      const toRemove = stats.fakes - fakesNeeded;
      removed = await this.poolRepo.removeFakeQRs(sessionId, toRemove);
    }

    const finalStats = await this.poolRepo.getPoolStats(sessionId);
    
    if (added > 0 || removed > 0) {
      logger.debug(
        `[PoolBalancer] Balanced session=${sessionId.substring(0, 8)}... ` +
        `added=${added} removed=${removed} total=${finalStats.total}`
      );
    }

    return {
      added,
      removed,
      total: finalStats.total,
      students: finalStats.students,
      fakes: finalStats.fakes,
    };
  }

  /**
   * Inyecta una cantidad especifica de QRs falsos
   * Util para testing o inicializacion manual
   * 
   * @param sessionId - ID de la sesion
   * @param count - Cantidad de falsos a inyectar
   */
  async injectFakes(sessionId: string, count: number): Promise<void> {
    if (count <= 0) return;

    await this.poolRepo.addFakeQRs(
      sessionId,
      count,
      () => this.generateFakeEncrypted(sessionId)
    );

    logger.debug(`[PoolBalancer] Injected ${count} fake QRs into session=${sessionId.substring(0, 8)}...`);
  }

  /**
   * Obtiene estadisticas del pool
   * 
   * @param sessionId - ID de la sesion
   * @returns Estadisticas del pool
   */
  async getPoolStats(sessionId: string): Promise<PoolStats> {
    return this.poolRepo.getPoolStats(sessionId);
  }

  /**
   * Obtiene la configuracion actual
   */
  getConfig(): PoolBalancerConfig {
    return { ...this.config };
  }

  /**
   * Actualiza la configuracion en runtime
   * 
   * @param newConfig - Nueva configuracion parcial
   */
  updateConfig(newConfig: Partial<PoolBalancerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug(`[PoolBalancer] Config updated: minPoolSize=${this.config.minPoolSize}`);
  }
}
