<?php
/**
 * User Data Controller
 * 
 * Responsabilidad: Proveer datos de usuario desde sistema legacy a Node service
 * Principio: Single Responsibility, Vertical Slice
 * 
 * Este controller permite que Node service consulte datos de usuarios
 * sin acceso directo a la base de datos legacy
 */

require_once __DIR__ . '/../../lib/crypto/JWT.php';
require_once __DIR__ . '/../../config/Config.php';

class UserDataController
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
     * Maneja request GET /api/user-data
     * 
     * Retorna datos de usuario desde sistema legacy
     * Query params: userId o username
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

        $userId = $_GET['userId'] ?? null;
        $username = $_GET['username'] ?? null;

        if (!$userId && !$username) {
            return [
                'success' => false,
                'error' => 'MISSING_PARAMETER',
                'message' => 'Se requiere userId o username'
            ];
        }

        try {
            $userData = $this->getUserData($userId, $username);
            
            if (!$userData) {
                return [
                    'success' => false,
                    'error' => 'USER_NOT_FOUND',
                    'message' => 'Usuario no encontrado'
                ];
            }

            return [
                'success' => true,
                'data' => $userData
            ];
            
        } catch (Exception $e) {
            error_log('Error en UserDataController: ' . $e->getMessage());
            
            return [
                'success' => false,
                'error' => 'DATABASE_ERROR',
                'message' => 'Error al consultar datos de usuario'
            ];
        }
    }

    /**
     * Obtiene datos de usuario desde sistema legacy
     * 
     * NOTA: Esta implementacion usa datos mock para testing
     * TODO: Refactorizar para usar db.inc cuando este disponible
     * 
     * @param int|null $userId ID de usuario
     * @param string|null $username Username (email)
     * @return array|null Datos de usuario o null si no existe
     */
    private function getUserData(?int $userId, ?string $username): ?array
    {
        // Verificar si db.inc esta disponible
        $dbIncPath = __DIR__ . '/../../../db.inc';
        
        if (file_exists($dbIncPath)) {
            return $this->getUserDataFromDatabase($userId, $username);
        }
        
        // Usar datos mock para testing
        return $this->getUserDataMock($userId, $username);
    }

    /**
     * Obtiene datos de usuario desde base de datos real
     * 
     * @param int|null $userId ID de usuario
     * @param string|null $username Username (email)
     * @return array|null Datos de usuario o null si no existe
     */
    private function getUserDataFromDatabase(?int $userId, ?string $username): ?array
    {
        require_once __DIR__ . '/../../../db.inc';
        
        $dbh = db_open();
        
        if ($userId) {
            $stmt = $dbh->prepare('
                SELECT 
                    id,
                    rut,
                    nombre,
                    correo as email,
                    super,
                    control_clases,
                    control_asistencia
                FROM profesor 
                WHERE id = :userId
            ');
            $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        } else {
            $stmt = $dbh->prepare('
                SELECT 
                    id,
                    rut,
                    nombre,
                    correo as email,
                    super,
                    control_clases,
                    control_asistencia
                FROM profesor 
                WHERE correo = :username
            ');
            $stmt->bindParam(':username', $username, PDO::PARAM_STR);
        }
        
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            return null;
        }

        return [
            'id' => (int)$user['id'],
            'rut' => $user['rut'],
            'nombre' => $user['nombre'],
            'email' => $user['email'],
            'isSuperAdmin' => $user['super'] === 't',
            'canControlClasses' => $user['control_clases'] === 't',
            'canTakeAttendance' => $user['control_asistencia'] === 't'
        ];
    }

    /**
     * Retorna datos mock para testing (sin db.inc)
     * 
     * @param int|null $userId ID de usuario
     * @param string|null $username Username (email)
     * @return array|null Datos mock o null si no coincide
     */
    private function getUserDataMock(?int $userId, ?string $username): ?array
    {
        $mockUsers = [
            1 => [
                'id' => 1,
                'rut' => '12345678-9',
                'nombre' => 'Juan Profesor Demo',
                'email' => 'profesor@demo.cl',
                'isSuperAdmin' => true,
                'canControlClasses' => true,
                'canTakeAttendance' => true
            ],
            2 => [
                'id' => 2,
                'rut' => '98765432-1',
                'nombre' => 'Maria Docente Test',
                'email' => 'docente@test.cl',
                'isSuperAdmin' => false,
                'canControlClasses' => true,
                'canTakeAttendance' => true
            ]
        ];

        if ($userId && isset($mockUsers[$userId])) {
            return $mockUsers[$userId];
        }

        if ($username) {
            foreach ($mockUsers as $user) {
                if ($user['email'] === $username) {
                    return $user;
                }
            }
        }

        return null;
    }
}
