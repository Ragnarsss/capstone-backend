import { PayloadBuilder } from '../../domain/services';
import type { QRPayloadV1 } from '../../domain/models';
import { AesGcmService } from '../../../../shared/infrastructure/crypto';
import { ProjectionPoolRepository, type PoolEntry } from '../../../../shared/infrastructure/valkey';
import { QRPayloadRepository } from '../../infrastructure/qr-payload.repository';
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
 * 1. Construir payload (PayloadBuilder)
 * 2. Encriptar (AesGcmService)
 * 3. Almacenar para validacion (QRPayloadRepository)
 * 4. Insertar en pool de proyeccion (ProjectionPoolRepository)
 * 
 * Este servicio NO maneja:
 * - Estado del estudiante (responsabilidad de StudentSessionRepository)
 * - Balanceo de fakes (responsabilidad de PoolBalancer)
 * - Emision por WebSocket (responsabilidad de QREmitter)
 */
export class PoolFeeder {
  private readonly aesGcmService: AesGcmService;
  private readonly poolRepo: ProjectionPoolRepository;
  private readonly payloadRepo: QRPayloadRepository;
  private readonly defaultTTL: number;

  constructor(
    aesGcmService?: AesGcmService,
    poolRepo?: ProjectionPoolRepository,
    payloadRepo?: QRPayloadRepository,
    defaultTTL: number = 60
  ) {
    this.aesGcmService = aesGcmService ?? new AesGcmService();
    this.poolRepo = poolRepo ?? new ProjectionPoolRepository();
    this.payloadRepo = payloadRepo ?? new QRPayloadRepository(defaultTTL);
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
      // 1. Construir payload (dominio puro)
      const payload = PayloadBuilder.buildStudentPayload({
        sessionId: input.sessionId,
        hostUserId: input.hostUserId,
        roundNumber: input.roundNumber,
      });

      // 2. Encriptar con AES-256-GCM
      const plaintext = PayloadBuilder.toJsonString(payload);
      const encryptResult = this.aesGcmService.encryptToPayload(plaintext);
      const encrypted = encryptResult.encrypted;

      // 3. Almacenar para validacion posterior
      const ttl = input.payloadTTL ?? this.defaultTTL;
      await this.payloadRepo.store(payload, encrypted, ttl);

      // 4. Insertar/actualizar en pool de proyeccion
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
