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

require_once __DIR__ . '/../../config/Config.php';

// Constantes de sesión legacy Hawaii (K_USER, K_ID, K_ROOT)
if (!defined('K_USER')) define('K_USER', 'user');
if (!defined('K_ID')) define('K_ID', 'id');
if (!defined('K_ROOT')) define('K_ROOT', 'root');

class LegacySessionAdapter
{
    /**
     * Verifica si usuario está autenticado
     * 
     * Compatible con sistema legacy Hawaii que usa $_SESSION[K_USER] y $_SESSION[K_ID]
     * 
     * @return bool True si hay sesión activa con usuario
     */
    public function isAuthenticated(): bool
    {
        // Verificar sesión con variables legacy Hawaii
        if (session_status() === PHP_SESSION_ACTIVE && 
            isset($_SESSION[K_USER]) && 
            isset($_SESSION[K_ID])) {
            return true;
        }
        
        // En desarrollo, permitir autenticacion mock
        return $this->isTestMode();
    }

    /**
     * Obtiene ID de usuario de la sesión legacy Hawaii
     * 
     * En el sistema legacy:
     * - Si es profesor: $_SESSION['id'] contiene el ID del profesor
     * - Si es alumno: $_SESSION['id'] = -1
     * 
     * Para generar un ID numérico único cuando es alumno (id=-1),
     * usamos CRC32 del email/RUT
     * 
     * @return int|null ID de usuario o null si no está autenticado
     */
    public function getUserId(): ?int
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION[K_ID])) {
            return $this->isTestMode() ? 1 : null;
        }
        
        $id = (int)$_SESSION[K_ID];
        
        // Si es alumno (id = -1), generar ID desde el RUT/email
        if ($id === -1 && isset($_SESSION[K_USER])) {
            return abs(crc32($_SESSION[K_USER]));
        }
        
        return $id;
    }

    /**
     * Obtiene username de la sesión legacy Hawaii
     * 
     * En el sistema legacy:
     * - Si es profesor: $_SESSION['user'] contiene el email
     * - Si es alumno: $_SESSION['user'] contiene el RUT sin formato
     * 
     * @return string|null Username (email o RUT) o null si no está autenticado
     */
    public function getUsername(): ?string
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION[K_USER])) {
            return $this->isTestMode() ? 'demo@test.cl' : null;
        }
        
        return $_SESSION[K_USER];
    }

    /**
     * Obtiene nombre completo de la sesión
     * 
     * Si está disponible en sesión lo retorna, sino intenta obtenerlo de BD
     * 
     * @return string|null Nombre completo o null si no está disponible
     */
    public function getFullName(): ?string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return $this->isTestMode() ? 'Usuario Demo' : null;
        }
        
        // Si ya está en sesión, retornar
        if (isset($_SESSION['nombre_completo'])) {
            return $_SESSION['nombre_completo'];
        }
        
        // Intentar obtener de funciones legacy si existen
        if (function_exists('get_def_profesor') && $this->isProfesor()) {
            $profesor = @get_def_profesor($_SESSION[K_USER]);
            return $profesor['nombre'] ?? null;
        }
        
        return null;
    }

    /**
     * Obtiene rol de usuario de la sesión
     * 
     * Determina el rol basándose en $_SESSION['id']:
     * - id = -1 → alumno
     * - id > 0 → profesor
     * 
     * @return string Rol del usuario (profesor o alumno)
     */
    public function getRole(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION[K_ID])) {
            return $this->isTestMode() ? 'profesor' : 'alumno';
        }
        
        $id = (int)$_SESSION[K_ID];
        return $id === -1 ? 'alumno' : 'profesor';
    }
    
    /**
     * Verifica si el usuario actual es profesor
     * 
     * @return bool True si es profesor (id != -1)
     */
    public function isProfesor(): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION[K_ID])) {
            return $this->isTestMode();
        }
        
        return (int)$_SESSION[K_ID] !== -1;
    }
    
    /**
     * Verifica si el usuario actual es alumno
     * 
     * @return bool True si es alumno (id = -1)
     */
    public function isAlumno(): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION[K_ID])) {
            return false;
        }
        
        return (int)$_SESSION[K_ID] === -1;
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
     * Verifica si estamos en modo development (sesiones mock permitidas)
     * 
     * @return bool True si NODE_ENV es development
     */
    private function isTestMode(): bool
    {
        return Config::isDevelopment();
    }
}
