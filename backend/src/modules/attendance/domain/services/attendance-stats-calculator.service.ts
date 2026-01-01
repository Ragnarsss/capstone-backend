/**
 * AttendanceStatsCalculator
 * 
 * Implementación del puerto IAttendanceStatsCalculator.
 * Servicio de dominio que encapsula la lógica de cálculo de estadísticas.
 * 
 * Es lógica pura de dominio (sin I/O), por lo que reside en domain/.
 */

import type { 
  IAttendanceStatsCalculator, 
  StatsCalculationContext, 
  StatsCalculationResult,
  ResponseTimeStats 
} from '../../../../shared/ports';

/**
 * Implementación del calculador de estadísticas de asistencia
 */
export class AttendanceStatsCalculator implements IAttendanceStatsCalculator {
  /**
   * Calcula estadísticas de asistencia basadas en tiempos de respuesta
   * 
   * @param context - Contexto con tiempos y configuración
   * @returns Estadísticas calculadas
   */
  calculate(context: StatsCalculationContext): StatsCalculationResult {
    const { responseTimes, maxRounds } = context;

    if (responseTimes.length === 0) {
      return {
        stats: this.emptyStats(),
        roundsCompleted: 0,
        isFullCompletion: false,
      };
    }

    const stats = this.calculateResponseTimeStats(responseTimes);

    return {
      stats,
      roundsCompleted: responseTimes.length,
      isFullCompletion: responseTimes.length >= maxRounds,
    };
  }

  /**
   * Calcula estadísticas de tiempos de respuesta
   */
  private calculateResponseTimeStats(responseTimes: number[]): ResponseTimeStats {
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const min = Math.min(...responseTimes);
    const max = Math.max(...responseTimes);

    const squaredDiffs = responseTimes.map(rt => Math.pow(rt - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);

    const certainty = this.calculateCertainty(avg, stdDev);

    return {
      avg: Math.round(avg),
      stdDev: Math.round(stdDev),
      min: Math.round(min),
      max: Math.round(max),
      certainty,
    };
  }

  /**
   * Calcula certeza basada en consistencia y rango de tiempos
   * 
   * Algoritmo:
   * - Base: 50%
   * - Bonus por consistencia (baja desviación estándar)
   * - Bonus por tiempo de respuesta realista (800ms - 3000ms óptimo)
   * - Penalización por tiempos sospechosos (<300ms o >15000ms)
   */
  private calculateCertainty(avg: number, stdDev: number): number {
    let certainty = 50; // Base

    // Bonus por consistencia (baja desviación estándar)
    if (stdDev < 500) {
      certainty += 30;
    } else if (stdDev < 1000) {
      certainty += 20;
    } else if (stdDev < 2000) {
      certainty += 10;
    }

    // Bonus por tiempo de respuesta realista
    if (avg > 800 && avg < 3000) {
      certainty += 20;
    } else if (avg > 500 && avg < 5000) {
      certainty += 10;
    } else if (avg > 300 && avg < 8000) {
      certainty += 5;
    } else if (avg < 300 || avg > 15000) {
      // Tiempos muy rápidos o muy lentos son sospechosos
      certainty -= 20;
    }

    return Math.max(0, Math.min(100, certainty));
  }

  /**
   * Retorna estadísticas vacías para casos sin datos
   */
  private emptyStats(): ResponseTimeStats {
    return { avg: 0, stdDev: 0, min: 0, max: 0, certainty: 0 };
  }
}
