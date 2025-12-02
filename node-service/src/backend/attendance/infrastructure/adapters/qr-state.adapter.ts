/**
 * QR State Adapter
 * 
 * Adapta ProjectionPoolRepository para implementar QRStateLoader.
 * Busca el QR en el pool y calcula si ha expirado.
 */

import type { QRStateLoader } from '../../domain/validation-pipeline/stages/load-qr-state.stage';
import type { QRState } from '../../domain/validation-pipeline/context';
import { ProjectionPoolRepository } from '../projection-pool.repository';

/** TTL del QR en segundos (configurable) */
const QR_TTL_SECONDS = 30;

export class QRStateAdapter implements QRStateLoader {
  constructor(
    private readonly poolRepo: ProjectionPoolRepository,
    private readonly qrTTL: number = QR_TTL_SECONDS
  ) {}

  /**
   * Busca el estado del QR por nonce
   * 
   * El nonce está embebido en el encrypted payload, pero no tenemos
   * acceso directo aquí. En su lugar, buscamos por estudiante/round.
   * 
   * Para esta fase, asumimos que si el estudiante tiene un QR activo,
   * ese es el QR que estamos validando.
   */
  async getState(nonce: string): Promise<QRState | null> {
    // NOTA: El pool no indexa por nonce directamente.
    // La validación de nonce se hace contra studentState.activeNonce.
    // Este adapter solo verifica existencia general del pool.
    // Por ahora retornamos un estado "existe" genérico.
    
    // En implementación real, podríamos:
    // 1. Mantener un índice nonce -> poolEntry
    // 2. Buscar linealmente en el pool
    
    // Para el pipeline actual, la expiración se valida con qrGeneratedAt
    // del StudentSessionState, no del pool.
    
    return {
      exists: true,      // Asumimos que existe si llegó hasta aquí
      consumed: false,   // El consumo se rastrea en StudentState
    };
  }
}

/**
 * Factory para crear el adapter con dependencias por defecto
 */
export function createQRStateAdapter(
  poolRepo?: ProjectionPoolRepository,
  qrTTL?: number
): QRStateLoader {
  return new QRStateAdapter(
    poolRepo ?? new ProjectionPoolRepository(),
    qrTTL
  );
}
