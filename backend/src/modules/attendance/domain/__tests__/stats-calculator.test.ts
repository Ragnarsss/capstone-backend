/**
 * Tests para Stats Calculator
 *
 * @description Tests para funciones puras de cálculo de estadísticas
 * @coverage Target: 100%
 */

import { describe, it, expect } from "vitest";
import { calculateStats, type ResponseTimeStats } from "../stats-calculator";

describe("calculateStats()", () => {
  describe("Casos vacíos", () => {
    it("debe retornar stats en cero cuando array está vacío", () => {
      const result = calculateStats([]);

      expect(result).toEqual({
        avg: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        certainty: 0,
      });
    });
  });

  describe("Caso con un solo valor", () => {
    it("debe calcular stats con stdDev = 0", () => {
      const result = calculateStats([1000]);

      expect(result.avg).toBe(1000);
      expect(result.stdDev).toBe(0);
      expect(result.min).toBe(1000);
      expect(result.max).toBe(1000);
      expect(result.certainty).toBeGreaterThan(0);
    });
  });

  describe("Cálculos básicos", () => {
    it("debe calcular promedio correctamente", () => {
      const result = calculateStats([1000, 2000, 3000]);

      expect(result.avg).toBe(2000);
    });

    it("debe calcular min y max correctamente", () => {
      const result = calculateStats([500, 1500, 3000]);

      expect(result.min).toBe(500);
      expect(result.max).toBe(3000);
    });

    it("debe redondear valores a enteros", () => {
      const result = calculateStats([999, 1001]); // avg = 1000, stdDev = 1

      expect(Number.isInteger(result.avg)).toBe(true);
      expect(Number.isInteger(result.stdDev)).toBe(true);
      expect(Number.isInteger(result.min)).toBe(true);
      expect(Number.isInteger(result.max)).toBe(true);
    });
  });

  describe("Desviación estándar", () => {
    it("debe calcular stdDev = 0 para valores idénticos", () => {
      const result = calculateStats([1000, 1000, 1000, 1000]);

      expect(result.stdDev).toBe(0);
    });

    it("debe calcular stdDev correctamente para valores variables", () => {
      // Valores: 800, 1000, 1200
      // Media = 1000
      // Varianza = ((200)^2 + (0)^2 + (200)^2) / 3 = 80000/3 = 26666.67
      // stdDev = sqrt(26666.67) ≈ 163.3
      const result = calculateStats([800, 1000, 1200]);

      expect(result.avg).toBe(1000);
      expect(result.stdDev).toBeCloseTo(163, 0); // Redondeado
    });

    it("debe calcular stdDev alta para valores muy dispersos", () => {
      const result = calculateStats([100, 5000]);

      expect(result.stdDev).toBeGreaterThan(2000);
    });
  });

  describe("Certeza (Certainty) - Base", () => {
    it("debe tener certeza base de 50%", () => {
      // Valores que no califican para bonus óptimo: tiempo 5-8s + stdDev alto
      const result = calculateStats([6000, 7000, 8000]); // avg ~7000, stdDev ~816

      // Base 50 + consistencia 20 (500-1000) + tiempo marginal 5 (300-8000) = 75
      expect(result.certainty).toBeGreaterThanOrEqual(70);
      expect(result.certainty).toBeLessThanOrEqual(80);
    });
  });

  describe("Certeza - Bonus por consistencia (baja stdDev)", () => {
    it("debe dar +30 puntos si stdDev < 500", () => {
      // Valores muy consistentes
      const result = calculateStats([1000, 1100, 1050, 1080]);

      // stdDev debería ser < 500
      expect(result.stdDev).toBeLessThan(500);
      // Certeza debería ser al menos 50 (base) + 30 (consistencia) + bonus de tiempo
      expect(result.certainty).toBeGreaterThanOrEqual(80);
    });

    it("debe dar +20 puntos si stdDev entre 500-1000", () => {
      // Valores moderadamente consistentes - necesitamos stdDev >= 500
      const result = calculateStats([1000, 2000, 2500, 1000]);

      expect(result.stdDev).toBeGreaterThanOrEqual(500);
      expect(result.stdDev).toBeLessThan(1000);
      expect(result.certainty).toBeGreaterThanOrEqual(70);
    });

    it("debe dar +10 puntos si stdDev entre 1000-2000", () => {
      // Valores poco consistentes pero aceptables - necesitamos stdDev >= 1000
      const result = calculateStats([1000, 3000, 4000, 1500]);

      expect(result.stdDev).toBeGreaterThanOrEqual(1000);
      expect(result.stdDev).toBeLessThan(2000);
      expect(result.certainty).toBeGreaterThanOrEqual(60);
    });

    it("no debe dar bonus si stdDev >= 2000", () => {
      // Valores muy inconsistentes
      const result = calculateStats([1000, 5000, 500, 8000]);

      expect(result.stdDev).toBeGreaterThanOrEqual(2000);
      // Solo certeza base + posible bonus/penalty de tiempo
      expect(result.certainty).toBeLessThanOrEqual(70);
    });
  });

  describe("Certeza - Bonus por tiempo realista", () => {
    it("debe dar +20 puntos si avg entre 800-3000ms (óptimo)", () => {
      // Tiempo de respuesta humano óptimo
      const result = calculateStats([1000, 1200, 1500, 1100]);

      expect(result.avg).toBeGreaterThan(800);
      expect(result.avg).toBeLessThan(3000);
      // Base 50 + consistencia alta 30 + tiempo óptimo 20 = 100
      expect(result.certainty).toBe(100);
    });

    it("debe dar +10 puntos si avg entre 500-5000ms", () => {
      const result = calculateStats([600, 700, 800, 600]);

      expect(result.avg).toBeGreaterThan(500);
      expect(result.avg).toBeLessThan(800);
      // Base 50 + consistencia 30 + tiempo aceptable 10 = 90
      expect(result.certainty).toBeGreaterThanOrEqual(90);
    });

    it("debe dar +5 puntos si avg entre 300-8000ms", () => {
      const result = calculateStats([400, 450, 380, 420]);

      expect(result.avg).toBeGreaterThan(300);
      expect(result.avg).toBeLessThan(500);
      // Base 50 + consistencia 30 + tiempo marginal 5 = 85
      expect(result.certainty).toBeGreaterThanOrEqual(85);
    });
  });

  describe("Certeza - Penalty por tiempos sospechosos", () => {
    it("debe aplicar -20 puntos si avg < 300ms (muy rápido)", () => {
      // Tiempo sospechosamente rápido (posible bot)
      const result = calculateStats([100, 150, 200, 180]);

      expect(result.avg).toBeLessThan(300);
      // Base 50 + consistencia 30 - tiempo sospechoso 20 = 60
      expect(result.certainty).toBeLessThanOrEqual(70);
    });

    it("debe aplicar -20 puntos si avg > 15000ms (muy lento)", () => {
      // Tiempo sospechosamente lento
      const result = calculateStats([16000, 17000, 18000, 16500]);

      expect(result.avg).toBeGreaterThan(15000);
      // Base 50 + consistencia 30 - tiempo sospechoso 20 = 60
      expect(result.certainty).toBeLessThanOrEqual(70);
    });
  });

  describe("Certeza - Límites", () => {
    it("no debe superar 100%", () => {
      // Caso perfecto: consistencia alta + tiempo óptimo
      const result = calculateStats([1000, 1100, 1050, 1080]);

      expect(result.certainty).toBeLessThanOrEqual(100);
    });

    it("no debe ser menor a 0%", () => {
      // Caso extremo: muy rápido e inconsistente
      const result = calculateStats([50, 100, 8000, 200]);

      expect(result.certainty).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Casos de uso reales", () => {
    it("estudiante humano típico (alto certainty)", () => {
      // Response times normales: 1-2 segundos, consistentes
      const result = calculateStats([1200, 1500, 1300, 1400, 1600]);

      expect(result.avg).toBeGreaterThan(1000);
      expect(result.avg).toBeLessThan(2000);
      expect(result.stdDev).toBeLessThan(500);
      expect(result.certainty).toBeGreaterThanOrEqual(90);
    });

    it("estudiante humano lento (medio certainty)", () => {
      // Estudiante que tarda pero es consistente
      const result = calculateStats([4000, 4500, 4200, 4300]);

      expect(result.avg).toBeGreaterThan(3000);
      expect(result.stdDev).toBeLessThan(500);
      // Consistencia alta (30) + tiempo marginal (5) + base (50) = 85-90
      expect(result.certainty).toBeGreaterThanOrEqual(80);
      expect(result.certainty).toBeLessThanOrEqual(95);
    });

    it("posible bot (bajo certainty)", () => {
      // Response times sospechosamente rápidos
      const result = calculateStats([100, 120, 110, 105, 115]);

      expect(result.avg).toBeLessThan(300);
      expect(result.stdDev).toBeLessThan(500);
      // Consistencia alta pero tiempo sospechoso
      expect(result.certainty).toBeLessThan(70);
    });

    it("estudiante inconsistente (bajo certainty)", () => {
      // Tiempos muy variables (posible compartir QR)
      const result = calculateStats([500, 3000, 1000, 9000, 2000]);

      expect(result.stdDev).toBeGreaterThan(2000);
      // Sin bonus de consistencia, solo base (50) + tiempo marginal (5) = 55-60
      expect(result.certainty).toBeLessThanOrEqual(70);
    });
  });

  describe("Edge cases", () => {
    it("debe manejar valores extremadamente grandes", () => {
      const result = calculateStats([999999, 1000000, 1000001]);

      expect(result.avg).toBeCloseTo(1000000, -2);
      expect(Number.isFinite(result.stdDev)).toBe(true);
      expect(Number.isFinite(result.certainty)).toBe(true);
    });

    it("debe manejar valores decimales en entrada", () => {
      const result = calculateStats([1000.5, 1500.7, 1200.3]);

      expect(Number.isInteger(result.avg)).toBe(true);
      expect(Number.isInteger(result.stdDev)).toBe(true);
    });

    it("debe manejar muchos valores", () => {
      const manyValues = Array.from({ length: 1000 }, (_, i) => 1000 + i);
      const result = calculateStats(manyValues);

      expect(result.avg).toBeCloseTo(1500, 0);
      expect(Number.isFinite(result.stdDev)).toBe(true);
    });
  });
});
