<?php
/**
 * Dev Simulator - API Token Endpoint
 * 
 * Responsabilidad: Generar JWT para usuario autenticado en dev-simulator
 * 
 * Este endpoint emula /asistencia-node-integration/api/token usando
 * la misma biblioteca JWT y el mismo formato de respuesta.
 * 
 * El JWT generado es REAL (no simulado) - usa el mismo secret que
 * producción, por lo que Node-service lo valida correctamente.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../functions.php';

// Cargar biblioteca JWT de producción
require_once __DIR__ . '/../../asistencia-node-integration/lib/crypto/JWT.php';
require_once __DIR__ . '/../../asistencia-node-integration/config/Config.php';

// Iniciar sesión
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Verificar autenticación
if (!dev_is_logged_in()) {
    echo json_encode([
        'success' => false,
        'error' => 'NOT_AUTHENTICATED',
        'message' => 'Sesión no válida'
    ]);
    exit;
}

// Obtener datos del usuario de la sesión
$userId = $_SESSION[K_ID];
$username = $_SESSION[K_USER];
$fullName = $_SESSION['nombre_completo'] ?? $username;
$role = dev_get_user_role();

// Crear payload JWT (mismo formato que producción)
$payload = [
    'userId' => $userId,
    'username' => $username,
    'nombreCompleto' => $fullName,
    'rol' => $role,
];

try {
    // Usar la misma biblioteca JWT y secret que producción
    $jwtLibrary = new JWT(Config::getJwtSecret());
    
    $token = $jwtLibrary->encode(
        $payload,
        Config::getJwtTtl(),
        Config::getJwtIssuer(),
        Config::getJwtAudience()
    );
    
    echo json_encode([
        'success' => true,
        'token' => $token,
        'expiresIn' => Config::getJwtTtl(),
        'userId' => $userId,
        'username' => $username
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'TOKEN_GENERATION_ERROR',
        'message' => 'Error generando token: ' . $e->getMessage()
    ]);
}
