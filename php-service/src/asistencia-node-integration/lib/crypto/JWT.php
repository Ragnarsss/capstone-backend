<?php
/**
 * JWT Library - JSON Web Token Encoding/Decoding
 * 
 * Responsabilidad: Codificar y decodificar tokens JWT usando HMAC-SHA256
 * Principio: Stateless utility class con dependency injection
 * 
 * Compatible con jsonwebtoken de Node.js
 */

class JWT
{
    private $secret;

    /**
     * Constructor
     * 
     * @param string $secret Clave secreta para firmar tokens
     */
    public function __construct(string $secret)
    {
        if (empty($secret)) {
            throw new InvalidArgumentException('JWT secret cannot be empty');
        }
        
        $this->secret = $secret;
    }

    /**
     * Codifica payload en JWT
     * 
     * @param array $payload Datos a incluir en el token
     * @param int $expiresIn TTL en segundos (default: 300)
     * @param string $issuer Emisor del token (default: php-service)
     * @param string $audience Destinatario del token (default: node-service)
     * @return string Token JWT firmado
     */
    public function encode(
        array $payload,
        int $expiresIn = 300,
        string $issuer = 'php-service',
        string $audience = 'node-service'
    ): string {
        $now = time();

        $header = [
            'typ' => 'JWT',
            'alg' => 'HS256'
        ];

        $fullPayload = array_merge($payload, [
            'iat' => $now,
            'exp' => $now + $expiresIn,
            'iss' => $issuer,
            'aud' => $audience,
        ]);

        $encodedHeader = $this->base64urlEncode(json_encode($header));
        $encodedPayload = $this->base64urlEncode(json_encode($fullPayload));

        $signature = hash_hmac(
            'sha256',
            "$encodedHeader.$encodedPayload",
            $this->secret,
            true
        );
        
        $encodedSignature = $this->base64urlEncode($signature);

        return "$encodedHeader.$encodedPayload.$encodedSignature";
    }

    /**
     * Decodifica y valida JWT
     * 
     * @param string $token Token JWT a validar
     * @return array Payload decodificado
     * @throws Exception Si token es inválido o expirado
     */
    public function decode(string $token): array
    {
        $parts = explode('.', $token);
        
        if (count($parts) !== 3) {
            throw new Exception('Invalid JWT format');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

        $expectedSignature = hash_hmac(
            'sha256',
            "$encodedHeader.$encodedPayload",
            $this->secret,
            true
        );
        
        $expectedEncodedSignature = $this->base64urlEncode($expectedSignature);

        if (!hash_equals($expectedEncodedSignature, $encodedSignature)) {
            throw new Exception('Invalid JWT signature');
        }

        $payload = json_decode($this->base64urlDecode($encodedPayload), true);

        if (!$payload) {
            throw new Exception('Invalid JWT payload');
        }

        if (isset($payload['exp']) && $payload['exp'] < time()) {
            throw new Exception('JWT token expired');
        }

        return $payload;
    }

    /**
     * Codifica en base64url (RFC 4648)
     * 
     * @param string $data Datos a codificar
     * @return string Datos codificados
     */
    private function base64urlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Decodifica de base64url (RFC 4648)
     * 
     * @param string $data Datos a decodificar
     * @return string Datos decodificados
     */
    private function base64urlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
