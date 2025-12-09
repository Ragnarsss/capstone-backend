<?php
/**
 * Dev Simulator - Modal Host (Proyección QR para Profesores)
 * 
 * Responsabilidad: Vista para que profesores proyecten códigos QR
 * 
 * Esta es la versión dev-simulator que:
 * 1. Usa functions.php en lugar de db.inc
 * 2. Apunta a /dev-simulator/api/token.php para obtener JWT
 * 3. El resto es idéntico a producción (postMessage, iframe, etc.)
 */

require_once __DIR__ . '/functions.php';

// Iniciar sesión
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Verificar autenticación
if (!dev_is_logged_in()) {
    header('Location: login.php');
    exit;
}

// Verificar que sea profesor
if (!can_control_asistencia() && !dev_has_super_access()) {
    http_response_code(403);
    echo 'Acceso denegado. Se requieren permisos de control de asistencia.';
    exit;
}

$usuarioActual = dev_get_usuario_actual();
$nombreCompleto = $_SESSION['nombre_completo'] ?? $usuarioActual;

// Obtener código de sesión si viene por parámetro
$codigoSesion = isset($_GET['codigo']) ? htmlspecialchars($_GET['codigo']) : '';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proyección QR - Dev Simulator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        h1 {
            color: #333;
            margin-bottom: 10px;
        }

        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }

        .dev-badge {
            display: inline-block;
            background: #f59e0b;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 10px;
            vertical-align: middle;
        }

        .user-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #667eea;
        }

        .user-info strong {
            color: #667eea;
        }

        .session-code {
            background: #e0e7ff;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }

        .session-code .code {
            font-family: 'Consolas', monospace;
            font-size: 32px;
            letter-spacing: 4px;
            color: #4338ca;
        }

        .btn-primary {
            background: #667eea;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            transition: background 0.2s;
        }

        .btn-primary:hover {
            background: #5568d3;
        }

        .btn-primary:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .btn-secondary {
            background: #6b7280;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 8px;
            cursor: pointer;
            margin-left: 10px;
            text-decoration: none;
            display: inline-block;
        }

        .btn-secondary:hover {
            background: #4b5563;
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .modal-content {
            position: relative;
            margin: 50px auto;
            width: 90%;
            max-width: 1200px;
            height: 85vh;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .modal-header {
            padding: 15px 20px;
            background: #667eea;
            color: white;
            border-radius: 16px 16px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-header h2 {
            margin: 0;
        }

        .close {
            font-size: 28px;
            font-weight: bold;
            color: white;
            cursor: pointer;
            background: none;
            border: none;
            padding: 0 10px;
        }

        .close:hover {
            color: #ddd;
        }

        .modal-body {
            width: 100%;
            height: calc(100% - 60px);
        }

        .modal-body iframe {
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 0 0 16px 16px;
        }

        .status {
            margin-top: 20px;
            padding: 10px;
            border-radius: 6px;
            display: none;
        }

        .status.error {
            background: #fee;
            color: #c00;
            border: 1px solid #fcc;
        }

        .status.success {
            background: #efe;
            color: #060;
            border: 1px solid #cfc;
        }

        .actions {
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Proyección de Códigos QR <span class="dev-badge">DEV</span></h1>
        <p class="subtitle">Sistema de Asistencia Criptográfica - Simulador de Desarrollo</p>

        <div class="user-info">
            <strong>Profesor:</strong> <?= htmlspecialchars($nombreCompleto) ?><br>
            <strong>Usuario:</strong> <?= htmlspecialchars($usuarioActual) ?>
        </div>

        <?php if ($codigoSesion): ?>
        <div class="session-code">
            <div>Código de Sesión:</div>
            <div class="code"><?= $codigoSesion ?></div>
        </div>
        <?php endif; ?>

        <button class="btn-primary" onclick="abrirProyeccion()">
            PROYECTAR CÓDIGOS QR
        </button>

        <div class="actions">
            <a href="profesor-dashboard.php" class="btn-secondary">Volver al Dashboard</a>
        </div>

        <div id="status" class="status"></div>
    </div>

    <div id="proyeccionModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Proyección QR - Toma de Asistencia</h2>
                <button class="close" onclick="cerrarProyeccion()">&times;</button>
            </div>
            <div class="modal-body">
                <iframe id="proyeccionFrame" src="about:blank"></iframe>
            </div>
        </div>
    </div>

    <script>
        async function abrirProyeccion() {
            const statusEl = document.getElementById('status');
            statusEl.style.display = 'none';

            try {
                console.log('[Host-Dev] Obteniendo token JWT desde dev-simulator...');
                
                // Usar endpoint del dev-simulator
                const response = await fetch('/dev-simulator/api/token.php', {
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    console.error('[Host-Dev] Error obteniendo token:', data.error);
                    mostrarError('Error: ' + (data.message || 'No se pudo obtener token de autenticación'));
                    return;
                }
                
                console.log('[Host-Dev] Token obtenido exitosamente');
                console.log('[Host-Dev] userId:', data.userId, 'username:', data.username);
                
                const modal = document.getElementById('proyeccionModal');
                const iframe = document.getElementById('proyeccionFrame');
                
                modal.style.display = 'block';
                
                // Cargar el QR Host de Node-service
                iframe.src = '/asistencia/host/';
                
                iframe.onload = function() {
                    console.log('[Host-Dev] Iframe cargado, enviando token JWT via postMessage...');
                    iframe.contentWindow.postMessage({
                        type: 'AUTH_TOKEN',
                        token: data.token
                    }, window.location.origin);
                    console.log('[Host-Dev] Token enviado al iframe');
                };
                
            } catch (error) {
                console.error('[Host-Dev] Error:', error);
                mostrarError('Error de conexión. Verifique que el servidor esté funcionando.');
            }
        }

        function cerrarProyeccion() {
            console.log('[Host-Dev] Cerrando modal...');
            const modal = document.getElementById('proyeccionModal');
            const iframe = document.getElementById('proyeccionFrame');
            
            modal.style.display = 'none';
            iframe.src = 'about:blank';
        }

        function mostrarError(mensaje) {
            const statusEl = document.getElementById('status');
            statusEl.className = 'status error';
            statusEl.textContent = mensaje;
            statusEl.style.display = 'block';
        }

        // Escuchar tecla Escape para cerrar
        window.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                cerrarProyeccion();
            }
        });

        // Escuchar mensajes del iframe (Node.js)
        window.addEventListener('message', function(event) {
            console.log('[Host-Dev] Mensaje recibido:', event.data);
            
            if (event.data && event.data.type === 'qr-session-started') {
                console.log('[Host-Dev] Sesión QR iniciada:', event.data);
            }
        });
    </script>
</body>
</html>
