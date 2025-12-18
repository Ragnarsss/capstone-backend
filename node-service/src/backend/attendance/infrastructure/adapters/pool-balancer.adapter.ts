/**
 * Adapter: PoolBalancer
 * 
 * Implementa IPoolBalancer delegando a la implementación concreta de qr-projection.
 * Permite que attendance dependa de la interface (shared/ports/) en lugar de la implementación.
 * 
 * Patrón: Ports & Adapters (Hexagonal Architecture)
 */

import type { IPoolBalancer, BalanceResult, PoolStats, PoolBalancerConfig } from '../../../../shared/ports';
import { PoolBalancer } from '../../../qr-projection/application/services';
import type { AesGcmService } from '../../../../shared/infrastructure/crypto';
import type { ProjectionPoolRepository } from '../../../../shared/infrastructure/valkey';

/**
 * Opciones de configuración para el adapter
 */
interface PoolBalancerAdapterOptions {
  minPoolSize?: number;
}

/**
 * Adapter que implementa IPoolBalancer usando PoolBalancer de qr-projection
 */
export class PoolBalancerAdapter implements IPoolBalancer {
  private readonly poolBalancer: PoolBalancer;

  constructor(
    aesGcmService: AesGcmService,
    poolRepo: ProjectionPoolRepository,
    options?: PoolBalancerAdapterOptions
  ) {
    this.poolBalancer = new PoolBalancer(aesGcmService, poolRepo, options);
  }

  async balance(sessionId: string): Promise<BalanceResult> {
    return this.poolBalancer.balance(sessionId);
  }

  async injectFakes(sessionId: string, count: number): Promise<void> {
    return this.poolBalancer.injectFakes(sessionId, count);
  }

  async getPoolStats(sessionId: string): Promise<PoolStats> {
    return this.poolBalancer.getPoolStats(sessionId);
  }

  calculateFakesNeeded(realCount: number): number {
    return this.poolBalancer.calculateFakesNeeded(realCount);
  }

  getConfig(): PoolBalancerConfig {
    return this.poolBalancer.getConfig();
  }

  updateConfig(newConfig: Partial<PoolBalancerConfig>): void {
    return this.poolBalancer.updateConfig(newConfig);
  }
}
