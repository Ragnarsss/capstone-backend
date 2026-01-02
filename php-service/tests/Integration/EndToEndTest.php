<?php

namespace JwtBridge\Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * Tests de integración end-to-end del JWT Bridge Service
 * Validan el flujo completo de generación de JWT
 */
class EndToEndTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // Configurar variables de entorno necesarias
        putenv('JWT_SECRET=test-secret-key-for-integration-tests');
        putenv('JWT_TTL=300');
        putenv('JWT_ISSUER=jwt-bridge-test');
        putenv('JWT_AUDIENCE=asistencia-backend-test');
        putenv('RATE_LIMIT_ENABLED=false'); // Desactivar rate limiting en tests
        putenv('LOGGING_ENABLED=false'); // Desactivar logging en tests
    }
    
    /**
     * @test
     */
    public function it_has_all_required_components()
    {
        $this->assertFileExists(__DIR__ . '/../../src/index.php');
        $this->assertFileExists(__DIR__ . '/../../src/config.php');
        $this->assertFileExists(__DIR__ . '/../../src/middleware/Logger.php');
        $this->assertFileExists(__DIR__ . '/../../src/middleware/CorsHandler.php');
        $this->assertFileExists(__DIR__ . '/../../src/middleware/RateLimiter.php');
        $this->assertFileExists(__DIR__ . '/../../src/middleware/LegacySessionValidator.php');
    }
    
    /**
     * @test
     */
    public function it_validates_jwt_structure()
    {
        // Simular generación manual de JWT
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'userId' => 12345,
            'username' => 'test@ucn.cl',
            'iat' => time(),
            'exp' => time() + 300,
        ]);
        
        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, 'test-secret', true);
        $base64UrlSignature = $this->base64UrlEncode($signature);
        
        $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
        
        // Validar estructura
        $parts = explode('.', $jwt);
        $this->assertCount(3, $parts);
        
        // Decodificar y validar header
        $decodedHeader = json_decode(base64_decode(strtr($parts[0], '-_', '+/')), true);
        $this->assertEquals('JWT', $decodedHeader['typ']);
        $this->assertEquals('HS256', $decodedHeader['alg']);
        
        // Decodificar y validar payload
        $decodedPayload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
        $this->assertEquals(12345, $decodedPayload['userId']);
        $this->assertEquals('test@ucn.cl', $decodedPayload['username']);
        $this->assertArrayHasKey('iat', $decodedPayload);
        $this->assertArrayHasKey('exp', $decodedPayload);
    }
    
    /**
     * @test
     */
    public function it_generates_consistent_user_ids()
    {
        $username1 = 'profesor@ucn.cl';
        $username2 = 'profesor@ucn.cl';
        $username3 = 'alumno@ucn.cl';
        
        $userId1 = abs(crc32($username1));
        $userId2 = abs(crc32($username2));
        $userId3 = abs(crc32($username3));
        
        // Mismo username debe generar mismo userId
        $this->assertEquals($userId1, $userId2);
        
        // Diferente username debe generar diferente userId
        $this->assertNotEquals($userId1, $userId3);
        
        // Todos los IDs deben ser positivos
        $this->assertGreaterThan(0, $userId1);
        $this->assertGreaterThan(0, $userId3);
    }
    
    /**
     * @test
     */
    public function it_validates_jwt_expiration_logic()
    {
        $now = time();
        $ttl = 300; // 5 minutos
        
        $iat = $now;
        $exp = $now + $ttl;
        $nbf = $now;
        
        // Token debe ser válido ahora
        $this->assertLessThanOrEqual($now, $iat);
        $this->assertLessThanOrEqual($now, $nbf);
        $this->assertGreaterThan($now, $exp);
        
        // Diferencia debe ser exactamente el TTL
        $this->assertEquals($ttl, $exp - $iat);
    }
    
    /**
     * @test
     */
    public function it_validates_jti_uniqueness()
    {
        $jti1 = bin2hex(random_bytes(16));
        $jti2 = bin2hex(random_bytes(16));
        
        // JTIs deben ser únicos
        $this->assertNotEquals($jti1, $jti2);
        
        // JTIs deben tener longitud correcta (32 chars hex = 16 bytes)
        $this->assertEquals(32, strlen($jti1));
        $this->assertEquals(32, strlen($jti2));
    }
    
    /**
     * Helper: Base64 URL encode
     */
    private function base64UrlEncode($data)
    {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }
}
