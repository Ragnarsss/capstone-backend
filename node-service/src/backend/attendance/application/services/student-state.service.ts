/**
 * Servicio de estado de estudiante en sesión de asistencia.
 * Encapsula el acceso al repositorio de sesión del estudiante.
 */
import { StudentSessionRepository } from '../../infrastructure/student-session.repository';
import type { StudentSessionData } from '../../domain/student-session.entity';

export class StudentStateService {
  constructor(private readonly studentRepo: StudentSessionRepository = new StudentSessionRepository()) {}

  async registerStudent(
    sessionId: string,
    studentId: number,
    config: { maxRounds: number; maxAttempts: number; qrTTL: number }
  ): Promise<StudentSessionData> {
    return this.studentRepo.registerStudent(sessionId, studentId, config);
  }

  async getState(sessionId: string, studentId: number): Promise<StudentSessionData | null> {
    return this.studentRepo.getState(sessionId, studentId);
  }

  async setActiveQR(sessionId: string, studentId: number, nonce: string): Promise<void> {
    await this.studentRepo.setActiveQR(sessionId, studentId, nonce);
  }

  async failRound(
    sessionId: string,
    studentId: number,
    reason: string
  ): Promise<{ state: StudentSessionData; canRetry: boolean }> {
    return this.studentRepo.failRound(sessionId, studentId, reason);
  }
}
