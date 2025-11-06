Estas funciones actúan como una capa de abstracción (un "API" interno) sobre la base de datos. Aquí tienes un resumen detallado, categorizado para tu conveniencia.

### Funciones Relacionadas con Profesores y Usuarios

Estas funciones se centran en obtener información y verificar permisos del usuario que ha iniciado sesión.

1.  **`get_usuario_actual()`**
    *   **Descripción:** Es la función más fundamental. Devuelve el correo electrónico del usuario actualmente autenticado leyendo y validando el JWT de la cookie `UCN_SESSID`.
    *   **Parámetros:** Ninguno.
    *   **Retorna:** El `email` del usuario si está logueado, o `false` si no lo está.

2.  **`get_def_profesor($user)`**
    *   **Descripción:** Obtiene la definición completa (todos los campos) de un profesor desde la tabla `profesor` a partir de su email.
    *   **Parámetros:** `$user` (el email del usuario, usualmente el resultado de `get_usuario_actual()`).
    *   **Retorna:** Un array asociativo con todos los datos del profesor (`id`, `rut`, `nombre`, `correo`, `super`, etc.), o `false` si no se encuentra.

3.  **`get_rut_from_email($email)`**
    *   **Descripción:** Una función de ayuda para obtener específicamente el RUT de un profesor usando su email.
    *   **Parámetros:** `$email`.
    *   **Retorna:** El `rut` del profesor o `false`.

4.  **`get_nombre_profesor($rut)`**
    *   **Descripción:** Obtiene el nombre completo de un profesor a partir de su RUT.
    *   **Parámetros:** `$rut`.
    *   **Retorna:** El `nombre` del profesor.

5.  **Funciones de Permisos (Booleanas):**
    *   Estas funciones verifican si el usuario actual tiene un permiso específico. Internamente, obtienen los datos del profesor y revisan los campos booleanos correspondientes.
    *   **`has_super_access()`**: Verifica si el usuario es un super administrador (`super == 't'`).
    *   **`can_control_clases()`**: Verifica si el usuario puede acceder al control de clases (`control_clases == 't'`).
    *   **`can_control_asistencia()`**: Verifica si puede gestionar la asistencia (`control_asistencia == 't'`).
    *   **`can_tomar_asistencia($idcurso, $idsemestre)`**: Verifica si el profesor actual está asignado a un curso específico en un semestre, dándole permiso para marcar asistencia.
    *   **`can_asistencia_fuera_de_fecha($user)`**: Verifica si un usuario tiene el permiso especial para registrar asistencia fuera de la fecha y hora estipuladas.

### Funciones Relacionadas con Alumnos

Estas funciones se utilizan para obtener datos específicos de los estudiantes.

1.  **`get_alumno_by_rut($rut)`**
    *   **Descripción:** Busca y devuelve los datos de un alumno a partir de su RUT.
    *   **Parámetros:** `$rut`.
    *   **Retorna:** Un array con la información del alumno desde la tabla `alumno`, o `false` si no existe.

2.  **`get_url_foto($rut)`**
    *   **Descripción:** Construye la URL de la foto de perfil de un alumno. Comprueba si existe un archivo de imagen para el RUT dado en el directorio `files/fotos/` y devuelve la ruta correspondiente.
    *   **Parámetros:** `$rut`.
    *   **Retorna:** La URL de la imagen (ej. `files/fotos/12345678-9.jpg`) o `false` si no existe.

### Funciones Relacionadas con Cursos y Clases

Estas funciones te permiten obtener información sobre los cursos, sus horarios y otros detalles.

1.  **`get_curso($id)`**
    *   **Descripción:** Obtiene los detalles de un curso específico por su ID.
    *   **Parámetros:** `$id` (el ID del curso).
    *   **Retorna:** Un array con los datos del curso desde la tabla `curso`.

2.  **`get_semestre_actual()`**
    *   **Descripción:** Determina y devuelve el ID del semestre que está actualmente activo, basándose en la fecha actual.
    *   **Parámetros:** Ninguno.
    *   **Retorna:** El `id` del semestre actual.

3.  **`get_cursos_profesor($rut_profesor, $id_semestre)`**
    *   **Descripción:** Obtiene una lista de todos los cursos que un profesor imparte en un semestre determinado.
    *   **Parámetros:** `$rut_profesor`, `$id_semestre`.
    *   **Retorna:** Un array de arrays, donde cada subarray contiene la información de un curso asignado al profesor.

4.  **`get_inscritos_curso($idcurso, $idsemestre)`**
    *   **Descripción:** Devuelve la lista completa de alumnos inscritos en un curso y semestre específicos.
    *   **Parámetros:** `$idcurso`, `$idsemestre`.
    *   **Retorna:** Un array con los datos de todos los alumnos inscritos.

5.  **`get_tipo_asistencia_curso($codReserva)`**
    *   **Descripción:** Obtiene el "tipo" de formulario de asistencia/feedback que se debe mostrar para un código de reserva dado.
    *   **Parámetros:** `$codReserva`.
    *   **Retorna:** Un número entero que representa el tipo de formulario (ej. 2 para "completa", 4 para "one minute paper", etc.).

### ¿Cómo aprovecharlas?

En lugar de hacer esto:

```php
// Acceso directo a la BD (lo que queremos evitar)
require("db.inc");
$dbh = db_open();
$stmt = $dbh->prepare("SELECT * FROM profesor WHERE correo = :email");
$stmt->bindParam(':email', $user_email);
$stmt->execute();
$profesor = $stmt->fetch();
if ($profesor['super'] == 't') {
    // Es super admin
}
```

Puedes usar las funciones existentes para lograr lo mismo de una manera más limpia y segura:

```php
// Usando las funciones de db.inc
require("db.inc");
if (has_super_access()) {
    // Es super admin
}

// Para obtener los cursos de un profesor
$user_email = get_usuario_actual();
$profesor = get_def_profesor($user_email);
$semestre_actual = get_semestre_actual();
$mis_cursos = get_cursos_profesor($profesor['rut'], $semestre_actual);

// Para listar los alumnos de un curso
$alumnos_del_curso = get_inscritos_curso($id_del_curso, $semestre_actual);
```

Utilizar estas funciones no solo te ahorra escribir SQL, sino que también centraliza la lógica de negocio. Si en el futuro cambia la estructura de la base de datos, solo necesitarás actualizar estas funciones en db.inc, en lugar de buscar y modificar cada consulta SQL repartida por todo el proyecto.