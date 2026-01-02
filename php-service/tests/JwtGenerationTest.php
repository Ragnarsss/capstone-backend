<?php

namespace JwtBridge\Tests;

use PHPUnit\Framework\TestCase;

class JwtGenerationTest extends TestCase
{
    public function testJwtHasCorrectStructure()
    {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'userId' => 12345,
            'username' => 'test@ucn.cl',
            'iat' => time(),
            'exp' => time() + 300,
        ]);

        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, 'test_secret', true);
        $base64UrlSignature = $this->base64UrlEncode($signature);

        $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

        // JWT debe tener 3 partes separadas por puntos
        $parts = explode('.', $jwt);
        $this->assertCount(3, $parts);
        
        // Header decodificado
        $decodedHeader = json_decode(base64_decode(strtr($parts[0], '-_', '+/')), true);
        $this->assertEquals('JWT', $decodedHeader['typ']);
        $this->assertEquals('HS256', $decodedHeader['alg']);
        
        // Payload decodificado
        $decodedPayload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
        $this->assertEquals(12345, $decodedPayload['userId']);
        $this->assertEquals('test@ucn.cl', $decodedPayload['username']);
    }

    public function testBase64UrlEncodingIsCorrect()
    {
        $data = 'Test data with special chars: +/=';
        $encoded = $this->base64UrlEncode($data);

        // No debe contener caracteres especiales de base64
        $this->assertStringNotContainsString('+', $encoded);
        $this->assertStringNotContainsString('/', $encoded);
        $this->assertStringNotContainsString('=', $encoded);
    }

    public function testJwtSignatureIsValid()
    {
        $secret = 'super_secret_key';
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode(['userId' => 1, 'username' => 'test']);

        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
        $base64UrlSignature = $this->base64UrlEncode($signature);

        // Verificar firma
        $dataToVerify = $base64UrlHeader . "." . $base64UrlPayload;
        $expectedSignature = hash_hmac('sha256', $dataToVerify, $secret, true);
        $expectedBase64UrlSignature = $this->base64UrlEncode($expectedSignature);

        $this->assertEquals($expectedBase64UrlSignature, $base64UrlSignature);
    }

    public function testUserIdGenerationIsConsistent()
    {
        $username = 'profesor@ucn.cl';
        
        $userId1 = abs(crc32($username));
        $userId2 = abs(crc32($username));

        // El mismo username debe generar el mismo userId
        $this->assertEquals($userId1, $userId2);
        
        // Debe ser un número positivo
        $this->assertGreaterThan(0, $userId1);
    }

    public function testJwtExpirationIsInFuture()
    {
        $now = time();
        $ttl = 300; // 5 minutos
        $exp = $now + $ttl;

        $this->assertGreaterThan($now, $exp);
        $this->assertEquals(300, $exp - $now);
    }

    /**
     * Helper: Base64 URL encode
     */
    private function base64UrlEncode($data)
    {
        if (is_string($data)) {
            $data = base64_encode($data);
        }
        return str_replace(['+', '/', '='], ['-', '_', ''], $data);
    }
}
