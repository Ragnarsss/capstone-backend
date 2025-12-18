/**
 * Puerto: IQRLifecycleManager
 * 
 * Interface para gestión del ciclo de vida de QRs durante el proceso de asistencia.
 * Encapsula la lógica de:
 * - Generación del siguiente QR
 * - Guardado como QR activo del estudiante
 * - Actualización en el pool de proyección
 * 
 * Esto desacopla CompleteScanUseCase de los detalles de infraestructura.
 */

import type { QRPayloadV1 } from '../types';

/**
 * Opciones para generar siguiente QR
 */
export interface NextQROptions {
  /** ID de la sesión de asistencia */
  readonly sessionId: string;
  /** ID del estudiante */
  readonly studentId: number;
  /** Número de round siguiente */
  readonly round: number;
  /** TTL del QR en segundos */
  readonly qrTTL: number;
}

/**
 * Resultado de generación de siguiente QR
 */
export interface NextQRResult {
  /** Payload encriptado para mostrar en QR */
  readonly encrypted: string;
  /** Nonce único del QR (para tracking) */
  readonly nonce: string;
  /** Número de round */
  readonly round: number;
  /** TTL del QR en segundos */
  readonly qrTTL: number;
}

/**
 * Puerto: Gestor de Ciclo de Vida de QRs
 * 
 * Abstracción para gestionar la generación y publicación de QRs.
 * El UseCase usa esta interface para avanzar el flujo sin conocer
 * los detalles de Valkey, pools, etc.
 */
export interface IQRLifecycleManager {
  /**
   * Genera y publica el siguiente QR para un estudiante
   * 
   * Flujo interno:
   * 1. Genera QR con IQRGenerator
   * 2. Guarda como QR activo del estudiante en Valkey
   * 3. Actualiza en pool de proyección para WebSocket
   * 
   * @param options - Opciones de generación
   * @returns Resultado con QR generado
   * @throws Error si falla algún paso crítico
   */
  generateAndPublish(options: NextQROptions): Promise<NextQRResult>;
}
