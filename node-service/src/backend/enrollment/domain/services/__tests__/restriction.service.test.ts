/**
 * Unit Tests: RestrictionService (Stub)
 *
 * Tests the stub implementation that always returns { blocked: false }
 * Future tests will cover actual PHP integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RestrictionService } from '../restriction.service';

describe('RestrictionService (Stub)', () => {
  let service: RestrictionService;

  beforeEach(() => {
    service = new RestrictionService();
  });

  describe('checkRestrictions', () => {
    it('returns blocked=false for any user (stub behavior)', async () => {
      const result = await service.checkRestrictions(100);

      expect(result.blocked).toBe(false);
      expect(result.reason).toBeUndefined();
      expect(result.endsAt).toBeUndefined();
      expect(result.type).toBeUndefined();
    });

    it('returns blocked=false for different users', async () => {
      const users = [1, 100, 999, 12345];

      for (const userId of users) {
        const result = await service.checkRestrictions(userId);
        expect(result.blocked).toBe(false);
      }
    });

    it('implements IRestrictionService interface', async () => {
      // Type check: service should conform to interface
      const checkFn = service.checkRestrictions;
      expect(typeof checkFn).toBe('function');
    });
  });

  describe('stub documentation', () => {
    it('service has correct structure for future implementation', () => {
      // Ensure the stub can be easily replaced with real implementation
      expect(service).toHaveProperty('checkRestrictions');
      expect(typeof service.checkRestrictions).toBe('function');
    });
  });
});
