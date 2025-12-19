/**
 * Constantes de configuracion por defecto para el modulo de Attendance
 * 
 * Centraliza valores que se usan en multiples archivos:
 * - StudentSessionRepository
 * - ParticipationService
 * - CompleteScanUseCase
 */

/** Numero de rounds que debe completar un estudiante */
export const DEFAULT_MAX_ROUNDS = 3;

/** Numero maximo de intentos antes de fallar permanentemente */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Tiempo de vida del QR en segundos */
export const DEFAULT_QR_TTL_SECONDS = parseInt(process.env.QR_TTL_SECONDS || '60', 10);

/** Tamano minimo del pool de QRs (incluyendo fakes/decoys) */
export const DEFAULT_MIN_POOL_SIZE = parseInt(process.env.MIN_POOL_SIZE || '10', 10);
