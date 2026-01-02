<?php

namespace JwtBridge;

// Importar funciones del sistema legacy solo si no estamos en tests
if (!defined('PHPUNIT_RUNNING')) {
    require_once '/var/www/html/hawaii/db.inc';
}

/**
 * Middleware: Validación de sesión legacy
 * Usa las funciones de db.inc del sistema Hawaii
 */

class LegacySessionValidator
{
    private $config;

    public function __construct($config)
    {
        $this->config = $config;
    }

    public function validate()
    {
        if (!$this->config['security']['validate_legacy_session']) {
            return true;
        }

        // Usar función legacy is_logged_in()
        if (!is_logged_in()) {
            return false;
        }

        // Verificar campos requeridos de sesión
        if (!isset($_SESSION['correo']) || empty($_SESSION['correo'])) {
            return false;
        }

        if (!isset($_SESSION['rol']) || empty($_SESSION['rol'])) {
            return false;
        }

        if (!isset($_SESSION['activo']) || $_SESSION['activo'] !== true) {
            return false;
        }

        return true;
    }

    public function validateRole($requiredRole)
    {
        if (!$this->config['security']['validate_legacy_session']) {
            return true;
        }

        if (!isset($this->config['security']['require_role_validation']) || 
            !$this->config['security']['require_role_validation']) {
            return true;
        }

        if (!isset($_SESSION['rol'])) {
            return false;
        }

        return $_SESSION['rol'] === $requiredRole;
    }

    public function getUserEmail()
    {
        if (!isset($_SESSION['correo'])) {
            return null;
        }
        return $_SESSION['correo'];
    }

    public function getUserRole()
    {
        if (!isset($_SESSION['rol'])) {
            return null;
        }
        return $_SESSION['rol'];
    }
}
