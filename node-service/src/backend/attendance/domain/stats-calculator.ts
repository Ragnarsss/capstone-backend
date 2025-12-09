/**
 * Stats Calculator
 * 
 * Calcula estadisticas de Response Time y certeza de asistencia.
 * Logica de dominio pura, sin I/O.
 */

export interface ResponseTimeStats {
  avg: number;
  stdDev: number;
  min: number;
  max: number;
  certainty: number;
}

/**
 * Calcula estadisticas de Response Time y certeza
 * 
 * @param responseTimes - Array de tiempos de respuesta en ms
 * @returns Estadisticas calculadas
 */
export function calculateStats(responseTimes: number[]): ResponseTimeStats {
  if (responseTimes.length === 0) {
    return { avg: 0, stdDev: 0, min: 0, max: 0, certainty: 0 };
  }

  const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const min = Math.min(...responseTimes);
  const max = Math.max(...responseTimes);

  const squaredDiffs = responseTimes.map(rt => Math.pow(rt - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / responseTimes.length;
  const stdDev = Math.sqrt(variance);

  const certainty = calculateCertainty(avg, stdDev);

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
 * - Bonus por consistencia (baja desviacion estandar)
 * - Bonus por tiempo de respuesta realista (800ms - 3000ms optimo)
 * - Penalizacion por tiempos sospechosos (<300ms o >15000ms)
 */
function calculateCertainty(avg: number, stdDev: number): number {
  let certainty = 50; // Base

  // Bonus por consistencia (baja desviacion estandar)
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
    // Tiempos muy rapidos o muy lentos son sospechosos
    certainty -= 20;
  }

  return Math.max(0, Math.min(100, certainty));
}
