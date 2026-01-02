<?php

/**
 * Middleware: Validación de sesión legacy
 * Lee sesiones PHP del sistema Hawaii legacy
 */

class LegacySessionValidator
{
    private $config;
    private $db;

    public function __construct($config)
    {
        $this->config = $config;
    }

    public function validate()
    {
        // Configurar path de sesiones si está especificado
        if (!empty($this->config['legacy']['session_path'])) {
            ini_set('session.save_path', $this->config['legacy']['session_path']);
        }

        // Iniciar sesión si no está activa
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        // Verificar autenticación
        if (!$this->isLoggedIn()) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'NOT_AUTHENTICATED',
                'message' => 'Usuario no autenticado en sistema legacy'
            ]);
            exit;
        }

        return $this->getUserData();
    }

    private function isLoggedIn()
    {
        // Verificar si existe la variable de sesión (ajustar según el legacy)
        return isset($_SESSION['K_USER']) || isset($_SESSION['usuario']);
    }

    private function getUserData()
    {
        $username = $_SESSION['K_USER'] ?? $_SESSION['usuario'] ?? null;
        $rol = $_SESSION['rol'] ?? 'estudiante';
        
        if (!$username) {
            return null;
        }

        return [
            'username' => $username,
            'rol' => $rol,
            'session_id' => session_id()
        ];
    }

    public function validateRole($user)
    {
        if (!$this->config['security']['require_role_validation']) {
            return true; // Validación deshabilitada
        }

        $allowedRoles = $this->config['security']['allowed_roles'];
        $userRole = $user['rol'] ?? 'estudiante';

        if (!in_array($userRole, $allowedRoles)) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'INSUFFICIENT_PERMISSIONS',
                'message' => 'Rol no autorizado para generar tokens',
                'required_roles' => $allowedRoles,
                'user_role' => $userRole
            ]);
            exit;
        }

        return true;
    }

    public function __destruct()
    {
        if ($this->db) {
            try {
                $this->db->close();
            } catch (Exception $e) {
                // Silenciar errores
            }
        }
    }
}
