<?php
/**
 * Dev Simulator - Functions (Stubs de db.inc)
 * 
 * Responsabilidad: Emular funciones del sistema legacy Hawaii
 * 
 * Estas funciones simulan el comportamiento de db.inc para
 * permitir pruebas locales sin acceso al servidor de produccion.
 * 
 * En produccion, estas funciones son reemplazadas por las reales de db.inc.
 */

// Constantes de sesion (igual que en db.inc)
define('K_ROOT', 'root');
define('K_USER', 'user');
define('K_ID', 'id');

/**
 * Verifica si hay sesion activa
 * Emula is_logged_in() de db.inc
 * 
 * @return bool
 */
function dev_is_logged_in(): bool
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    return isset($_SESSION[K_ID]) && isset($_SESSION[K_USER]);
}

/**
 * Alias para compatibilidad con legacy
 */
function is_logged_in(): bool
{
    return dev_is_logged_in();
}

/**
 * Obtiene el usuario actual (email o RUT)
 * Emula get_usuario_actual() de db.inc
 * 
 * @return string|false
 */
function dev_get_usuario_actual()
{
    if (!dev_is_logged_in()) {
        return false;
    }
    return $_SESSION[K_USER];
}

/**
 * Alias para compatibilidad
 */
function get_usuario_actual()
{
    return dev_get_usuario_actual();
}

/**
 * Determina el rol del usuario actual
 * En legacy: id == -1 es alumno, id > 0 es profesor
 * 
 * @return string|null 'profesor' | 'alumno' | null
 */
function dev_get_user_role(): ?string
{
    if (!dev_is_logged_in()) {
        return null;
    }
    return $_SESSION[K_ID] == -1 ? 'alumno' : 'profesor';
}

/**
 * Verifica si es superadministrador
 * Emula has_super_access() de db.inc
 * 
 * @return bool
 */
function dev_has_super_access(): bool
{
    if (!dev_is_logged_in()) {
        return false;
    }
    return isset($_SESSION[K_ROOT]) && $_SESSION[K_ROOT] === true;
}

/**
 * Alias para compatibilidad
 */
function has_super_access(): bool
{
    return dev_has_super_access();
}

/**
 * Verifica si puede controlar asistencia (es profesor o admin)
 * 
 * @return bool
 */
function can_control_asistencia(): bool
{
    if (!dev_is_logged_in()) {
        return false;
    }
    return $_SESSION[K_ID] != -1 || dev_has_super_access();
}

/**
 * Guarda datos de autenticacion en sesion
 * Emula save_auth_token() de db.inc
 * 
 * @param array $token Array con id, user, root
 */
function dev_save_auth_token(array $token): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $_SESSION[K_ID] = $token['id'] ?? -1;
    $_SESSION[K_USER] = $token['user'] ?? '';
    $_SESSION[K_ROOT] = $token['root'] ?? false;
    
    // Datos adicionales para el simulador
    if (isset($token['nombre'])) {
        $_SESSION['nombre_completo'] = $token['nombre'];
    }
    if (isset($token['rut'])) {
        $_SESSION['rut'] = $token['rut'];
    }
}

/**
 * Destruye la sesion
 * Emula auth_logout() de db.inc
 */
function dev_auth_logout(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $_SESSION = [];
    
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"],
            $params["domain"],
            $params["secure"],
            $params["httponly"]
        );
    }
    
    session_destroy();
}

/**
 * Alias para compatibilidad
 */
function auth_logout(): void
{
    dev_auth_logout();
}

/**
 * Genera codigo de reserva a partir de ID
 * Emula gen_cod_reserva() de db.inc
 * 
 * @param int $n ID numerico
 * @return string Codigo de 6 letras (ej: CVYAFO)
 */
function dev_gen_cod_reserva(int $n): string
{
    // Convertir a binario de 26 bits
    $binary = str_pad(decbin($n), 26, '0', STR_PAD_LEFT);
    
    // Invertir bits
    $reversed = strrev($binary);
    
    // Convertir a decimal
    $decimal = bindec($reversed);
    
    // Convertir a base 26
    $result = '';
    for ($i = 0; $i < 6; $i++) {
        $result = chr(65 + ($decimal % 26)) . $result;
        $decimal = intdiv($decimal, 26);
    }
    
    return $result;
}

/**
 * Alias para compatibilidad
 */
function gen_cod_reserva(int $n): string
{
    return dev_gen_cod_reserva($n);
}
