/**
 * Tests: Validation Pipeline Runner
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runPipeline, formatTrace } from "../runner";
import type { ValidationContext } from "../context";
import type { Stage, SyncStage } from "../stage.interface";

describe("runPipeline", () => {
  let ctx: ValidationContext;

  beforeEach(() => {
    ctx = {
      sessionId: "session-123",
      studentId: 456,
      trace: [],
      error: undefined,
      failedAt: undefined,
    } as ValidationContext;
  });

  it("debe ejecutar todos los stages si todos pasan", async () => {
    const stage1: SyncStage = {
      name: "stage1",
      execute: vi.fn().mockReturnValue(true),
    };

    const stage2: SyncStage = {
      name: "stage2",
      execute: vi.fn().mockReturnValue(true),
    };

    const result = await runPipeline(ctx, [stage1, stage2]);

    expect(result.success).toBe(true);
    expect(result.ctx.trace).toHaveLength(2);
    expect(result.ctx.trace[0].stage).toBe("stage1");
    expect(result.ctx.trace[0].passed).toBe(true);
    expect(result.ctx.trace[1].stage).toBe("stage2");
    expect(result.ctx.trace[1].passed).toBe(true);
    expect(result.ctx.error).toBeUndefined();
    expect(result.ctx.failedAt).toBeUndefined();
  });

  it("debe detenerse en el primer stage que falla", async () => {
    const stage1: SyncStage = {
      name: "stage1",
      execute: vi.fn().mockImplementation((ctx) => {
        ctx.error = { code: "TEST_ERROR", message: "Stage 1 failed" };
        return false;
      }),
    };

    const stage2: SyncStage = {
      name: "stage2",
      execute: vi.fn().mockReturnValue(true),
    };

    const result = await runPipeline(ctx, [stage1, stage2]);

    expect(result.success).toBe(false);
    expect(result.ctx.trace).toHaveLength(1);
    expect(result.ctx.trace[0].passed).toBe(false);
    expect(result.ctx.failedAt).toBe("stage1");
    expect(stage2.execute).not.toHaveBeenCalled();
  });

  it("debe ejecutar stages asíncronos", async () => {
    const stage1: Stage = {
      name: "asyncStage",
      execute: vi.fn().mockResolvedValue(true),
    };

    const result = await runPipeline(ctx, [stage1]);

    expect(result.success).toBe(true);
    expect(result.ctx.trace[0].stage).toBe("asyncStage");
    expect(result.ctx.trace[0].passed).toBe(true);
  });

  it("debe manejar errores inesperados en stages", async () => {
    const stage1: SyncStage = {
      name: "errorStage",
      execute: vi.fn().mockImplementation(() => {
        throw new Error("Unexpected error");
      }),
    };

    const result = await runPipeline(ctx, [stage1]);

    expect(result.success).toBe(false);
    expect(result.ctx.error?.code).toBe("INTERNAL_ERROR");
    expect(result.ctx.error?.message).toBe("Unexpected error");
    expect(result.ctx.failedAt).toBe("errorStage");
    expect(result.ctx.trace[0].passed).toBe(false);
  });

  it("debe registrar duración de cada stage", async () => {
    const stage1: SyncStage = {
      name: "stage1",
      execute: vi.fn().mockReturnValue(true),
    };

    const result = await runPipeline(ctx, [stage1]);

    expect(result.ctx.trace[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.ctx.trace[0].durationMs).toBe("number");
  });

  it("debe registrar duración total del pipeline", async () => {
    const stage1: SyncStage = {
      name: "stage1",
      execute: vi.fn().mockReturnValue(true),
    };

    const stage2: SyncStage = {
      name: "stage2",
      execute: vi.fn().mockReturnValue(true),
    };

    const result = await runPipeline(ctx, [stage1, stage2]);

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.totalDurationMs).toBe("number");
  });

  it("debe manejar pipeline vacío", async () => {
    const result = await runPipeline(ctx, []);

    expect(result.success).toBe(true);
    expect(result.ctx.trace).toHaveLength(0);
    expect(result.ctx.error).toBeUndefined();
  });

  it("debe ejecutar stages en orden correcto", async () => {
    const executionOrder: string[] = [];

    const stage1: SyncStage = {
      name: "stage1",
      execute: vi.fn().mockImplementation(() => {
        executionOrder.push("stage1");
        return true;
      }),
    };

    const stage2: SyncStage = {
      name: "stage2",
      execute: vi.fn().mockImplementation(() => {
        executionOrder.push("stage2");
        return true;
      }),
    };

    const stage3: SyncStage = {
      name: "stage3",
      execute: vi.fn().mockImplementation(() => {
        executionOrder.push("stage3");
        return true;
      }),
    };

    await runPipeline(ctx, [stage1, stage2, stage3]);

    expect(executionOrder).toEqual(["stage1", "stage2", "stage3"]);
  });

  it("debe mantener el error del stage que falló", async () => {
    const customError = {
      code: "CUSTOM_ERROR" as const,
      message: "Custom error message",
    };

    const stage1: SyncStage = {
      name: "stage1",
      execute: vi.fn().mockImplementation((ctx) => {
        ctx.error = customError;
        return false;
      }),
    };

    const result = await runPipeline(ctx, [stage1]);

    expect(result.ctx.error).toEqual(customError);
  });

  it("debe manejar errores no-Error", async () => {
    const stage1: SyncStage = {
      name: "stage1",
      execute: vi.fn().mockImplementation(() => {
        throw "String error";
      }),
    };

    const result = await runPipeline(ctx, [stage1]);

    expect(result.ctx.error?.code).toBe("INTERNAL_ERROR");
    expect(result.ctx.error?.message).toBe("Error interno");
  });
});

describe("formatTrace", () => {
  it("debe formatear trace con todos los stages pasados", () => {
    const ctx: ValidationContext = {
      trace: [
        { stage: "stage1", passed: true, durationMs: 10 },
        { stage: "stage2", passed: true, durationMs: 15 },
        { stage: "stage3", passed: true, durationMs: 8 },
      ],
    } as ValidationContext;

    const formatted = formatTrace(ctx);

    expect(formatted).toBe("stage1: OK -> stage2: OK -> stage3: OK");
  });

  it("debe formatear trace con un stage fallido", () => {
    const ctx: ValidationContext = {
      trace: [
        { stage: "stage1", passed: true, durationMs: 10 },
        { stage: "stage2", passed: false, durationMs: 15 },
      ],
    } as ValidationContext;

    const formatted = formatTrace(ctx);

    expect(formatted).toBe("stage1: OK -> stage2: FAIL");
  });

  it("debe manejar trace vacío", () => {
    const ctx: ValidationContext = {
      trace: [],
    } as ValidationContext;

    const formatted = formatTrace(ctx);

    expect(formatted).toBe("");
  });

  it("debe formatear trace con un solo stage", () => {
    const ctx: ValidationContext = {
      trace: [{ stage: "onlyStage", passed: true, durationMs: 5 }],
    } as ValidationContext;

    const formatted = formatTrace(ctx);

    expect(formatted).toBe("onlyStage: OK");
  });
});
