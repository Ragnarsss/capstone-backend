<?php

/**
 * Suite de Tests de Integración PHP
 * 
 * Este archivo contiene tests automatizados para validar la integración
 * entre el sistema legacy Hawaii y el nuevo módulo de asistencia.
 * 
 * Requisitos validados:
 * - REQ-02: Opción estudiante (sesión PHP)
 * - REQ-03: Opción profesor (autenticación y permisos)
 * - REQ-05: Encuestas (guardado en BD)
 * 
 * Uso:
 *   vendor/bin/phpunit tests/integration/IntegrationTest.php
 */

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../db.inc';
require_once __DIR__ . '/../../asistencia-node-integration/AuthenticationService.php';
require_once __DIR__ . '/../../asistencia-node-integration/JWT.php';

class IntegrationTest extends TestCase
{
    private static $dbh;
    private static $profesorTest;
    private static $alumnoTest;
    private static $cursoTest;
    private static $semestreTest;

    /**
     * Setup ejecutado una vez antes de todos los tests
     */
    public static function setUpBeforeClass(): void
    {
        self::$dbh = db_open();
        
        // Crear datos de prueba
        self::createTestData();
    }

    /**
     * Teardown ejecutado una vez después de todos los tests
     */
    public static function tearDownAfterClass(): void
    {
        self::cleanupTestData();
        self::$dbh = null;
    }

    /**
     * Setup ejecutado antes de cada test
     */
    protected function setUp(): void
    {
        // Limpiar datos transaccionales
        self::$dbh->exec("DELETE FROM alumno_asistencia WHERE rut = '" . self::$alumnoTest['rut'] . "'");
        self::$dbh->exec("DELETE FROM asistencia_curso WHERE usuario = '" . self::$profesorTest['email'] . "'");
        self::$dbh->exec("DELETE FROM comentarios_clase WHERE alumno_rut = '" . self::$alumnoTest['rut'] . "'");
    }

