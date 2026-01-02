<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../../src/asistencia-node-integration/lib/crypto/JWT.php';

/**
 * Tests unitarios para JWT Library
 * 
 * Objetivo: Validar encoding/decoding de tokens JWT
 * Cobertura mínima: 80%
 */
class JWTTest extends TestCase
{
    private $secret = 'test-secret-key-2025';
    private $jwt;

    protected function setUp(): void
    {
        $this->jwt = new JWT($this->secret);
    }

    /**
     * Test 1: Constructor rechaza secret vacío
     * 
     * Requisito: JWT debe requerir secret válido
     * Criterio: Exception si secret es string vacío
     */
    public function testConstructorRejectsEmptySecret(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('JWT secret cannot be empty');
        
        new JWT('');
    }

    /**
     * Test 2: Encode genera token JWT válido con estructura correcta
     * 
     * Requisito: Token debe tener formato header.payload.signature
     * Criterio: String con exactamente 3 partes separadas por punto
     */
    public function testEncodeGeneratesValidJWTStructure(): void
    {
        $payload = ['userId' => 123, 'role' => 'student'];
        
        $token = $this->jwt->encode($payload);
        
        $this->assertIsString($token);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/', $token);
        
        $parts = explode('.', $token);
        $this->assertCount(3, $parts, 'JWT debe tener 3 partes: header.payload.signature');
    }

    /**
     * Test 3: Encode incluye claims estándar (iat, exp, iss, aud)
     * 
     * Requisito: Token debe incluir claims JWT estándar
     * Criterio: Payload decodificado contiene iat, exp, iss, aud
     */
    public function testEncodeIncludesStandardClaims(): void
    {
        $payload = ['userId' => 456];
        $expiresIn = 300;
        
        $token = $this->jwt->encode($payload, $expiresIn);
        $decoded = $this->jwt->decode($token);
        
        $this->assertArrayHasKey('iat', $decoded, 'Debe incluir issued at timestamp');
        $this->assertArrayHasKey('exp', $decoded, 'Debe incluir expiration timestamp');
        $this->assertArrayHasKey('iss', $decoded, 'Debe incluir issuer');
        $this->assertArrayHasKey('aud', $decoded, 'Debe incluir audience');
        
        $this->assertEquals('php-service', $decoded['iss']);
        $this->assertEquals('node-service', $decoded['aud']);
        
        // Validar que exp = iat + expiresIn (con margen de 2 segundos)
        $expectedExp = $decoded['iat'] + $expiresIn;
        $this->assertEqualsWithDelta($expectedExp, $decoded['exp'], 2);
    }

    /**
     * Test 4: Decode valida correctamente token válido
     * 
     * Requisito: Token generado debe ser decodificable y contener payload original
     * Criterio: Payload decodificado contiene datos originales
     */
    public function testDecodeValidatesAndReturnsPayload(): void
    {
        $originalPayload = [
            'userId' => 789,
            'role' => 'professor',
            'courseId' => 'IWG-101'
        ];
        
        $token = $this->jwt->encode($originalPayload);
        $decoded = $this->jwt->decode($token);
        
        $this->assertEquals(789, $decoded['userId']);
        $this->assertEquals('professor', $decoded['role']);
        $this->assertEquals('IWG-101', $decoded['courseId']);
    }

    /**
     * Test 5: Decode rechaza token con firma inválida
     * 
     * Requisito: Token con firma alterada debe ser rechazado
     * Criterio: Exception "Invalid JWT signature"
     */
    public function testDecodeRejectsTokenWithInvalidSignature(): void
    {
        $payload = ['userId' => 999];
        $token = $this->jwt->encode($payload);
        
        // Alterar último carácter de la firma
        $tamperedToken = substr($token, 0, -1) . 'X';
        
        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Invalid JWT signature');
        
        $this->jwt->decode($tamperedToken);
    }
}
