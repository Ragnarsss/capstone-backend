/**
 * Stage: Validate Student State
 * 
 * Valida el estado del estudiante en la sesion.
 * Stages puros (sin I/O).
 */

import type { SyncStage } from '../stage.interface';
import type { ValidationContext } from '../context';

export const validateStudentRegisteredStage: SyncStage = {
  name: 'validateStudentRegistered',

  execute(ctx: ValidationContext): boolean {
    if (!ctx.studentState) {
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: 'No hay estado estudiante cargado',
      };
      return false;
    }

    if (!ctx.studentState.registered) {
      ctx.error = {
        code: 'STUDENT_NOT_REGISTERED',
        message: 'No estas registrado en esta sesion',
      };
      return false;
    }

    return true;
  },
};

export const validateStudentActiveStage: SyncStage = {
  name: 'validateStudentActive',

  execute(ctx: ValidationContext): boolean {
    if (!ctx.studentState) {
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: 'No hay estado estudiante cargado',
      };
      return false;
    }

    if (ctx.studentState.status === 'completed') {
      ctx.error = {
        code: 'ALREADY_COMPLETED',
        message: 'Ya completaste la asistencia',
      };
      return false;
    }

    if (ctx.studentState.status === 'failed') {
      ctx.error = {
        code: 'NO_ATTEMPTS_LEFT',
        message: 'Sin intentos restantes',
      };
      return false;
    }

    return true;
  },
};

export const validateStudentOwnsQRStage: SyncStage = {
  name: 'validateStudentOwnsQR',

  execute(ctx: ValidationContext): boolean {
    if (!ctx.studentState || !ctx.response) {
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: 'Contexto incompleto',
      };
      return false;
    }

    const payloadNonce = ctx.response.original.n;

    if (ctx.studentState.activeNonce !== payloadNonce) {
      ctx.error = {
        code: 'WRONG_QR',
        message: 'Este no es tu codigo QR actual',
      };
      return false;
    }

    return true;
  },
};

export const validateRoundMatchStage: SyncStage = {
  name: 'validateRoundMatch',

  execute(ctx: ValidationContext): boolean {
    if (!ctx.studentState || !ctx.response) {
      ctx.error = {
        code: 'INTERNAL_ERROR',
        message: 'Contexto incompleto',
      };
      return false;
    }

    const payloadRound = ctx.response.original.r;
    const studentRound = ctx.studentState.currentRound;

    if (payloadRound < studentRound) {
      ctx.error = {
        code: 'ROUND_ALREADY_COMPLETED',
        message: 'Este codigo es de una ronda anterior',
      };
      return false;
    }

    if (payloadRound > studentRound) {
      ctx.error = {
        code: 'ROUND_NOT_REACHED',
        message: 'Este codigo es de una ronda futura',
      };
      return false;
    }

    return true;
  },
};
