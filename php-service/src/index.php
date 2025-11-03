<?php
session_start();

// Pagina principal con boton para abrir el modal de asistencia
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Gestion</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        header {
            background: #667eea;
            color: white;
            padding: 30px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }

        main {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px;
        }

        .card {
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }

        .card h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 24px;
        }

        .card p {
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        .btn-asistencia {
            background: rgb(255, 128, 0);
            color: white;
            border: none;
            padding: 16px 40px;
            font-size: 18px;
            font-weight: bold;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 15px rgba(255, 128, 0, 0.4);
        }

        .btn-asistencia:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 128, 0, 0.6);
        }

        .btn-asistencia:active {
            transform: translateY(0);
        }

        /* Modal overlay */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        }

        .modal-overlay.active {
            display: flex;
        }

        .modal-container {
            background: white;
            border-radius: 16px;
            width: 600px;
            height: 800px;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .modal-header {
            background: #667eea;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-header h3 {
            margin: 0;
            font-size: 20px;
        }

        .btn-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 24px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            transition: background 0.2s;
        }

        .btn-close:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .modal-content {
            width: 100%;
            height: calc(100% - 60px);
            border: none;
        }
    </style>
</head>
<body>
    <header>
        <h1>Proyecto Asistencia</h1>
        <p>Sistema de Registro con QR Dinámico + JWT</p>
    </header>

    <main>
        <div class="card">
            <h2>Sistema de Registro de Asistencia</h2>
            <p>
                Al hacer click, obtienes un JWT desde PHP y el modal se abre con autenticación segura.
            </p>
            <button class="btn-asistencia" onclick="openAsistenciaModal()">
                ASISTENCIA
            </button>
        </div>
    </main>

    <!-- Modal con iframe al servicio Node.js -->
    <div class="modal-overlay" id="modalOverlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3>Registro de Asistencia</h3>
                <button class="btn-close" onclick="closeAsistenciaModal()">&times;</button>
            </div>
            <iframe
                id="asistenciaFrame"
                class="modal-content"
                src=""
                title="Sistema de Asistencia"
            ></iframe>
        </div>
    </div>

    <script>
        // ============================================
        // JWT + postMessage Integration
        // ============================================
        async function openAsistenciaModal() {
            const modal = document.getElementById('modalOverlay');
            const iframe = document.getElementById('asistenciaFrame');

            try {
                console.log('[Modal] Obteniendo JWT desde PHP...');

                // 1. Obtener JWT desde PHP
                const response = await fetch('/api_puente_minodo.php?action=get_token', {
                    credentials: 'include' // Incluir cookies de sesión PHP
                });

                const data = await response.json();

                if (!data.success) {
                    alert('Error de autenticación. Por favor recarga la página.');
                    console.error('[Modal] Error obteniendo JWT:', data.message);
                    return;
                }

                console.log('[Modal] JWT obtenido exitosamente');

                // 2. Cargar iframe
                iframe.src = '/asistencia/';

                // 3. Enviar token cuando el iframe cargue
                iframe.onload = function() {
                    console.log('[Modal] Iframe cargado, enviando token...');

                    iframe.contentWindow.postMessage({
                        type: 'AUTH_TOKEN',
                        token: data.token
                    }, window.location.origin);

                    console.log('[Modal] Token enviado al iframe');
                };

                // 4. Mostrar modal
                modal.classList.add('active');

            } catch (error) {
                console.error('[Modal] Error:', error);
                alert('Error de conexión. Intenta de nuevo.');
            }
        }

        function closeAsistenciaModal() {
            const modal = document.getElementById('modalOverlay');
            const iframe = document.getElementById('asistenciaFrame');

            modal.classList.remove('active');

            // Limpia el iframe al cerrar
            iframe.src = '';
        }

        // Cierra el modal si se hace click fuera del contenedor
        document.getElementById('modalOverlay').addEventListener('click', function(e) {
            if (e.target === this) {
                closeAsistenciaModal();
            }
        });

        // Cierra el modal con la tecla ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeAsistenciaModal();
            }
        });
    </script>
</body>
</html>
