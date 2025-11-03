<?php
/**
 * Biblioteca JWT simple para PHP (sin dependencias externas)
 *
 * Genera tokens JWT usando HMAC-SHA256 (HS256)
 * Compatible con jsonwebtoken de Node.js
 */

class JWT {
    /**
     * Clave secreta compartida con Node.js
     * DEBE coincidir con JWT_SECRET en Node service
     */
    private const SECRET = 'CAMBIAR_EN_PRODUCCION_SECRET_KEY_COMPARTIDO_PHP_NODE';

    /**
     * Issuer del token (quien lo emite)
     */
    private const ISSUER = 'php-service';

    /**
     * Audience del token (para quien es)
     */
    private const AUDIENCE = 'node-service';

    /**
     * Codifica datos en base64url (RFC 4648)
     *
     * @param string $data Datos a codificar
     * @return string Datos codificados en base64url
     */
    private static function base64url_encode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Decodifica datos en base64url (RFC 4648)
     *
     * @param string $data Datos codificados en base64url
     * @return string Datos decodificados
     */
    private static function base64url_decode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    /**
     * Genera un token JWT
     *
     * @param array $payload Datos a incluir en el token (userId, username, etc.)
     * @param int $expiresIn Tiempo de expiracion en segundos (default: 5 minutos)
     * @return string Token JWT firmado
     *
     * Ejemplo:
     *   $token = JWT::generate([
     *       'userId' => 123,
     *       'username' => 'juan.perez',
     *       'nombreCompleto' => 'Juan Pérez',
     *       'rol' => 'alumno'
     *   ]);
     */
    public static function generate(array $payload, int $expiresIn = 300): string {
        $now = time();

        // Header del JWT (algoritmo HS256)
        $header = [
            'typ' => 'JWT',
            'alg' => 'HS256'
        ];

        // Payload completo con claims estándar
        $fullPayload = array_merge($payload, [
            'iat' => $now,                     // Issued at
            'exp' => $now + $expiresIn,        // Expiration
            'iss' => self::ISSUER,             // Issuer
            'aud' => self::AUDIENCE,           // Audience
        ]);

        // Codificar header y payload
        $encodedHeader = self::base64url_encode(json_encode($header));
        $encodedPayload = self::base64url_encode(json_encode($fullPayload));

        // Crear firma HMAC-SHA256
        $signature = hash_hmac(
            'sha256',
            "$encodedHeader.$encodedPayload",
            self::SECRET,
            true
        );
        $encodedSignature = self::base64url_encode($signature);

        // Retornar token completo: header.payload.signature
        return "$encodedHeader.$encodedPayload.$encodedSignature";
    }

    /**
     * Valida un token JWT (opcional, para debugging)
     *
     * @param string $token Token JWT a validar
     * @return array|null Payload decodificado si es válido, null si es inválido
     *
     * NOTA: En producción, Node.js es quien valida los tokens.
     *       Esta función es solo para testing/debugging en PHP.
     */
    public static function validate(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

        // Verificar firma
        $expectedSignature = hash_hmac(
            'sha256',
            "$encodedHeader.$encodedPayload",
            self::SECRET,
            true
        );
        $expectedEncodedSignature = self::base64url_encode($expectedSignature);

        if (!hash_equals($expectedEncodedSignature, $encodedSignature)) {
            return null; // Firma inválida
        }

        // Decodificar payload
        $payload = json_decode(self::base64url_decode($encodedPayload), true);

        // Verificar expiración
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null; // Token expirado
        }

        return $payload;
    }

    /**
     * Obtiene la clave secreta (para configuración)
     *
     * @return string Clave secreta actual
     */
    public static function getSecret(): string {
        return self::SECRET;
    }
}
