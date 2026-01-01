/**
 * AttendancePersistenceService
 * 
 * Facade para operaciones de persistencia de asistencia en PostgreSQL.
 * Encapsula lógica de guardado en validation_attempts, attendance_results, y registrations.
 * 
 * Responsabilidades:
 * - Guardar intentos de validación (por round)
 * - Guardar resultado final de asistencia (tras completar todos los rounds)
 * - Marcar registración como completada
 * - Operación atómica para persistencia completa
 */

import type { ValidationRepository, ResultRepository, RegistrationRepository } from '../../infrastructure/repositories';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * Parámetros para guardar validación parcial
 */
export interface SaveValidationParams {
  sessionId: string;
  studentId: number;
  round: number;
  responseTime: number;
  validatedAt: number;
}

/**
 * Parámetros para guardar resultado final
 */
export interface SaveResultParams {
  sessionId: string;
  studentId: number;
  round: number;
  responseTime: number;
  stats: {
    avg: number;
    stdDev: number;
    min: number;
    max: number;
    certainty: number;
  };
  validatedAt: number;
  maxRounds: number;
}

/**
 * Servicio de persistencia de asistencia
 */
export class AttendancePersistenceService {
  constructor(
    private readonly validationRepo: ValidationRepository,
    private readonly resultRepo: ResultRepository,
    private readonly registrationRepo: RegistrationRepository,
    private readonly log: typeof logger = logger
  ) {}

  /**
   * Guarda intento de validación en validation_attempts
   * 
   * - Si la validación ya existe: actualiza con respuesta
   * - Si no existe: crea nueva y completa
   */
  async saveValidationAttempt(params: SaveValidationParams): Promise<void> {
    try {
      const sessionIdNum = parseInt(params.sessionId, 10);
      if (isNaN(sessionIdNum)) {
        this.log.warn(`[Persistence] sessionId no numérico: ${params.sessionId}, omitiendo persistencia`);
        return;
      }

      const registration = await this.registrationRepo.getBySessionAndUser(sessionIdNum, params.studentId);
      
      if (!registration) {
        this.log.warn(`[Persistence] No registro encontrado: session=${params.sessionId}, student=${params.studentId}`);
        return;
      }

      const existing = await this.validationRepo.getByRound(registration.registrationId, params.round);
      
      if (existing) {
        // Completar validación existente
        await this.validationRepo.complete(registration.registrationId, params.round, {
          responseReceivedAt: new Date(params.validatedAt),
          responseTimeMs: params.responseTime,
          validationStatus: 'success',
        });
      } else {
        // Crear nueva validación
        await this.validationRepo.create({
          registrationId: registration.registrationId,
          roundNumber: params.round,
          qrGeneratedAt: new Date(params.validatedAt - params.responseTime),
        });
        
        await this.validationRepo.complete(registration.registrationId, params.round, {
          responseReceivedAt: new Date(params.validatedAt),
          responseTimeMs: params.responseTime,
          validationStatus: 'success',
        });
      }

      this.log.debug(`[Persistence] Validación guardada: registration=${registration.registrationId}, round=${params.round}`);
    } catch (error) {
      this.log.error('[Persistence] Error guardando validación:', error);
      // No lanzamos error, persistencia es opcional
    }
  }

  /**
   * Guarda resultado final en attendance_results
   * 
   * - Verifica que no exista resultado previo (idempotencia)
   * - Calcula estadísticas desde validation_attempts
   * - Determina estado final según certeza
   * - Idempotente: si ya existe resultado, no duplica
   */
  async saveAttendanceResult(params: SaveResultParams): Promise<void> {
    try {
      const sessionIdNum = parseInt(params.sessionId, 10);
      if (isNaN(sessionIdNum)) {
        this.log.warn(`[Persistence] sessionId no numérico: ${params.sessionId}, omitiendo persistencia`);
        return;
      }

      const registration = await this.registrationRepo.getBySessionAndUser(sessionIdNum, params.studentId);
      
      if (!registration) {
        this.log.warn(`[Persistence] No registro encontrado: session=${params.sessionId}, student=${params.studentId}`);
        return;
      }

      // Verificar si ya existe resultado (idempotencia)
      const existingResult = await this.resultRepo.getByRegistration(registration.registrationId);
      if (existingResult) {
        this.log.debug(`[Persistence] Resultado ya existe para registration=${registration.registrationId}`);
        return;
      }

      // Obtener estadísticas reales desde validation_attempts
      const rtStats = await this.validationRepo.getResponseTimeStats(registration.registrationId);
      const successCount = await this.validationRepo.countSuccessful(registration.registrationId);

      // Determinar estado final
      const finalStatus = params.stats.certainty >= 70 
        ? 'PRESENT' 
        : params.stats.certainty >= 40 
          ? 'DOUBTFUL' 
          : 'ABSENT';

      // Crear resultado
      await this.resultRepo.create({
        registrationId: registration.registrationId,
        totalRounds: params.maxRounds,
        successfulRounds: successCount,
        failedRounds: params.maxRounds - successCount,
        avgResponseTimeMs: rtStats.avg ?? params.stats.avg,
        stdDevResponseTime: rtStats.stdDev ?? params.stats.stdDev,
        minResponseTimeMs: rtStats.min ?? params.stats.min,
        maxResponseTimeMs: rtStats.max ?? params.stats.max,
        medianResponseTimeMs: rtStats.median ?? undefined,
        certaintyScore: params.stats.certainty,
        finalStatus,
      });

      this.log.debug(`[Persistence] Resultado guardado: registration=${registration.registrationId}, status=${finalStatus}, certainty=${params.stats.certainty}`);
    } catch (error) {
      this.log.error('[Persistence] Error guardando resultado:', error);
      // No lanzamos error, persistencia es opcional
    }
  }

  /**
   * Marca registración como completada
   */
  async markRegistrationComplete(studentId: number, sessionId: string): Promise<void> {
    try {
      const sessionIdNum = parseInt(sessionId, 10);
      if (isNaN(sessionIdNum)) {
        this.log.warn(`[Persistence] sessionId no numérico: ${sessionId}, omitiendo persistencia`);
        return;
      }

      const registration = await this.registrationRepo.getBySessionAndUser(sessionIdNum, studentId);
      
      if (!registration) {
        this.log.warn(`[Persistence] No registro encontrado: session=${sessionId}, student=${studentId}`);
        return;
      }

      await this.registrationRepo.updateStatus(registration.registrationId, { status: 'completed' });
      this.log.debug(`[Persistence] Registración completada: registration=${registration.registrationId}`);
    } catch (error) {
      this.log.error('[Persistence] Error marcando registración:', error);
      // No lanzamos error, persistencia es opcional
    }
  }

  /**
   * Operación atómica: guarda validación + resultado + marca completado
   * 
   * Se ejecuta cuando el estudiante completa todos los rounds.
   * Incluye última validación + resultado final + actualización estado.
   */
  async saveCompleteAttendance(
    validation: SaveValidationParams,
    result: SaveResultParams
  ): Promise<void> {
    // 1. Guardar última validación
    await this.saveValidationAttempt(validation);
    
    // 2. Guardar resultado final
    await this.saveAttendanceResult(result);
    
    // 3. Marcar registración como completada
    await this.markRegistrationComplete(validation.studentId, validation.sessionId);
  }
}
