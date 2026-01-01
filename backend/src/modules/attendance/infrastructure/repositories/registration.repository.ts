/**
 * RegistrationRepository - Persistencia de registros de participación
 * 
 * Tabla: attendance.registrations
 * Responsabilidad: Guardar cuando un estudiante se registra en una sesión
 */

import { PostgresPool } from '../../../../shared/infrastructure/database/postgres-pool';

/**
 * Entidad de registro para persistencia
 */
export interface RegistrationEntity {
  registrationId: number;
  sessionId: number;
  userId: number;
  deviceId: number | null;
  queuePosition: number;
  registeredAt: Date;
  status: 'active' | 'processing' | 'completed' | 'failed';
}

/**
 * DTO para crear un registro
 */
export interface CreateRegistrationDTO {
  sessionId: number;
  userId: number;
  deviceId?: number;
}

/**
 * DTO para actualizar estado
 */
export interface UpdateRegistrationStatusDTO {
  status: 'active' | 'processing' | 'completed' | 'failed';
}

/**
 * Repositorio de registros de participación
 */
export class RegistrationRepository {
  private db: PostgresPool;

  constructor(db?: PostgresPool) {
    this.db = db ?? PostgresPool.getInstance();
  }

  /**
   * Registra un estudiante en una sesión
   * queue_position se calcula automáticamente
   */
  async create(dto: CreateRegistrationDTO): Promise<RegistrationEntity> {
    const sql = `
      INSERT INTO attendance.registrations (
        session_id,
        user_id,
        device_id,
        queue_position,
        status
      ) VALUES (
        $1, 
        $2, 
        $3,
        (SELECT COALESCE(MAX(queue_position), 0) + 1 
         FROM attendance.registrations 
         WHERE session_id = $1),
        'active'
      )
      RETURNING *
    `;

    const params = [
      dto.sessionId,
      dto.userId,
      dto.deviceId ?? null,
    ];

    const result = await this.db.query(sql, params);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Obtiene registro por ID
   */
  async getById(registrationId: number): Promise<RegistrationEntity | null> {
    const sql = `
      SELECT * FROM attendance.registrations
      WHERE registration_id = $1
    `;

    const result = await this.db.query(sql, [registrationId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Obtiene registro por sesión y usuario
   */
  async getBySessionAndUser(
    sessionId: number,
    userId: number
  ): Promise<RegistrationEntity | null> {
    const sql = `
      SELECT * FROM attendance.registrations
      WHERE session_id = $1 AND user_id = $2
    `;

    const result = await this.db.query(sql, [sessionId, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Actualiza el estado de un registro
   */
  async updateStatus(
    registrationId: number,
    dto: UpdateRegistrationStatusDTO
  ): Promise<RegistrationEntity | null> {
    const sql = `
      UPDATE attendance.registrations
      SET status = $2
      WHERE registration_id = $1
      RETURNING *
    `;

    const result = await this.db.query(sql, [registrationId, dto.status]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Lista registros de una sesión
   */
  async listBySession(sessionId: number): Promise<RegistrationEntity[]> {
    const sql = `
      SELECT * FROM attendance.registrations
      WHERE session_id = $1
      ORDER BY queue_position ASC
    `;

    const result = await this.db.query(sql, [sessionId]);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Lista registros activos de una sesión (pendientes de completar)
   */
  async listActiveBySession(sessionId: number): Promise<RegistrationEntity[]> {
    const sql = `
      SELECT * FROM attendance.registrations
      WHERE session_id = $1 AND status IN ('active', 'processing')
      ORDER BY queue_position ASC
    `;

    const result = await this.db.query(sql, [sessionId]);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Cuenta registros por estado en una sesión
   */
  async countByStatusInSession(
    sessionId: number
  ): Promise<Record<RegistrationEntity['status'], number>> {
    const sql = `
      SELECT status, COUNT(*) as count
      FROM attendance.registrations
      WHERE session_id = $1
      GROUP BY status
    `;

    const result = await this.db.query(sql, [sessionId]);
    
    const counts: Record<RegistrationEntity['status'], number> = {
      active: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of result.rows) {
      counts[row.status as RegistrationEntity['status']] = parseInt(row.count, 10);
    }

    return counts;
  }

  /**
   * Verifica si usuario ya está registrado en sesión
   */
  async exists(sessionId: number, userId: number): Promise<boolean> {
    const sql = `
      SELECT 1 FROM attendance.registrations
      WHERE session_id = $1 AND user_id = $2
      LIMIT 1
    `;

    const result = await this.db.query(sql, [sessionId, userId]);
    return result.rows.length > 0;
  }

  /**
   * Mapea una fila de DB a entidad
   */
  private mapRow(row: Record<string, unknown>): RegistrationEntity {
    return {
      registrationId: row.registration_id as number,
      sessionId: row.session_id as number,
      userId: row.user_id as number,
      deviceId: row.device_id as number | null,
      queuePosition: row.queue_position as number,
      registeredAt: row.registered_at as Date,
      status: row.status as RegistrationEntity['status'],
    };
  }
}
