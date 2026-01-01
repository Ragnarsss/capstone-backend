/**
 * Domain Layer - Attendance Module
 * 
 * Exporta logica de dominio pura: modelos, calculos, validaciones.
 */

// Models
export * from './models';

// Entities
export {
  StudentSession,
  type StudentSessionData,
  type StudentSessionStatus,
  type RoundResult,
  type CompleteRoundResult,
  type FailRoundResult,
} from './student-session.entity';

// Stats Calculator
export { calculateStats, type ResponseTimeStats } from './stats-calculator';

// Validation Pipeline
export * from './validation-pipeline';
