/**
 * Tests para TOTP Validation Stage
 * 
 * Ejecutar con: npm run test
 */

import { describe, it, expect, vi } from 'vitest';
import { createTOTPValidationStage } from '../domain/validation-pipeline/stages/totp-validation.stage';
import { createContext, type ValidationContext } from '../domain/validation-pipeline/context';
import { totp } from 'otplib';

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
 * Helper para generar un TOTP valido
 */
function generateValidTOTP(sessionKey: Buffer): string {
  const secret = sessionKey.toString('base64');
  return totp.generate(secret);
}

describe('TOTPValidationStage', () => {
  it('debe pasar con TOTPu valido', async () => {
    // Crear una session_key de prueba (32 bytes)
    const sessionKey = Buffer.from('0'.repeat(64), 'hex');
    const validTOTP = generateValidTOTP(sessionKey);

    // Mock del repositorio
    const mockSessionKeyRepo = {
      findByUserId: vi.fn().mockResolvedValue({
        sessionKey,
        userId: 42,
        deviceId: 'device-123',
        createdAt: Date.now(),
      }),
    };

    const stage = createTOTPValidationStage({
      sessionKeyQuery: mockSessionKeyRepo,
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
        totpu: validTOTP,
      },
    });

    const result = await stage.execute(ctx);
    
    expect(result).toBe(true);
    expect(ctx.error).toBeUndefined();
    expect(mockSessionKeyRepo.findByUserId).toHaveBeenCalledWith(42);
  });

  it('debe fallar sin response desencriptada', async () => {
    const mockSessionKeyRepo = {
      findByUserId: vi.fn(),
    };

    const stage = createTOTPValidationStage({
      sessionKeyQuery: mockSessionKeyRepo,
    });

    const ctx = createContext('encrypted-test', 42);
    // Sin response

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('TOTP_VALIDATION_FAILED');
  });

  it('debe fallar cuando falta TOTPu en el payload', async () => {
    const mockSessionKeyRepo = {
      findByUserId: vi.fn(),
    };

    const stage = createTOTPValidationStage({
      sessionKeyQuery: mockSessionKeyRepo,
    });

    const ctx = createValidContext();
    // Remover totpu
    delete ctx.response!.totpu;

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('TOTP_MISSING');
  });

  it('debe fallar cuando session_key no existe en Valkey', async () => {
    const mockSessionKeyRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
    };

    const stage = createTOTPValidationStage({
      sessionKeyQuery: mockSessionKeyRepo,
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
        totpu: '123456', // TOTPu cualquiera para llegar al check de session_key
      },
    });

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('SESSION_KEY_NOT_FOUND');
  });

  it('debe fallar con TOTPu incorrecto', async () => {
    const sessionKey = Buffer.from('0'.repeat(64), 'hex');

    const mockSessionKeyRepo = {
      findByUserId: vi.fn().mockResolvedValue({
        sessionKey,
        userId: 42,
        deviceId: 'device-123',
        createdAt: Date.now(),
      }),
    };

    const stage = createTOTPValidationStage({
      sessionKeyQuery: mockSessionKeyRepo,
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

  it('debe validarse correctamente con diferentes session_keys', async () => {
    // Test con multiples session_keys diferentes
    for (let i = 0; i < 3; i++) {
      const sessionKey = Buffer.from(String(i).repeat(64), 'hex');
      const validTOTP = generateValidTOTP(sessionKey);

      const mockSessionKeyRepo = {
        findByUserId: vi.fn().mockResolvedValue({
          sessionKey,
          userId: 42 + i,
          deviceId: `device-${i}`,
          createdAt: Date.now(),
        }),
      };

      const stage = createTOTPValidationStage({
        sessionKeyQuery: mockSessionKeyRepo,
      });

      const ctx = createValidContext({
        studentId: 42 + i,
        response: {
          original: {
            v: 1,
            sid: 'session-123',
            uid: 1,
            r: 1,
            ts: Date.now() - 1000,
            n: 'a'.repeat(32),
          },
          studentId: 42 + i,
          receivedAt: Date.now(),
          totpu: validTOTP,
        },
      });

      const result = await stage.execute(ctx);
      
      expect(result).toBe(true);
      expect(ctx.error).toBeUndefined();
    }
  });

  it('debe rechazar TOTPu de otra sesion_key', async () => {
    const sessionKey1 = Buffer.from('1'.repeat(64), 'hex');
    const sessionKey2 = Buffer.from('2'.repeat(64), 'hex');
    
    // Generar TOTP con clave diferente
    const wrongTOTP = generateValidTOTP(sessionKey2);

    const mockSessionKeyRepo = {
      findByUserId: vi.fn().mockResolvedValue({
        sessionKey: sessionKey1,
        userId: 42,
        deviceId: 'device-123',
        createdAt: Date.now(),
      }),
    };

    const stage = createTOTPValidationStage({
      sessionKeyQuery: mockSessionKeyRepo,
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
        totpu: wrongTOTP, // TOTP de otra clave
      },
    });

    const result = await stage.execute(ctx);
    
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('TOTP_INVALID');
  });
});