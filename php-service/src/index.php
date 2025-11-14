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

        .button-group {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .btn-main {
            display: block;
            width: 100%;
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

        .btn-main:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 128, 0, 0.6);
        }

        .btn-main:active {
            transform: translateY(0);
        }

        .btn-secondary {
            background: #1f2937;
            box-shadow: 0 4px 15px rgba(31, 41, 55, 0.4);
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
            <div class="button-group">
                <button class="btn-main" onclick="openAsistenciaModal()">
                    PROYECTAR QR
                </button>
                <button class="btn-main btn-secondary" onclick="openLectorModal()">
                    LECTOR QR
                </button>
            </div>
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

    <!-- Modal lector QR -->
    <div class="modal-overlay" id="modalReaderOverlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3>Lector de QR</h3>
                <button class="btn-close" onclick="closeLectorModal()">&times;</button>
            </div>
            <iframe
                id="lectorFrame"
                class="modal-content"
                src=""
                title="Lector QR"
                allow="camera"
            ></iframe>
        </div>
    </div>

    <script>
        // ============================================
        // JWT + postMessage Integration (Proyección y Lector)
        // ============================================
        async function fetchAuthToken() {
            const response = await fetch('/api_puente_minodo.php?action=get_token', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('No se pudo obtener el token');
            }

            return response.json();
        }

        async function openSecureModal(modalId, iframeId, targetPath) {
            const modal = document.getElementById(modalId);
            const iframe = document.getElementById(iframeId);

            if (!modal || !iframe) {
                console.error('[Modal] Elementos no encontrados:', modalId, iframeId);
                return;
            }

            try {
                const data = await fetchAuthToken();

                if (!data.success) {
                    alert('Error de autenticación. Por favor recarga la página.');
                    console.error('[Modal] Error obteniendo JWT:', data.message);
                    return;
                }

                iframe.src = targetPath;
                iframe.onload = function () {
                    iframe.contentWindow.postMessage({
                        type: 'AUTH_TOKEN',
                        token: data.token
                    }, window.location.origin);
                };

                modal.classList.add('active');
            } catch (error) {
                console.error('[Modal] Error:', error);
                alert('Error de conexión. Intenta de nuevo.');
            }
        }

        function closeModal(modalId, iframeId) {
            const modal = document.getElementById(modalId);
            const iframe = document.getElementById(iframeId);

            if (!modal || !iframe) return;

            modal.classList.remove('active');
            iframe.src = '';
        }

        function openAsistenciaModal() {
            openSecureModal('modalOverlay', 'asistenciaFrame', '/asistencia/');
        }

        function closeAsistenciaModal() {
            closeModal('modalOverlay', 'asistenciaFrame');
        }

        function openLectorModal() {
            openSecureModal('modalReaderOverlay', 'lectorFrame', '/asistencia/lector/');
        }

        function closeLectorModal() {
            closeModal('modalReaderOverlay', 'lectorFrame');
        }

        ['modalOverlay', 'modalReaderOverlay'].forEach((modalId) => {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    if (modalId === 'modalOverlay') {
                        closeAsistenciaModal();
                    } else {
                        closeLectorModal();
                    }
                }
            });
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeAsistenciaModal();
                closeLectorModal();
            }
        });
    </script>
</body>
</html>
