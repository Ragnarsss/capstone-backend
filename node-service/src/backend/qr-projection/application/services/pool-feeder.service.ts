import { PayloadBuilder } from '../../domain/services';
import type { QRPayloadV1 } from '../../domain/models';
import { AesGcmService } from '../../../../shared/infrastructure/crypto';
import { ProjectionPoolRepository, type PoolEntry } from '../../../../shared/infrastructure/valkey';
import { QRPayloadRepository } from '../../infrastructure/qr-payload.repository';
import { SessionKeyRepository } from '../../../session/infrastructure/repositories/session-key.repository';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * Input para alimentar un QR de estudiante al pool
 */
export interface FeedStudentInput {
  readonly sessionId: string;
  readonly studentId: number;
  readonly roundNumber: number;
  readonly hostUserId: number;
  /** TTL en segundos para el payload almacenado */
  readonly payloadTTL?: number;
}

/**
 * Resultado de alimentar un QR al pool
 */
export interface FeedResult {
  readonly success: boolean;
  readonly payload?: QRPayloadV1;
  readonly encrypted?: string;
  readonly poolEntryId?: string;
  readonly error?: string;
}

/**
 * PoolFeeder - Application Service
 * 
 * Responsabilidad UNICA: Alimentar QRs de estudiantes al pool de proyeccion
 * 
 * Flujo:
 * 1. Obtener session_key del estudiante (SessionKeyRepository)
 * 2. Construir payload (PayloadBuilder)
 * 3. Encriptar con clave especifica del estudiante (AesGcmService)
 * 4. Almacenar para validacion (QRPayloadRepository)
 * 5. Insertar en pool de proyeccion (ProjectionPoolRepository)
 * 
 * Este servicio NO maneja:
 * - Estado del estudiante (responsabilidad de StudentSessionRepository)
 * - Balanceo de fakes (responsabilidad de PoolBalancer)
 * - Emision por WebSocket (responsabilidad de QREmitter)
 */
export class PoolFeeder {
  private readonly fallbackAesGcmService: AesGcmService;
  private readonly poolRepo: ProjectionPoolRepository;
  private readonly payloadRepo: QRPayloadRepository;
  private readonly sessionKeyRepo: SessionKeyRepository;
  private readonly defaultTTL: number;

  constructor(
    aesGcmService?: AesGcmService,
    poolRepo?: ProjectionPoolRepository,
    payloadRepo?: QRPayloadRepository,
    defaultTTL: number = 60,
    sessionKeyRepo?: SessionKeyRepository
  ) {
    this.fallbackAesGcmService = aesGcmService ?? new AesGcmService();
    this.poolRepo = poolRepo ?? new ProjectionPoolRepository();
    this.payloadRepo = payloadRepo ?? new QRPayloadRepository(defaultTTL);
    this.sessionKeyRepo = sessionKeyRepo ?? new SessionKeyRepository();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Alimenta un QR de estudiante al pool de proyeccion
   * 
   * @param input - Datos del estudiante y sesion
   * @returns Resultado con payload y encrypted string
   */
  async feedStudentQR(input: FeedStudentInput): Promise<FeedResult> {
    try {
      // 1. Obtener session_key del estudiante desde Valkey
      const sessionKeyData = await this.sessionKeyRepo.findByUserId(input.studentId);
      
      // Seleccionar servicio de encriptación
      let aesService: AesGcmService;
      if (sessionKeyData) {
        // Usar session_key real del estudiante
        aesService = new AesGcmService(sessionKeyData.sessionKey);
        logger.debug(`[PoolFeeder] Usando session_key real para estudiante ${input.studentId}`);
      } else {
        // Fallback a mock key (solo desarrollo)
        aesService = this.fallbackAesGcmService;
        logger.warn(`[PoolFeeder] Sin session_key para estudiante ${input.studentId}, usando fallback`);
      }

      // 2. Construir payload (dominio puro)
      const payload = PayloadBuilder.buildStudentPayload({
        sessionId: input.sessionId,
        hostUserId: input.hostUserId,
        roundNumber: input.roundNumber,
      });

      // 3. Encriptar con AES-256-GCM usando la clave apropiada
      const plaintext = PayloadBuilder.toJsonString(payload);
      const encryptResult = aesService.encryptToPayload(plaintext);
      const encrypted = encryptResult.encrypted;

      // 4. Almacenar para validacion posterior
      const ttl = input.payloadTTL ?? this.defaultTTL;
      await this.payloadRepo.store(payload, encrypted, ttl);

      // 5. Insertar/actualizar en pool de proyeccion
      const poolEntryId = await this.poolRepo.upsertStudentQR(
        input.sessionId,
        input.studentId,
        encrypted,
        input.roundNumber
      );

      return {
        success: true,
        payload,
        encrypted,
        poolEntryId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[PoolFeeder] Error feeding student QR:', message);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Alimenta multiples QRs de estudiantes al pool
   * Util para registro masivo
   * 
   * @param inputs - Array de inputs
   * @returns Array de resultados
   */
  async feedMultiple(inputs: FeedStudentInput[]): Promise<FeedResult[]> {
    const results: FeedResult[] = [];
    
    for (const input of inputs) {
      const result = await this.feedStudentQR(input);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Obtiene el nonce del payload generado
   * Util para actualizar el estado del estudiante con el QR activo
   * 
   * @param payload - Payload generado
   * @returns Nonce del payload
   */
  static getNonce(payload: QRPayloadV1): string {
    return payload.n;
  }
}
