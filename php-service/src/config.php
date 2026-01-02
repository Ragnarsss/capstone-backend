<?php

/**
 * Configuración del JWT Bridge Service
 * Todas las configuraciones sensibles vienen de variables de entorno
 */

return [
    // JWT Configuration
    'jwt' => [
        'secret' => getenv('JWT_SECRET') ?: throw new RuntimeException('JWT_SECRET no configurado'),
        'ttl' => (int)(getenv('JWT_TTL') ?: 300), // 5 minutos por defecto
        'issuer' => getenv('JWT_ISSUER') ?: 'jwt-bridge-service',
        'audience' => getenv('JWT_AUDIENCE') ?: 'asistencia-backend',
    ],

    // CORS Configuration
    'cors' => [
        'allowed_origins' => array_filter(explode(',', getenv('CORS_ALLOWED_ORIGINS') ?: '')),
        'allow_credentials' => true,
    ],

    // Rate Limiting (usando Redis/Valkey)
    'rate_limit' => [
        'enabled' => (bool)(getenv('RATE_LIMIT_ENABLED') ?: true),
        'max_requests' => (int)(getenv('RATE_LIMIT_MAX_REQUESTS') ?: 10),
        'window_seconds' => (int)(getenv('RATE_LIMIT_WINDOW') ?: 60),
        'redis_host' => getenv('REDIS_HOST') ?: 'valkey',
        'redis_port' => (int)(getenv('REDIS_PORT') ?: 6379),
    ],

    // Legacy Integration
    'legacy' => [
        'session_cookie_name' => getenv('LEGACY_SESSION_NAME') ?: 'PHPSESSID',
        'session_path' => getenv('LEGACY_SESSION_PATH') ?: '/var/www/html/hawaii/sessions',
        'db_host' => getenv('LEGACY_DB_HOST') ?: 'localhost',
        'db_name' => getenv('LEGACY_DB_NAME') ?: 'hawaii',
        'db_user' => getenv('LEGACY_DB_USER') ?: 'root',
        'db_pass' => getenv('LEGACY_DB_PASS') ?: '',
    ],

    // Logging
    'logging' => [
        'enabled' => (bool)(getenv('LOGGING_ENABLED') ?: true),
        'level' => getenv('LOG_LEVEL') ?: 'info', // debug, info, warning, error
    ],

    // Security
    'security' => [
        'allowed_roles' => array_filter(explode(',', getenv('ALLOWED_ROLES') ?: 'profesor,admin')),
        'require_role_validation' => (bool)(getenv('REQUIRE_ROLE_VALIDATION') ?: false),
    ],
];
