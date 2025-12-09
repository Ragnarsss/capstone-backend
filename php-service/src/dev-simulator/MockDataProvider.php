<?php
/**
 * MockDataProvider - Proveedor de Datos Mock
 * 
 * Responsabilidad: Cargar y proveer datos desde archivos JSON
 * Patron: Repository (implementacion mock)
 * 
 * Esta clase implementa la interface ILegacyDataProvider de forma
 * implicita (PHP 7.4 no requiere declarar interface).
 * En produccion, se usaria DatabaseDataProvider que usa db.inc.
 */

class MockDataProvider
{
    private static $instance = null;
    private $usuarios = null;
    private $cursos = null;
    private $sesiones = null;
    
    private $mockDataPath;

    private function __construct()
    {
        $this->mockDataPath = __DIR__ . '/mock-data/';
    }

    /**
     * Singleton para evitar recargar JSONs multiples veces
     */
    public static function getInstance(): MockDataProvider
    {
        if (self::$instance === null) {
            self::$instance = new MockDataProvider();
        }
        return self::$instance;
    }

    /**
     * Carga datos de usuarios (profesores + alumnos)
     */
    private function loadUsuarios(): void
    {
        if ($this->usuarios !== null) {
            return;
        }
        
        $path = $this->mockDataPath . 'usuarios.json';
        if (!file_exists($path)) {
            $this->usuarios = ['profesores' => [], 'alumnos' => []];
            return;
        }
        
        $content = file_get_contents($path);
        $this->usuarios = json_decode($content, true) ?: ['profesores' => [], 'alumnos' => []];
    }

    /**
     * Carga datos de cursos
     */
    private function loadCursos(): void
    {
        if ($this->cursos !== null) {
            return;
        }
        
        $path = $this->mockDataPath . 'cursos.json';
        if (!file_exists($path)) {
            $this->cursos = ['cursos' => [], 'semestres' => [], 'bloques' => [], 'inscripciones' => []];
            return;
        }
        
        $content = file_get_contents($path);
        $this->cursos = json_decode($content, true) ?: ['cursos' => [], 'semestres' => [], 'bloques' => [], 'inscripciones' => []];
    }

    /**
     * Carga datos de sesiones de asistencia
     */
    private function loadSesiones(): void
    {
        if ($this->sesiones !== null) {
            return;
        }
        
        $path = $this->mockDataPath . 'sesiones.json';
        if (!file_exists($path)) {
            $this->sesiones = ['sesiones' => [], 'tipos_encuesta' => [], 'ultimo_id_sesion' => 0];
            return;
        }
        
        $content = file_get_contents($path);
        $this->sesiones = json_decode($content, true) ?: ['sesiones' => [], 'tipos_encuesta' => [], 'ultimo_id_sesion' => 0];
    }

    // =========================================================================
    // Metodos de Usuarios
    // =========================================================================

    /**
     * Obtiene profesor por email
     * Emula get_auth_token() para profesores
     * 
     * @param string $email
     * @return array|null
     */
    public function getProfesorByEmail(string $email): ?array
    {
        $this->loadUsuarios();
        
        foreach ($this->usuarios['profesores'] as $profesor) {
            if (strtolower($profesor['email']) === strtolower($email)) {
                return $profesor;
            }
        }
        return null;
    }

    /**
     * Obtiene profesor por ID
     * 
     * @param int $id
     * @return array|null
     */
    public function getProfesorById(int $id): ?array
    {
        $this->loadUsuarios();
        
        foreach ($this->usuarios['profesores'] as $profesor) {
            if ($profesor['id'] === $id) {
                return $profesor;
            }
        }
        return null;
    }

    /**
     * Obtiene alumno por RUT
     * 
     * @param string $rut RUT sin formato (ej: 186875052)
     * @return array|null
     */
    public function getAlumnoByRut(string $rut): ?array
    {
        $this->loadUsuarios();
        
        $rutClean = preg_replace('/[^0-9]/', '', $rut);
        
        foreach ($this->usuarios['alumnos'] as $alumno) {
            $alumnoRutClean = preg_replace('/[^0-9]/', '', $alumno['rut']);
            if ($alumnoRutClean === $rutClean) {
                return $alumno;
            }
        }
        return null;
    }

    /**
     * Obtiene alumno por email
     * Emula get_rut_from_alumno_email()
     * 
     * @param string $email
     * @return array|null
     */
    public function getAlumnoByEmail(string $email): ?array
    {
        $this->loadUsuarios();
        
        foreach ($this->usuarios['alumnos'] as $alumno) {
            if (strtolower($alumno['email']) === strtolower($email)) {
                return $alumno;
            }
        }
        return null;
    }

