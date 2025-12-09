<?php
/**
 * Entrada principal - Sirve Dev Simulator desde raiz
 * 
 * Permite acceder al dev-simulator directamente desde:
 * - http://localhost:9500/
 * - https://localhost:9505/
 * 
 * Sin mostrar /dev-simulator/ en la URL del navegador.
 * 
 * El <base href> hace que los links relativos (login.php, etc.)
 * apunten a /dev-simulator/ correctamente.
 * 
 * En produccion: Este archivo no se usa (Hawaii es el entry point)
 */

// Incluir funciones del dev-simulator
require_once __DIR__ . '/dev-simulator/functions.php';

// Iniciar sesion si no esta activa
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$isLoggedIn = dev_is_logged_in();
$currentUser = $isLoggedIn ? dev_get_usuario_actual() : null;
$userRole = $isLoggedIn ? dev_get_user_role() : null;
$logoutSuccess = isset($_GET['logout']) && $_GET['logout'] === '1';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="/dev-simulator/">
    <title>Dev Simulator - Sistema Asistencia</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 20px;
            color: #fff;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 {
            text-align: center;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            text-align: center;
            color: #aaa;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .warning {
            background: rgba(255, 193, 7, 0.2);
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 30px;
            font-size: 13px;
        }
        .warning strong {
            color: #ffc107;
        }
        .status-box {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .status-box h3 {
            margin-bottom: 10px;
            font-size: 16px;
            color: #aaa;
        }
        .status-box .value {
            font-size: 18px;
            color: #4ade80;
        }
        .status-box .value.not-logged {
            color: #f87171;
        }
        .links {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .link-btn {
            display: block;
            background: #667eea;
            color: white;
            text-decoration: none;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
            font-size: 16px;
            transition: background 0.2s, transform 0.2s;
        }
        .link-btn:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        .link-btn.secondary {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .link-btn.secondary:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        .link-btn.danger {
            background: #dc2626;
        }
        .link-btn.danger:hover {
            background: #b91c1c;
        }
        .divider {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            margin: 20px 0;
        }
        .role-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            text-transform: uppercase;
            font-weight: bold;
        }
        .role-badge.profesor {
            background: #3b82f6;
        }
        .role-badge.alumno {
            background: #10b981;
        }
        .success {
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid #10b981;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #6ee7b7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Dev Simulator</h1>
        <p class="subtitle">Simulador del Sistema Hawaii para Desarrollo</p>
        
        <div class="warning">
            <strong>Solo Desarrollo:</strong> Este simulador emula el sistema legacy Hawaii.
            No va a produccion. Los datos son mock.
        </div>
        
        <?php if ($logoutSuccess): ?>
            <div class="success">
                Sesion cerrada correctamente.
            </div>
        <?php endif; ?>

        <div class="status-box">
            <h3>Estado de Sesion</h3>
            <?php if ($isLoggedIn): ?>
                <p class="value">
                    <?php echo htmlspecialchars($currentUser); ?>
                    <span class="role-badge <?php echo $userRole; ?>">
                        <?php echo $userRole; ?>
                    </span>
                </p>
            <?php else: ?>
                <p class="value not-logged">No autenticado</p>
            <?php endif; ?>
        </div>

        <div class="links">
            <?php if (!$isLoggedIn): ?>
                <a href="login.php" class="link-btn">Iniciar Sesion</a>
            <?php else: ?>
                <?php if ($userRole === 'profesor'): ?>
                    <a href="profesor-dashboard.php" class="link-btn">Dashboard Profesor</a>
                <?php else: ?>
                    <a href="alumno-dashboard.php" class="link-btn">Dashboard Alumno</a>
                <?php endif; ?>
                
                <div class="divider"></div>
                
                <a href="logout.php" class="link-btn danger">Cerrar Sesion</a>
            <?php endif; ?>
            
            <div class="divider"></div>
            
            <a href="/asistencia-node-integration/api/validate-session" class="link-btn secondary" target="_blank">
                Verificar API Token
            </a>
            <a href="/asistencia/features/qr-host/" class="link-btn secondary" target="_blank">
                QR Host (directo)
            </a>
            <a href="/asistencia/features/qr-reader/" class="link-btn secondary" target="_blank">
                QR Reader (directo)
            </a>
        </div>
    </div>
</body>
</html>
