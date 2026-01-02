/**
 * Usuarios de prueba para tests E2E
 * 
 * Este módulo exporta usuarios predefinidos con roles y permisos específicos
 */

export class TestUsers {
  /**
   * Profesor autorizado para tomar asistencia en curso de prueba
   */
  static getProfesorAutorizado() {
    return {
      email: 'profesor.test@ucn.cl',
      password: 'Test123!',
      nombre: 'Profesor Test',
      rut: '11111111-1',
      role: 'profesor',
      permissions: ['can_tomar_asistencia', 'can_poner_notas']
    };
  }

  /**
   * Profesor NO autorizado (no asignado al curso de prueba)
   */
  static getProfesorNoAutorizado() {
    return {
      email: 'profesor.otro@ucn.cl',
      password: 'Test123!',
      nombre: 'Profesor Otro',
      rut: '22222222-2',
      role: 'profesor',
      permissions: []
    };
  }

  /**
   * Estudiante inscrito en curso de prueba
   */
  static getEstudianteInscrito() {
    return {
      email: 'estudiante.test@alumnos.ucn.cl',
      password: 'Test123!',
      nombre: 'Estudiante Test',
      rut: '18687505-2',
      role: 'estudiante',
      cursos: ['TEST-2025-1']
    };
  }

  /**
   * Estudiante NO inscrito en curso de prueba
   */
  static getEstudianteNoInscrito() {
    return {
      email: 'estudiante.otro@alumnos.ucn.cl',
      password: 'Test123!',
      nombre: 'Estudiante Otro',
      rut: '33333333-3',
      role: 'estudiante',
      cursos: []
    };
  }

  /**
   * Administrador con acceso total
   */
  static getAdministrador() {
    return {
      email: 'admin.test@ucn.cl',
      password: 'Admin123!',
      nombre: 'Admin Test',
      rut: '99999999-9',
      role: 'admin',
      permissions: ['*']
    };
  }
}
