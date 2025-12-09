<?php
/**
 * Dev Simulator - Dashboard Profesor
 * 
 * Responsabilidad: Mostrar panel de control del profesor con cursos y sesiones
 * 
 * Emula la vista del sistema Hawaii para profesores.
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

if (dev_get_user_role() !== 'profesor') {
    header('Location: alumno-dashboard.php');
    exit;
}

$provider = MockDataProvider::getInstance();
$profesorId = $_SESSION[K_ID];
$profesorEmail = $_SESSION[K_USER];
$nombreCompleto = $_SESSION['nombre_completo'] ?? $profesorEmail;
$isAdmin = dev_has_super_access();

// Obtener cursos del profesor
$cursos = $provider->getCursosByProfesor($profesorId);
$sesiones = $provider->getAllSesiones();

// Obtener semestre actual
$semestre = $provider->getSemestreActual();

// Filtrar sesiones del profesor
$misSesiones = [];
foreach ($sesiones as $sesion) {
    $curso = $provider->getCursoById($sesion['curso_id']);
    if ($curso && $curso['profesor_id'] === $profesorId) {
        $sesion['curso'] = $curso;
        $bloque = $provider->getBloqueById($sesion['bloque_id']);
        $sesion['bloque'] = $bloque;
        $misSesiones[] = $sesion;
    }
}

// Ordenar sesiones por fecha descendente
usort($misSesiones, function($a, $b) {
    return strtotime($b['fechahora_inicio']) - strtotime($a['fechahora_inicio']);
});

$success = isset($_GET['created']) ? 'Sesion creada exitosamente' : '';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Profesor - Dev Simulator</title>
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
            max-width: 1200px;
            margin: 0 auto 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
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
            background: #3b82f6;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            text-transform: uppercase;
        }
        .header .user-info .badge.admin {
            background: #dc2626;
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
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }
        .card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
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
        }
        .card-item:last-child {
            margin-bottom: 0;
        }
        .card-item h3 {
            font-size: 16px;
            margin-bottom: 8px;
        }
        .card-item .meta {
            font-size: 13px;
            color: #aaa;
            margin-bottom: 10px;
        }
        .card-item .actions {
            display: flex;
            gap: 10px;
            margin-top: 12px;
        }
        .session-status {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: bold;
        }
        .session-status.activa {
            background: #10b981;
        }
        .session-status.cerrada {
            background: #6b7280;
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
        .quick-actions {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .code-display {
            font-family: 'Consolas', monospace;
            font-size: 18px;
            background: rgba(102, 126, 234, 0.2);
            padding: 8px 15px;
            border-radius: 6px;
            letter-spacing: 2px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Dashboard Profesor</h1>
        <div class="user-info">
            <span class="name"><?php echo htmlspecialchars($nombreCompleto); ?></span>
            <span class="badge">Profesor</span>
            <?php if ($isAdmin): ?>
                <span class="badge admin">Admin</span>
            <?php endif; ?>
            <a href="logout.php" class="btn btn-danger">Cerrar Sesion</a>
        </div>
    </div>

    <div class="container">
        <?php if ($success): ?>
            <div class="success-msg"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>

        <div class="quick-actions">
            <a href="crear-sesion.php" class="btn btn-success">+ Nueva Sesion de Asistencia</a>
            <a href="index.php" class="btn btn-primary">Volver al Inicio</a>
        </div>

        <div class="grid">
            <div class="card">
                <h2>Mis Cursos</h2>
                <?php if (empty($cursos)): ?>
                    <div class="empty-state">No tienes cursos asignados</div>
                <?php else: ?>
                    <?php foreach ($cursos as $curso): ?>
                        <div class="card-item">
                            <h3><?php echo htmlspecialchars($curso['nombre']); ?></h3>
                            <div class="meta">
                                Seccion: <?php echo htmlspecialchars($curso['seccion']); ?> |
                                Codigo: <?php echo htmlspecialchars($curso['codigo']); ?>
                            </div>
                            <div class="actions">
                                <a href="crear-sesion.php?curso=<?php echo $curso['id']; ?>" class="btn btn-primary">
                                    Crear Sesion
                                </a>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <div class="card">
                <h2>Sesiones Recientes</h2>
                <?php if (empty($misSesiones)): ?>
                    <div class="empty-state">No hay sesiones creadas</div>
                <?php else: ?>
                    <?php foreach (array_slice($misSesiones, 0, 5) as $sesion): ?>
                        <div class="card-item">
                            <h3>
                                <?php echo htmlspecialchars($sesion['curso']['nombre'] ?? 'Curso'); ?>
                                <span class="session-status <?php echo $sesion['activa'] ? 'activa' : 'cerrada'; ?>">
                                    <?php echo $sesion['activa'] ? 'Activa' : 'Cerrada'; ?>
                                </span>
                            </h3>
                            <div class="meta">
                                <div>Bloque: <?php echo htmlspecialchars($sesion['bloque']['nombre'] ?? 'N/A'); ?></div>
                                <div>Fecha: <?php echo date('d/m/Y H:i', strtotime($sesion['fechahora_inicio'])); ?></div>
                            </div>
                            <div>
                                <span class="code-display"><?php echo htmlspecialchars($sesion['codigo']); ?></span>
                            </div>
                            <?php if ($sesion['activa']): ?>
                                <div class="actions">
                                    <a href="modal-host.php?codigo=<?php echo urlencode($sesion['codigo']); ?>" 
                                       class="btn btn-primary">
                                        Proyectar QR
                                    </a>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    </div>
</body>
</html>
