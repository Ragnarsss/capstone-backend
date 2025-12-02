/**
 * Stage: Load Student State
 * 
 * Carga el estado del estudiante desde Valkey.
 * I/O stage que requiere acceso al repositorio.
 */

import type { Stage } from '../stage.interface';
import type { ValidationContext, StudentState } from '../context';

/**
 * Interface para el repositorio de estudiante (inversion de dependencia)
 */
export interface StudentStateLoader {
  getState(sessionId: string, studentId: number): Promise<StudentState | null>;
}

export function createLoadStudentStateStage(loader: StudentStateLoader): Stage {
  return {
    name: 'loadStudentState',

    async execute(ctx: ValidationContext): Promise<boolean> {
      if (!ctx.response) {
        ctx.error = {
          code: 'INTERNAL_ERROR',
          message: 'No hay respuesta para cargar estado estudiante',
        };
        return false;
      }

      const sessionId = ctx.response.original.sid;
      const studentState = await loader.getState(sessionId, ctx.studentId);

      if (!studentState) {
        // Estudiante no registrado - creamos estado vacio
        ctx.studentState = {
          registered: false,
          status: 'active',
          currentRound: 0,
          activeNonce: null,
          roundsCompleted: [],
          currentAttempt: 0,
          maxAttempts: 0,
          maxRounds: 0,
        };
      } else {
        ctx.studentState = {
          ...studentState,
          registered: true,
        };
      }

      return true;
    },
  };
}
