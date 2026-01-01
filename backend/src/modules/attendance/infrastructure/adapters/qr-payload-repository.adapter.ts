/**
 * Adapter: QRPayloadRepository
 * 
 * Implementa IQRPayloadRepository delegando a la implementación concreta de qr-projection.
 * Permite que attendance dependa de la interface (shared/ports/) en lugar de la implementación.
 * 
 * Patrón: Ports & Adapters (Hexagonal Architecture)
 */

import type { IQRPayloadRepository, StoredPayload, PayloadValidationResult } from '../../../../shared/ports';
import { QRPayloadRepository } from '../../../qr-projection/infrastructure/qr-payload.repository';
import type { QRPayloadV1 } from '../../../../shared/types';

/**
 * Adapter que implementa IQRPayloadRepository usando QRPayloadRepository de qr-projection
 */
export class QRPayloadRepositoryAdapter implements IQRPayloadRepository {
  private readonly payloadRepo: QRPayloadRepository;

  constructor(ttl: number) {
    this.payloadRepo = new QRPayloadRepository(ttl);
  }

  async store(payload: QRPayloadV1, encrypted: string, ttl?: number): Promise<void> {
    return this.payloadRepo.store(payload, encrypted, ttl);
  }

  async findByNonce(nonce: string): Promise<StoredPayload | null> {
    return this.payloadRepo.findByNonce(nonce);
  }

  async validate(payload: QRPayloadV1): Promise<PayloadValidationResult> {
    return this.payloadRepo.validate(payload);
  }

  async markAsConsumed(nonce: string, consumedBy: number): Promise<boolean> {
    return this.payloadRepo.markAsConsumed(nonce, consumedBy);
  }

  async delete(nonce: string): Promise<void> {
    return this.payloadRepo.delete(nonce);
  }

  async countActiveForSession(sessionId: string): Promise<number> {
    return this.payloadRepo.countActiveForSession(sessionId);
  }
}
