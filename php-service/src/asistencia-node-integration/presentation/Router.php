<?php
/**
 * Router - HTTP Request Routing
 * 
 * Responsabilidad: Mapear HTTP requests a handlers apropiados
 * Principio: Front Controller Pattern
 * 
 * Este router centraliza el manejo de requests y delega a servicios
 * de dominio según la ruta solicitada
 */

require_once __DIR__ . '/../domain/AuthenticationService.php';
require_once __DIR__ . '/../domain/IntegrationGateway.php';
require_once __DIR__ . '/../config/Config.php';
require_once __DIR__ . '/../lib/crypto/JWT.php';
require_once __DIR__ . '/api/UserDataController.php';
require_once __DIR__ . '/api/CourseDataController.php';
require_once __DIR__ . '/api/EnrollmentDataController.php';

class Router
{
    private $authService;
    private $nodeClient;
    private $userDataController;
    private $courseDataController;
    private $enrollmentDataController;

    /**
     * Inyecta AuthenticationService
     * 
     * @param AuthenticationService $authService Servicio de autenticación
     */
    public function setAuthService(AuthenticationService $authService): void
    {
        $this->authService = $authService;
    }

    /**
     * Inyecta Node service client
     * 
     * @param IntegrationGateway $nodeClient Cliente para comunicación con Node
     */
    public function setNodeClient(IntegrationGateway $nodeClient): void
    {
        $this->nodeClient = $nodeClient;
    }

    /**
     * Configura controllers para endpoints de datos
     * 
     * @param JWT $jwtLibrary Biblioteca JWT para validación interna
     */
    public function setDataControllers(JWT $jwtLibrary): void
    {
        $this->userDataController = new UserDataController($jwtLibrary);
        $this->courseDataController = new CourseDataController($jwtLibrary);
        $this->enrollmentDataController = new EnrollmentDataController($jwtLibrary);
    }

    /**
     * Procesa request HTTP actual
     */
    public function handle(): void
    {
        $path = $_SERVER['REQUEST_URI'] ?? '/';
        $method = $_SERVER['REQUEST_METHOD'];

        $parsedUrl = parse_url($path);
        $path = $parsedUrl['path'];
        parse_str($parsedUrl['query'] ?? '', $queryParams);

        header('Content-Type: application/json');
        $this->setCorsHeaders();

        if ($method === 'OPTIONS') {
            http_response_code(200);
            return;
        }

        switch ($path) {
            case '/api/token':
                $this->handleGetToken();
                break;

            case '/api/validate-session':
                $this->handleValidateSession();
                break;

            case '/api/log-event':
                $this->handleLogEvent();
                break;

            case '/api/user-data':
                $this->handleUserData();
                break;

            case '/api/course-data':
                $this->handleCourseData();
                break;

            case '/api/enrollment-data':
                $this->handleEnrollmentData();
                break;

            default:
                $this->sendError('ROUTE_NOT_FOUND', 'Ruta no encontrada', 404);
        }
    }

    /**
     * Handler: GET /api/token
     * Genera JWT para usuario autenticado
     */
    private function handleGetToken(): void
    {
        $result = $this->authService->generateToken();
        $statusCode = $result['success'] ? 200 : 401;
        
        $this->logEvent('TOKEN_REQUESTED', [
            'success' => $result['success'],
            'userId' => $result['userId'] ?? null
        ]);
        
        $this->sendJson($result, $statusCode);
    }

    /**
     * Handler: GET /api/validate-session
     * Valida estado de sesión sin generar token
     */
    private function handleValidateSession(): void
    {
        $result = $this->authService->validateSession();
        $this->sendJson($result);
    }

    /**
     * Handler: POST /api/log-event
     * Recibe eventos de log desde Node service
     */
    private function handleLogEvent(): void
    {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);

        if (!isset($data['event'])) {
            $this->sendError('INVALID_PAYLOAD', 'Evento no especificado', 400);
            return;
        }

        $this->logEvent($data['event'], $data['data'] ?? []);

        $this->sendJson([
            'success' => true,
            'message' => 'Evento registrado'
        ]);
    }

    /**
     * Handler: GET /api/user-data
     * Provee datos de usuario a Node service
     */
    private function handleUserData(): void
    {
        $result = $this->userDataController->handle();
        $statusCode = $result['success'] ? 200 : ($result['error'] === 'UNAUTHORIZED' ? 401 : 400);
        $this->sendJson($result, $statusCode);
    }

    /**
     * Handler: GET /api/course-data
     * Provee datos de curso a Node service
     */
    private function handleCourseData(): void
    {
        $result = $this->courseDataController->handle();
        $statusCode = $result['success'] ? 200 : ($result['error'] === 'UNAUTHORIZED' ? 401 : 400);
        $this->sendJson($result, $statusCode);
    }

    /**
     * Handler: GET /api/enrollment-data
     * Provee datos de inscripciones a Node service
     */
    private function handleEnrollmentData(): void
    {
        $result = $this->enrollmentDataController->handle();
        $statusCode = $result['success'] ? 200 : ($result['error'] === 'UNAUTHORIZED' ? 401 : 400);
        $this->sendJson($result, $statusCode);
    }

    /**
     * Configura headers CORS
     */
    private function setCorsHeaders(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
    }

    /**
     * Envía respuesta JSON y termina
     * 
     * @param array $data Datos a enviar
     * @param int $statusCode HTTP status code
     */
    private function sendJson(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }

    /**
     * Envía error JSON y termina
     * 
     * @param string $error Código de error
     * @param string $message Mensaje de error
     * @param int $code HTTP status code
     */
    private function sendError(string $error, string $message, int $code = 400): void
    {
        $this->sendJson([
            'success' => false,
            'error' => $error,
            'message' => $message
        ], $code);
    }

    /**
     * Registra evento en log
     * 
     * @param string $event Tipo de evento
     * @param array $data Datos del evento
     */
    private function logEvent(string $event, array $data): void
    {
        if (!Config::isLoggingEnabled()) {
            return;
        }

        $logEntry = sprintf(
            "[%s] %s | IP: %s | Data: %s\n",
            date('Y-m-d H:i:s'),
            $event,
            $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            json_encode($data)
        );

        $logPath = Config::getLogPath();
        
        if (!is_dir($logPath)) {
            mkdir($logPath, 0755, true);
        }

        error_log(
            $logEntry,
            3,
            $logPath . '/events-' . date('Y-m-d') . '.log'
        );
    }
}
