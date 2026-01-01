/**
 * Tests para AttendanceStatsCalculator
 * 
 * Verifica la lógica de cálculo de estadísticas de asistencia,
 * incluyendo tiempos de respuesta, desviación estándar y certeza.
 */
import { describe, it, expect } from 'vitest';
import { AttendanceStatsCalculator } from '../attendance-stats-calculator.service';
import type { StatsCalculationContext, StatsCalculationResult } from '../../../../../shared/ports';

describe('AttendanceStatsCalculator', () => {
  const calculator = new AttendanceStatsCalculator();

  describe('calculate', () => {
    describe('con tiempos de respuesta vacíos', () => {
      it('debe retornar estadísticas vacías', () => {
        // Arrange
        const context: StatsCalculationContext = {
          responseTimes: [],
          maxRounds: 3,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert
        expect(result.roundsCompleted).toBe(0);
        expect(result.isFullCompletion).toBe(false);
        expect(result.stats.avg).toBe(0);
        expect(result.stats.stdDev).toBe(0);
        expect(result.stats.min).toBe(0);
        expect(result.stats.max).toBe(0);
        expect(result.stats.certainty).toBe(0);
      });
    });

    describe('con tiempos de respuesta normales', () => {
      it('debe calcular promedio correctamente', () => {
        // Arrange - tiempos: 1000, 1200, 1400 => promedio = 1200
        const context: StatsCalculationContext = {
          responseTimes: [1000, 1200, 1400],
          maxRounds: 3,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert
        expect(result.stats.avg).toBe(1200);
      });

      it('debe calcular min y max correctamente', () => {
        // Arrange
        const context: StatsCalculationContext = {
          responseTimes: [800, 1500, 1200, 2000],
          maxRounds: 4,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert
        expect(result.stats.min).toBe(800);
        expect(result.stats.max).toBe(2000);
      });

      it('debe calcular desviación estándar correctamente', () => {
        // Arrange - tiempos iguales => stdDev = 0
        const context: StatsCalculationContext = {
          responseTimes: [1000, 1000, 1000],
          maxRounds: 3,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert
        expect(result.stats.stdDev).toBe(0);
      });

      it('debe detectar fullCompletion cuando todos los rounds están completos', () => {
        // Arrange
        const context: StatsCalculationContext = {
          responseTimes: [1000, 1200, 1400],
          maxRounds: 3,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert
        expect(result.roundsCompleted).toBe(3);
        expect(result.isFullCompletion).toBe(true);
      });

      it('debe detectar no fullCompletion cuando faltan rounds', () => {
        // Arrange
        const context: StatsCalculationContext = {
          responseTimes: [1000, 1200],
          maxRounds: 3,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert
        expect(result.roundsCompleted).toBe(2);
        expect(result.isFullCompletion).toBe(false);
      });
    });

    describe('cálculo de certeza', () => {
      it('debe dar alta certeza para tiempos consistentes en rango óptimo', () => {
        // Arrange - tiempos consistentes entre 800-3000ms
        const context: StatsCalculationContext = {
          responseTimes: [1200, 1250, 1180, 1220],
          maxRounds: 4,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert - debe tener alta certeza (>70%)
        expect(result.stats.certainty).toBeGreaterThan(70);
        expect(result.stats.certainty).toBeLessThanOrEqual(100);
      });

      it('debe dar menor certeza para tiempos muy dispersos', () => {
        // Arrange - tiempos con mucha variación
        const context: StatsCalculationContext = {
          responseTimes: [500, 5000, 1000, 8000],
          maxRounds: 4,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert - debe tener menor certeza por alta variación
        expect(result.stats.certainty).toBeLessThan(80);
      });

      it('debe penalizar tiempos sospechosamente rápidos (<300ms)', () => {
        // Arrange - tiempos muy rápidos (sospechosos de automatización)
        const context: StatsCalculationContext = {
          responseTimes: [150, 180, 200],
          maxRounds: 3,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert - debe tener certeza reducida
        expect(result.stats.certainty).toBeLessThan(70);
      });

      it('debe penalizar tiempos excesivamente lentos (>15000ms)', () => {
        // Arrange - tiempos muy lentos
        const context: StatsCalculationContext = {
          responseTimes: [18000, 20000, 16000],
          maxRounds: 3,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert - debe tener certeza reducida
        expect(result.stats.certainty).toBeLessThan(70);
      });
    });

    describe('redondeo de valores', () => {
      it('debe redondear avg, stdDev, min, max a enteros', () => {
        // Arrange - tiempos que generarían decimales
        const context: StatsCalculationContext = {
          responseTimes: [1001, 1002, 1003],
          maxRounds: 3,
          sessionId: 'test-session',
          studentId: 1,
        };

        // Act
        const result = calculator.calculate(context);

        // Assert
        expect(Number.isInteger(result.stats.avg)).toBe(true);
        expect(Number.isInteger(result.stats.stdDev)).toBe(true);
        expect(Number.isInteger(result.stats.min)).toBe(true);
        expect(Number.isInteger(result.stats.max)).toBe(true);
      });
    });
  });
});
