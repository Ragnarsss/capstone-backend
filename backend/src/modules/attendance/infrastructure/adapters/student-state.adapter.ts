/**
 * Student State Adapter
 * 
 * Adapta StudentSessionRepository para implementar StudentStateLoader.
 * Transforma el formato de infraestructura al formato de dominio.
 */

import type { StudentStateLoader } from '../../domain/validation-pipeline/stages/load-student-state.stage';
import type { StudentState } from '../../domain/validation-pipeline/context';
import { StudentSessionRepository } from '../student-session.repository';

export class StudentStateAdapter implements StudentStateLoader {
  constructor(
    private readonly studentRepo: StudentSessionRepository
  ) {}

  /**
   * Obtiene el estado del estudiante en formato de dominio
   */
  async getState(sessionId: string, studentId: number): Promise<StudentState | null> {
    const state = await this.studentRepo.getState(sessionId, studentId);
    
    if (!state) {
      return null;
    }

    // Transformar formato de infraestructura a dominio
    return {
      registered: true,
      status: state.status,
      currentRound: state.currentRound,
      activeNonce: state.activeQRNonce,
      roundsCompleted: state.roundsCompleted.map(r => ({
        round: r.round,
        responseTime: r.responseTime,
      })),
      currentAttempt: state.currentAttempt,
      maxAttempts: state.maxAttempts,
      maxRounds: state.maxRounds,
    };
  }
}

/**
 * Factory para crear el adapter con dependencias por defecto
 */
export function createStudentStateAdapter(
  studentRepo?: StudentSessionRepository
): StudentStateLoader {
  return new StudentStateAdapter(
    studentRepo ?? new StudentSessionRepository()
  );
}
