<?php

/**
 * Middleware: CORS restrictivo
 * Solo permite orígenes configurados
 */

class CorsHandler
{
    private $config;

    public function __construct($config)
    {
        $this->config = $config;
    }

    public function handle()
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowedOrigins = $this->config['cors']['allowed_origins'];

        // Verificar si el origen está permitido
        if (in_array($origin, $allowedOrigins)) {
            header("Access-Control-Allow-Origin: $origin");
        } elseif (empty($allowedOrigins)) {
            // Si no hay orígenes configurados, permitir todos (solo para desarrollo)
            header('Access-Control-Allow-Origin: *');
            error_log('WARNING: CORS_ALLOWED_ORIGINS no configurado, permitiendo todos los orígenes');
        } else {
            // Origen no permitido
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'ORIGIN_NOT_ALLOWED',
                'message' => 'Origen no permitido'
            ]);
            exit;
        }

        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        
        if ($this->config['cors']['allow_credentials']) {
            header('Access-Control-Allow-Credentials: true');
        }

        // Handle OPTIONS preflight
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }

    public function isOriginAllowed($origin)
    {
        $allowedOrigins = $this->config['cors']['allowed_origins'];
        return empty($allowedOrigins) || in_array($origin, $allowedOrigins);
    }
}
