import { Pool, PoolConfig, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../../config';

/**
 * Pool de conexiones PostgreSQL
 * Responsabilidad única: Gestión de conexiones y operaciones básicas
 * Patrón: Singleton para evitar múltiples pools
 */
export class PostgresPool {
  private pool: Pool;
  private static instance: PostgresPool;

  private constructor() {
    const poolConfig: PoolConfig = {
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      max: config.postgres.poolMax,
      idleTimeoutMillis: config.postgres.idleTimeout,
      connectionTimeoutMillis: config.postgres.connectionTimeout,
    };

    this.pool = new Pool(poolConfig);
    this.setupEventHandlers();
  }

  static getInstance(): PostgresPool {
    if (!PostgresPool.instance) {
      PostgresPool.instance = new PostgresPool();
    }
    return PostgresPool.instance;
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', () => {
      console.log('[PostgreSQL] Nueva conexión establecida');
    });

    this.pool.on('error', (error: Error) => {
      console.error('[PostgreSQL] Error en conexión idle:', error);
    });

    this.pool.on('remove', () => {
      console.log('[PostgreSQL] Conexión removida del pool');
    });
  }

  /**
   * Obtiene un cliente del pool para transacciones
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Ejecuta una query simple (sin transacción explícita)
   */
  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return await this.pool.query<T>(text, params);
  }

  /**
   * Ejecuta múltiples queries en una transacción
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verifica la conexión con la base de datos
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rowCount === 1;
    } catch {
      return false;
    }
  }

  /**
   * Cierra todas las conexiones del pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('[PostgreSQL] Pool cerrado');
  }

  /**
   * Estadísticas del pool
   */
  getStats(): { total: number; idle: number; waiting: number } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}
