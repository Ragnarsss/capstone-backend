/**
 * Validation Pipeline - Runner
 * 
 * Ejecuta stages en orden, registrando trace y deteniendo en primer fallo.
 */

import type { ValidationContext } from './context';
import type { Stage } from './stage.interface';

export interface RunnerResult {
  ctx: ValidationContext;
  success: boolean;
  totalDurationMs: number;
}

/**
 * Ejecuta el pipeline de validacion
 * 
 * @param ctx - Contexto inicial
 * @param stages - Array de stages a ejecutar en orden
 * @returns Contexto final con resultado
 */
export async function runPipeline(
  ctx: ValidationContext,
  stages: Stage[]
): Promise<RunnerResult> {
  const pipelineStart = Date.now();

  for (const stage of stages) {
    const stageStart = Date.now();
    
    try {
      const passed = await stage.execute(ctx);
      const durationMs = Date.now() - stageStart;
      
      ctx.trace.push({
        stage: stage.name,
        passed,
        durationMs,
      });

      if (!passed) {
        // Stage fallo, detener pipeline
        if (!ctx.failedAt) {
          ctx.failedAt = stage.name;
        }
        break;
      }
    } catch (error) {
      // Error inesperado en stage
      const durationMs = Date.now() - stageStart;
      ctx.trace.push({
        stage: stage.name,
        passed: false,
        durationMs,
      });
      
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Error interno',
      };
      ctx.failedAt = stage.name;
      break;
    }
  }

  const totalDurationMs = Date.now() - pipelineStart;

  return {
    ctx,
    success: ctx.error === undefined,
    totalDurationMs,
  };
}

/**
 * Formatea el trace para logging
 */
export function formatTrace(ctx: ValidationContext): string {
  return ctx.trace
    .map(t => `${t.stage}: ${t.passed ? 'OK' : 'FAIL'}`)
    .join(' -> ');
}
