/**
 * Tests para TOTP Validation Stage
 * 
 * Ejecutar con: npm run test
 */

import { describe, it, expect, vi } from 'vitest';
import { createTOTPValidationStage } from '../domain/validation-pipeline/stages/totp-validation.stage';
import { createContext, type ValidationContext } from '../domain/validation-pipeline/context';
import type { ITotpValidator } from '../../../shared/ports';

/**
 * Helper para crear contexto con response valida
 */
function createValidContext(overrides?: Partial<ValidationContext>): ValidationContext {
  const ctx = createContext('encrypted-test', 42);
  
  ctx.response = {
    original: {
      v: 1,
      sid: 'session-123',
      uid: 1,
      r: 1,
      ts: Date.now() - 1000,
      n: 'a'.repeat(32),
    },
    studentId: 42,
    receivedAt: Date.now(),
    totpu: '', // Se establece en cada test
  };

  return { ...ctx, ...overrides };
}

/**
 * Mock factory para ITotpValidator
 */
function createMockTotpValidator(validateResult: boolean): ITotpValidator {
  return {
    validate: vi.fn().mockResolvedValue(validateResult),
  };
}

describe('TOTPValidationStage', () => {
  it('debe pasar con TOTPu valido', async () => {
    // Mock del validador que retorna true
    const mockTotpValidator = createMockTotpValidator(true);

    const stage = createTOTPValidationStage({
      totpValidator: mockTotpValidator,
    });

    const ctx = createValidContext({
      response: {
        original: {
          v: 1,
          sid: 'session-123',
          uid: 1,
          r: 1,
          ts: Date.now() - 1000,
          n: 'a'.repeat(32),
        },
        studentId: 42,
        receivedAt: Date.now(),
        totpu: '123456',
      },
    });

    const result = await stage.execute(ctx);
    
    expect(result).toBe(true);
    expect(ctx.error).toBeUndefined();
    expect(mockTotpValidator.validate).toHaveBeenCalledWith(42, '123456');
  });

  it('debe fallar sin response desencriptada', async () => {
    const mockTotpValidator = createMockTotpValidator(true);

    const stage = createTOTPValidationStage({
      totpValidator: mockTotpValidator,
    });

    const ctx = createContext('encrypted-test', 42);
    // Sin response

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('TOTP_VALIDATION_FAILED');
  });

  it('debe fallar cuando falta TOTPu en el payload', async () => {
    const mockTotpValidator = createMockTotpValidator(true);

    const stage = createTOTPValidationStage({
      totpValidator: mockTotpValidator,
    });

    const ctx = createValidContext();
    // Remover totpu
    delete ctx.response!.totpu;

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('TOTP_MISSING');
  });

  it('debe fallar cuando validador retorna false (dispositivo no encontrado o TOTP invalido)', async () => {
    // Mock que retorna false (puede ser dispositivo no encontrado o TOTP invalido)
    const mockTotpValidator = createMockTotpValidator(false);

    const stage = createTOTPValidationStage({
      totpValidator: mockTotpValidator,
    });

    const ctx = createValidContext({
      response: {
        original: {
          v: 1,
          sid: 'session-123',
          uid: 1,
          r: 1,
          ts: Date.now() - 1000,
          n: 'a'.repeat(32),
        },
        studentId: 42,
        receivedAt: Date.now(),
        totpu: '123456',
      },
    });

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('TOTP_INVALID');
  });

  it('debe fallar con TOTPu incorrecto', async () => {
    // Mock que retorna false para TOTP incorrecto
    const mockTotpValidator = createMockTotpValidator(false);

    const stage = createTOTPValidationStage({
      totpValidator: mockTotpValidator,
    });

    const ctx = createValidContext({
      response: {
        original: {
          v: 1,
          sid: 'session-123',
          uid: 1,
          r: 1,
          ts: Date.now() - 1000,
          n: 'a'.repeat(32),
        },
        studentId: 42,
        receivedAt: Date.now(),
        totpu: '000000', // TOTPu incorrecto
      },
    });

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('TOTP_INVALID');
  });

  it('debe validarse correctamente con diferentes estudiantes', async () => {
    // Test con multiples estudiantes
    for (let i = 0; i < 3; i++) {
      const mockTotpValidator: ITotpValidator = {
        validate: vi.fn().mockResolvedValue(true),
      };

      const stage = createTOTPValidationStage({
        totpValidator: mockTotpValidator,
      });

      const studentId = 42 + i;
      const ctx = createValidContext({
        studentId,
        response: {
          original: {
            v: 1,
            sid: 'session-123',
            uid: 1,
            r: 1,
            ts: Date.now() - 1000,
            n: 'a'.repeat(32),
          },
          studentId,
          receivedAt: Date.now(),
          totpu: `12345${i}`,
        },
      });

      const result = await stage.execute(ctx);
      
      expect(result).toBe(true);
      expect(ctx.error).toBeUndefined();
      expect(mockTotpValidator.validate).toHaveBeenCalledWith(studentId, `12345${i}`);
    }
  });

  it('debe rechazar TOTPu de otro usuario', async () => {
    // Mock que valida el userId correcto
    const mockTotpValidator: ITotpValidator = {
      validate: vi.fn().mockImplementation(async (userId: number, _totp: string) => {
        // Solo validar para userId 42
        return userId === 42;
      }),
    };

    const stage = createTOTPValidationStage({
      totpValidator: mockTotpValidator,
    });

    // Context con studentId diferente
    const ctx = createValidContext({
      studentId: 99, // Usuario diferente
      response: {
        original: {
          v: 1,
          sid: 'session-123',
          uid: 1,
          r: 1,
          ts: Date.now() - 1000,
          n: 'a'.repeat(32),
        },
        studentId: 99,
        receivedAt: Date.now(),
        totpu: '123456',
      },
    });

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('TOTP_INVALID');
    expect(mockTotpValidator.validate).toHaveBeenCalledWith(99, '123456');
  });
});