<?php

namespace JwtBridge\Tests;

use PHPUnit\Framework\TestCase;

class ConfigTest extends TestCase
{
    private $originalEnv = [];

    protected function setUp(): void
    {
        parent::setUp();
        // Guardar variables de entorno originales
        $this->originalEnv = [
            'JWT_SECRET' => getenv('JWT_SECRET'),
            'JWT_TTL' => getenv('JWT_TTL'),
            'CORS_ALLOWED_ORIGINS' => getenv('CORS_ALLOWED_ORIGINS'),
        ];
    }

    protected function tearDown(): void
    {
        // Restaurar variables de entorno
        foreach ($this->originalEnv as $key => $value) {
            if ($value !== false) {
                putenv("$key=$value");
            }
        }
        parent::tearDown();
    }

    public function testConfigLoadSuccessfully()
    {
        putenv('JWT_SECRET=test_secret_123');
        putenv('JWT_TTL=600');
        
        $config = require __DIR__ . '/../src/config.php';

        $this->assertIsArray($config);
        $this->assertArrayHasKey('jwt', $config);
        $this->assertArrayHasKey('cors', $config);
        $this->assertArrayHasKey('rate_limit', $config);
        $this->assertArrayHasKey('legacy', $config);
    }

    public function testJwtSecretIsRequired()
    {
        putenv('JWT_SECRET='); // Vacío
        
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('JWT_SECRET no configurado');
        
        require __DIR__ . '/../src/config.php';
    }

    public function testJwtConfigDefaults()
    {
        putenv('JWT_SECRET=test_secret_456');
        putenv('JWT_TTL='); // Sin definir
        
        $config = require __DIR__ . '/../src/config.php';

        $this->assertEquals('test_secret_456', $config['jwt']['secret']);
        $this->assertEquals(300, $config['jwt']['ttl']); // Default 5 minutos
        $this->assertEquals('jwt-bridge-service', $config['jwt']['issuer']);
        $this->assertEquals('asistencia-backend', $config['jwt']['audience']);
    }

    public function testCorsConfigParsesMultipleOrigins()
    {
        putenv('JWT_SECRET=test_secret_789');
        putenv('CORS_ALLOWED_ORIGINS=http://localhost:3000,https://example.com,http://test.local');
        
        $config = require __DIR__ . '/../src/config.php';

        $this->assertCount(3, $config['cors']['allowed_origins']);
        $this->assertContains('http://localhost:3000', $config['cors']['allowed_origins']);
        $this->assertContains('https://example.com', $config['cors']['allowed_origins']);
        $this->assertContains('http://test.local', $config['cors']['allowed_origins']);
    }

    public function testRateLimitConfigDefaults()
    {
        putenv('JWT_SECRET=test_secret_abc');
        
        $config = require __DIR__ . '/../src/config.php';

        $this->assertTrue($config['rate_limit']['enabled']);
        $this->assertEquals(10, $config['rate_limit']['max_requests']);
        $this->assertEquals(60, $config['rate_limit']['window_seconds']);
        $this->assertEquals('valkey', $config['rate_limit']['redis_host']);
        $this->assertEquals(6379, $config['rate_limit']['redis_port']);
    }

    public function testSecurityConfigDefaults()
    {
        putenv('JWT_SECRET=test_secret_def');
        
        $config = require __DIR__ . '/../src/config.php';

        $this->assertCount(2, $config['security']['allowed_roles']);
        $this->assertContains('profesor', $config['security']['allowed_roles']);
        $this->assertContains('admin', $config['security']['allowed_roles']);
        $this->assertFalse($config['security']['require_role_validation']);
    }
}