    /**
     * Lista todos los profesores
     * 
     * @return array
     */
    public function getAllProfesores(): array
    {
        $this->loadUsuarios();
        return $this->usuarios['profesores'];
    }

    /**
     * Lista todos los alumnos
     * 
     * @return array
     */
    public function getAllAlumnos(): array
    {
        $this->loadUsuarios();
        return $this->usuarios['alumnos'];
    }

    // =========================================================================
    // Metodos de Cursos
    // =========================================================================

    /**
     * Obtiene curso por ID
     * Emula get_def_curso()
     * 
     * @param int $id
     * @return array|null
     */
    public function getCursoById(int $id): ?array
    {
        $this->loadCursos();
        
        foreach ($this->cursos['cursos'] as $curso) {
            if ($curso['id'] === $id) {
                return $curso;
            }
        }
        return null;
    }

    /**
     * Lista cursos de un profesor
     * 
     * @param int $profesorId
     * @return array
     */
    public function getCursosByProfesor(int $profesorId): array
    {
        $this->loadCursos();
        
        return array_filter($this->cursos['cursos'], function($curso) use ($profesorId) {
            return $curso['profesor_id'] === $profesorId;
        });
    }

    /**
     * Obtiene bloque por ID
     * Emula get_def_bloque()
     * 
     * @param int $id
     * @return array|null
     */
    public function getBloqueById(int $id): ?array
    {
        $this->loadCursos();
        
        foreach ($this->cursos['bloques'] as $bloque) {
            if ($bloque['id'] === $id) {
                return $bloque;
            }
        }
        return null;
    }

    /**
     * Lista todos los bloques
     * 
     * @return array
     */
    public function getAllBloques(): array
    {
        $this->loadCursos();
        return $this->cursos['bloques'];
    }

    /**
     * Obtiene semestre por ID
     * Emula get_def_semestre()
     * 
     * @param int $id
     * @return array|null
     */
    public function getSemestreById(int $id): ?array
    {
        $this->loadCursos();
        
        foreach ($this->cursos['semestres'] as $semestre) {
            if ($semestre['id'] === $id) {
                return $semestre;
            }
        }
        return null;
    }

    /**
     * Obtiene semestre activo
     * 
     * @return array|null
     */
    public function getSemestreActivo(): ?array
    {
        $this->loadCursos();
        
        foreach ($this->cursos['semestres'] as $semestre) {
            if ($semestre['activo'] ?? false) {
                return $semestre;
            }
        }
        return null;
    }

    /**
     * Alias para getSemestreActivo (compatibilidad)
     * 
     * @return array|null
     */
    public function getSemestreActual(): ?array
    {
        return $this->getSemestreActivo();
    }

    /**
     * Obtiene inscripciones de un alumno
     * 
     * @param string $alumnoRut
     * @return array
     */
    public function getInscripcionesByAlumno(string $alumnoRut): array
    {
        $this->loadCursos();
        
        $rutClean = preg_replace('/[^0-9]/', '', $alumnoRut);
        
        return array_values(array_filter($this->cursos['inscripciones'], function($inscripcion) use ($rutClean) {
            $inscRutClean = preg_replace('/[^0-9]/', '', $inscripcion['alumno_rut']);
            return $inscRutClean === $rutClean;
        }));
    }

    /**
     * Lista alumnos inscritos en un curso
     * 
     * @param int $cursoId
     * @return array
     */
    public function getAlumnosByCurso(int $cursoId): array
    {
        $this->loadCursos();
        $this->loadUsuarios();
        
        $ruts = [];
        foreach ($this->cursos['inscripciones'] as $inscripcion) {
            if ($inscripcion['curso_id'] === $cursoId) {
                $ruts[] = $inscripcion['alumno_rut'];
            }
        }
        
        return array_filter($this->usuarios['alumnos'], function($alumno) use ($ruts) {
            return in_array($alumno['rut'], $ruts);
        });
    }

    // =========================================================================
    // Metodos de Sesiones de Asistencia
    // =========================================================================

    /**
     * Obtiene sesion por codigo
     * 
     * @param string $codigo Codigo de 6 letras (ej: CVYAFO)
     * @return array|null
     */
    public function getSesionByCodigo(string $codigo): ?array
    {
        $this->loadSesiones();
        
        foreach ($this->sesiones['sesiones'] as $sesion) {
            if (strtoupper($sesion['codigo']) === strtoupper($codigo)) {
                return $sesion;
            }
        }
        return null;
    }

