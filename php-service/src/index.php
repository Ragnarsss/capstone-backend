<?php

/**
 * JWT Bridge Service - Endpoint Principal
 * Genera tokens JWT seguros para integración legacy → Node.js
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/middleware/Logger.php';
require_once __DIR__ . '/middleware/CorsHandler.php';
require_once __DIR__ . '/middleware/RateLimiter.php';
require_once __DIR__ . '/middleware/LegacySessionValidator.php';

// Cargar configuración
$config = require __DIR__ . '/config.php';

// Inicializar servicios
$logger = new Logger($config);
$corsHandler = new CorsHandler($config);
$rateLimiter = new RateLimiter($config);
$sessionValidator = new LegacySessionValidator($config);

// Headers base
header('Content-Type: application/json');

try {
    // 1. Manejar CORS
    $corsHandler->handle();

    // 2. Rate limiting por IP
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rateLimiter->check($clientIp);

    // 3. Validar sesión legacy
    $user = $sessionValidator->validate();
    
    if (!$user) {
        throw new Exception('Usuario no válido');
    }

    // 4. Validar rol si está habilitado
    $sessionValidator->validateRole($user);

    // 5. Generar JWT
    $now = time();
    $jwtConfig = $config['jwt'];

    $header = json_encode([
        'typ' => 'JWT',
        'alg' => 'HS256'
    ]);

    $payload = json_encode([
        'userId' => abs(crc32($user['username'])), // ID numérico consistente
        'username' => $user['username'],
        'rol' => $user['rol'],
        'iat' => $now,
        'exp' => $now + $jwtConfig['ttl'],
        'nbf' => $now,
        'jti' => bin2hex(random_bytes(16)), // Token único (previene replay)
        'iss' => $jwtConfig['issuer'],
        'aud' => $jwtConfig['audience']
    ]);

    // Codificar en base64url
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    // Crear firma HMAC-SHA256
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $jwtConfig['secret'], true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    // JWT completo
    $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

    // Log exitoso
    $logger->info('JWT generado', [
        'user' => $user['username'],
        'rol' => $user['rol'],
        'ip' => $clientIp,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ]);

    // Respuesta exitosa
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'token' => $jwt,
        'expiresIn' => $jwtConfig['ttl'],
        'userId' => abs(crc32($user['username'])),
        'username' => $user['username']
    ]);

} catch (Exception $e) {
    // Log de error
    $logger->error('Error generando JWT', [
        'error' => $e->getMessage(),
        'ip' => $clientIp ?? 'unknown',
        'trace' => $e->getTraceAsString()
    ]);

    // Respuesta de error genérica (no exponer detalles internos)
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'INTERNAL_ERROR',
        'message' => 'Error al generar token de autenticación'
    ]);
}
