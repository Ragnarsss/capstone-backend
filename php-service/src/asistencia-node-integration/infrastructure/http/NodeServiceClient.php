<?php
/**
 * Node Service Client - HTTP Client Implementation
 * 
 * Responsabilidad: Comunicación HTTP con Node service
 * Principio: Implementación de IntegrationGateway interface
 * 
 * Este cliente maneja la comunicación backend-to-backend con Node.js
 * usando JWT interno para autenticación
 */

require_once __DIR__ . '/../../domain/IntegrationGateway.php';
require_once __DIR__ . '/../../lib/crypto/JWT.php';
require_once __DIR__ . '/../../config/Config.php';

class NodeServiceClient implements IntegrationGateway
{
    private $baseUrl;
    private $jwtLibrary;
    private $timeout;

    /**
     * Constructor
     * 
     * @param string $baseUrl URL base del Node service
     * @param string $jwtSecret Secret para JWT interno
     */
    public function __construct(string $baseUrl, string $jwtSecret)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->jwtLibrary = new JWT($jwtSecret);
        $this->timeout = Config::getNodeTimeout();
    }

    /**
     * Genera JWT interno para comunicación backend-to-backend
     * 
     * @return string Token JWT interno
     */
    private function generateInternalToken(): string
    {
        $payload = [
            'source' => 'php-service',
        ];

        return $this->jwtLibrary->encode(
            $payload,
            3600,
            'php-service-internal',
            'node-service-internal'
        );
    }

    /**
     * Ejecuta HTTP request a Node service
     * 
     * @param string $method HTTP method (GET, POST, PUT, etc)
     * @param string $path Path relativo al baseUrl
     * @param array|null $data Datos para request body (POST, PUT, PATCH)
     * @return array Respuesta decodificada
     */
    private function request(string $method, string $path, array $data = null): array
    {
        $url = $this->baseUrl . $path;
        $token = $this->generateInternalToken();

        $options = [
            'http' => [
                'method' => $method,
                'header' => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $token
                ],
                'timeout' => $this->timeout,
                'ignore_errors' => true
            ]
        ];

        if ($data !== null && in_array($method, ['POST', 'PUT', 'PATCH'])) {
            $options['http']['content'] = json_encode($data);
        }

        $context = stream_context_create($options);
        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            return [
                'success' => false,
                'error' => 'CONNECTION_ERROR',
                'message' => 'No se pudo conectar con Node service'
            ];
        }

        $decoded = json_decode($response, true);
        
        return $decoded ?? [
            'success' => false,
            'error' => 'INVALID_RESPONSE',
            'message' => 'Respuesta inválida de Node service'
        ];
    }

    /**
     * Implementación de IntegrationGateway::logEvent
     */
    public function logEvent(string $event, array $data): array
    {
        return $this->request('POST', '/api/internal/log-event', [
            'event' => $event,
            'data' => $data
        ]);
    }

    /**
     * Implementación de IntegrationGateway::getDeviceData
     */
    public function getDeviceData(int $userId): array
    {
        return $this->request('GET', '/api/internal/device?userId=' . $userId);
    }
}
