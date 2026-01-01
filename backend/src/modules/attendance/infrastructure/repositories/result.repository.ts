/**
 * ResultRepository - Persistencia de resultados finales en PostgreSQL
 * 
 * Tabla: attendance.results
 * Responsabilidad: Guardar resultado consolidado cuando estudiante completa
 */

import { PostgresPool } from '../../../../shared/infrastructure/database/postgres-pool';

/**
 * Entidad de resultado para persistencia
 */
export interface ResultEntity {
  resultId: number;
  registrationId: number;
  totalRounds: number;
  successfulRounds: number;
  failedRounds: number;
  avgResponseTimeMs: number | null;
  stdDevResponseTime: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
  medianResponseTimeMs: number | null;
  certaintyScore: number;
  finalStatus: 'PRESENT' | 'ABSENT' | 'DOUBTFUL' | 'ERROR';
  calculatedAt: Date;
}

/**
 * DTO para crear un resultado
 */
export interface CreateResultDTO {
  registrationId: number;
  totalRounds: number;
  successfulRounds: number;
  failedRounds?: number;
  avgResponseTimeMs?: number;
  stdDevResponseTime?: number;
  minResponseTimeMs?: number;
  maxResponseTimeMs?: number;
  medianResponseTimeMs?: number;
  certaintyScore: number;
  finalStatus: 'PRESENT' | 'ABSENT' | 'DOUBTFUL' | 'ERROR';
}

/**
 * Repositorio de resultados finales
 */
export class ResultRepository {
  private db: PostgresPool;

  constructor(db?: PostgresPool) {
    this.db = db ?? PostgresPool.getInstance();
  }

  /**
   * Crea un resultado final
   */
  async create(dto: CreateResultDTO): Promise<ResultEntity> {
    const sql = `
      INSERT INTO attendance.results (
        registration_id,
        total_rounds,
        successful_rounds,
        failed_rounds,
        avg_response_time_ms,
        std_dev_response_time,
        min_response_time_ms,
        max_response_time_ms,
        median_response_time_ms,
        certainty_score,
        final_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const params = [
      dto.registrationId,
      dto.totalRounds,
      dto.successfulRounds,
      dto.failedRounds ?? 0,
      dto.avgResponseTimeMs ?? null,
      dto.stdDevResponseTime ?? null,
      dto.minResponseTimeMs ?? null,
      dto.maxResponseTimeMs ?? null,
      dto.medianResponseTimeMs ?? null,
      dto.certaintyScore,
      dto.finalStatus,
    ];

    const result = await this.db.query(sql, params);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Obtiene resultado por registration ID
   */
  async getByRegistration(registrationId: number): Promise<ResultEntity | null> {
    const sql = `
      SELECT * FROM attendance.results
      WHERE registration_id = $1
    `;

    const result = await this.db.query(sql, [registrationId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Lista resultados de una sesión (via registrations)
   */
  async listBySession(sessionId: number): Promise<ResultEntity[]> {
    const sql = `
      SELECT r.* FROM attendance.results r
      INNER JOIN attendance.registrations reg ON r.registration_id = reg.registration_id
      WHERE reg.session_id = $1
      ORDER BY r.calculated_at DESC
    `;

    const result = await this.db.query(sql, [sessionId]);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Cuenta resultados por estado final en una sesión
   */
  async countByStatusInSession(
    sessionId: number
  ): Promise<Record<ResultEntity['finalStatus'], number>> {
    const sql = `
      SELECT r.final_status, COUNT(*) as count
      FROM attendance.results r
      INNER JOIN attendance.registrations reg ON r.registration_id = reg.registration_id
      WHERE reg.session_id = $1
      GROUP BY r.final_status
    `;

    const result = await this.db.query(sql, [sessionId]);
    
    const counts: Record<ResultEntity['finalStatus'], number> = {
      PRESENT: 0,
      ABSENT: 0,
      DOUBTFUL: 0,
      ERROR: 0,
    };

    for (const row of result.rows) {
      counts[row.final_status as ResultEntity['finalStatus']] = parseInt(row.count, 10);
    }

    return counts;
  }

  /**
   * Obtiene estadísticas agregadas de una sesión
   */
  async getSessionStats(sessionId: number): Promise<{
    totalStudents: number;
    present: number;
    absent: number;
    doubtful: number;
    error: number;
    avgCertainty: number | null;
  }> {
    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE r.final_status = 'PRESENT') as present,
        COUNT(*) FILTER (WHERE r.final_status = 'ABSENT') as absent,
        COUNT(*) FILTER (WHERE r.final_status = 'DOUBTFUL') as doubtful,
        COUNT(*) FILTER (WHERE r.final_status = 'ERROR') as error,
        AVG(r.certainty_score) as avg_certainty
      FROM attendance.results r
      INNER JOIN attendance.registrations reg ON r.registration_id = reg.registration_id
      WHERE reg.session_id = $1
    `;

    const result = await this.db.query(sql, [sessionId]);
    const row = result.rows[0];

    return {
      totalStudents: parseInt(row.total, 10),
      present: parseInt(row.present, 10),
      absent: parseInt(row.absent, 10),
      doubtful: parseInt(row.doubtful, 10),
      error: parseInt(row.error, 10),
      avgCertainty: row.avg_certainty ? parseFloat(row.avg_certainty) : null,
    };
  }

  /**
   * Verifica si ya existe resultado para un registro
   */
  async exists(registrationId: number): Promise<boolean> {
    const sql = `
      SELECT 1 FROM attendance.results
      WHERE registration_id = $1
      LIMIT 1
    `;

    const result = await this.db.query(sql, [registrationId]);
    return result.rows.length > 0;
  }

  /**
   * Mapea una fila de DB a entidad
   */
  private mapRow(row: Record<string, unknown>): ResultEntity {
    return {
      resultId: row.result_id as number,
      registrationId: row.registration_id as number,
      totalRounds: row.total_rounds as number,
      successfulRounds: row.successful_rounds as number,
      failedRounds: row.failed_rounds as number,
      avgResponseTimeMs: row.avg_response_time_ms as number | null,
      stdDevResponseTime: row.std_dev_response_time as number | null,
      minResponseTimeMs: row.min_response_time_ms as number | null,
      maxResponseTimeMs: row.max_response_time_ms as number | null,
      medianResponseTimeMs: row.median_response_time_ms as number | null,
      certaintyScore: row.certainty_score as number,
      finalStatus: row.final_status as ResultEntity['finalStatus'],
      calculatedAt: row.calculated_at as Date,
    };
  }
}
