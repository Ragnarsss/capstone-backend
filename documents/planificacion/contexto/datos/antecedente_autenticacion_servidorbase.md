### Proceso para Marcar Asistencia

El sistema tiene dos formas principales de gestionar la asistencia:

1.  **Asistencia marcada por el Alumno (asist.php):**
    *   El profesor genera un código de reserva único para una clase específica. Este código tiene una ventana de tiempo de validez (`fechahora_inicio` y `fechahora_termino`).
    *   El alumno accede a una URL con ese código (ej. `asist.php?c=CODIGO_RESERVA`).
    *   El sistema valida el acceso a través de la función `validar_acceso()` en asist.php. Esta función comprueba:
        *   Que el código de reserva exista en la tabla `asistencia_curso`.
        *   Que la solicitud se haga dentro del tiempo permitido.
        *   Que la dirección IP del alumno esté en un rango permitido (si la restricción está activa).
    *   El alumno ingresa su RUT y, dependiendo del tipo de formulario (`tipo` en `asistencia_curso`), puede que también deba rellenar campos de retroalimentación sobre la clase.
    *   Al enviar el formulario, se ejecuta una operación (`op=m`) que inserta dos registros en la base de datos:
        1.  Un registro en `alumno_asistencia` que vincula al alumno con la clase, guardando su asistencia.
        2.  Un registro en `comentarios_clase` con la retroalimentación proporcionada.

2.  **Asistencia marcada por el Profesor (asist_marcar4.php):**
    *   El profesor accede a una interfaz para un curso y semestre específicos (ej. `asist_marcar4.php?c=IDCURSO&s=IDSEMESTRE`).
    *   El sistema verifica si el profesor tiene permisos para editar la asistencia de ese curso (`can_tomar_asistencia()`).
    *   La interfaz carga la lista de alumnos y las fechas de las clases, mostrando el estado de asistencia de cada uno.
    *   El profesor puede modificar manualmente el estado de asistencia (presente, ausente, etc.) para cada alumno en cada clase.
    *   Al guardar los cambios (`op=s`), el sistema:
        1.  Hace una copia de seguridad de la asistencia existente (`backupAsistencia()`).
        2.  Elimina los registros de asistencia anteriores para ese curso y semestre (`eliminarAsistenciaToda()`).
        3.  Inserta los nuevos registros de asistencia en las tablas `asistencia_curso` y `alumno_asistencia` con la información actualizada.

### Funciones para Acceder a la Base de Datos

El proyecto utiliza principalmente la extensión **PDO (PHP Data Objects)** para interactuar con la base de datos PostgreSQL. La conexión y las funciones principales se definen en db.inc.

1.  **Conexión a la Base de Datos:**
    *   **`db_open()`**: Esta es la función principal para establecer la conexión. Lee las credenciales desde constantes definidas en db.inc y crea un nuevo objeto `PDO`.

    ```php
    // En db.inc
    function db_open() {
        $dbh = new PDO(DBENGI . ':' . DBPATH);
        $dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $dbh;
    }
    ```

2.  **Ejecución de Consultas:**
    *   No hay una única función de "ejecutar SQL", sino que se sigue el patrón estándar de PDO:
        *   **`$dbh->prepare($sql)`**: Prepara una sentencia SQL para ser ejecutada.
        *   **`$stmt->bindParam(...)`**: Vincula una variable de PHP a un parámetro de la consulta SQL para evitar inyección de SQL.
        *   **`$stmt->execute()`**: Ejecuta la consulta preparada.
        *   **`$stmt->fetchAll()` / `$stmt->fetch()`**: Obtiene los resultados de la consulta.

    *   **`stmt_execute($stmt)`**: Es una función de ayuda (wrapper) definida en db.inc que simplemente ejecuta un `statement` preparado. Su propósito parece ser centralizar la ejecución, aunque en la práctica solo llama a `$stmt->execute()`.

    ```php
    // En db.inc
    function stmt_execute($stmt) {
        return $stmt->execute();
    }
    ```

3.  **Transacciones:**
    *   El código utiliza transacciones para asegurar la integridad de los datos, especialmente cuando se realizan múltiples inserciones o eliminaciones.
        *   **`$dbh->beginTransaction()`**: Inicia una transacción.
        *   **`$dbh->commit()`**: Confirma los cambios realizados durante la transacción.
        *   **`$dbh->rollBack()`**: Revierte los cambios si ocurre un error.

En resumen, el acceso a datos se gestiona a través de `db_open()` para conectar y el uso directo de los métodos de PDO (`prepare`, `execute`, `fetchAll`) para las operaciones, a menudo envueltas en transacciones para mayor seguridad.

CMCFL: haz la misma investigacion a fondo buscando en todo el proyecto desde la raiz. para el tema de autenticacion y como se mantiene de seccion en seccion

GitHub Copilot: ¡Claro! He realizado una investigación a fondo en todo el proyecto para explicarte cómo funciona la autenticación y el manejo de sesiones.

### Proceso de Autenticación y Manejo de Sesiones

