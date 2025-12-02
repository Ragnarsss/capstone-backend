import type { QRPayloadV1 } from '../domain/models';
import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';

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
 * Repository para almacenamiento temporal de payloads QR
 * 
 * Responsabilidad: Almacenar payloads generados para validación posterior
 * 
 * Estrategia:
 * - Cada payload se almacena con TTL corto (configurable, default 30s)
 * - La clave incluye el nonce para lookup rápido
 * - Permite validar que un payload escaneado fue realmente generado
 * - Previene replay attacks marcando payloads como consumidos
 */
export class QRPayloadRepository {
  private client = ValkeyClient.getInstance().getClient();
  
  /** TTL por defecto en segundos */
  private readonly defaultTTL: number;
  
  /** Prefijo para claves de payload */
  private static readonly KEY_PREFIX = 'qr:payload:';

  /**
   * Constructor
   * @param ttlSeconds - TTL en segundos para payloads (default: 30)
   */
  constructor(ttlSeconds = 30) {
    this.defaultTTL = ttlSeconds;
  }

  /**
   * Almacena un payload generado
   * @param payload - Payload V1 estructurado
   * @param encrypted - String encriptado del payload
   * @param ttl - TTL opcional (usa default si no se especifica)
   */
  async store(payload: QRPayloadV1, encrypted: string, ttl?: number): Promise<void> {
    const key = this.buildKey(payload.n);
    
    const stored: StoredPayload = {
      payload,
      encrypted,
      createdAt: Date.now(),
      consumed: false,
    };

    // Almacenar como JSON string
    await this.client.setex(
      key,
      ttl ?? this.defaultTTL,
      JSON.stringify(stored)
    );

    console.debug(`[QRPayloadRepository] Stored payload nonce=${payload.n.substring(0, 8)}... TTL=${ttl ?? this.defaultTTL}s`);
  }

  /**
   * Busca un payload por su nonce
   * @param nonce - Nonce del payload
   * @returns StoredPayload o null si no existe/expiró
   */
  async findByNonce(nonce: string): Promise<StoredPayload | null> {
    const key = this.buildKey(nonce);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as StoredPayload;
    } catch (error) {
      console.error(`[QRPayloadRepository] Error parsing stored payload:`, error);
      return null;
    }
  }

  /**
   * Valida un payload escaneado
   * @param payload - Payload recibido del escaneo
   * @returns true si el payload es válido y no ha sido consumido
   */
  async validate(payload: QRPayloadV1): Promise<{ valid: boolean; reason?: string }> {
    const stored = await this.findByNonce(payload.n);

    if (!stored) {
      return { valid: false, reason: 'PAYLOAD_NOT_FOUND_OR_EXPIRED' };
    }

    // Verificar que no ha sido consumido
    if (stored.consumed) {
      return { valid: false, reason: 'PAYLOAD_ALREADY_CONSUMED' };
    }

    // Verificar que los datos coinciden
    if (stored.payload.sid !== payload.sid) {
      return { valid: false, reason: 'SESSION_ID_MISMATCH' };
    }

    if (stored.payload.uid !== payload.uid) {
      return { valid: false, reason: 'USER_ID_MISMATCH' };
    }

    if (stored.payload.r !== payload.r) {
      return { valid: false, reason: 'ROUND_MISMATCH' };
    }

    if (stored.payload.ts !== payload.ts) {
      return { valid: false, reason: 'TIMESTAMP_MISMATCH' };
    }

    return { valid: true };
  }

  /**
   * Marca un payload como consumido
   * @param nonce - Nonce del payload
   * @param consumedBy - ID del estudiante que lo consumió
   * @returns true si se marcó exitosamente
   */
  async markAsConsumed(nonce: string, consumedBy: number): Promise<boolean> {
    const stored = await this.findByNonce(nonce);

    if (!stored) {
      return false;
    }

    if (stored.consumed) {
      return false; // Ya estaba consumido
    }

    // Actualizar con consumo
    stored.consumed = true;
    stored.consumedBy = consumedBy;
    stored.consumedAt = Date.now();

    const key = this.buildKey(nonce);
    
    // Obtener TTL restante
    const ttl = await this.client.ttl(key);
    
    if (ttl > 0) {
      await this.client.setex(key, ttl, JSON.stringify(stored));
    }

    console.debug(`[QRPayloadRepository] Marked as consumed nonce=${nonce.substring(0, 8)}... by user=${consumedBy}`);
    return true;
  }

  /**
   * Elimina un payload (cleanup manual)
   * @param nonce - Nonce del payload
   */
  async delete(nonce: string): Promise<void> {
    const key = this.buildKey(nonce);
    await this.client.del(key);
  }

  /**
   * Obtiene estadísticas de payloads activos para una sesión
   * @param sessionId - ID de la sesión
   * @returns Conteo de payloads activos
   */
  async countActiveForSession(sessionId: string): Promise<number> {
    // Usamos SCAN para encontrar claves que pertenecen a esta sesión
    // Nota: Esto es O(n) pero para validación/debug es útil
    const pattern = `${QRPayloadRepository.KEY_PREFIX}*`;
    let cursor = '0';
    let count = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          try {
            const stored = JSON.parse(data) as StoredPayload;
            if (stored.payload.sid === sessionId && !stored.consumed) {
              count++;
            }
          } catch {
            // Ignorar errores de parsing
          }
        }
      }
    } while (cursor !== '0');

    return count;
  }

  /**
   * Construye la clave de Valkey para un payload
   * Usa el nonce como identificador único
   */
  private buildKey(nonce: string): string {
    return `${QRPayloadRepository.KEY_PREFIX}${nonce}`;
  }
}
