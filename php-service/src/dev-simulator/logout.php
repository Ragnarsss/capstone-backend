<?php
/**
 * Dev Simulator - Logout Page
 * 
 * Responsabilidad: Cerrar sesion y limpiar variables de sesion
 */

require_once __DIR__ . '/functions.php';

// Iniciar sesion para poder destruirla
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Ejecutar logout
dev_auth_logout();

// Redirigir al index con mensaje
header('Location: index.php?logout=1');
exit;
