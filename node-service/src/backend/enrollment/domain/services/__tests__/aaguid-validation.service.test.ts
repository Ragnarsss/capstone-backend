/**
 * Unit Tests: AaguidValidationService
 *
 * Tests AAGUID whitelist validation for Phase 22.3:
 * - Accept known platform authenticators (Windows Hello, Google, Apple, Samsung)
 * - Reject unknown AAGUIDs
 * - Handle NULL AAGUID based on config
 * - Bypass validation when disabled
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AaguidValidationService } from '../aaguid-validation.service';

// Mock config module
vi.mock('../../../../../shared/config', () => ({
  config: {
    aaguid: {
      validationEnabled: true,
      allowNull: false,
    },
  },
}));

// Mock logger
vi.mock('../../../../../shared/infrastructure/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AaguidValidationService', () => {
  let service: AaguidValidationService;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when validation is enabled (default)', () => {
    beforeEach(async () => {
      // Re-mock config for enabled state
      vi.doMock('../../../../../shared/config', () => ({
        config: {
          aaguid: {
            validationEnabled: true,
            allowNull: false,
          },
        },
      }));
      const module = await import('../aaguid-validation.service');
      service = new module.AaguidValidationService();
    });

    describe('authorized AAGUIDs', () => {
      it('accepts Windows Hello AAGUID', () => {
        const result = service.validate('08987058-cadc-4b81-b6e1-30de50dcbe96');

        expect(result.valid).toBe(true);
        expect(result.authenticatorName).toBe('Windows Hello');
        expect(result.reason).toBeUndefined();
      });

      it('accepts Google Password Manager AAGUID', () => {
        const result = service.validate('ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4');

        expect(result.valid).toBe(true);
        expect(result.authenticatorName).toBe('Google Password Manager');
      });

      it('accepts iCloud Keychain AAGUID', () => {
        const result = service.validate('dd4ec289-e01d-41c9-bb89-70fa845d4bf2');

        expect(result.valid).toBe(true);
        expect(result.authenticatorName).toBe('iCloud Keychain (Managed)');
      });

      it('accepts Samsung Pass AAGUID', () => {
        const result = service.validate('53414d53-554e-4700-0000-000000000000');

        expect(result.valid).toBe(true);
        expect(result.authenticatorName).toBe('Samsung Pass');
      });

      it('accepts uppercase AAGUID (case insensitive)', () => {
        const result = service.validate('08987058-CADC-4B81-B6E1-30DE50DCBE96');

        expect(result.valid).toBe(true);
        expect(result.authenticatorName).toBe('Windows Hello');
      });
    });

    describe('unauthorized AAGUIDs', () => {
      it('rejects unknown AAGUID', () => {
        const unknownAaguid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const result = service.validate(unknownAaguid);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain(unknownAaguid.toLowerCase());
        expect(result.reason).toContain('no esta en la lista');
        expect(result.authenticatorName).toBeUndefined();
      });

      it('rejects NULL AAGUID when allowNull is false', () => {
        const result = service.validate('00000000-0000-0000-0000-000000000000');

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('sin attestation');
      });
    });

    describe('utility methods', () => {
      it('isEnabled returns true when validation is enabled', () => {
        expect(service.isEnabled()).toBe(true);
      });

      it('getAuthorizedAaguids returns list of whitelisted AAGUIDs', () => {
        const aaguids = service.getAuthorizedAaguids();

        expect(Array.isArray(aaguids)).toBe(true);
        expect(aaguids.length).toBeGreaterThan(0);
        expect(aaguids[0]).toHaveProperty('aaguid');
        expect(aaguids[0]).toHaveProperty('name');
      });
    });
  });

  describe('when validation is disabled', () => {
    beforeEach(async () => {
      vi.doMock('../../../../../shared/config', () => ({
        config: {
          aaguid: {
            validationEnabled: false,
            allowNull: false,
          },
        },
      }));
      const module = await import('../aaguid-validation.service');
      service = new module.AaguidValidationService();
    });

    it('accepts any AAGUID when disabled', () => {
      const unknownAaguid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      const result = service.validate(unknownAaguid);

      expect(result.valid).toBe(true);
      expect(result.authenticatorName).toBe('Validacion deshabilitada');
    });

    it('accepts NULL AAGUID when validation is disabled', () => {
      const result = service.validate('00000000-0000-0000-0000-000000000000');

      expect(result.valid).toBe(true);
    });

    it('isEnabled returns false when validation is disabled', () => {
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('when allowNull is true', () => {
    beforeEach(async () => {
      vi.doMock('../../../../../shared/config', () => ({
        config: {
          aaguid: {
            validationEnabled: true,
            allowNull: true,
          },
        },
      }));
      const module = await import('../aaguid-validation.service');
      service = new module.AaguidValidationService();
    });

    it('accepts NULL AAGUID when allowNull is true', () => {
      const result = service.validate('00000000-0000-0000-0000-000000000000');

      expect(result.valid).toBe(true);
      expect(result.authenticatorName).toBe('Sin attestation (permitido)');
    });

    it('still rejects unknown non-null AAGUIDs', () => {
      const result = service.validate('12345678-1234-1234-1234-123456789012');

      expect(result.valid).toBe(false);
    });
  });
});
