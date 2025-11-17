<?php
/**
 * Enrollment Data Controller
 * 
 * Responsabilidad: Proveer datos de inscripciones desde sistema legacy a Node service
 * Principio: Single Responsibility, Vertical Slice
 * 
 * Este controller permite que Node service consulte inscripciones de alumnos
 * en cursos específicos para validar acceso
 */

require_once __DIR__ . '/../../lib/crypto/JWT.php';
require_once __DIR__ . '/../../config/Config.php';

class EnrollmentDataController
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
     * Maneja request GET /api/enrollment-data
     * 
     * Retorna inscripciones de curso o verifica inscripción específica
     * Query params: courseId, semesterId, userId (opcional)
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
        $userId = $_GET['userId'] ?? null;

        if (!$courseId || !$semesterId) {
            return [
                'success' => false,
                'error' => 'MISSING_PARAMETER',
                'message' => 'Se requiere courseId y semesterId'
            ];
        }

        try {
            if ($userId) {
                $result = $this->checkEnrollment((int)$courseId, (int)$semesterId, (int)$userId);
            } else {
                $result = $this->getEnrollments((int)$courseId, (int)$semesterId);
            }

            return [
                'success' => true,
                'data' => $result
            ];
            
        } catch (Exception $e) {
            error_log('Error en EnrollmentDataController: ' . $e->getMessage());
            
            return [
                'success' => false,
                'error' => 'DATABASE_ERROR',
                'message' => 'Error al consultar inscripciones'
            ];
        }
    }

    /**
     * Verifica si usuario está inscrito en curso
     * 
     * @param int $courseId ID del curso
     * @param int $semesterId ID del semestre
     * @param int $userId ID del usuario
     * @return array Resultado de verificación
     */
    private function checkEnrollment(int $courseId, int $semesterId, int $userId): array
    {
        $dbh = db_open();
        
        $stmt = $dbh->prepare('
            SELECT COUNT(*) as count
            FROM alumno_curso ac
            JOIN curso c ON ac.curso_id = c.id
            JOIN profesor p ON p.id = :userId
            JOIN alumno a ON a.rut = p.rut
            WHERE c.id = :courseId
            AND c.semestre_id = :semesterId
            AND ac.alumno_id = a.id
        ');
        
        $stmt->bindParam(':courseId', $courseId, PDO::PARAM_INT);
        $stmt->bindParam(':semesterId', $semesterId, PDO::PARAM_INT);
        $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $stmt->execute();
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return [
            'enrolled' => (int)$result['count'] > 0,
            'courseId' => $courseId,
            'semesterId' => $semesterId,
            'userId' => $userId
        ];
    }

    /**
     * Obtiene lista de alumnos inscritos en curso
     * 
     * @param int $courseId ID del curso
     * @param int $semesterId ID del semestre
     * @return array Lista de alumnos inscritos
     */
    private function getEnrollments(int $courseId, int $semesterId): array
    {
        $dbh = db_open();
        
        $stmt = $dbh->prepare('
            SELECT 
                a.id,
                a.rut,
                a.nombre,
                a.email
            FROM alumno a
            JOIN alumno_curso ac ON a.id = ac.alumno_id
            JOIN curso c ON ac.curso_id = c.id
            WHERE c.id = :courseId
            AND c.semestre_id = :semesterId
            ORDER BY a.nombre ASC
        ');
        
        $stmt->bindParam(':courseId', $courseId, PDO::PARAM_INT);
        $stmt->bindParam(':semesterId', $semesterId, PDO::PARAM_INT);
        $stmt->execute();
        
        $enrollments = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $enrollments[] = [
                'id' => (int)$row['id'],
                'rut' => $row['rut'],
                'nombre' => $row['nombre'],
                'email' => $row['email']
            ];
        }
        
        return [
            'courseId' => $courseId,
            'semesterId' => $semesterId,
            'students' => $enrollments,
            'total' => count($enrollments)
        ];
    }
}
