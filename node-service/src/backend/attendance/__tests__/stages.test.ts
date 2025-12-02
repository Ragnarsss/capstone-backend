/**
 * Tests unitarios para stages puros del pipeline de validación
 * 
 * Ejecutar con: npx tsx --test src/backend/attendance/__tests__/stages.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
 * Helper para crear contexto con response válida
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
  it('debe pasar con estructura válida', () => {
    const ctx = createValidContext();
    const result = validateStructureStage.execute(ctx);
    assert.equal(result, true);
    assert.equal(ctx.error, undefined);
  });

  it('debe fallar sin response', () => {
    const ctx = createContext('test', 42);
    const result = validateStructureStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'INTERNAL_ERROR');
  });

  it('debe fallar con version incorrecta', () => {
    const ctx = createValidContext();
    (ctx.response!.original as any).v = 2;
    const result = validateStructureStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'INVALID_FORMAT');
  });

  it('debe fallar con nonce de longitud incorrecta', () => {
    const ctx = createValidContext();
    (ctx.response!.original as any).n = 'short';
    const result = validateStructureStage.execute(ctx);
    assert.equal(result, false);
  });
});

describe('validateOwnershipStage', () => {
  it('debe pasar cuando studentId coincide', () => {
    const ctx = createValidContext();
    const result = validateOwnershipStage.execute(ctx);
    assert.equal(result, true);
  });

  it('debe fallar cuando studentId no coincide', () => {
    const ctx = createValidContext();
    ctx.response!.studentId = 99;
    const result = validateOwnershipStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'USER_MISMATCH');
  });
});

describe('validateQRNotExpiredStage', () => {
  it('debe pasar con QR existente', () => {
    const ctx = createValidContext();
    const result = validateQRNotExpiredStage.execute(ctx);
    assert.equal(result, true);
  });

  it('debe fallar con QR inexistente', () => {
    const ctx = createValidContext();
    ctx.qrState!.exists = false;
    const result = validateQRNotExpiredStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'PAYLOAD_EXPIRED');
  });
});

describe('validateQRNotConsumedStage', () => {
  it('debe pasar con QR no consumido', () => {
    const ctx = createValidContext();
    const result = validateQRNotConsumedStage.execute(ctx);
    assert.equal(result, true);
  });

  it('debe fallar con QR consumido', () => {
    const ctx = createValidContext();
    ctx.qrState!.consumed = true;
    const result = validateQRNotConsumedStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'PAYLOAD_ALREADY_CONSUMED');
  });
});

describe('validateStudentRegisteredStage', () => {
  it('debe pasar con estudiante registrado', () => {
    const ctx = createValidContext();
    const result = validateStudentRegisteredStage.execute(ctx);
    assert.equal(result, true);
  });

  it('debe fallar con estudiante no registrado', () => {
    const ctx = createValidContext();
    ctx.studentState!.registered = false;
    const result = validateStudentRegisteredStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'STUDENT_NOT_REGISTERED');
  });
});

describe('validateStudentActiveStage', () => {
  it('debe pasar con status active', () => {
    const ctx = createValidContext();
    const result = validateStudentActiveStage.execute(ctx);
    assert.equal(result, true);
  });

  it('debe fallar con status completed', () => {
    const ctx = createValidContext();
    ctx.studentState!.status = 'completed';
    const result = validateStudentActiveStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'ALREADY_COMPLETED');
  });

  it('debe fallar con status failed', () => {
    const ctx = createValidContext();
    ctx.studentState!.status = 'failed';
    const result = validateStudentActiveStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'NO_ATTEMPTS_LEFT');
  });
});

describe('validateStudentOwnsQRStage', () => {
  it('debe pasar cuando nonce coincide', () => {
    const ctx = createValidContext();
    const result = validateStudentOwnsQRStage.execute(ctx);
    assert.equal(result, true);
  });

  it('debe fallar cuando nonce no coincide', () => {
    const ctx = createValidContext();
    ctx.studentState!.activeNonce = 'b'.repeat(32);
    const result = validateStudentOwnsQRStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'WRONG_QR');
  });
});

describe('validateRoundMatchStage', () => {
  it('debe pasar cuando round coincide', () => {
    const ctx = createValidContext();
    const result = validateRoundMatchStage.execute(ctx);
    assert.equal(result, true);
  });

  it('debe fallar cuando round ya fue completado', () => {
    const ctx = createValidContext();
    ctx.studentState!.currentRound = 2;
    (ctx.response!.original as any).r = 1;
    const result = validateRoundMatchStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'ROUND_ALREADY_COMPLETED');
  });

  it('debe fallar cuando round no ha sido alcanzado', () => {
    const ctx = createValidContext();
    ctx.studentState!.currentRound = 1;
    (ctx.response!.original as any).r = 3;
    const result = validateRoundMatchStage.execute(ctx);
    assert.equal(result, false);
    assert.equal(ctx.error?.code, 'ROUND_NOT_REACHED');
  });
});
