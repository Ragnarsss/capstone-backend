<?php
/**
 * Authentication Service - Domain Service
 * 
 * Responsabilidad: Lógica de negocio de autenticación y emisión de tokens
 * Principio: Single Responsibility, Dependency Inversion
 * 
 * Este servicio coordina la validación de sesión y generación de JWT
 * sin conocer detalles de implementación de infraestructura
 */

require_once __DIR__ . '/../infrastructure/persistence/LegacySessionAdapter.php';
require_once __DIR__ . '/../lib/crypto/JWT.php';
require_once __DIR__ . '/../config/Config.php';

class AuthenticationService
{
    private $sessionAdapter;
    private $jwtLibrary;

    /**
     * Constructor con dependency injection
     * 
     * @param LegacySessionAdapter $sessionAdapter Adapter para sistema de sesiones
     * @param JWT $jwtLibrary Biblioteca JWT configurada
     */
    public function __construct(
        LegacySessionAdapter $sessionAdapter,
        JWT $jwtLibrary
    ) {
        $this->sessionAdapter = $sessionAdapter;
        $this->jwtLibrary = $jwtLibrary;
    }

    /**
     * Genera token JWT para usuario autenticado
     * 
     * @return array Respuesta con success, token, expiresIn, userId, username
     */
    public function generateToken(): array
    {
        if (!$this->sessionAdapter->isAuthenticated()) {
            return [
                'success' => false,
                'error' => 'NOT_AUTHENTICATED',
                'message' => 'Sesión no válida'
            ];
        }

        $userId = $this->sessionAdapter->getUserId();
        $username = $this->sessionAdapter->getUsername();
        $fullName = $this->sessionAdapter->getFullName();
        $role = $this->sessionAdapter->getRole();

        $payload = [
            'userId' => $userId,
            'username' => $username,
            'nombreCompleto' => $fullName,
            'rol' => $role,
        ];

        $token = $this->jwtLibrary->encode(
            $payload,
            Config::getJwtTtl(),
            Config::getJwtIssuer(),
            Config::getJwtAudience()
        );

        return [
            'success' => true,
            'token' => $token,
            'expiresIn' => Config::getJwtTtl(),
            'userId' => $userId,
            'username' => $username
        ];
    }

    /**
     * Valida estado de sesión sin generar token
     * 
     * @return array Respuesta con success, authenticated, userId, username
     */
    public function validateSession(): array
    {
        $isAuthenticated = $this->sessionAdapter->isAuthenticated();

        if (!$isAuthenticated) {
            return [
                'success' => true,
                'authenticated' => false
            ];
        }

        return [
            'success' => true,
            'authenticated' => true,
            'userId' => $this->sessionAdapter->getUserId(),
            'username' => $this->sessionAdapter->getUsername()
        ];
    }
}
