<?php
/**
 * Configuration - Centralized Application Configuration
 * 
 * Responsabilidad: Proveer acceso type-safe a configuración de aplicación
 * Principio: Single source of truth para configuración
 * 
 * Configuración se carga desde variables de entorno con fallbacks seguros
 */

class Config
{
    private static $loaded = false;
    private static $config = [];

    /**
     * Carga configuración desde environment variables
     */
    private static function load(): void
    {
        if (self::$loaded) {
            return;
        }

        self::$config = [
            'module_enabled' => getenv('NODE_MODULE_ENABLED') !== 'false',
            'node_env' => getenv('NODE_ENV') ?: 'production',
            'jwt_secret' => getenv('JWT_SECRET') ?: 'MUST_CHANGE_IN_PRODUCTION',
            'jwt_secret_internal' => getenv('JWT_SECRET_INTERNAL') ?: 'MUST_CHANGE_INTERNAL',
            'jwt_ttl' => (int)(getenv('JWT_TTL') ?: 300),
            'jwt_issuer' => 'php-service',
            'jwt_audience' => 'node-service',
            'node_service_url' => getenv('NODE_SERVICE_URL') ?: 'http://node-service:3000',
            'node_timeout' => (int)(getenv('NODE_TIMEOUT') ?: 5),
            'enable_logging' => getenv('ENABLE_LOGGING') === 'true',
            'log_path' => __DIR__ . '/../logs',
        ];

        self::$loaded = true;
    }

    public static function isEnabled(): bool
    {
        self::load();
        return self::$config['module_enabled'];
    }

    public static function getJwtSecret(): string
    {
        self::load();
        return self::$config['jwt_secret'];
    }

    public static function getJwtSecretInternal(): string
    {
        self::load();
        return self::$config['jwt_secret_internal'];
    }

    public static function getJwtTtl(): int
    {
        self::load();
        return self::$config['jwt_ttl'];
    }

    public static function getJwtIssuer(): string
    {
        self::load();
        return self::$config['jwt_issuer'];
    }

    public static function getJwtAudience(): string
    {
        self::load();
        return self::$config['jwt_audience'];
    }

    public static function getNodeServiceUrl(): string
    {
        self::load();
        return self::$config['node_service_url'];
    }

    public static function getNodeTimeout(): int
    {
        self::load();
        return self::$config['node_timeout'];
    }

    public static function isLoggingEnabled(): bool
    {
        self::load();
        return self::$config['enable_logging'];
    }

    public static function getLogPath(): string
    {
        self::load();
        return self::$config['log_path'];
    }

    public static function isDevelopment(): bool
    {
        self::load();
        return self::$config['node_env'] === 'development';
    }

    public static function isProduction(): bool
    {
        self::load();
        return self::$config['node_env'] === 'production';
    }
}
