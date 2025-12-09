<?php
/**
 * Dev Simulator - Login Page
 * 
 * Responsabilidad: Permitir seleccionar usuario para simular sesion
 * 
 * Emula el flujo de autenticacion OAuth de Hawaii sin requerir Google.
 */

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/MockDataProvider.php';

// Iniciar sesion
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Si ya esta logueado, redirigir al dashboard
if (dev_is_logged_in()) {
    $role = dev_get_user_role();
    header('Location: ' . ($role === 'profesor' ? 'profesor-dashboard.php' : 'alumno-dashboard.php'));
    exit;
}

$provider = MockDataProvider::getInstance();
$profesores = $provider->getAllProfesores();
$alumnos = $provider->getAllAlumnos();

$error = '';
$success = '';

// Procesar login
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userType = $_POST['user_type'] ?? '';
    $userId = $_POST['user_id'] ?? '';
    
    if (empty($userType) || empty($userId)) {
        $error = 'Selecciona un tipo de usuario y un usuario';
    } else {
        if ($userType === 'profesor') {
            $profesor = $provider->getProfesorById((int)$userId);
            if ($profesor) {
                dev_save_auth_token([
                    'id' => $profesor['id'],
                    'user' => $profesor['email'],
                    'root' => $profesor['root'] ?? false,
                    'nombre' => $profesor['nombre'],
                    'rut' => $profesor['rut']
                ]);
                header('Location: profesor-dashboard.php');
                exit;
            } else {
                $error = 'Profesor no encontrado';
            }
        } elseif ($userType === 'alumno') {
            $alumno = $provider->getAlumnoByRut($userId);
            if ($alumno) {
                // Alumnos tienen id = -1 en sistema legacy
                dev_save_auth_token([
                    'id' => -1,
                    'user' => $alumno['rut'],
                    'root' => false,
                    'nombre' => $alumno['nombre'],
                    'rut' => $alumno['rut']
                ]);
                header('Location: alumno-dashboard.php');
                exit;
            } else {
                $error = 'Alumno no encontrado';
            }
        } else {
            $error = 'Tipo de usuario invalido';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Dev Simulator</title>
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
            justify-content: center;
            padding: 20px;
            color: #fff;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 {
            text-align: center;
            margin-bottom: 10px;
            font-size: 24px;
        }
        .subtitle {
            text-align: center;
            color: #aaa;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            color: #ccc;
        }
        .radio-group {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }
        .radio-option {
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
        }
        .radio-option:hover {
            border-color: #667eea;
        }
        .radio-option.selected {
            border-color: #667eea;
            background: rgba(102, 126, 234, 0.2);
        }
        .radio-option input {
            display: none;
        }
        .radio-option .icon {
            font-size: 32px;
            margin-bottom: 10px;
        }
        .radio-option .label {
            font-size: 14px;
        }
        select {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.2);
            color: #fff;
            font-size: 16px;
            cursor: pointer;
        }
        select:focus {
            outline: none;
            border-color: #667eea;
        }
        select option {
            background: #1a1a2e;
            color: #fff;
        }
        .btn {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
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
        .btn-primary:disabled {
            background: #4a5568;
            cursor: not-allowed;
        }
        .error {
            background: rgba(220, 38, 38, 0.2);
            border: 1px solid #dc2626;
            color: #fca5a5;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .back-link {
            display: block;
            text-align: center;
            margin-top: 20px;
            color: #aaa;
            text-decoration: none;
            font-size: 14px;
        }
        .back-link:hover {
            color: #fff;
        }
        .user-select-container {
            display: none;
        }
        .user-select-container.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Iniciar Sesion</h1>
        <p class="subtitle">Selecciona un usuario para simular</p>
        
        <?php if ($error): ?>
            <div class="error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <form method="POST" id="login-form">
            <div class="form-group">
                <label>Tipo de Usuario</label>
                <div class="radio-group">
                    <label class="radio-option" id="opt-profesor">
                        <input type="radio" name="user_type" value="profesor">
                        <div class="icon">&#128104;&#8205;&#127891;</div>
                        <div class="label">Profesor</div>
                    </label>
                    <label class="radio-option" id="opt-alumno">
                        <input type="radio" name="user_type" value="alumno">
                        <div class="icon">&#128105;&#8205;&#127891;</div>
                        <div class="label">Alumno</div>
                    </label>
                </div>
            </div>
            
            <div class="form-group user-select-container" id="profesor-select">
                <label>Seleccionar Profesor</label>
                <select name="user_id" id="profesor-dropdown">
                    <option value="">-- Seleccionar --</option>
                    <?php foreach ($profesores as $prof): ?>
                        <option value="<?php echo $prof['id']; ?>">
                            <?php echo htmlspecialchars($prof['nombre']); ?> 
                            (<?php echo htmlspecialchars($prof['email']); ?>)
                            <?php echo $prof['root'] ? ' [ADMIN]' : ''; ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            
            <div class="form-group user-select-container" id="alumno-select">
                <label>Seleccionar Alumno</label>
                <select name="user_id" id="alumno-dropdown">
                    <option value="">-- Seleccionar --</option>
                    <?php foreach ($alumnos as $alumno): ?>
                        <option value="<?php echo htmlspecialchars($alumno['rut']); ?>">
                            <?php echo htmlspecialchars($alumno['nombre']); ?> 
                            (RUT: <?php echo htmlspecialchars($alumno['rut']); ?>)
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            
            <button type="submit" class="btn btn-primary" id="submit-btn" disabled>
                Iniciar Sesion
            </button>
        </form>
        
        <a href="index.php" class="back-link">Volver al inicio</a>
    </div>
    
    <script>
        const optProfesor = document.getElementById('opt-profesor');
        const optAlumno = document.getElementById('opt-alumno');
        const profesorSelect = document.getElementById('profesor-select');
        const alumnoSelect = document.getElementById('alumno-select');
        const profesorDropdown = document.getElementById('profesor-dropdown');
        const alumnoDropdown = document.getElementById('alumno-dropdown');
        const submitBtn = document.getElementById('submit-btn');
        
        function updateSelection(type) {
            // Update radio visual
            optProfesor.classList.toggle('selected', type === 'profesor');
            optAlumno.classList.toggle('selected', type === 'alumno');
            
            // Show/hide selects
            profesorSelect.classList.toggle('active', type === 'profesor');
            alumnoSelect.classList.toggle('active', type === 'alumno');
            
            // Enable/disable dropdowns for form submission
            profesorDropdown.disabled = type !== 'profesor';
            alumnoDropdown.disabled = type !== 'alumno';
            
            // Reset selection
            if (type === 'profesor') {
                alumnoDropdown.value = '';
            } else {
                profesorDropdown.value = '';
            }
            
            updateSubmitButton();
        }
        
        function updateSubmitButton() {
            const profesorSelected = optProfesor.classList.contains('selected') && profesorDropdown.value;
            const alumnoSelected = optAlumno.classList.contains('selected') && alumnoDropdown.value;
            submitBtn.disabled = !(profesorSelected || alumnoSelected);
        }
        
        optProfesor.addEventListener('click', () => {
            optProfesor.querySelector('input').checked = true;
            updateSelection('profesor');
        });
        
        optAlumno.addEventListener('click', () => {
            optAlumno.querySelector('input').checked = true;
            updateSelection('alumno');
        });
        
        profesorDropdown.addEventListener('change', updateSubmitButton);
        alumnoDropdown.addEventListener('change', updateSubmitButton);
        
        // Initial state
        profesorDropdown.disabled = true;
        alumnoDropdown.disabled = true;
    </script>
</body>
</html>
