<?php

/**
 * Bootstrap para tests PHPUnit
 */

// Definir constante para indicar que estamos en PHPUnit
define('PHPUNIT_RUNNING', true);

// Stub functions from db.inc for testing
if (!function_exists('is_logged_in')) {
    function is_logged_in() {
        return isset($_SESSION['K_USER']);
    }
}

if (!function_exists('get_usuario_actual')) {
    function get_usuario_actual() {
        return $_SESSION['K_USER'] ?? false;
    }
}

// Autoload de Composer
require_once __DIR__ . '/../vendor/autoload.php';

// Variables de entorno para tests
putenv('APP_ENV=testing');
putenv('JWT_SECRET=test_secret_for_phpunit_' . bin2hex(random_bytes(16)));
putenv('JWT_TTL=300');
putenv('CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:9506');
putenv('RATE_LIMIT_ENABLED=false'); // Deshabilitado en tests
putenv('LOGGING_ENABLED=false'); // Deshabilitado en tests
