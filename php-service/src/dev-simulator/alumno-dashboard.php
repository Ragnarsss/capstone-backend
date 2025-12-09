<?php
/**
 * Dev Simulator - Dashboard Alumno
 * 
 * Responsabilidad: Mostrar panel de control del alumno con cursos y registros
 * 
 * Emula la vista del sistema Hawaii para alumnos.
 */

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/MockDataProvider.php';

// Iniciar sesion
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Verificar autenticacion y rol
if (!dev_is_logged_in()) {
    header('Location: login.php');
    exit;
}

if (dev_get_user_role() !== 'alumno') {
    header('Location: profesor-dashboard.php');
    exit;
}

$provider = MockDataProvider::getInstance();
$alumnoRut = $_SESSION[K_USER];
$nombreCompleto = $_SESSION['nombre_completo'] ?? $alumnoRut;

// Obtener datos del alumno
$alumno = $provider->getAlumnoByRut($alumnoRut);

// Obtener inscripciones del alumno
$inscripciones = $provider->getInscripcionesByAlumno($alumnoRut);

// Construir lista de cursos con info completa
$misCursos = [];
foreach ($inscripciones as $inscripcion) {
    $curso = $provider->getCursoById($inscripcion['curso_id']);
    if ($curso) {
        $misCursos[] = $curso;
    }
}

// Obtener sesiones activas de mis cursos
$sesionesActivas = [];
$todasSesiones = $provider->getAllSesiones();
foreach ($todasSesiones as $sesion) {
    if (!$sesion['activa']) continue;
    
    foreach ($misCursos as $curso) {
        if ($sesion['curso_id'] === $curso['id']) {
            $sesion['curso'] = $curso;
            $bloque = $provider->getBloqueById($sesion['bloque_id']);
            $sesion['bloque'] = $bloque;
            $sesionesActivas[] = $sesion;
            break;
        }
    }
}

$success = isset($_GET['registered']) ? 'Asistencia registrada exitosamente' : '';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Alumno - Dev Simulator</title>
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
            padding: 20px;
            color: #fff;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 1000px;
            margin: 0 auto 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            flex-wrap: wrap;
            gap: 15px;
        }
        .header h1 {
            font-size: 24px;
        }
        .header .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .header .user-info .name {
            font-weight: bold;
        }
        .header .user-info .badge {
            background: #10b981;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            text-transform: uppercase;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover {
            background: #5a67d8;
        }
        .btn-danger {
            background: #dc2626;
            color: white;
        }
        .btn-danger:hover {
            background: #b91c1c;
        }
        .btn-success {
            background: #059669;
            color: white;
        }
        .btn-success:hover {
            background: #047857;
        }
        .btn-lg {
            padding: 15px 30px;
            font-size: 16px;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        .card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
        }
        .card h2 {
            font-size: 18px;
            margin-bottom: 20px;
            color: #aaa;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .card-item {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        .card-item:last-child {
            margin-bottom: 0;
        }
        .card-item .info h3 {
            font-size: 16px;
            margin-bottom: 5px;
        }
        .card-item .info .meta {
            font-size: 13px;
            color: #aaa;
        }
        .session-active {
            background: rgba(16, 185, 129, 0.2);
            border: 2px solid #10b981;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { border-color: #10b981; }
            50% { border-color: #6ee7b7; }
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .success-msg {
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid #10b981;
            color: #6ee7b7;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .scan-section {
            text-align: center;
            padding: 40px;
        }
        .scan-section p {
            color: #aaa;
            margin-bottom: 20px;
        }
        .active-sessions-banner {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            text-align: center;
        }
        .active-sessions-banner h3 {
            font-size: 18px;
            margin-bottom: 10px;
        }
        .code-display {
            font-family: 'Consolas', monospace;
            font-size: 16px;
            background: rgba(102, 126, 234, 0.2);
            padding: 6px 12px;
            border-radius: 6px;
            letter-spacing: 2px;
        }
        .curso-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        .curso-item {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 15px;
        }
        .curso-item h4 {
            font-size: 14px;
            margin-bottom: 5px;
        }
        .curso-item .meta {
            font-size: 12px;
            color: #aaa;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Dashboard Alumno</h1>
        <div class="user-info">
            <span class="name"><?php echo htmlspecialchars($nombreCompleto); ?></span>
            <span class="badge">Alumno</span>
            <a href="logout.php" class="btn btn-danger">Cerrar Sesion</a>
        </div>
    </div>

    <div class="container">
        <?php if ($success): ?>
            <div class="success-msg"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>

        <?php if (!empty($sesionesActivas)): ?>
            <div class="active-sessions-banner">
                <h3>Hay <?php echo count($sesionesActivas); ?> sesion(es) activa(s) en tus cursos</h3>
                <p>Escanea el codigo QR para registrar tu asistencia</p>
            </div>
        <?php endif; ?>

        <div class="card">
            <h2>Registrar Asistencia</h2>
            <div class="scan-section">
                <p>Escanea el codigo QR proyectado por el profesor para registrar tu asistencia</p>
                <a href="modal-reader.php" class="btn btn-success btn-lg">
                    📷 Abrir Escaner QR
                </a>
            </div>
        </div>

        <?php if (!empty($sesionesActivas)): ?>
            <div class="card">
                <h2>Sesiones Activas</h2>
                <?php foreach ($sesionesActivas as $sesion): ?>
                    <div class="card-item session-active">
                        <div class="info">
                            <h3><?php echo htmlspecialchars($sesion['curso']['nombre'] ?? 'Curso'); ?></h3>
                            <div class="meta">
                                Bloque: <?php echo htmlspecialchars($sesion['bloque']['nombre'] ?? 'N/A'); ?> |
                                <?php echo date('d/m/Y H:i', strtotime($sesion['fechahora_inicio'])); ?>
                            </div>
                        </div>
                        <div>
                            <span class="code-display"><?php echo htmlspecialchars($sesion['codigo']); ?></span>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <div class="card">
            <h2>Mis Cursos Inscritos</h2>
            <?php if (empty($misCursos)): ?>
                <div class="empty-state">No tienes cursos inscritos</div>
            <?php else: ?>
                <div class="curso-list">
                    <?php foreach ($misCursos as $curso): ?>
                        <div class="curso-item">
                            <h4><?php echo htmlspecialchars($curso['nombre']); ?></h4>
                            <div class="meta">
                                Seccion: <?php echo htmlspecialchars($curso['seccion']); ?> |
                                Codigo: <?php echo htmlspecialchars($curso['codigo']); ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>

        <div style="text-align: center; margin-top: 20px;">
            <a href="index.php" class="btn btn-primary">Volver al Inicio</a>
        </div>
    </div>
</body>
</html>
