<?php
/**
 * API Puente Minodo - El "Portero" del Sistema
 *
 * Este es el ÚNICO archivo PHP nuevo que se agrega al monolito.
 * Su única función es emitir tokens JWT para usuarios autenticados.
 *
 * Según la recomendación de la IA amiga:
 * - Verifica la sesión PHP (autenticación legacy)
 * - Emite un "Pase de Visitante" (JWT) temporal y firmado
 * - El cliente usa este JWT para hablar directamente con Node.js
 *
 * NO hace:
 * - Lógica de negocio
 * - Llamadas a Node.js
 * - Proxy de requests
 *
 * SOLO emite tokens JWT.
 */

session_start();
require_once __DIR__ . '/lib/jwt.php';

// ============================================
// SOLO PARA TESTING - Simular sesión PHP
// ============================================
// En producción, la sesión PHP ya existe del login legacy
// Esta sección debe REMOVERSE en producción
if (!isset($_SESSION['user_id'])) {
    $_SESSION['user_id'] = 123;
    $_SESSION['username'] = 'test.user';
    $_SESSION['nombre_completo'] = 'Usuario de Prueba';
    $_SESSION['rol'] = 'alumno';
    error_log('[TESTING] Sesión PHP simulada creada para testing');
}
// ============================================

// Configuración de respuesta JSON
header('Content-Type: application/json');

// CORS para permitir requests desde el cliente
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/**
 * Función helper para enviar respuesta JSON y terminar
 */
function sendJSON($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

/**
 * Función helper para log de eventos de seguridad
 */
function logSecurityEvent($event, $data = []) {
    $logEntry = sprintf(
        "[%s] %s | User: %s | IP: %s | Data: %s\n",
        date('Y-m-d H:i:s'),
        $event,
        $_SESSION['user_id'] ?? 'N/A',
        $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        json_encode($data)
    );

    // En producción, escribir a archivo de log
    // error_log($logEntry, 3, '/var/log/php-minodo-bridge.log');

    // Por ahora, log a error_log estándar
    error_log($logEntry);
}

// Determinar acción a realizar
$action = $_GET['action'] ?? $_POST['action'] ?? 'get_token';

switch ($action) {
    case 'get_token':
        handleGetToken();
        break;

    case 'log_evento':
        handleLogEvento();
        break;

    default:
        sendJSON([
            'success' => false,
            'error' => 'INVALID_ACTION',
            'message' => 'Acción no válida'
        ], 400);
}

/**
 * Acción: get_token
 *
 * Verifica la sesión PHP y emite un JWT para el usuario autenticado
 *
 * Request:
 *   GET /api_puente_minodo.php?action=get_token
 *
 * Response:
 *   {
 *     "success": true,
 *     "token": "eyJhbGc...",
 *     "expiresIn": 300,
 *     "userId": 123,
 *     "username": "juan.perez"
 *   }
 */
function handleGetToken() {
    // Verificar que el usuario esté autenticado
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['username'])) {
        logSecurityEvent('GET_TOKEN_FAILED', ['reason' => 'not_authenticated']);

        sendJSON([
            'success' => false,
            'error' => 'NOT_AUTHENTICATED',
            'message' => 'Debes iniciar sesión primero'
        ], 401);
    }

    // Extraer datos de la sesión
    $userId = (int)$_SESSION['user_id'];
    $username = $_SESSION['username'];
    $nombreCompleto = $_SESSION['nombre_completo'] ?? null;
    $rol = $_SESSION['rol'] ?? 'usuario';

    // Generar JWT
    $token = JWT::generate([
        'userId' => $userId,
        'username' => $username,
        'nombreCompleto' => $nombreCompleto,
        'rol' => $rol,
    ], 300); // 5 minutos de expiración

    logSecurityEvent('TOKEN_GENERATED', [
        'userId' => $userId,
        'username' => $username,
    ]);

    sendJSON([
        'success' => true,
        'token' => $token,
        'expiresIn' => 300,
        'userId' => $userId,
        'username' => $username,
    ]);
}

/**
 * Acción: log_evento
 *
 * Permite a Node.js registrar eventos de seguridad en los logs de PHP
 * (Comunicación backend-a-backend)
 *
 * Request:
 *   POST /api_puente_minodo.php?action=log_evento
 *   {
 *     "event": "ENROLLMENT_COMPLETED",
 *     "userId": 123,
 *     "data": {...}
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "message": "Evento registrado"
 *   }
 */
function handleLogEvento() {
    // Validar que la request venga de Node.js (localhost)
    // En producción, agregar verificación más robusta (shared secret, etc.)
    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';

    // Permitir solo requests locales (desde el contenedor Node.js)
    $allowedIPs = ['127.0.0.1', '::1', 'node-service']; // Docker/Podman network

    // Por ahora, comentar validación para permitir testing
    // if (!in_array($remoteAddr, $allowedIPs)) {
    //     sendJSON([
    //         'success' => false,
    //         'error' => 'FORBIDDEN',
    //         'message' => 'Solo Node.js puede llamar este endpoint'
    //     ], 403);
    // }

    // Leer payload JSON
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data || !isset($data['event'])) {
        sendJSON([
            'success' => false,
            'error' => 'INVALID_PAYLOAD',
            'message' => 'Payload inválido'
        ], 400);
    }

    // Registrar evento
    logSecurityEvent($data['event'], $data['data'] ?? []);

    sendJSON([
        'success' => true,
        'message' => 'Evento registrado'
    ]);
}
