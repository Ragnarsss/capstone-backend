<?php
/**
 * Course Data Controller
 * 
 * Responsabilidad: Proveer datos de cursos desde sistema legacy a Node service
 * Principio: Single Responsibility, Vertical Slice
 * 
 * Este controller permite que Node service consulte datos de cursos
 * y sus sesiones de asistencia
 */

require_once __DIR__ . '/../../lib/crypto/JWT.php';
require_once __DIR__ . '/../../config/Config.php';

class CourseDataController
{
    private $jwtLibrary;

    /**
     * Constructor
     * 
     * @param JWT $jwtLibrary Biblioteca JWT para validar tokens internos
     */
    public function __construct(JWT $jwtLibrary)
    {
        $this->jwtLibrary = $jwtLibrary;
    }

    /**
     * Valida JWT interno en Authorization header
     * 
     * @return bool True si token es válido
     * @throws Exception Si token es inválido o falta
     */
    private function validateInternalToken(): bool
    {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        
        if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            throw new Exception('Missing authorization token');
        }

        $token = $matches[1];
        
        try {
            $payload = $this->jwtLibrary->decode($token);
            return true;
        } catch (Exception $e) {
            throw new Exception('Invalid authorization token');
        }
    }

    /**
     * Maneja request GET /api/course-data
     * 
     * Retorna datos de curso y sus sesiones
     * Query params: courseId, semesterId
     * 
     * @return array Respuesta JSON
     */
    public function handle(): array
    {
        try {
            $this->validateInternalToken();
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'UNAUTHORIZED',
                'message' => $e->getMessage()
            ];
        }

        $courseId = $_GET['courseId'] ?? null;
        $semesterId = $_GET['semesterId'] ?? null;

        if (!$courseId) {
            return [
                'success' => false,
                'error' => 'MISSING_PARAMETER',
                'message' => 'Se requiere courseId'
            ];
        }

        try {
            $courseData = $this->getCourseData((int)$courseId, $semesterId ? (int)$semesterId : null);
            
            if (!$courseData) {
                return [
                    'success' => false,
                    'error' => 'COURSE_NOT_FOUND',
                    'message' => 'Curso no encontrado'
                ];
            }

            return [
                'success' => true,
                'data' => $courseData
            ];
            
        } catch (Exception $e) {
            error_log('Error en CourseDataController: ' . $e->getMessage());
            
            return [
                'success' => false,
                'error' => 'DATABASE_ERROR',
                'message' => 'Error al consultar datos de curso'
            ];
        }
    }

    /**
     * Obtiene datos de curso desde sistema legacy
     * 
     * @param int $courseId ID del curso
     * @param int|null $semesterId ID del semestre (opcional)
     * @return array|null Datos de curso o null si no existe
     */
    private function getCourseData(int $courseId, ?int $semesterId): ?array
    {
        $dbh = db_open();
        
        $stmt = $dbh->prepare('
            SELECT 
                c.id,
                c.codigo,
                c.nombre,
                c.semestre_id,
                s.nombre as semestre_nombre,
                s.fecha_inicio,
                s.fecha_termino
            FROM curso c
            LEFT JOIN semestre s ON c.semestre_id = s.id
            WHERE c.id = :courseId
        ');
        
        $stmt->bindParam(':courseId', $courseId, PDO::PARAM_INT);
        $stmt->execute();
        $course = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$course) {
            return null;
        }

        $sessions = $this->getCourseSessions($courseId, $semesterId);

        return [
            'id' => (int)$course['id'],
            'codigo' => $course['codigo'],
            'nombre' => $course['nombre'],
            'semestre' => [
                'id' => (int)$course['semestre_id'],
                'nombre' => $course['semestre_nombre'],
                'fechaInicio' => $course['fecha_inicio'],
                'fechaTermino' => $course['fecha_termino']
            ],
            'sessions' => $sessions
        ];
    }

    /**
     * Obtiene sesiones de asistencia de un curso
     * 
     * @param int $courseId ID del curso
     * @param int|null $semesterId ID del semestre
     * @return array Lista de sesiones
     */
    private function getCourseSessions(int $courseId, ?int $semesterId): array
    {
        $dbh = db_open();
        
        $stmt = $dbh->prepare('
            SELECT 
                id,
                fecha,
                codigo_reserva,
                tipo
            FROM asistencia_curso
            WHERE curso_id = :courseId
            ORDER BY fecha DESC
            LIMIT 50
        ');
        
        $stmt->bindParam(':courseId', $courseId, PDO::PARAM_INT);
        $stmt->execute();
        
        $sessions = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $sessions[] = [
                'id' => (int)$row['id'],
                'fecha' => $row['fecha'],
                'codigoReserva' => $row['codigo_reserva'],
                'tipo' => (int)$row['tipo']
            ];
        }
        
        return $sessions;
    }
}
