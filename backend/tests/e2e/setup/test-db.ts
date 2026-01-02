import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Clase para gestionar la base de datos de prueba
 * 
 * Funcionalidades:
 * - Conexión a BD de prueba aislada
 * - Carga de fixtures (datos de prueba)
 * - Limpieza de datos entre tests
 * - Consultas SQL helpers
 * - Guardado de resultados para evidencias
 */
export class TestDatabase {
  public pool: Pool;
  private connected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5433'),
      database: process.env.TEST_DB_NAME || 'hawaii_test',
      user: process.env.TEST_DB_USER || 'test_user',
      password: process.env.TEST_DB_PASSWORD || 'test_password',
    });
  }

  /**
   * Conectar a la base de datos
   */
  async connect(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
      this.connected = true;
      console.log('✓ Conectado a base de datos de prueba');
    } catch (error) {
      console.error('✗ Error conectando a BD de prueba:', error);
      throw error;
    }
  }

  /**
   * Desconectar de la base de datos
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.pool.end();
      this.connected = false;
      console.log('✓ Desconectado de base de datos de prueba');
    }
  }

  /**
   * Cargar fixtures (datos de prueba)
   */
  async loadFixtures(): Promise<void> {
    const fixturesPath = path.join(__dirname, 'fixtures');
    
    // Orden de carga (respetando foreign keys)
    const fixtures = [
      'semestres.sql',
      'profesores.sql',
      'cursos.sql',
      'alumnos.sql',
      'bloques.sql',
      'tipos_asistencia.sql'
    ];

    for (const fixture of fixtures) {
      const filePath = path.join(fixturesPath, fixture);
      try {
        const sql = await fs.readFile(filePath, 'utf-8');
        await this.pool.query(sql);
        console.log(`✓ Fixture cargado: ${fixture}`);
      } catch (error) {
        console.error(`✗ Error cargando fixture ${fixture}:`, error);
      }
    }
  }

  /**
   * Limpiar datos de prueba (excepto fixtures)
   */
  async cleanup(): Promise<void> {
    const tables = [
      'alumno_asistencia',
      'asistencia_curso',
      'comentarios_clase'
    ];

    for (const table of tables) {
      await this.pool.query(`DELETE FROM ${table} WHERE TRUE`);
    }
    
    console.log('✓ Datos de prueba limpiados');
  }

  /**
   * Obtener curso de prueba
   */
  async getCursoTest(): Promise<any> {
    const result = await this.pool.query(`
      SELECT c.*, s.nombre as semestre_nombre
      FROM curso c
      JOIN semestre s ON c.semestre = s.id
      WHERE c.nombre LIKE '%TEST%'
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      throw new Error('No se encontró curso de prueba. Ejecutar fixtures primero.');
    }
    
    return result.rows[0];
  }

  /**
   * Obtener alumno de prueba
   */
  async getAlumnoTest(): Promise<any> {
    const result = await this.pool.query(`
      SELECT * FROM alumno
      WHERE email LIKE '%test%'
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      throw new Error('No se encontró alumno de prueba. Ejecutar fixtures primero.');
    }
    
    return result.rows[0];
  }

  /**
   * Guardar resultado de query para evidencia
   */
  async saveQueryResult(testName: string, data: any[]): Promise<void> {
    const evidencePath = path.join(__dirname, '../../evidencias', `${testName}.json`);
    await fs.mkdir(path.dirname(evidencePath), { recursive: true });
    await fs.writeFile(evidencePath, JSON.stringify(data, null, 2));
    console.log(`✓ Evidencia guardada: ${testName}.json`);
  }

  /**
   * Ejecutar query SQL y retornar resultados
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  /**
   * Crear sesión de asistencia de prueba
   */
  async createTestSession(profesorEmail: string, cursoId: number, semestreId: number): Promise<any> {
    const result = await this.pool.query(`
      INSERT INTO asistencia_curso (
        curso, semestre, fecha, bloque, codigo, 
        fechahora_inicio, fechahora_termino, usuario, tipo, acepta_origen_ip
      ) VALUES (
        $1, $2, CURRENT_DATE, 1, 'TESTQR',
        NOW(), NOW() + INTERVAL '5 minutes', $3, 2, 'ALL'
      )
      RETURNING *
    `, [cursoId, semestreId, profesorEmail]);
    
    return result.rows[0];
  }

  /**
   * Verificar que asistencia fue registrada
   */
  async verificarAsistenciaRegistrada(rut: string, fecha: string, bloque: number): Promise<boolean> {
    const result = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM alumno_asistencia
      WHERE rut = $1 AND fecha = $2 AND bloque = $3
    `, [rut, fecha, bloque]);
    
    return result.rows[0].count > 0;
  }

  /**
   * Obtener última asistencia registrada
   */
  async getUltimaAsistencia(rut: string): Promise<any> {
    const result = await this.pool.query(`
      SELECT aa.*, ac.fecha, ac.bloque, ac.codigo, a.nombre
      FROM alumno_asistencia aa
      JOIN asistencia_curso ac ON aa.curso = ac.curso
      JOIN alumno a ON aa.rut = a.rut
      WHERE aa.rut = $1
      ORDER BY aa.hora_marca DESC
      LIMIT 1
    `, [rut]);
    
    return result.rows[0] || null;
  }
}
