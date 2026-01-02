<?php

/**
 * Middleware: Rate Limiting usando Redis/Valkey
 * Previene abuso del endpoint JWT
 */

class RateLimiter
{
    private $redis;
    private $config;

    public function __construct($config)
    {
        $this->config = $config;
        
        if ($config['rate_limit']['enabled']) {
            $this->redis = new Redis();
            try {
                $this->redis->connect(
                    $config['rate_limit']['redis_host'],
                    $config['rate_limit']['redis_port']
                );
            } catch (Exception $e) {
                error_log("Redis connection failed: " . $e->getMessage());
                $this->redis = null;
            }
        }
    }

    public function check($identifier)
    {
        if (!$this->config['rate_limit']['enabled'] || !$this->redis) {
            return true; // Bypass si está deshabilitado o Redis no disponible
        }

        $key = "rate_limit:jwt:{$identifier}";
        $maxRequests = $this->config['rate_limit']['max_requests'];
        $window = $this->config['rate_limit']['window_seconds'];

        try {
            $current = $this->redis->incr($key);
            
            if ($current === 1) {
                $this->redis->expire($key, $window);
            }

            if ($current > $maxRequests) {
                $ttl = $this->redis->ttl($key);
                http_response_code(429);
                header('Content-Type: application/json');
                header("Retry-After: $ttl");
                echo json_encode([
                    'success' => false,
                    'error' => 'RATE_LIMIT_EXCEEDED',
                    'message' => "Límite de {$maxRequests} solicitudes por {$window} segundos excedido",
                    'retry_after' => $ttl
                ]);
                exit;
            }

            return true;
        } catch (Exception $e) {
            error_log("Rate limit check failed: " . $e->getMessage());
            return true; // Permitir en caso de error
        }
    }

    public function getRemainingAttempts($identifier)
    {
        if (!$this->redis) {
            return null;
        }

        $key = "rate_limit:jwt:{$identifier}";
        $maxRequests = $this->config['rate_limit']['max_requests'];

        try {
            $current = (int)$this->redis->get($key);
            return max(0, $maxRequests - $current);
        } catch (Exception $e) {
            return null;
        }
    }

    public function __destruct()
    {
        if ($this->redis) {
            try {
                $this->redis->close();
            } catch (Exception $e) {
                // Silenciar errores en destructor
            }
        }
    }
}
