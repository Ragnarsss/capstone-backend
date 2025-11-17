<?php
/**
 * Entry Point - Módulo de Integración Node.js
 * 
 * Responsabilidad: Único punto de entrada HTTP al módulo
 * Principio: Front Controller Pattern
 * 
 * Carga bootstrap (composition root) y delega al router
 */

$router = require_once __DIR__ . '/bootstrap.php';

$router->handle();
