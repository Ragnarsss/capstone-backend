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
     * @return bool True si hay sesión activa con usuario
     */
    public function isAuthenticated(): bool
    {
        return isset($_SESSION['user_id']) && isset($_SESSION['username']);
    }

    /**
     * Obtiene ID de usuario de la sesión
     * 
     * @return int|null ID de usuario o null si no está autenticado
     */
    public function getUserId(): ?int
    {
        return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    }

    /**
     * Obtiene username de la sesión
     * 
     * @return string|null Username o null si no está autenticado
     */
    public function getUsername(): ?string
    {
        return $_SESSION['username'] ?? null;
    }

    /**
     * Obtiene nombre completo de la sesión
     * 
     * @return string|null Nombre completo o null si no está disponible
     */
    public function getFullName(): ?string
    {
        return $_SESSION['nombre_completo'] ?? null;
    }

    /**
     * Obtiene rol de usuario de la sesión
     * 
     * @return string Rol del usuario (default: usuario)
     */
    public function getRole(): string
    {
        return $_SESSION['rol'] ?? 'usuario';
    }

    /**
     * Verifica si usuario es super administrador
     * 
     * @return bool True si es super admin
     */
    public function isSuperAdmin(): bool
    {
        return isset($_SESSION['root']) && $_SESSION['root'] === true;
    }

    /**
     * Verifica si usuario tiene control de clases
     * 
     * @return bool True si puede controlar clases
     */
    public function canControlClasses(): bool
    {
        return isset($_SESSION['control_clases']) && $_SESSION['control_clases'] === true;
    }

    /**
     * Verifica si usuario puede tomar asistencia
     * 
     * @return bool True si puede tomar asistencia
     */
    public function canTakeAttendance(): bool
    {
        return isset($_SESSION['control_asistencia']) && $_SESSION['control_asistencia'] === true;
    }
}
