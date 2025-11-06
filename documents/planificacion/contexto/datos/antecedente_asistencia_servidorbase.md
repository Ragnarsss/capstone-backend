# Proceso para Marcar Asistencia

---

## Formas Principales de Gestión

### 1. Asistencia Marcada por el Alumno (asist.php)

- El profesor genera un código de reserva único para una clase específica. Este código tiene una ventana de tiempo de validez (`fechahora_inicio` y `fechahora_termino`).
- El alumno accede a una URL con ese código (ej. `asist.php?c=CODIGO_RESERVA`).
- El sistema valida el acceso a través de la función `validar_acceso()` en asist.php. Esta función comprueba:
  - Que el código de reserva exista en la tabla `asistencia_curso`.
  - Que la solicitud se haga dentro del tiempo permitido.
  - Que la dirección IP del alumno esté en un rango permitido (si la restricción está activa).
- El alumno ingresa su RUT y, dependiendo del tipo de formulario (`tipo` en `asistencia_curso`), puede que también deba rellenar campos de retroalimentación sobre la clase.
- Al enviar el formulario, se ejecuta una operación (`op=m`) que inserta dos registros en la base de datos:
  1. Un registro en `alumno_asistencia` que vincula al alumno con la clase, guardando su asistencia.
  2. Un registro en `comentarios_clase` con la retroalimentación proporcionada.

### 2. Asistencia Marcada por el Profesor (asist_marcar4.php)

- El profesor accede a una interfaz para un curso y semestre específicos (ej. `asist_marcar4.php?c=IDCURSO&s=IDSEMESTRE`).
- El sistema verifica si el profesor tiene permisos para editar la asistencia de ese curso (`can_tomar_asistencia()`).
- La interfaz carga la lista de alumnos y las fechas de las clases, mostrando el estado de asistencia de cada uno.
- El profesor puede modificar manualmente el estado de asistencia (presente, ausente, etc.) para cada alumno en cada clase.
- Al guardar los cambios (`op=s`), el sistema:
  1. Hace una copia de seguridad de la asistencia existente (`backupAsistencia()`).
  2. Elimina los registros de asistencia anteriores para ese curso y semestre (`eliminarAsistenciaToda()`).
  3. Inserta los nuevos registros de asistencia en las tablas `asistencia_curso` y `alumno_asistencia` con la información actualizada.

---

## Funciones para Acceder a la Base de Datos

### Conexión a la Base de Datos

```php
// En db.inc
function db_open() {
    $dbh = new PDO(DBENGI . ':' . DBPATH);
    $dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $dbh;
}
```

### Ejecución de Consultas

- No hay una única función de "ejecutar SQL", sino que se sigue el patrón estándar de PDO:
  - `$dbh->prepare($sql)`: Prepara una sentencia SQL para ser ejecutada.
  - `$stmt->bindParam(...)`: Vincula una variable de PHP a un parámetro de la consulta SQL para evitar inyección de SQL.
  - `$stmt->execute()`: Ejecuta la consulta preparada.
  - `$stmt->fetchAll()` / `$stmt->fetch()`: Obtiene los resultados de la consulta.

```php
// En db.inc
function stmt_execute($stmt) {
    return $stmt->execute();
}
```

### Transacciones

- El código utiliza transacciones para asegurar la integridad de los datos, especialmente cuando se realizan múltiples inserciones o eliminaciones.
  - `$dbh->beginTransaction()`: Inicia una transacción.
  - `$dbh->commit()`: Confirma los cambios realizados durante la transacción.
  - `$dbh->rollBack()`: Revierte los cambios si ocurre un error.

---

## Resumen

El acceso a datos se gestiona a través de `db_open()` para conectar y el uso directo de los métodos de PDO (`prepare`, `execute`, `fetchAll`) para las operaciones, a menudo envueltas en transacciones para mayor seguridad.
