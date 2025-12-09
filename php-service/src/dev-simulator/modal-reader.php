<?php
/**
 * Dev Simulator - Modal Reader (Captura QR para Alumnos)
 * 
 * Responsabilidad: Vista para que alumnos escaneen códigos QR
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

$usuarioActual = dev_get_usuario_actual();
$nombreCompleto = $_SESSION['nombre_completo'] ?? $usuarioActual;
$userRole = dev_get_user_role();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Captura QR - Dev Simulator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 600px;
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
            background: #f0fdf4;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #10b981;
        }

        .user-info strong {
            color: #059669;
        }

        .info-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .info-box p {
            margin-bottom: 8px;
            color: #555;
        }

        .info-box p:last-child {
            margin-bottom: 0;
        }

        .btn-primary {
            background: #10b981;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            transition: background 0.2s;
            width: 100%;
        }

        .btn-primary:hover {
            background: #059669;
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
            max-width: 500px;
            height: 80vh;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .modal-header {
            padding: 15px 20px;
            background: #10b981;
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
            padding: 15px;
            border-radius: 6px;
            display: none;
            text-align: center;
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
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Captura de Código QR <span class="dev-badge">DEV</span></h1>
        <p class="subtitle">Sistema de Asistencia Criptográfica - Simulador de Desarrollo</p>

        <div class="user-info">
            <strong><?= $userRole === 'alumno' ? 'Alumno' : 'Usuario' ?>:</strong> <?= htmlspecialchars($nombreCompleto) ?><br>
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
            📷 CAPTURAR CÓDIGO QR
        </button>

        <div id="status" class="status"></div>

        <div class="actions">
            <a href="<?= $userRole === 'alumno' ? 'alumno-dashboard.php' : 'profesor-dashboard.php' ?>" class="btn-secondary">
                Volver al Dashboard
            </a>
        </div>
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
                console.log('[Reader-Dev] Obteniendo token JWT desde dev-simulator...');
                
                // Usar endpoint del dev-simulator
                const response = await fetch('/dev-simulator/api/token.php', {
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    console.error('[Reader-Dev] Error obteniendo token:', data.error);
                    mostrarError('Error: ' + (data.message || 'No se pudo obtener token de autenticación'));
                    return;
                }
                
                console.log('[Reader-Dev] Token obtenido exitosamente');
                console.log('[Reader-Dev] userId:', data.userId, 'username:', data.username);
                
                const modal = document.getElementById('capturaModal');
                const iframe = document.getElementById('capturaFrame');
                
                modal.style.display = 'block';
                
                // Cargar el QR Reader de Node-service
                iframe.src = '/asistencia/reader/';
                
                iframe.onload = function() {
                    console.log('[Reader-Dev] Iframe cargado, enviando token JWT via postMessage...');
                    iframe.contentWindow.postMessage({
                        type: 'AUTH_TOKEN',
                        token: data.token
                    }, window.location.origin);
                    console.log('[Reader-Dev] Token enviado al iframe');
                };
                
            } catch (error) {
                console.error('[Reader-Dev] Error:', error);
                mostrarError('Error de conexión. Verifique que el servidor esté funcionando.');
            }
        }

        function cerrarCaptura() {
            console.log('[Reader-Dev] Cerrando modal...');
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

        function mostrarExito(mensaje) {
            const statusEl = document.getElementById('status');
            statusEl.className = 'status success';
            statusEl.textContent = mensaje;
            statusEl.style.display = 'block';
        }

        // Escuchar tecla Escape para cerrar
        window.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                cerrarCaptura();
            }
        });

        // Escuchar mensajes del iframe (Node.js)
        window.addEventListener('message', function(event) {
            console.log('[Reader-Dev] Mensaje recibido de origen:', event.origin);
            console.log('[Reader-Dev] Datos:', event.data);
            
            // Verificar que sea el mensaje de completado de asistencia
            if (event.data && event.data.type === 'attendance-completed') {
                console.log('[Reader-Dev] Asistencia completada:', event.data);
                
                // Cerrar el modal
                cerrarCaptura();
                
                // Mostrar mensaje de éxito
                const nombreAlumno = event.data.studentName || 'Alumno';
                mostrarExito('¡Asistencia registrada para ' + nombreAlumno + '!');
                
                // En dev-simulator, solo mostramos el mensaje
                // En producción, esto redirigiría a la encuesta
                console.log('[Reader-Dev] Datos disponibles para encuesta:');
                console.log('  - studentId:', event.data.studentId);
                console.log('  - studentName:', event.data.studentName);
                console.log('  - sessionId:', event.data.sessionId);
                console.log('  - completedAt:', event.data.completedAt);
            }
        });
    </script>
</body>
</html>
