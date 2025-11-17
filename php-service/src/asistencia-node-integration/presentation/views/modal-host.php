<?php
/**
 * Modal Host View - Proyección QR para Profesores
 * 
 * Responsabilidad: Vista para que profesores proyecten códigos QR
 * Principio: Presentation layer del bounded context
 * 
 * Verifica autenticación legacy y permisos de profesor antes de renderizar
 */

require_once __DIR__ . '/../../bootstrap.php';

if (!is_logged_in()) {
    header('Location: /login.php');
    exit;
}

$usuarioActual = get_usuario_actual();
$nombreCompleto = $_SESSION['nombre_completo'] ?? $usuarioActual;

if (!can_control_asistencia() && !has_super_access()) {
    http_response_code(403);
    echo 'Acceso denegado. Se requieren permisos de control de asistencia.';
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proyección QR - Asistencia</title>
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
    </style>
</head>
<body>
    <div class="container">
        <h1>Proyección de Códigos QR</h1>
        <p class="subtitle">Sistema de Asistencia Criptográfica</p>

        <div class="user-info">
            <strong>Profesor:</strong> <?= htmlspecialchars($nombreCompleto) ?><br>
            <strong>Usuario:</strong> <?= htmlspecialchars($usuarioActual) ?>
        </div>

        <button class="btn-primary" onclick="abrirProyeccion()">
            PROYECTAR CÓDIGOS QR
        </button>

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
                console.log('[Host] Obteniendo token JWT...');
                
                const response = await fetch('/asistencia-node-integration/api/token', {
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    console.error('[Host] Error obteniendo token:', data.error);
                    mostrarError('Error: ' + (data.message || 'No se pudo obtener token de autenticación'));
                    return;
                }
                
                console.log('[Host] Token obtenido exitosamente');
                
                const modal = document.getElementById('proyeccionModal');
                const iframe = document.getElementById('proyeccionFrame');
                
                modal.style.display = 'block';
                
                iframe.src = '/asistencia/features/qr-host/';
                
                iframe.onload = function() {
                    console.log('[Host] Iframe cargado, enviando token JWT...');
                    iframe.contentWindow.postMessage({
                        type: 'AUTH_TOKEN',
                        token: data.token
                    }, window.location.origin);
                    console.log('[Host] Token enviado al iframe');
                };
                
            } catch (error) {
                console.error('[Host] Error:', error);
                mostrarError('Error de conexión. Verifique que el servidor esté funcionando.');
            }
        }

        function cerrarProyeccion() {
            console.log('[Host] Cerrando modal...');
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

        window.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                cerrarProyeccion();
            }
        });
    </script>
</body>
</html>
