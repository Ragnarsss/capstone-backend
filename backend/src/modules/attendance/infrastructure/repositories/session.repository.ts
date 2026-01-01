/**
 * SessionRepository - Persistencia de sesiones en PostgreSQL
 * 
 * Tabla: attendance.sessions
 * Responsabilidad: CRUD de sesiones de asistencia
 */

import { PostgresPool } from '../../../../shared/infrastructure/database/postgres-pool';

/**
 * Entidad de sesion para persistencia
 */
export interface SessionEntity {
  sessionId: number;
  professorId: number;
  professorName: string;
  courseCode: string;
  courseName: string;
  room: string;
  semester: string;
  startTime: Date;
  endTime: Date | null;
  maxRounds: number;
  status: 'active' | 'closed' | 'cancelled';
  createdAt: Date;
}

/**
 * DTO para crear una sesion
 */
export interface CreateSessionDTO {
  professorId: number;
  professorName: string;
  courseCode: string;
  courseName: string;
  room: string;
  semester: string;
  maxRounds?: number;
}

/**
 * DTO para actualizar una sesion
 */
export interface UpdateSessionDTO {
  endTime?: Date;
  status?: 'active' | 'closed' | 'cancelled';
}

/**
 * Repositorio de sesiones de asistencia
 */
export class SessionRepository {
  private db: PostgresPool;

  constructor(db?: PostgresPool) {
    this.db = db ?? PostgresPool.getInstance();
  }

  /**
   * Crea una nueva sesion de asistencia
   */
  async create(dto: CreateSessionDTO): Promise<SessionEntity> {
    const sql = `
      INSERT INTO attendance.sessions (
        professor_id,
        professor_name,
        course_code,
        course_name,
        room,
        semester,
        start_time,
        max_rounds,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'active')
      RETURNING *
    `;

    const params = [
      dto.professorId,
      dto.professorName,
      dto.courseCode,
      dto.courseName,
      dto.room,
      dto.semester,
      dto.maxRounds ?? 3,
    ];

    const result = await this.db.query(sql, params);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Obtiene una sesion por ID
   */
  async getById(sessionId: number): Promise<SessionEntity | null> {
    const sql = `
      SELECT * FROM attendance.sessions
      WHERE session_id = $1
    `;

    const result = await this.db.query(sql, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Obtiene la sesion activa de un profesor
   */
  async getActiveByProfessor(professorId: number): Promise<SessionEntity | null> {
    const sql = `
      SELECT * FROM attendance.sessions
      WHERE professor_id = $1 AND status = 'active'
      ORDER BY start_time DESC
      LIMIT 1
    `;

    const result = await this.db.query(sql, [professorId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Obtiene sesiones activas por sala
   */
  async getActiveByRoom(room: string): Promise<SessionEntity | null> {
    const sql = `
      SELECT * FROM attendance.sessions
      WHERE room = $1 AND status = 'active'
      ORDER BY start_time DESC
      LIMIT 1
    `;

    const result = await this.db.query(sql, [room]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Actualiza una sesion existente
   */
  async update(sessionId: number, dto: UpdateSessionDTO): Promise<SessionEntity | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.endTime !== undefined) {
      updates.push(`end_time = $${paramIndex++}`);
      params.push(dto.endTime);
    }

    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(dto.status);
    }

    if (updates.length === 0) {
      return this.getById(sessionId);
    }

    params.push(sessionId);

    const sql = `
      UPDATE attendance.sessions
      SET ${updates.join(', ')}
      WHERE session_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Cierra una sesion (marca como closed y establece end_time)
   */
  async close(sessionId: number): Promise<SessionEntity | null> {
    return this.update(sessionId, {
      status: 'closed',
      endTime: new Date(),
    });
  }

  /**
   * Cancela una sesion
   */
  async cancel(sessionId: number): Promise<SessionEntity | null> {
    return this.update(sessionId, {
      status: 'cancelled',
      endTime: new Date(),
    });
  }

  /**
   * Lista sesiones por profesor con paginacion
   */
  async listByProfessor(
    professorId: number,
    limit: number = 10,
    offset: number = 0
  ): Promise<SessionEntity[]> {
    const sql = `
      SELECT * FROM attendance.sessions
      WHERE professor_id = $1
      ORDER BY start_time DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query(sql, [professorId, limit, offset]);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Cuenta sesiones por profesor
   */
  async countByProfessor(professorId: number): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM attendance.sessions
      WHERE professor_id = $1
    `;

    const result = await this.db.query(sql, [professorId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Mapea una fila de DB a entidad
   */
  private mapRow(row: Record<string, unknown>): SessionEntity {
    return {
      sessionId: row.session_id as number,
      professorId: row.professor_id as number,
      professorName: row.professor_name as string,
      courseCode: row.course_code as string,
      courseName: row.course_name as string,
      room: row.room as string,
      semester: row.semester as string,
      startTime: row.start_time as Date,
      endTime: row.end_time as Date | null,
      maxRounds: row.max_rounds as number,
      status: row.status as 'active' | 'closed' | 'cancelled',
      createdAt: row.created_at as Date,
    };
  }
}
