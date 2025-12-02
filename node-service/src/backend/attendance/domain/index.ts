/**
 * Domain Layer - Attendance Module
 * 
 * Exporta logica de dominio pura: modelos, calculos, validaciones.
 */

// Models
export * from './models';

// Stats Calculator
export { calculateStats, type ResponseTimeStats } from './stats-calculator';

// Validation Pipeline
export * from './validation-pipeline';