    /**
     * Obtiene sesion por ID
     * 
     * @param int $id
     * @return array|null
     */
    public function getSesionById(int $id): ?array
    {
        $this->loadSesiones();
        
        foreach ($this->sesiones['sesiones'] as $sesion) {
            if ($sesion['id'] === $id) {
                return $sesion;
            }
        }
        return null;
    }

    /**
     * Lista sesiones de un profesor
     * 
     * @param string $profesorEmail
     * @return array
     */
    public function getSesionesByProfesor(string $profesorEmail): array
    {
        $this->loadSesiones();
        
        return array_values(array_filter($this->sesiones['sesiones'], function($sesion) use ($profesorEmail) {
            return strtolower($sesion['profesor_email']) === strtolower($profesorEmail);
        }));
    }

    /**
     * Lista sesiones activas
     * 
     * @return array
     */
    public function getSesionesActivas(): array
    {
        $this->loadSesiones();
        
        return array_values(array_filter($this->sesiones['sesiones'], function($sesion) {
            return $sesion['activa'] ?? false;
        }));
    }

    /**
     * Lista todas las sesiones
     * 
     * @return array
     */
    public function getAllSesiones(): array
    {
        $this->loadSesiones();
        return $this->sesiones['sesiones'];
    }

    /**
     * Lista tipos de encuesta
     * 
     * @return array
     */
    public function getTiposEncuesta(): array
    {
        $this->loadSesiones();
        return $this->sesiones['tipos_encuesta'];
    }

    /**
     * Obtiene tipo de encuesta por ID
     * 
     * @param int $id
     * @return array|null
     */
    public function getTipoEncuestaById(int $id): ?array
    {
        $this->loadSesiones();
        
        foreach ($this->sesiones['tipos_encuesta'] as $tipo) {
            if ($tipo['id'] === $id) {
                return $tipo;
            }
        }
        return null;
    }

    /**
     * Crea nueva sesion (mock - solo en memoria, no persiste)
     * 
     * @param array $data Datos de la sesion
     * @return array Sesion creada con ID y codigo
     */
    public function createSesion(array $data): array
    {
        $this->loadSesiones();
        
        // Generar nuevo ID
        $nuevoId = ($this->sesiones['ultimo_id_sesion'] ?? 12347) + 1;
        
        // Generar codigo
        $codigo = dev_gen_cod_reserva($nuevoId);
        
        $sesion = [
            'id' => $nuevoId,
            'codigo' => $codigo,
            'curso_id' => $data['curso_id'],
            'semestre_id' => $data['semestre_id'],
            'fecha' => $data['fecha'] ?? date('Y-m-d'),
            'bloque_id' => $data['bloque_id'],
            'tipo_encuesta' => $data['tipo_encuesta'] ?? 4,
            'profesor_email' => $data['profesor_email'],
            'fechahora_inicio' => $data['fechahora_inicio'] ?? date('Y-m-d\TH:i:s'),
            'fechahora_termino' => $data['fechahora_termino'] ?? date('Y-m-d\TH:i:s', strtotime('+30 minutes')),
            'acepta_origen_ip' => $data['acepta_origen_ip'] ?? 'ALL',
            'activa' => true
        ];
        
        // Agregar a memoria (no persiste en JSON)
        $this->sesiones['sesiones'][] = $sesion;
        $this->sesiones['ultimo_id_sesion'] = $nuevoId;
        
        return $sesion;
    }

    // =========================================================================
    // Metodos de Utilidad
    // =========================================================================

    /**
     * Obtiene datos completos de una sesion con curso, bloque, etc.
     * 
     * @param string $codigo
     * @return array|null
     */
    public function getSesionCompleta(string $codigo): ?array
    {
        $sesion = $this->getSesionByCodigo($codigo);
        if (!$sesion) {
            return null;
        }
        
        $curso = $this->getCursoById($sesion['curso_id']);
        $bloque = $this->getBloqueById($sesion['bloque_id']);
        $semestre = $this->getSemestreById($sesion['semestre_id']);
        $tipoEncuesta = $this->getTipoEncuestaById($sesion['tipo_encuesta']);
        $profesor = $this->getProfesorByEmail($sesion['profesor_email']);
        
        return [
            'sesion' => $sesion,
            'curso' => $curso,
            'bloque' => $bloque,
            'semestre' => $semestre,
            'tipo_encuesta' => $tipoEncuesta,
            'profesor' => $profesor
        ];
    }
}
