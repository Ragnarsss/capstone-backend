<?php
/**
 * Modal Reader View - Captura QR para Alumnos
 * 
 * Responsabilidad: Vista para que alumnos capturen códigos QR
 * Principio: Presentation layer del bounded context
 * 
 * Verifica autenticación legacy antes de renderizar
 */

require_once __DIR__ . '/../../bootstrap.php';

if (!is_logged_in()) {
    header('Location: /login.php');
    exit;
}

$usuarioActual = get_usuario_actual();
$nombreCompleto = $_SESSION['nombre_completo'] ?? $usuarioActual;
$rol = $_SESSION['rol'] ?? 'usuario';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registrar Asistencia - QR</title>
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
            max-width: 600px;
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
            font-size: 18px;
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

        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .info-box p {
            margin: 5px 0;
            color: #1565c0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Registrar Asistencia</h1>
        <p class="subtitle">Sistema de Asistencia Criptográfica</p>

        <div class="user-info">
            <strong>Usuario:</strong> <?= htmlspecialchars($nombreCompleto) ?><br>
            <strong>Cuenta:</strong> <?= htmlspecialchars($usuarioActual) ?>
        </div>

        <div class="info-box">
            <p><strong>Instrucciones:</strong></p>
            <p>1. Haga clic en el botón para abrir el lector QR</p>
            <p>2. Permita acceso a la cámara cuando se solicite</p>
            <p>3. Apunte la cámara al código QR proyectado</p>
            <p>4. El sistema registrará su asistencia automáticamente</p>
        </div>

        <button class="btn-primary" onclick="abrirCaptura()">
            CAPTURAR CÓDIGO QR
        </button>

        <div id="status" class="status"></div>
    </div>

    <div id="capturaModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Captura QR - Registro de Asistencia</h2>
                <button class="close" onclick="cerrarCaptura()">&times;</button>
            </div>
            <div class="modal-body">
                <iframe id="capturaFrame" src="about:blank"></iframe>
            </div>
        </div>
    </div>

    <script>
        async function abrirCaptura() {
            const statusEl = document.getElementById('status');
            statusEl.style.display = 'none';

            try {
                console.log('[Reader] Obteniendo token JWT...');
                
                const response = await fetch('/asistencia-node-integration/api/token', {
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    console.error('[Reader] Error obteniendo token:', data.error);
                    mostrarError('Error: ' + (data.message || 'No se pudo obtener token de autenticación'));
                    return;
                }
                
                console.log('[Reader] Token obtenido exitosamente');
                
                const modal = document.getElementById('capturaModal');
                const iframe = document.getElementById('capturaFrame');
                
                modal.style.display = 'block';
                
                // Ruta unificada: /asistencia/reader/
                iframe.src = '/asistencia/reader/';
                
                iframe.onload = function() {
                    console.log('[Reader] Iframe cargado, enviando token JWT...');
                    iframe.contentWindow.postMessage({
                        type: 'AUTH_TOKEN',
                        token: data.token
                    }, window.location.origin);
                    console.log('[Reader] Token enviado al iframe');
                };
                
            } catch (error) {
                console.error('[Reader] Error:', error);
                mostrarError('Error de conexión. Verifique que el servidor esté funcionando.');
            }
        }

        function cerrarCaptura() {
            console.log('[Reader] Cerrando modal...');
            const modal = document.getElementById('capturaModal');
            const iframe = document.getElementById('capturaFrame');
            
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
                cerrarCaptura();
            }
        });
    </script>
</body>
</html>
