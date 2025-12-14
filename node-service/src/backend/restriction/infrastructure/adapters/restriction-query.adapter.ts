import type { IRestrictionQuery } from '../../../../shared/ports';
import type { IRestrictionService } from '../../application/services/restriction.service';

/**
 * Adapter para RestrictionQuery
 * Wrappea RestrictionService para implementar IRestrictionQuery
 * Responsabilidad: Proporcionar interfaz read-only para Access Gateway
 */
export class RestrictionQueryAdapter implements IRestrictionQuery {
  constructor(private readonly restrictionService: IRestrictionService) {}

  async isBlocked(userId: number): Promise<{
    blocked: boolean;
    reason?: string;
  }> {
    const result = await this.restrictionService.checkRestrictions(userId);
    return {
      blocked: result.blocked,
      reason: result.reason,
    };
  }
}