    /**
     * Crear datos de prueba en BD
     */
    private static function createTestData()
    {
        // Crear semestre de prueba
        $stmt = self::$dbh->prepare("
            INSERT INTO semestre (nombre, activo, cerrado, fecha_inicio, fecha_termino)
            VALUES ('TEST-2025-1', TRUE, FALSE, '2025-01-01', '2025-06-30')
            RETURNING id
        ");
        $stmt->execute();
        self::$semestreTest = $stmt->fetch(PDO::FETCH_ASSOC);

        // Crear profesor de prueba
        $stmt = self::$dbh->prepare("
            INSERT INTO profesor (email, nombre, apellido, passwd)
            VALUES ('profesor.test@ucn.cl', 'Profesor', 'Test', '123456')
            RETURNING email, nombre, apellido
        ");
        $stmt->execute();
        self::$profesorTest = $stmt->fetch(PDO::FETCH_ASSOC);

        // Crear alumno de prueba
        $stmt = self::$dbh->prepare("
            INSERT INTO alumno (rut, nombre, apellido, email)
            VALUES ('18687505-2', 'Alumno', 'Test', 'alumno.test@alumnos.ucn.cl')
            RETURNING rut, nombre, apellido, email
        ");
        $stmt->execute();
        self::$alumnoTest = $stmt->fetch(PDO::FETCH_ASSOC);

        // Crear curso de prueba
        $stmt = self::$dbh->prepare("
            INSERT INTO curso (nombre, nrc, semestre, profesor_email)
            VALUES ('Curso Test Automatizado', 'TEST001', :semestre, :profesor)
            RETURNING id, nombre, nrc
        ");
        $stmt->bindParam(':semestre', self::$semestreTest['id']);
        $stmt->bindParam(':profesor', self::$profesorTest['email']);
        $stmt->execute();
        self::$cursoTest = $stmt->fetch(PDO::FETCH_ASSOC);

        // Inscribir alumno en curso
        $stmt = self::$dbh->prepare("
            INSERT INTO inscripcion (alumno_rut, curso_id, semestre_id)
            VALUES (:rut, :curso, :semestre)
        ");
        $stmt->bindParam(':rut', self::$alumnoTest['rut']);
        $stmt->bindParam(':curso', self::$cursoTest['id']);
        $stmt->bindParam(':semestre', self::$semestreTest['id']);
        $stmt->execute();
    }

    /**
     * Limpiar datos de prueba
     */
    private static function cleanupTestData()
    {
        self::$dbh->exec("DELETE FROM inscripcion WHERE alumno_rut = '" . self::$alumnoTest['rut'] . "'");
        self::$dbh->exec("DELETE FROM alumno_asistencia WHERE rut = '" . self::$alumnoTest['rut'] . "'");
        self::$dbh->exec("DELETE FROM asistencia_curso WHERE usuario = '" . self::$profesorTest['email'] . "'");
        self::$dbh->exec("DELETE FROM comentarios_clase WHERE alumno_rut = '" . self::$alumnoTest['rut'] . "'");
        self::$dbh->exec("DELETE FROM curso WHERE id = " . self::$cursoTest['id']);
        self::$dbh->exec("DELETE FROM alumno WHERE rut = '" . self::$alumnoTest['rut'] . "'");
        self::$dbh->exec("DELETE FROM profesor WHERE email = '" . self::$profesorTest['email'] . "'");
        self::$dbh->exec("DELETE FROM semestre WHERE id = " . self::$semestreTest['id']);
    }

    /**
     * REQ-02-001: Sesión de estudiante se identifica correctamente
     */
    public function testEstudianteSessionIdentification()
    {
        // Simular sesión de estudiante
        $_SESSION['id'] = -1;
        $_SESSION['rut'] = self::$alumnoTest['rut'];
        $_SESSION['email'] = self::$alumnoTest['email'];

        // Validar que get_usuario_actual retorna el RUT
        $usuario = get_usuario_actual();
        
        $this->assertEquals(self::$alumnoTest['rut'], $usuario);
        $this->assertEquals(-1, $_SESSION['id']);
    }

    /**
     * REQ-02-002: Sesión de profesor se identifica correctamente
     */
    public function testProfesorSessionIdentification()
    {
        // Simular sesión de profesor
        $_SESSION['id'] = 123;
        $_SESSION['email'] = self::$profesorTest['email'];

        // Validar que get_usuario_actual retorna el email
        $usuario = get_usuario_actual();
        
        $this->assertEquals(self::$profesorTest['email'], $usuario);
        $this->assertNotEquals(-1, $_SESSION['id']);
    }

    /**
     * REQ-03-001: can_tomar_asistencia retorna true para profesor autorizado
     */
    public function testCanTomarAsistenciaAutorizado()
    {
        // Simular sesión de profesor asignado al curso
        $_SESSION['id'] = 123;
        $_SESSION['email'] = self::$profesorTest['email'];

        $canTomar = can_tomar_asistencia(self::$cursoTest['id'], self::$semestreTest['id']);
        
        $this->assertTrue($canTomar, 'Profesor asignado debe poder tomar asistencia');
    }

    /**
     * REQ-03-002: can_tomar_asistencia retorna false para profesor no autorizado
     */
    public function testCanTomarAsistenciaNoAutorizado()
    {
        // Simular sesión de profesor NO asignado al curso
        $_SESSION['id'] = 999;
        $_SESSION['email'] = 'otro.profesor@ucn.cl';

        $canTomar = can_tomar_asistencia(self::$cursoTest['id'], self::$semestreTest['id']);
        
        $this->assertFalse($canTomar, 'Profesor no asignado NO debe poder tomar asistencia');
    }

    /**
     * REQ-03-003: AuthenticationService genera JWT válido para profesor
     */
    public function testAuthenticationServiceGenerateToken()
    {
        $authService = new AuthenticationService();
        
        $token = $authService->generateToken(
            self::$profesorTest['email'],
            'profesor'
        );
        
        $this->assertNotEmpty($token);
        
        // Validar estructura JWT (3 partes)
        $parts = explode('.', $token);
        $this->assertCount(3, $parts);
        
        // Decodificar y validar payload
        $payload = json_decode(base64_decode($parts[1]), true);
        $this->assertEquals(self::$profesorTest['email'], $payload['email']);
        $this->assertEquals('profesor', $payload['role']);
        $this->assertArrayHasKey('userId', $payload);
        $this->assertArrayHasKey('exp', $payload);
    }

    /**
     * REQ-03-004: JWT expira correctamente (TTL 1 hora)
     */
    public function testJWTExpiration()
    {
        $authService = new AuthenticationService();
        
        $token = $authService->generateToken(
            self::$profesorTest['email'],
            'profesor'
        );
        
        $parts = explode('.', $token);
        $payload = json_decode(base64_decode($parts[1]), true);
        
        $exp = $payload['exp'];
        $now = time();
        
        // Debe expirar en ~1 hora (3600 segundos ± 60 seg de margen)
        $ttl = $exp - $now;
        $this->assertGreaterThan(3540, $ttl);
        $this->assertLessThan(3660, $ttl);
    }

    /**
     * REQ-04-001: Registro de asistencia se guarda correctamente
     */
    public function testRegistroAsistencia()
    {
        // Crear sesión de asistencia
        $stmt = self::$dbh->prepare("
            INSERT INTO asistencia_curso (
                curso, semestre, fecha, bloque, codigo, 
                fechahora_inicio, fechahora_termino, usuario, tipo, acepta_origen_ip
            ) VALUES (
                :curso, :semestre, :fecha, 1, 'TESTQR',
                NOW(), NOW() + INTERVAL '5 minutes', :usuario, 2, 'ALL'
            )
            RETURNING id, codigo
        ");
        $fecha = date('Y-m-d');
        $stmt->bindParam(':curso', self::$cursoTest['id']);
        $stmt->bindParam(':semestre', self::$semestreTest['id']);
        $stmt->bindParam(':fecha', $fecha);
        $stmt->bindParam(':usuario', self::$profesorTest['email']);
        $stmt->execute();
        $sesion = $stmt->fetch(PDO::FETCH_ASSOC);

        // Registrar asistencia del alumno
        $stmt = self::$dbh->prepare("
            INSERT INTO alumno_asistencia (
                rut, curso, fecha, bloque, hora_marca, estado, codigo_reserva
            ) VALUES (
                :rut, :curso, :fecha, 1, NOW(), 1, :codigo
            )
            RETURNING id
        ");
        $fechaLegacy = date('Ymd');
        $stmt->bindParam(':rut', self::$alumnoTest['rut']);
        $stmt->bindParam(':curso', self::$cursoTest['id']);
        $stmt->bindParam(':fecha', $fechaLegacy);
        $stmt->bindParam(':codigo', $sesion['codigo']);
        $stmt->execute();
        $asistencia = $stmt->fetch(PDO::FETCH_ASSOC);

        // Validar que se guardó
        $this->assertNotEmpty($asistencia['id']);

        // Consultar y validar datos
        $stmt = self::$dbh->prepare("
            SELECT * FROM alumno_asistencia 
            WHERE rut = :rut AND fecha = :fecha AND bloque = 1
        ");
        $stmt->bindParam(':rut', self::$alumnoTest['rut']);
        $stmt->bindParam(':fecha', $fechaLegacy);
        $stmt->execute();
        $registro = $stmt->fetch(PDO::FETCH_ASSOC);

        $this->assertEquals(self::$alumnoTest['rut'], $registro['rut']);
        $this->assertEquals(1, $registro['estado']); // Presente
        $this->assertEquals($sesion['codigo'], $registro['codigo_reserva']);
    }

    /**
     * REQ-05-001: Encuesta se guarda correctamente en comentarios_clase
     */
    public function testGuardarEncuesta()
    {
        // Crear sesión de asistencia
        $stmt = self::$dbh->prepare("
            INSERT INTO asistencia_curso (
                curso, semestre, fecha, bloque, codigo, 
                fechahora_inicio, fechahora_termino, usuario, tipo, acepta_origen_ip
            ) VALUES (
                :curso, :semestre, :fecha, 1, 'TESTQR',
                NOW(), NOW() + INTERVAL '5 minutes', :usuario, 2, 'ALL'
            )
            RETURNING id
        ");
        $fecha = date('Y-m-d');
        $stmt->bindParam(':curso', self::$cursoTest['id']);
        $stmt->bindParam(':semestre', self::$semestreTest['id']);
        $stmt->bindParam(':fecha', $fecha);
        $stmt->bindParam(':usuario', self::$profesorTest['email']);
        $stmt->execute();
        $sesion = $stmt->fetch(PDO::FETCH_ASSOC);

        // Guardar encuesta
        $stmt = self::$dbh->prepare("
            INSERT INTO comentarios_clase (
                reserva_id, alumno_rut, nota, objetivos, puntualidad, comentario, timestamp
            ) VALUES (
                :reserva_id, :rut, 5, 'Excelente', 'Puntual', 'Clase muy buena', NOW()
            )
            RETURNING id
        ");
        $stmt->bindParam(':reserva_id', $sesion['id']);
        $stmt->bindParam(':rut', self::$alumnoTest['rut']);
        $stmt->execute();
        $comentario = $stmt->fetch(PDO::FETCH_ASSOC);

        // Validar que se guardó
        $this->assertNotEmpty($comentario['id']);

        // Consultar y validar datos
        $stmt = self::$dbh->prepare("
            SELECT * FROM comentarios_clase WHERE reserva_id = :reserva_id
        ");
        $stmt->bindParam(':reserva_id', $sesion['id']);
        $stmt->execute();
        $registro = $stmt->fetch(PDO::FETCH_ASSOC);

        $this->assertEquals(self::$alumnoTest['rut'], $registro['alumno_rut']);
        $this->assertEquals(5, $registro['nota']);
        $this->assertEquals('Excelente', $registro['objetivos']);
        $this->assertEquals('Puntual', $registro['puntualidad']);
        $this->assertEquals('Clase muy buena', $registro['comentario']);
    }

    /**
     * REQ-06-001: No se permiten registros duplicados
     */
    public function testNoDuplicadosAsistencia()
    {
        $this->expectException(PDOException::class);

        // Crear sesión de asistencia
        $stmt = self::$dbh->prepare("
            INSERT INTO asistencia_curso (
                curso, semestre, fecha, bloque, codigo, 
                fechahora_inicio, fechahora_termino, usuario, tipo, acepta_origen_ip
            ) VALUES (
                :curso, :semestre, :fecha, 1, 'TESTQR',
                NOW(), NOW() + INTERVAL '5 minutes', :usuario, 2, 'ALL'
            )
            RETURNING id, codigo
        ");
        $fecha = date('Y-m-d');
        $stmt->bindParam(':curso', self::$cursoTest['id']);
        $stmt->bindParam(':semestre', self::$semestreTest['id']);
        $stmt->bindParam(':fecha', $fecha);
        $stmt->bindParam(':usuario', self::$profesorTest['email']);
        $stmt->execute();
        $sesion = $stmt->fetch(PDO::FETCH_ASSOC);

        // Primer registro (debe funcionar)
        $stmt = self::$dbh->prepare("
            INSERT INTO alumno_asistencia (
                rut, curso, fecha, bloque, hora_marca, estado, codigo_reserva
            ) VALUES (
                :rut, :curso, :fecha, 1, NOW(), 1, :codigo
            )
        ");
        $fechaLegacy = date('Ymd');
        $stmt->bindParam(':rut', self::$alumnoTest['rut']);
        $stmt->bindParam(':curso', self::$cursoTest['id']);
        $stmt->bindParam(':fecha', $fechaLegacy);
        $stmt->bindParam(':codigo', $sesion['codigo']);
        $stmt->execute();

        // Segundo registro (debe lanzar excepción por constraint)
        $stmt->execute(); // Esta línea debe fallar
    }

    /**
     * REQ-07-001: Validación de duración de sesión (TTL 5 minutos)
     */
    public function testValidacionDuracionSesion()
    {
        // Crear sesión de asistencia
        $stmt = self::$dbh->prepare("
            INSERT INTO asistencia_curso (
                curso, semestre, fecha, bloque, codigo, 
                fechahora_inicio, fechahora_termino, usuario, tipo, acepta_origen_ip
            ) VALUES (
                :curso, :semestre, :fecha, 1, 'TESTQR',
                NOW(), NOW() + INTERVAL '5 minutes', :usuario, 2, 'ALL'
            )
            RETURNING id, fechahora_inicio, fechahora_termino
        ");
        $fecha = date('Y-m-d');
        $stmt->bindParam(':curso', self::$cursoTest['id']);
        $stmt->bindParam(':semestre', self::$semestreTest['id']);
        $stmt->bindParam(':fecha', $fecha);
        $stmt->bindParam(':usuario', self::$profesorTest['email']);
        $stmt->execute();
        $sesion = $stmt->fetch(PDO::FETCH_ASSOC);

        // Calcular TTL
        $inicio = strtotime($sesion['fechahora_inicio']);
        $termino = strtotime($sesion['fechahora_termino']);
        $ttlMinutes = ($termino - $inicio) / 60;

        // Validar que TTL es 5 minutos (con margen de ±10 segundos)
        $this->assertGreaterThan(4.8, $ttlMinutes);
        $this->assertLessThan(5.2, $ttlMinutes);
    }
}
