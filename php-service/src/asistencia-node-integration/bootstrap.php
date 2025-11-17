<?php
/**
 * Bootstrap - Application Composition Root
 * 
 * Responsabilidad: Crear instancias de servicios e inyectar dependencias
 * Principio: Dependency Injection manual (sin framework)
 * 
 * Este archivo configura toda la aplicación y retorna el router listo
 * para procesar requests
 */

require_once __DIR__ . '/config/Config.php';
require_once __DIR__ . '/lib/crypto/JWT.php';
require_once __DIR__ . '/domain/AuthenticationService.php';
require_once __DIR__ . '/domain/IntegrationGateway.php';
require_once __DIR__ . '/infrastructure/http/NodeServiceClient.php';
require_once __DIR__ . '/infrastructure/persistence/LegacySessionAdapter.php';
require_once __DIR__ . '/presentation/Router.php';

if (!Config::isEnabled()) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'MODULE_DISABLED',
        'message' => 'Módulo deshabilitado'
    ]);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$dbIncPath = __DIR__ . '/../db.inc';
if (file_exists($dbIncPath)) {
    require_once $dbIncPath;
}

$sessionAdapter = new LegacySessionAdapter();
$jwtLibrary = new JWT(Config::getJwtSecret());
$nodeClient = new NodeServiceClient(
    Config::getNodeServiceUrl(),
    Config::getJwtSecretInternal()
);

$authService = new AuthenticationService(
    $sessionAdapter,
    $jwtLibrary
);

$jwtLibraryInternal = new JWT(Config::getJwtSecretInternal());

$router = new Router();
$router->setAuthService($authService);
$router->setNodeClient($nodeClient);
$router->setDataControllers($jwtLibraryInternal);

return $router;
