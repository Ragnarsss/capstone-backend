/**
 * Validation Pipeline - Context
 * 
 * Define el contexto mutable que pasa por cada stage del pipeline.
 * Cada stage puede leer datos previos y agregar nuevos.
 */

import type { QRPayloadV1 } from '../../../../shared/types';

/**
 * Respuesta desencriptada del estudiante
 */
export interface StudentResponse {
  original: QRPayloadV1;
  studentId: number;
  receivedAt: number;
  totpu?: string; // TOTP derivado de session_key (se valida en pipeline)
}

/**
 * Estado del QR en Valkey
 */
export interface QRState {
  exists: boolean;
  consumed: boolean;
  payload?: QRPayloadV1;
  createdAt?: number;
}

/**
 * Estado del estudiante en la sesion
 */
export interface StudentState {
  registered: boolean;
  status: 'active' | 'completed' | 'failed';
  currentRound: number;
  activeNonce: string | null;
  roundsCompleted: Array<{ round: number; responseTime: number }>;
  currentAttempt: number;
  maxAttempts: number;
  maxRounds: number;
}

/**
 * Error de validacion
 */
export interface ValidationError {
  code: string;
  message: string;
}

/**
 * Entrada en el trace de ejecucion
 */
export interface TraceEntry {
  stage: string;
  passed: boolean;
  durationMs?: number;
}

/**
 * Contexto del pipeline de validacion
 * 
 * Se construye incrementalmente a medida que los stages ejecutan.
 * Los campos opcionales se populan por stages especificos.
 */
export interface ValidationContext {
  // Input (requerido)
  readonly encrypted: string;
  readonly studentId: number;
  readonly startedAt: number;

  // Populated by stages
  response?: StudentResponse;
  qrState?: QRState;
  studentState?: StudentState;

  // Result
  error?: ValidationError;
  failedAt?: string;

  // Debugging
  trace: TraceEntry[];
}

/**
 * Crea un contexto inicial para el pipeline
 */
export function createContext(encrypted: string, studentId: number): ValidationContext {
  return {
    encrypted,
    studentId,
    startedAt: Date.now(),
    trace: [],
  };
}

/**
 * Verifica si el contexto tiene error
 */
export function hasError(ctx: ValidationContext): boolean {
  return ctx.error !== undefined;
}

/**
 * Verifica si el contexto completo la validacion exitosamente
 */
export function isValid(ctx: ValidationContext): boolean {
  return !hasError(ctx) && ctx.response !== undefined;
}