El sistema de autenticación es bastante particular y combina varios mecanismos. No utiliza el manejo de sesiones estándar de PHP (`$_SESSION`) de forma generalizada, sino que se apoya en una cookie y funciones personalizadas para verificar la identidad del usuario en cada página.

Aquí está el desglose del proceso:

1.  **Inicio de Sesión (logeo.php):**
    *   El proceso de inicio de sesión principal se gestiona en logeo.php.
    *   El usuario puede autenticarse de dos maneras:
        1.  **Con RUT y Contraseña:** El formulario envía el RUT y la contraseña. El sistema verifica estos datos contra la tabla `profesor` en la base de datos. La contraseña se valida usando `password_verify()` contra un hash almacenado en la columna `password`.
        2.  **Con Google (OAuth 2.0):** El sistema utiliza la biblioteca `google-api-php-client`. Redirige al usuario a la página de consentimiento de Google. Una vez que el usuario autoriza, Google lo redirige de vuelta a logeo.php con un código de autorización. El sistema intercambia este código por un token de acceso y obtiene el perfil del usuario (incluido su correo electrónico).

2.  **Creación de la "Sesión" (`set_login_cookie`):**
    *   Una vez que el usuario es validado (ya sea por RUT/contraseña o por Google), el sistema busca su correo electrónico en la tabla `profesor`.
    *   Si el usuario existe, se llama a la función `set_login_cookie($user_email)`. Esta función es el núcleo del manejo de sesión.
    *   `set_login_cookie` crea una cookie llamada `UCN_SESSID`. El valor de esta cookie **no es un simple identificador de sesión**, sino un token JWT (JSON Web Token) que contiene el correo electrónico del usuario y una fecha de expiración. El token es firmado con una clave secreta (`get_secret_key()`) para evitar que sea manipulado.

    ```php
    // En db.inc
    function set_login_cookie($user) {
        $key = get_secret_key();
        $payload = array(
            "user" => $user,
            "exp" => time() + (30 * 24 * 60 * 60) // Expira en 30 días
        );
        $jwt = JWT::encode($payload, $key);
        setcookie("UCN_SESSID", $jwt, ...);
    }
    ```

3.  **Mantenimiento y Verificación de la Sesión (`get_usuario_actual`):**
    *   En casi todas las páginas del proyecto, se llama a la función `get_usuario_actual()` (definida en db.inc) al principio del script.
    *   Esta función es la encargada de verificar si el usuario está autenticado en cada petición.
    *   **¿Cómo funciona?**
        1.  Lee la cookie `UCN_SESSID`.
        2.  Si la cookie existe, decodifica el token JWT usando la misma clave secreta.
        3.  Si la decodificación es exitosa y el token no ha expirado, la función devuelve el correo electrónico del usuario contenido en el token.
        4.  Si la cookie no existe, el token es inválido o ha expirado, la función devuelve `false`.

    ```php
    // En db.inc
    function get_usuario_actual() {
        if (!isset($_COOKIE['UCN_SESSID'])) {
            return false;
        }
        $jwt = $_COOKIE['UCN_SESSID'];
        $key = get_secret_key();
        try {
            $decoded = JWT::decode($jwt, $key, array('HS256'));
            return $decoded->user;
        } catch (Exception $e) {
            return false;
        }
    }
    ```

4.  **Protección de Páginas:**
    *   Las páginas protegidas llaman a `get_usuario_actual()` y comprueban si el resultado es `false`. Si lo es, generalmente redirigen al usuario a logeo.php o muestran un mensaje de error.
    *   El correo del usuario obtenido se utiliza para consultar sus datos y permisos específicos en la base de datos (por ejemplo, usando `get_def_profesor($user_email)`).

5.  **Cierre de Sesión:**
    *   Para cerrar la sesión, el sistema simplemente elimina la cookie `UCN_SESSID` estableciendo su fecha de expiración en el pasado. Esto se hace en `logeo.php?op=logout`.

### Resumen del Flujo

1.  **logeo.php**: Valida credenciales (RUT/pass o Google).
2.  **`set_login_cookie()`**: Si la validación es exitosa, crea un token JWT con el email del usuario y lo guarda en la cookie `UCN_SESSID`.
3.  **En cada página**: Se llama a `get_usuario_actual()`.
4.  **`get_usuario_actual()`**: Lee la cookie, decodifica el JWT y devuelve el email del usuario si es válido.
5.  **Autorización**: Con el email, el sistema consulta la base de datos para verificar los permisos del usuario.

Este enfoque basado en JWT en una cookie hace que la sesión sea "sin estado" (stateless) en el servidor, ya que toda la información necesaria para identificar al usuario se encuentra en el propio token que el cliente envía en cada solicitud, eliminando la necesidad de almacenar datos de sesión en el servidor.

CMCFL: ahora quiero un analisis de todas las funciones que podamos aprovechar para obtener datos de alumno, clase y profesor, sin tener que meter mano directamente en la base de datos, es decir, creo, usando db.inc 

GitHub Copilot: ¡Excelente idea! Analicé a fondo el archivo db.inc y otros archivos relevantes para identificar todas las funciones que te permitirán obtener datos de alumnos, profesores y cursos sin necesidad de escribir consultas SQL directamente.

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