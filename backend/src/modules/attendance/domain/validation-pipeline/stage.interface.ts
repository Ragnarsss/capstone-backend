/**
 * Validation Pipeline - Stage Interface
 * 
 * Define el contrato que cada stage debe implementar.
 */

import type { ValidationContext } from './context';

/**
 * Un stage del pipeline de validacion
 * 
 * Cada stage:
 * - Tiene un nombre unico para debugging
 * - Recibe el contexto mutable
 * - Retorna true para continuar, false para detener
 * - Si falla, debe setear ctx.error y ctx.failedAt
 */
export interface Stage {
  readonly name: string;
  execute(ctx: ValidationContext): Promise<boolean>;
}

/**
 * Tipo para stages sincronos (validaciones puras)
 */
export interface SyncStage {
  readonly name: string;
  execute(ctx: ValidationContext): boolean;
}

/**
 * Convierte un stage sincrono a asincrono
 */
export function toAsyncStage(stage: SyncStage): Stage {
  return {
    name: stage.name,
    execute: async (ctx) => stage.execute(ctx),
  };
}
