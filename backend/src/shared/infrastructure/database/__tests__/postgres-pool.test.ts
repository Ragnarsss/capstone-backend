import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgresPool } from '../postgres-pool';
import { Pool, type PoolClient, type QueryResult } from 'pg';

// Mock del módulo pg
vi.mock('pg', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    totalCount: 10,
    idleCount: 5,
    waitingCount: 2,
  };

  return {
    Pool: vi.fn(() => mockPool),
  };
});

// Mock del logger
vi.mock('../../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock del config
vi.mock('../../config', () => ({
  config: {
    postgres: {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
      poolMax: 20,
      idleTimeout: 10000,
      connectionTimeout: 2000,
    },
  },
}));

describe('PostgresPool', () => {
  let postgresPool: PostgresPool;
  let mockPool: any;

  beforeEach(() => {
    // Reset singleton
    (PostgresPool as any).instance = undefined;

    // Get mock pool instance
    postgresPool = PostgresPool.getInstance();
    mockPool = (postgresPool as any).pool;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('debe retornar la misma instancia (Singleton)', () => {
      // Act
      const instance1 = PostgresPool.getInstance();
      const instance2 = PostgresPool.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('debe crear pool con configuración del entorno', () => {
      // Assert - Verifica que se llamó con configuración (cualquier configuración)
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: expect.any(String),
        port: expect.any(Number),
        database: expect.any(String),
        user: expect.any(String),
        password: expect.any(String),
        max: expect.any(Number),
        idleTimeoutMillis: expect.any(Number),
        connectionTimeoutMillis: expect.any(Number),
      }));
    });

    it('debe configurar event handlers', () => {
      // Assert
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
    });
  });

  describe('getClient', () => {
    it('debe retornar un cliente del pool', async () => {
      // Arrange
      const mockClient = { query: vi.fn(), release: vi.fn() };
      vi.mocked(mockPool.connect).mockResolvedValue(mockClient);

      // Act
      const client = await postgresPool.getClient();

      // Assert
      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });

    it('debe propagar errores de conexión', async () => {
      // Arrange
      const error = new Error('Connection failed');
      vi.mocked(mockPool.connect).mockRejectedValue(error);

      // Act & Assert
      await expect(postgresPool.getClient()).rejects.toThrow('Connection failed');
    });
  });

  describe('query', () => {
    it('debe ejecutar query sin parámetros', async () => {
      // Arrange
      const mockResult: QueryResult = {
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };
      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      // Act
      const result = await postgresPool.query('SELECT * FROM users');

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users', undefined);
      expect(result).toEqual(mockResult);
    });

    it('debe ejecutar query con parámetros', async () => {
      // Arrange
      const mockResult: QueryResult = {
        rows: [{ id: 1, name: 'John' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };
      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      // Act
      const result = await postgresPool.query('SELECT * FROM users WHERE id = $1', [1]);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('John');
    });

    it('debe soportar tipado genérico', async () => {
      // Arrange
      interface User {
        id: number;
        email: string;
      }

      const mockResult: QueryResult<User> = {
        rows: [{ id: 1, email: 'test@example.com' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };
      vi.mocked(mockPool.query).mockResolvedValue(mockResult);

      // Act
      const result = await postgresPool.query<User>('SELECT * FROM users');

      // Assert
      expect(result.rows[0].email).toBe('test@example.com');
    });

    it('debe propagar errores de query', async () => {
      // Arrange
      const error = new Error('Query failed');
      vi.mocked(mockPool.query).mockRejectedValue(error);

      // Act & Assert
      await expect(postgresPool.query('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('transaction', () => {
    it('debe ejecutar transacción exitosa con BEGIN, COMMIT', async () => {
      // Arrange
      const mockClient: Partial<PoolClient> = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn(),
      };
      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as PoolClient);

      const callback = vi.fn().mockResolvedValue('success');

      // Act
      const result = await postgresPool.transaction(callback);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('debe hacer ROLLBACK si callback falla', async () => {
      // Arrange
      const mockClient: Partial<PoolClient> = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn(),
      };
      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as PoolClient);

      const error = new Error('Transaction failed');
      const callback = vi.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(postgresPool.transaction(callback)).rejects.toThrow('Transaction failed');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('debe liberar cliente incluso si ROLLBACK falla', async () => {
      // Arrange
      const mockClient: Partial<PoolClient> = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockRejectedValueOnce(new Error('ROLLBACK failed')), // ROLLBACK
        release: vi.fn(),
      };
      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as PoolClient);

      const callback = vi.fn().mockRejectedValue(new Error('Callback error'));

      // Act & Assert
      await expect(postgresPool.transaction(callback)).rejects.toThrow();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('debe retornar resultado del callback', async () => {
      // Arrange
      const mockClient: Partial<PoolClient> = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn(),
      };
      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as PoolClient);

      const expectedResult = { userId: 123, created: true };
      const callback = vi.fn().mockResolvedValue(expectedResult);

      // Act
      const result = await postgresPool.transaction(callback);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('debe manejar transacciones anidadas con mismo cliente', async () => {
      // Arrange
      const mockClient: Partial<PoolClient> = {
        query: vi.fn().mockResolvedValue({ rows: [{ count: 1 }], rowCount: 1 }),
        release: vi.fn(),
      };
      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as PoolClient);

      const callback = async (client: PoolClient) => {
        await client.query('INSERT INTO users VALUES ($1)', [1]);
        await client.query('INSERT INTO profiles VALUES ($1)', [1]);
        return 'done';
      };

      // Act
      await postgresPool.transaction(callback);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO users VALUES ($1)', [1]);
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO profiles VALUES ($1)', [1]);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('ping', () => {
    it('debe retornar true si conexión está activa', async () => {
      // Arrange
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [{ '?column?': 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Act
      const result = await postgresPool.ping();

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
      expect(result).toBe(true);
    });

    it('debe retornar false si conexión falla', async () => {
      // Arrange
      vi.mocked(mockPool.query).mockRejectedValue(new Error('Connection lost'));

      // Act
      const result = await postgresPool.ping();

      // Assert
      expect(result).toBe(false);
    });

    it('debe retornar false si rowCount no es 1', async () => {
      // Arrange
      vi.mocked(mockPool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      // Act
      const result = await postgresPool.ping();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('debe cerrar el pool', async () => {
      // Arrange
      vi.mocked(mockPool.end).mockResolvedValue();

      // Act
      await postgresPool.close();

      // Assert
      expect(mockPool.end).toHaveBeenCalled();
    });

    it('debe propagar errores al cerrar', async () => {
      // Arrange
      const error = new Error('Close failed');
      vi.mocked(mockPool.end).mockRejectedValue(error);

      // Act & Assert
      await expect(postgresPool.close()).rejects.toThrow('Close failed');
    });
  });

  describe('getStats', () => {
    it('debe retornar estadísticas del pool', () => {
      // Act
      const stats = postgresPool.getStats();

      // Assert
      expect(stats).toEqual({
        total: 10,
        idle: 5,
        waiting: 2,
      });
    });

    it('debe reflejar cambios en tiempo real del pool', () => {
      // Arrange
      mockPool.totalCount = 20;
      mockPool.idleCount = 15;
      mockPool.waitingCount = 0;

      // Act
      const stats = postgresPool.getStats();

      // Assert
      expect(stats.total).toBe(20);
      expect(stats.idle).toBe(15);
      expect(stats.waiting).toBe(0);
    });
  });

  describe('Event handlers', () => {
    it('debe llamar handlers al registrar eventos', () => {
      // Los handlers se registraron en beforeEach
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
    });
  });
});
