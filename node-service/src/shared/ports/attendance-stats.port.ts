/**
 * Puerto: IAttendanceStatsCalculator
 * 
 * Interface para cálculo de estadísticas de asistencia.
 * Encapsula la lógica de cálculo de certeza, tiempos de respuesta y métricas.
 * 
 * La implementación reside en domain/ porque es lógica pura sin I/O.
 */

/**
 * Estadísticas de tiempos de respuesta
 */
export interface ResponseTimeStats {
  /** Promedio de tiempos de respuesta en ms */
  readonly avg: number;
  /** Desviación estándar */
  readonly stdDev: number;
  /** Tiempo mínimo */
  readonly min: number;
  /** Tiempo máximo */
  readonly max: number;
  /** Certeza de asistencia (0-100) */
  readonly certainty: number;
}

/**
 * Contexto para cálculo de estadísticas
 */
export interface StatsCalculationContext {
  /** Tiempos de respuesta de cada round completado */
  readonly responseTimes: number[];
  /** Número total de rounds configurados */
  readonly maxRounds: number;
  /** ID de sesión (para logging/trazabilidad) */
  readonly sessionId: string;
  /** ID de estudiante (para logging/trazabilidad) */
  readonly studentId: number;
}

/**
 * Resultado del cálculo de estadísticas
 */
export interface StatsCalculationResult {
  /** Estadísticas de tiempos de respuesta */
  readonly stats: ResponseTimeStats;
  /** Número de rounds completados */
  readonly roundsCompleted: number;
  /** Indica si el estudiante completó todos los rounds requeridos */
  readonly isFullCompletion: boolean;
}

/**
 * Puerto: Calculador de Estadísticas de Asistencia
 * 
 * Abstracción para cálculo de métricas de asistencia.
 * Permite que el UseCase dependa de una interface, facilitando testing.
 */
export interface IAttendanceStatsCalculator {
  /**
   * Calcula estadísticas de asistencia
   * 
   * @param context - Contexto con tiempos y configuración
   * @returns Estadísticas calculadas
   */
  calculate(context: StatsCalculationContext): StatsCalculationResult;
}
