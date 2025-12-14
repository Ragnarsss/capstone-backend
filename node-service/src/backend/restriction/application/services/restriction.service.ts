import type { RestrictionResult } from '../../domain/models';

/**
 * RestrictionService (STUB)
 *
 * Placeholder for external restriction checking.
 * Will be implemented to integrate with PHP module for:
 * - Horarios de clase (time-based restrictions)
 * - Suspensiones (user suspensions)
 * - Bloqueos temporales (temporary blocks)
 *
 * Current implementation: Always returns { blocked: false }
 * Future: Will call PHP service via HTTP or message queue
 */

/**
 * Interface for restriction service
 * Allows for dependency injection and mocking
 */
export interface IRestrictionService {
  checkRestrictions(userId: number): Promise<RestrictionResult>;
}

/**
 * RestrictionService (Stub Implementation)
 *
 * TODO: Implement integration with PHP restriction module
 * See: documents/03-especificaciones-tecnicas/flujo-automata-enrolamiento.md
 *
 * Future implementation will:
 * 1. Call PHP endpoint: GET /api/restrictions/{userId}
 * 2. Parse response for active restrictions
 * 3. Return appropriate RestrictionResult
 */
export class RestrictionService implements IRestrictionService {
  /**
   * Check if user has any active restrictions
   *
   * STUB: Always returns { blocked: false }
   *
   * @param userId - User to check restrictions for
   * @returns RestrictionResult - Always allows access (stub)
   */
  async checkRestrictions(userId: number): Promise<RestrictionResult> {
    // STUB: No restrictions implemented yet
    // This will be replaced with actual PHP integration
    return {
      blocked: false,
    };
  }
}
