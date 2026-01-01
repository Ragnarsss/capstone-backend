/**
 * Tests unitarios para stages puros del pipeline de validacion
 * 
 * Ejecutar con: npm run test
 */

import { describe, it, expect } from 'vitest';

import { createContext, type ValidationContext } from '../domain/validation-pipeline/context';
import {
  validateStructureStage,
  validateOwnershipStage,
  validateQRNotExpiredStage,
  validateQRNotConsumedStage,
  validateStudentRegisteredStage,
  validateStudentActiveStage,
  validateStudentOwnsQRStage,
  validateRoundMatchStage,
} from '../domain/validation-pipeline/stages';

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
  };

  ctx.qrState = {
    exists: true,
    consumed: false,
  };

  ctx.studentState = {
    registered: true,
    status: 'active',
    currentRound: 1,
    activeNonce: 'a'.repeat(32),
    roundsCompleted: [],
    currentAttempt: 1,
    maxAttempts: 3,
    maxRounds: 3,
  };

  return { ...ctx, ...overrides };
}

describe('validateStructureStage', () => {
  it('debe pasar con estructura valida', () => {
    const ctx = createValidContext();
    const result = validateStructureStage.execute(ctx);
    expect(result).toBe(true);
    expect(ctx.error).toBeUndefined();
  });

  it('debe fallar sin response', () => {
    const ctx = createContext('test', 42);
    const result = validateStructureStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('INTERNAL_ERROR');
  });

  it('debe fallar con version incorrecta', () => {
    const ctx = createValidContext();
    (ctx.response!.original as any).v = 2;
    const result = validateStructureStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('INVALID_FORMAT');
  });

  it('debe fallar con nonce de longitud incorrecta', () => {
    const ctx = createValidContext();
    (ctx.response!.original as any).n = 'short';
    const result = validateStructureStage.execute(ctx);
    expect(result).toBe(false);
  });
});

describe('validateOwnershipStage', () => {
  it('debe pasar cuando studentId coincide', () => {
    const ctx = createValidContext();
    const result = validateOwnershipStage.execute(ctx);
    expect(result).toBe(true);
  });

  it('debe fallar cuando studentId no coincide', () => {
    const ctx = createValidContext();
    ctx.response!.studentId = 99;
    const result = validateOwnershipStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('USER_MISMATCH');
  });
});

describe('validateQRNotExpiredStage', () => {
  it('debe pasar con QR existente', () => {
    const ctx = createValidContext();
    const result = validateQRNotExpiredStage.execute(ctx);
    expect(result).toBe(true);
  });

  it('debe fallar con QR inexistente', () => {
    const ctx = createValidContext();
    ctx.qrState!.exists = false;
    const result = validateQRNotExpiredStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('PAYLOAD_EXPIRED');
  });
});

describe('validateQRNotConsumedStage', () => {
  it('debe pasar con QR no consumido', () => {
    const ctx = createValidContext();
    const result = validateQRNotConsumedStage.execute(ctx);
    expect(result).toBe(true);
  });

  it('debe fallar con QR consumido', () => {
    const ctx = createValidContext();
    ctx.qrState!.consumed = true;
    const result = validateQRNotConsumedStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('PAYLOAD_ALREADY_CONSUMED');
  });
});

describe('validateStudentRegisteredStage', () => {
  it('debe pasar con estudiante registrado', () => {
    const ctx = createValidContext();
    const result = validateStudentRegisteredStage.execute(ctx);
    expect(result).toBe(true);
  });

  it('debe fallar con estudiante no registrado', () => {
    const ctx = createValidContext();
    ctx.studentState!.registered = false;
    const result = validateStudentRegisteredStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('STUDENT_NOT_REGISTERED');
  });
});

describe('validateStudentActiveStage', () => {
  it('debe pasar con status active', () => {
    const ctx = createValidContext();
    const result = validateStudentActiveStage.execute(ctx);
    expect(result).toBe(true);
  });

  it('debe fallar con status completed', () => {
    const ctx = createValidContext();
    ctx.studentState!.status = 'completed';
    const result = validateStudentActiveStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('ALREADY_COMPLETED');
  });

  it('debe fallar con status failed', () => {
    const ctx = createValidContext();
    ctx.studentState!.status = 'failed';
    const result = validateStudentActiveStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('NO_ATTEMPTS_LEFT');
  });
});

describe('validateStudentOwnsQRStage', () => {
  it('debe pasar cuando nonce coincide', () => {
    const ctx = createValidContext();
    const result = validateStudentOwnsQRStage.execute(ctx);
    expect(result).toBe(true);
  });

  it('debe fallar cuando nonce no coincide', () => {
    const ctx = createValidContext();
    ctx.studentState!.activeNonce = 'b'.repeat(32);
    const result = validateStudentOwnsQRStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('WRONG_QR');
  });
});

describe('validateRoundMatchStage', () => {
  it('debe pasar cuando round coincide', () => {
    const ctx = createValidContext();
    const result = validateRoundMatchStage.execute(ctx);
    expect(result).toBe(true);
  });

  it('debe fallar cuando round ya fue completado', () => {
    const ctx = createValidContext();
    ctx.studentState!.currentRound = 2;
    (ctx.response!.original as any).r = 1;
    const result = validateRoundMatchStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('ROUND_ALREADY_COMPLETED');
  });

  it('debe fallar cuando round no ha sido alcanzado', () => {
    const ctx = createValidContext();
    ctx.studentState!.currentRound = 1;
    (ctx.response!.original as any).r = 3;
    const result = validateRoundMatchStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe('ROUND_NOT_REACHED');
  });
});
