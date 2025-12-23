/**
 * Tests: Validate Student Stage
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  validateStudentRegisteredStage,
  validateStudentActiveStage,
  validateStudentOwnsQRStage,
  validateRoundMatchStage,
} from "../validate-student.stage";
import type {
  ValidationContext,
  StudentState,
  StudentResponse,
} from "../../context";

describe("validateStudentRegisteredStage", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      studentState: undefined,
      error: undefined,
    } as ValidationContext;
  });

  it("debe fallar si no hay studentState", () => {
    const result = validateStudentRegisteredStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("INTERNAL_ERROR");
  });

  it("debe validar estudiante registrado", () => {
    ctx.studentState = {
      registered: true,
      status: "in_progress",
    } as StudentState;

    const result = validateStudentRegisteredStage.execute(ctx);

    expect(result).toBe(true);
  });

  it("debe fallar si estudiante no está registrado", () => {
    ctx.studentState = {
      registered: false,
      status: "pending",
    } as StudentState;

    const result = validateStudentRegisteredStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("STUDENT_NOT_REGISTERED");
  });
});

describe("validateStudentActiveStage", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      studentState: undefined,
      error: undefined,
    } as ValidationContext;
  });

  it("debe fallar si no hay studentState", () => {
    const result = validateStudentActiveStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("INTERNAL_ERROR");
  });

  it("debe validar estudiante con status in_progress", () => {
    ctx.studentState = {
      registered: true,
      status: "in_progress",
    } as StudentState;

    const result = validateStudentActiveStage.execute(ctx);

    expect(result).toBe(true);
  });

  it("debe validar estudiante con status pending", () => {
    ctx.studentState = {
      registered: true,
      status: "pending",
    } as StudentState;

    const result = validateStudentActiveStage.execute(ctx);

    expect(result).toBe(true);
  });

  it("debe fallar si estudiante ya completó", () => {
    ctx.studentState = {
      registered: true,
      status: "completed",
    } as StudentState;

    const result = validateStudentActiveStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("ALREADY_COMPLETED");
  });

  it("debe fallar si estudiante falló", () => {
    ctx.studentState = {
      registered: true,
      status: "failed",
    } as StudentState;

    const result = validateStudentActiveStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("NO_ATTEMPTS_LEFT");
  });
});

describe("validateStudentOwnsQRStage", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      studentState: undefined,
      response: undefined,
      error: undefined,
    } as ValidationContext;
  });

  it("debe fallar si no hay studentState", () => {
    const result = validateStudentOwnsQRStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("INTERNAL_ERROR");
  });

  it("debe fallar si no hay response", () => {
    ctx.studentState = {
      registered: true,
      activeNonce: "test-nonce",
    } as StudentState;

    const result = validateStudentOwnsQRStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("INTERNAL_ERROR");
  });

  it("debe validar cuando nonce coincide", () => {
    ctx.studentState = {
      registered: true,
      activeNonce: "nonce-12345678901234567890123456",
    } as StudentState;

    ctx.response = {
      original: {
        v: 1,
        sid: "session-123",
        uid: 456,
        r: 1,
        ts: Date.now(),
        n: "nonce-12345678901234567890123456",
      },
      studentId: 456,
      receivedAt: Date.now(),
    };

    const result = validateStudentOwnsQRStage.execute(ctx);

    expect(result).toBe(true);
  });

  it("debe fallar cuando nonce no coincide", () => {
    ctx.studentState = {
      registered: true,
      activeNonce: "old-nonce-123456789012345678901",
    } as StudentState;

    ctx.response = {
      original: {
        v: 1,
        sid: "session-123",
        uid: 456,
        r: 1,
        ts: Date.now(),
        n: "new-nonce-123456789012345678901",
      },
      studentId: 456,
      receivedAt: Date.now(),
    };

    const result = validateStudentOwnsQRStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("WRONG_QR");
  });
});

describe("validateRoundMatchStage", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      studentState: undefined,
      response: undefined,
      error: undefined,
    } as ValidationContext;
  });

  it("debe fallar si no hay studentState o response", () => {
    const result = validateRoundMatchStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("INTERNAL_ERROR");
  });

  it("debe validar cuando round coincide", () => {
    ctx.studentState = {
      registered: true,
      currentRound: 2,
    } as StudentState;

    ctx.response = {
      original: {
        v: 1,
        sid: "session-123",
        uid: 456,
        r: 2,
        ts: Date.now(),
        n: "12345678901234567890123456789012",
      },
      studentId: 456,
      receivedAt: Date.now(),
    };

    const result = validateRoundMatchStage.execute(ctx);

    expect(result).toBe(true);
  });

  it("debe fallar si round del payload es anterior", () => {
    ctx.studentState = {
      registered: true,
      currentRound: 3,
    } as StudentState;

    ctx.response = {
      original: {
        v: 1,
        sid: "session-123",
        uid: 456,
        r: 2, // Round anterior
        ts: Date.now(),
        n: "12345678901234567890123456789012",
      },
      studentId: 456,
      receivedAt: Date.now(),
    };

    const result = validateRoundMatchStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("ROUND_ALREADY_COMPLETED");
  });

  it("debe fallar si round del payload es futuro", () => {
    ctx.studentState = {
      registered: true,
      currentRound: 1,
    } as StudentState;

    ctx.response = {
      original: {
        v: 1,
        sid: "session-123",
        uid: 456,
        r: 3, // Round futuro
        ts: Date.now(),
        n: "12345678901234567890123456789012",
      },
      studentId: 456,
      receivedAt: Date.now(),
    };

    const result = validateRoundMatchStage.execute(ctx);

    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("ROUND_NOT_REACHED");
  });

  it("debe validar round 1 inicial", () => {
    ctx.studentState = {
      registered: true,
      currentRound: 1,
    } as StudentState;

    ctx.response = {
      original: {
        v: 1,
        sid: "session-123",
        uid: 456,
        r: 1,
        ts: Date.now(),
        n: "12345678901234567890123456789012",
      },
      studentId: 456,
      receivedAt: Date.now(),
    };

    const result = validateRoundMatchStage.execute(ctx);

    expect(result).toBe(true);
  });
});
