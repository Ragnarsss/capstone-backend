<?php

/**
 * Bootstrap para tests PHPUnit
 */

// Autoload de Composer
require_once __DIR__ . '/../vendor/autoload.php';

// Variables de entorno para tests
putenv('APP_ENV=testing');
putenv('JWT_SECRET=test_secret_for_phpunit_' . bin2hex(random_bytes(16)));
putenv('JWT_TTL=300');
putenv('CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:9506');
putenv('RATE_LIMIT_ENABLED=false'); // Deshabilitado en tests
putenv('LOGGING_ENABLED=false'); // Deshabilitado en tests
