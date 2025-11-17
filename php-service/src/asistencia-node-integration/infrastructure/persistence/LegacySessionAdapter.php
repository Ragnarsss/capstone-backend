<?php
/**
 * Legacy Session Adapter
 * 
 * Responsabilidad: Adaptar sistema de sesiones PHP legacy a interface limpia
 * Principio: Adapter Pattern, Dependency Inversion
 * 
 * Este adapter aisla la dependencia del sistema de sesiones PHP ($_SESSION)
 * permitiendo que el domain layer trabaje con una interface estable
 */

class LegacySessionAdapter
{
    /**
     * Verifica si usuario está autenticado
     * 
     * NOTA: En modo testing (sin sesion real), retorna true para permitir pruebas
     * 
     * @return bool True si hay sesión activa con usuario
     */
    public function isAuthenticated(): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return $this->isTestMode();
        }
        
        return isset($_SESSION['user_id']) && isset($_SESSION['username']);
    }

    /**
     * Obtiene ID de usuario de la sesión
     * 
     * @return int|null ID de usuario o null si no está autenticado
     */
    public function getUserId(): ?int
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION['user_id'])) {
            return $this->isTestMode() ? 1 : null;
        }
        
        return (int)$_SESSION['user_id'];
    }

    /**
     * Obtiene username de la sesión
     * 
     * @return string|null Username o null si no está autenticado
     */
    public function getUsername(): ?string
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION['username'])) {
            return $this->isTestMode() ? 'demo@test.cl' : null;
        }
        
        return $_SESSION['username'];
    }

    /**
     * Obtiene nombre completo de la sesión
     * 
     * @return string|null Nombre completo o null si no está disponible
     */
    public function getFullName(): ?string
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION['nombre_completo'])) {
            return $this->isTestMode() ? 'Usuario Demo' : null;
        }
        
        return $_SESSION['nombre_completo'];
    }

    /**
     * Obtiene rol de usuario de la sesión
     * 
     * @return string Rol del usuario (default: usuario)
     */
    public function getRole(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return $this->isTestMode() ? 'profesor' : 'usuario';
        }
        
        return $_SESSION['rol'] ?? 'usuario';
    }

    /**
     * Verifica si usuario es super administrador
     * 
     * @return bool True si es super admin
     */
    public function isSuperAdmin(): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return $this->isTestMode();
        }
        
        return isset($_SESSION['root']) && $_SESSION['root'] === true;
    }

    /**
     * Verifica si usuario tiene control de clases
     * 
     * @return bool True si puede controlar clases
     */
    public function canControlClasses(): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return $this->isTestMode();
        }
        
        return isset($_SESSION['control_clases']) && $_SESSION['control_clases'] === true;
    }

    /**
     * Verifica si usuario puede tomar asistencia
     * 
     * @return bool True si puede tomar asistencia
     */
    public function canTakeAttendance(): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return $this->isTestMode();
        }
        
        return isset($_SESSION['control_asistencia']) && $_SESSION['control_asistencia'] === true;
    }

    /**
     * Verifica si estamos en modo testing (sin sesiones reales)
     * 
     * @return bool True si NODE_ENV es development o testing
     */
    private function isTestMode(): bool
    {
        $nodeEnv = getenv('NODE_ENV') ?: 'production';
        return in_array($nodeEnv, ['development', 'testing', 'test']);
    }
}
