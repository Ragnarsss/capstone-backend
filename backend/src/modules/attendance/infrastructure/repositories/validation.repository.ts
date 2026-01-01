/**
 * ValidationRepository - Persistencia de validaciones en PostgreSQL
 * 
 * Tabla: attendance.validations
 * Responsabilidad: Guardar cada ronda de validación individual
 */

import { PostgresPool } from '../../../../shared/infrastructure/database/postgres-pool';

/**
 * Entidad de validación para persistencia
 */
export interface ValidationEntity {
  validationId: number;
  registrationId: number;
  roundNumber: number;
  qrGeneratedAt: Date;
  qrScannedAt: Date | null;
  responseReceivedAt: Date | null;
  responseTimeMs: number | null;
  totpuValid: boolean | null;
  totpsValid: boolean | null;
  rtValid: boolean | null;
  secretValid: boolean | null;
  validationStatus: 'success' | 'failed' | 'timeout' | 'invalid' | null;
  failedAttempts: number;
  createdAt: Date;
}

/**
 * DTO para crear una validación (cuando se genera el QR)
 */
export interface CreateValidationDTO {
  registrationId: number;
  roundNumber: number;
  qrGeneratedAt: Date;
}

/**
 * DTO para completar una validación (cuando se recibe respuesta)
 */
export interface CompleteValidationDTO {
  qrScannedAt?: Date;
  responseReceivedAt: Date;
  responseTimeMs: number;
  totpuValid?: boolean;
  totpsValid?: boolean;
  rtValid?: boolean;
  secretValid?: boolean;
  validationStatus: 'success' | 'failed' | 'timeout' | 'invalid';
}

/**
 * Repositorio de validaciones individuales
 */
export class ValidationRepository {
  private db: PostgresPool;

  constructor(db?: PostgresPool) {
    this.db = db ?? PostgresPool.getInstance();
  }

  /**
   * Crea un registro de validación cuando se genera el QR
   */
  async create(dto: CreateValidationDTO): Promise<ValidationEntity> {
    const sql = `
      INSERT INTO attendance.validations (
        registration_id,
        round_number,
        qr_generated_at
      ) VALUES ($1, $2, $3)
      RETURNING *
    `;

    const params = [
      dto.registrationId,
      dto.roundNumber,
      dto.qrGeneratedAt,
    ];

    const result = await this.db.query(sql, params);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Completa una validación cuando se recibe la respuesta del estudiante
   */
  async complete(
    registrationId: number,
    roundNumber: number,
    dto: CompleteValidationDTO
  ): Promise<ValidationEntity | null> {
    const sql = `
      UPDATE attendance.validations
      SET
        qr_scanned_at = COALESCE($3, qr_scanned_at),
        response_received_at = $4,
        response_time_ms = $5,
        totpu_valid = $6,
        totps_valid = $7,
        rt_valid = $8,
        secret_valid = $9,
        validation_status = $10
      WHERE registration_id = $1 AND round_number = $2
      RETURNING *
    `;

    const params = [
      registrationId,
      roundNumber,
      dto.qrScannedAt ?? null,
      dto.responseReceivedAt,
      dto.responseTimeMs,
      dto.totpuValid ?? null,
      dto.totpsValid ?? null,
      dto.rtValid ?? null,
      dto.secretValid ?? null,
      dto.validationStatus,
    ];

    const result = await this.db.query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Incrementa contador de intentos fallidos
   */
  async incrementFailedAttempts(
    registrationId: number,
    roundNumber: number
  ): Promise<number> {
    const sql = `
      UPDATE attendance.validations
      SET failed_attempts = failed_attempts + 1
      WHERE registration_id = $1 AND round_number = $2
      RETURNING failed_attempts
    `;

    const result = await this.db.query(sql, [registrationId, roundNumber]);
    
    if (result.rows.length === 0) {
      return 0;
    }

    return result.rows[0].failed_attempts;
  }

  /**
   * Obtiene validación por registration y round
   */
  async getByRound(
    registrationId: number,
    roundNumber: number
  ): Promise<ValidationEntity | null> {
    const sql = `
      SELECT * FROM attendance.validations
      WHERE registration_id = $1 AND round_number = $2
    `;

    const result = await this.db.query(sql, [registrationId, roundNumber]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Lista todas las validaciones de un registro
   */
  async listByRegistration(registrationId: number): Promise<ValidationEntity[]> {
    const sql = `
      SELECT * FROM attendance.validations
      WHERE registration_id = $1
      ORDER BY round_number ASC
    `;

    const result = await this.db.query(sql, [registrationId]);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Cuenta validaciones exitosas de un registro
   */
  async countSuccessful(registrationId: number): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM attendance.validations
      WHERE registration_id = $1 AND validation_status = 'success'
    `;

    const result = await this.db.query(sql, [registrationId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Obtiene estadísticas de response time para un registro
   */
  async getResponseTimeStats(registrationId: number): Promise<{
    avg: number | null;
    stdDev: number | null;
    min: number | null;
    max: number | null;
    median: number | null;
  }> {
    const sql = `
      SELECT
        AVG(response_time_ms) as avg,
        STDDEV(response_time_ms) as std_dev,
        MIN(response_time_ms) as min,
        MAX(response_time_ms) as max,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms) as median
      FROM attendance.validations
      WHERE registration_id = $1 
        AND validation_status = 'success'
        AND response_time_ms IS NOT NULL
    `;

    const result = await this.db.query(sql, [registrationId]);
    const row = result.rows[0];

    return {
      avg: row.avg ? parseFloat(row.avg) : null,
      stdDev: row.std_dev ? parseFloat(row.std_dev) : null,
      min: row.min ? parseFloat(row.min) : null,
      max: row.max ? parseFloat(row.max) : null,
      median: row.median ? parseFloat(row.median) : null,
    };
  }

  /**
   * Mapea una fila de DB a entidad
   */
  private mapRow(row: Record<string, unknown>): ValidationEntity {
    return {
      validationId: row.validation_id as number,
      registrationId: row.registration_id as number,
      roundNumber: row.round_number as number,
      qrGeneratedAt: row.qr_generated_at as Date,
      qrScannedAt: row.qr_scanned_at as Date | null,
      responseReceivedAt: row.response_received_at as Date | null,
      responseTimeMs: row.response_time_ms as number | null,
      totpuValid: row.totpu_valid as boolean | null,
      totpsValid: row.totps_valid as boolean | null,
      rtValid: row.rt_valid as boolean | null,
      secretValid: row.secret_valid as boolean | null,
      validationStatus: row.validation_status as ValidationEntity['validationStatus'],
      failedAttempts: row.failed_attempts as number,
      createdAt: row.created_at as Date,
    };
  }
}
