import type { QRPayloadV1 } from '../types';

/**
 * Puerto: IQRPayloadRepository
 * 
 * Interface para almacenamiento temporal de payloads QR.
 * Permite almacenar y validar payloads generados para escaneo.
 * 
 * Implementaciones:
 * - QRPayloadRepository (qr-projection/infrastructure) - Implementación real con Valkey
 * - MockQRPayloadRepository (tests) - Para testing
 */

/**
 * Datos almacenados para validación de payload
 */
export interface StoredPayload {
  /** Payload original (para validación) */
  payload: QRPayloadV1;
  /** Payload encriptado (el que va en el QR) */
  encrypted: string;
  /** Timestamp de creación */
  createdAt: number;
  /** Si ya fue consumido (escaneado exitosamente) */
  consumed: boolean;
  /** ID del estudiante que lo consumió (si aplica) */
  consumedBy?: number;
  /** Timestamp de consumo */
  consumedAt?: number;
}

/**
 * Resultado de validación de payload
 */
export interface PayloadValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Puerto: Repositorio de Payloads QR
 * 
 * Abstracción para almacenamiento temporal de payloads QR.
 * Los payloads tienen TTL corto y se usan para validar escaneos.
 */
export interface IQRPayloadRepository {
  /**
   * Almacena un payload generado
   * 
   * @param payload - Payload V1 estructurado
   * @param encrypted - String encriptado del payload
   * @param ttl - TTL opcional en segundos
   */
  store(payload: QRPayloadV1, encrypted: string, ttl?: number): Promise<void>;

  /**
   * Busca un payload por su nonce
   * 
   * @param nonce - Nonce del payload
   * @returns StoredPayload o null si no existe/expiró
   */
  findByNonce(nonce: string): Promise<StoredPayload | null>;

  /**
   * Valida un payload escaneado
   * 
   * @param payload - Payload recibido del escaneo
   * @returns Resultado de validación
   */
  validate(payload: QRPayloadV1): Promise<PayloadValidationResult>;

  /**
   * Marca un payload como consumido
   * 
   * @param nonce - Nonce del payload
   * @param consumedBy - ID del estudiante que lo consumió
   * @returns true si se marcó exitosamente
   */
  markAsConsumed(nonce: string, consumedBy: number): Promise<boolean>;

  /**
   * Elimina un payload (cleanup manual)
   * 
   * @param nonce - Nonce del payload
   */
  delete(nonce: string): Promise<void>;

  /**
   * Obtiene conteo de payloads activos para una sesión
   * 
   * @param sessionId - ID de la sesión
   * @returns Conteo de payloads activos (no consumidos)
   */
  countActiveForSession(sessionId: string): Promise<number>;
}
