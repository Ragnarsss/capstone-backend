# Flujo del Sistema de Asistencia Legacy (Hawaii)

> Documento de referencia para la integracion del modulo Node con el sistema existente.
> Ultima actualizacion: 2025-12-09

---

## 1. Vision General

El sistema legacy Hawaii maneja la asistencia en dos flujos separados:

1. **Flujo Profesor**: Crea sesion de asistencia y proyecta QR estatico
2. **Flujo Alumno**: Escanea QR, ingresa RUT, responde encuesta y registra asistencia

Ambos flujos son **atomicos y completos** - no hay mezcla entre sistemas.

---

## 2. Autenticacion del Sistema

### 2.1 Flujo de Autenticacion (Produccion)

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE OAUTH 2.0                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario accede a /hawaii/                                   │
│     └─> Redirige a /hawaii/horario.php                          │
│                                                                 │
│  2. Si no hay sesion, muestra boton "Login con Google"          │
│     └─> Redirige a /google-login/google-oauth.php               │
│                                                                 │
│  3. Google OAuth flujo estandar:                                │
│     └─> accounts.google.com/o/oauth2/auth                       │
│     └─> Callback con code                                       │
│     └─> Intercambio por access_token                            │
│     └─> GET /oauth2/v3/userinfo → obtiene email                 │
│                                                                 │
│  4. Con el email, buscar en BD:                                 │
│     └─> get_auth_token($email)                                  │
│         └─> Busca en tabla 'profesor' por email o RUT           │
│         └─> Si encuentra: id=ID_PROFESOR, user=email            │
│         └─> Si no encuentra: id=-1, user=email                  │
│                                                                 │
│  5. Si id == -1 (no es profesor):                               │
│     └─> get_rut_from_alumno_email($email)                       │
│         └─> Busca en tabla 'alumno' por email_ucn               │
│         └─> Si encuentra: user=RUT (sin guion ni puntos)        │
│         └─> Si no encuentra: "Usuario no registrado"            │
│                                                                 │
│  6. Guardar sesion:                                             │
│     └─> save_auth_token($token)                                 │
│         └─> $_SESSION['id'] = id (-1 si alumno, ID si profesor) │
│         └─> $_SESSION['user'] = email o RUT                     │
│         └─> $_SESSION['root'] = true/false (admin)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Sesion PHP

```php
// Constantes de sesion (db.inc)
define('K_ROOT', 'root');
define('K_USER', 'user');
define('K_ID',   'id');

// Estructura de sesion
$_SESSION['id']   // int: ID profesor en BD, o -1 si es alumno
$_SESSION['user'] // string: email (profesor) o RUT sin formato (alumno)
$_SESSION['root'] // bool: true si es superadministrador
```

### 2.3 Distinguir Profesor vs Alumno

```php
// En cualquier archivo PHP
if ($_SESSION['id'] == -1) {
    // Es ALUMNO
    // $_SESSION['user'] contiene el RUT (ej: "186875052")
} else {
    // Es PROFESOR
    // $_SESSION['user'] contiene el email (ej: "profesor@ucn.cl")
    // $_SESSION['id'] contiene el ID en tabla profesor
}
```

### 2.4 Funciones de Autenticacion

| Funcion | Descripcion | Retorno |
|---------|-------------|---------|
| `is_logged_in()` | Verifica si hay sesion activa | `bool` |
| `get_usuario_actual()` | Obtiene email/RUT del usuario actual | `string\|false` |
| `has_super_access()` | Verifica si es administrador | `bool` |
| `auth_ok($user, $passwd)` | Valida credenciales (legacy, poco usado) | `array\|false` |
| `get_auth_token($email)` | Busca usuario por email o RUT | `array` |
| `save_auth_token($token)` | Guarda sesion PHP | `void` |
| `auth_logout()` | Destruye sesion | `void` |
| `get_rut_from_alumno_email($email)` | Obtiene RUT de alumno por email UCN | `string\|false` |

### 2.5 Login de Desarrollo

En ambiente de desarrollo (`vm104-HAWAII-devcapstone`):

```php
// /hawaii/dev-login.php
// Login directo con usuario test@test.cl sin Google OAuth
// Solo disponible si hostname != "losvilos.ucn.cl" y != "cersei"
```

---

## 3. Arquitectura de Datos

### 2.1 Tablas Principales

```
┌─────────────────────────────────────────────────────────────────┐
│                         PostgreSQL                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  asistencia_curso          alumno_asistencia     comentarios_   │
│  ─────────────────         ─────────────────     clase          │
│  id (PK)                   id (PK)               ─────────────  │
│  curso (FK)                id_alumno (FK)        id (PK)        │
│  semestre (FK)             id_registro (FK)      curso (FK)     │
│  fecha                     ip_origen             semestre (FK)  │
│  bloque (FK)               fechahora             fecha          │
│  codigo (CVYAFO)           estado                bloque (FK)    │
│  fechahora_inicio                                tipo_encuesta  │
│  fechahora_termino                               nota           │
│  usuario (email prof)                            justificacion  │
│  tipo (FK)                                       objetivo       │
│  acepta_origen_ip                                horainicio     │
│                                                  horatermino    │
│                                                  comentario     │
│                                                  v3_*, v4_*...  │
│                                                  v8_* (campos)  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Tabla de Tipos de Asistencia

`asistencia_curso_tipo` define los tipos de encuesta disponibles:

| ID | Nombre | Descripcion |
|----|--------|-------------|
| 1 | (deshabilitado) | No se usa |
| 2 | Completa | Nota + justificacion + objetivo + horarios + mejoras |
| 3 | Solo comentarios | Solo campo de comentarios |
| 4 | One Minute Paper v1 | Nota + tema importante + tema confuso + comentarios |
| 5 | One Minute Paper v2 | Nota + importante + confuso + positivo + negativo |
| 6 | Primera Clase | Preguntas SI/NO sobre RA, programa, etica, reglas, carga |
| 7 | Percepcion Semestre | Carga, evaluaciones, retro, horario, RA, recomienda |
| 8 | Percepcion Semestre 2025-1 | Version extendida con ayudante |

---

## 4. Flujo del Profesor

### 4.1 Entrada al Sistema

**Archivo**: `main_curso.php`

```
Usuario accede via menu principal
       │
       ▼
┌─────────────────────────────────────┐
│ main_curso.php?s={semestre}&c={curso}
│                                     │
│ Verificaciones:                     │
│ - is_logged_in()                    │
│ - can_tomar_asistencia(curso, sem)  │
│ - is_semestre_cerrado(semestre)     │
└─────────────────────────────────────┘
```

### 4.2 Creacion de Sesion de Asistencia

**Operacion**: `op=n` (nueva sesion)

```php
// Parametros recibidos
$bloque = getget("bloque");    // ID del bloque horario
$tipo = getget("tipo");        // Tipo de encuesta (2-8)
$fecha = getget("fecha");      // Formato YYYY-MM-DD
$red = getget("red");          // RED_CQBO | ALL

// Calculo de tiempos
$horaInicio = date('H:i:s');
$horaTermino = date('H:i:s', strtotime('+5 minutes'));

// INSERT en asistencia_curso
INSERT INTO asistencia_curso(
    curso, semestre, fecha, bloque, codigo,
    fechahora_inicio, fechahora_termino,
    usuario, tipo, acepta_origen_ip
) VALUES (...)

// Generacion de codigo
$id = $dbh->lastInsertId('asistencia_curso_id_seq');
$reserva = gen_cod_reserva($id);  // Ej: "CVYAFO"

// Actualizacion con codigo
UPDATE asistencia_curso SET codigo = :codigo WHERE id = :id
```

### 4.3 Generacion del Codigo QR

**Funcion**: `gen_cod_reserva($n)`

Convierte el ID numerico a codigo alfanumerico de 6 caracteres:
1. Convierte ID a binario de 26 bits
2. Invierte los bits
3. Convierte a base 26
4. Mapea digitos a letras mayusculas (A-Z)

```
ID: 12345 → Binario: 00000000000011000000111001
           → Invertido: 10011100000001100000000000
           → Base26: cvyafo
           → Mayusculas: CVYAFO
```

### 4.4 Proyeccion del QR

El profesor ve:
- URL: `https://losvilos.ucn.cl/hawaii/asist.php?c=CVYAFO`
- QR generado via: `https://losvilos.ucn.cl/qr/qr.php?u={url}`
- Tiempo restante: 5 minutos desde creacion

---

## 5. Flujo del Alumno

### 5.1 Acceso via QR

**Archivo**: `asist.php?c={codigo}`

```
Alumno escanea QR
       │
       ▼
┌─────────────────────────────────────┐
│ asist.php?c=CVYAFO                  │
│                                     │
│ Validaciones (validar_acceso):      │
│ 1. Codigo existe en BD              │
│ 2. Dentro de ventana de tiempo      │
│ 3. IP permitida (si red restringida)│
│ 4. Curso existe                     │
└─────────────────────────────────────┘
```

### 5.2 Validacion de Acceso

```php
function validar_acceso() {
    // 1. Verificar que codigo existe
    SELECT * FROM asistencia_curso WHERE codigo = :reserva
    if (count == 0) return EA_RESERVA_NOT_FOUND;
    
    // 2. Verificar red permitida
    if (!check_red($reserva['acepta_origen_ip'])) 
        return EA_IP_INVALIDA;
    
    // 3. Verificar ventana de tiempo
    $inicio = parse_fechahora($reserva['fechahora_inicio']);
    $termino = parse_fechahora($reserva['fechahora_termino']);
    $now = time();
    
    if ($now < $inicio || $now > $termino)
        return EA_RESERVA_TIMEOUT;
    
    // 4. Obtener datos del curso
    SELECT c.id, c.nombre FROM asistencia_curso ac 
    INNER JOIN curso c ON (c.id = ac.curso) 
    WHERE ac.codigo = :reserva
    
    return EA_OK;
}
```

### 5.3 Codigos de Error

| Codigo | Constante | Significado |
|--------|-----------|-------------|
| 0 | EA_OK | Acceso permitido |
| - | EA_SIN_RESERVA | No se proporciono codigo |
| - | EA_IP_INVALIDA | IP fuera de red permitida |
| - | EA_RESERVA_NOT_FOUND | Codigo no existe |
| - | EA_RESERVA_TIMEOUT | Fuera de ventana de tiempo |
| - | EA_ALREADY_REGISTERED | IP ya registro (deshabilitado) |
| - | EA_CURSO_NOT_FOUND | Curso no existe |

### 5.4 Formulario de Asistencia

**Pantalla mostrada al alumno**:

```
┌─────────────────────────────────────────────────────────────┐
│ [Nombre del Curso]                                          │
│ [IP/Codigo/TipoEncuesta]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Rut: [____________]  [Nombre del Alumno]                    │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ [Formulario segun tipo de encuesta]                         │
│                                                             │
│ - Tipo 2: Nota slider + 3 preguntas SI/NO + textarea        │
│ - Tipo 3: Solo textarea de comentarios                      │
│ - Tipo 4: Nota + tema importante + confuso + comentarios    │
│ - Tipo 5: Nota + importante + confuso + positivo + negativo │
│ - Tipo 6: 7 preguntas SI/NO sobre primera clase             │
│ - Tipo 7: 12 campos sobre percepcion del semestre           │
│ - Tipo 8: Version extendida con seccion de ayudante         │
│                                                             │
│                              [Guardar] (oculto hasta valido)│
└─────────────────────────────────────────────────────────────┘
```

### 5.5 Busqueda del Alumno

**Operacion**: `op=b` (buscar)

```javascript
// Frontend: Al escribir RUT (con debounce 400ms)
$.post("asist.php?c=CVYAFO&op=b", {r: rut})

// Backend:
SELECT * FROM alumno WHERE lower(rut) = lower(:rut)
// Retorna: {nombre: "Juan Perez"} o {nombre: ""}
```

### 5.6 Registro de Asistencia

**Operacion**: `op=m` (marcar)

```php
// 1. Registrar asistencia
INSERT INTO alumno_asistencia (id_alumno, id_registro, ip_origen, fechahora) 
VALUES (
    (SELECT id FROM alumno WHERE lower(rut) = lower(:rut)), 
    (SELECT id FROM asistencia_curso WHERE codigo = :reserva), 
    :ip_origen, 
    CURRENT_TIMESTAMP
)

// 2. Registrar encuesta (segun tipo)
INSERT INTO comentarios_clase (
    curso, semestre, fecha, bloque, tipo_encuesta,
    [campos_segun_tipo]
) VALUES (
    (SELECT curso FROM asistencia_curso WHERE codigo = :reserva),
    (SELECT semestre FROM asistencia_curso WHERE codigo = :reserva),
    (SELECT fecha FROM asistencia_curso WHERE codigo = :reserva),
    (SELECT bloque FROM asistencia_curso WHERE codigo = :reserva),
    (SELECT tipo FROM asistencia_curso WHERE codigo = :reserva),
    [valores_segun_tipo]
)
```

### 5.7 Confirmacion

```
┌─────────────────────────────────────┐
│                                     │
│            Listo!                   │
│                                     │
│  Tu asistencia se ha registrado     │
│                                     │
└─────────────────────────────────────┘
```

---

## 6. Funciones Auxiliares del Legacy

### 6.1 Ubicacion

**Archivo**: `db.inc`

### 6.2 Funciones Principales

| Funcion | Descripcion | Retorno |
|---------|-------------|---------|
| `is_logged_in()` | Verifica sesion activa | `bool` |
| `get_usuario_actual()` | Email (prof) o RUT (alumno) | `string\|false` |
| `has_super_access()` | Verifica si es admin | `bool` |
| `get_def_curso($id)` | Datos del curso | `array` |
| `get_def_bloque($nombre)` | Datos del bloque horario | `array` |
| `get_def_profesor($email)` | Datos del profesor | `array` |
| `get_def_semestre($id)` | Datos del semestre | `array` |
| `can_tomar_asistencia($curso, $sem)` | Verifica permisos | `bool` |
| `get_tipos_asistencia($curso, $sem)` | Tipos disponibles | `array` |
| `get_tipo_asistencia_curso($reserva)` | Tipo de una sesion | `int` |
| `is_semestre_cerrado($id)` | Verifica si cerrado | `bool` |

### 6.3 Sesion PHP

```php
$_SESSION['id']   // ID profesor (-1 si es alumno)
$_SESSION['user'] // Email (profesor) o RUT (alumno)
$_SESSION['root'] // bool: es superadmin
```

---

## 7. Validacion de Red

### 7.1 Redes Permitidas

```php
function check_red($red) {
    if ($red == "RED_CQBO") {
        $origenesValidos = array(
            "172.16.0.0/16",  // Red interna UCN
            "10.0.0.0/8"      // Red privada
        );
        
        // En desarrollo se agrega localhost
        if ($hostname == "vm104-HAWAII-devcapstone") {
            $origenesValidos[] = "127.0.0.1/32";
        }
        
        foreach ($origenesValidos as $test) {
            if (cidr_match($ipOrigen, $test)) return true;
        }
        return false;
    }
    return true; // "ALL" permite cualquier IP
}
```

---

## 8. Vista del Profesor: Resumen de Asistencia

### 8.1 Archivo

`asist_curso.php?c={curso}&s={semestre}`

### 8.2 Consulta Principal

```sql
SELECT 
    ac.fecha || '·' || b.nombre as clase,
    ac.fecha,
    b.nombre as bloque,
    a.rut,
    a.apellidos,
    a.nombres
FROM asistencia_curso ac
INNER JOIN alumno_asistencia aa ON (aa.id_registro = ac.id)
INNER JOIN alumno a ON (a.id = aa.id_alumno)
INNER JOIN bloque b ON (b.id = ac.bloque)
WHERE ac.curso = :idcurso AND ac.semestre = :idsemestre
ORDER BY a.apellidos, a.nombres
```

### 8.3 Estadisticas por Clase

```sql
SELECT 
    ac.fecha || '·' || b.nombre as clase,
    round(avg(aa.nota), 1) as promedio,
    max(aa.nota) as max,
    min(aa.nota) as min
FROM asistencia_curso ac
INNER JOIN alumno_asistencia aa ON (aa.id_registro = ac.id)
INNER JOIN bloque b ON (b.id = ac.bloque)
WHERE ac.curso = :idcurso AND ac.semestre = :idsemestre
GROUP BY ac.fecha, ac.bloque
```

---

## 9. Diagrama de Secuencia Completo

```
┌─────────┐     ┌─────────────┐     ┌─────────┐     ┌──────────┐
│ Profesor│     │ main_curso  │     │   BD    │     │  Alumno  │
└────┬────┘     └──────┬──────┘     └────┬────┘     └────┬─────┘
     │                 │                 │               │
     │ Abrir asistencia│                 │               │
     │────────────────>│                 │               │
     │                 │                 │               │
     │                 │ INSERT asistencia_curso         │
     │                 │────────────────>│               │
     │                 │                 │               │
     │                 │<────────────────│               │
     │                 │   ID=12345      │               │
     │                 │                 │               │
     │                 │ gen_cod_reserva │               │
     │                 │   → CVYAFO      │               │
     │                 │                 │               │
     │  QR + URL       │                 │               │
     │<────────────────│                 │               │
     │                 │                 │               │
     │ Proyecta QR     │                 │               │
     │ ═══════════════════════════════════════════════> │
     │                 │                 │               │
     │                 │                 │      Escanea QR
     │                 │                 │               │
     │                 │     ┌───────────┴───────────┐   │
     │                 │     │      asist.php        │   │
     │                 │     └───────────┬───────────┘   │
     │                 │                 │               │
     │                 │     validar_acceso              │
     │                 │     ────────────>               │
     │                 │                 │               │
     │                 │                 │  Ingresa RUT  │
     │                 │                 │<──────────────│
     │                 │                 │               │
     │                 │     Buscar alumno               │
     │                 │     ────────────>               │
     │                 │                 │               │
     │                 │                 │  Muestra nombre
     │                 │                 │──────────────>│
     │                 │                 │               │
     │                 │                 │  Responde encuesta
     │                 │                 │<──────────────│
     │                 │                 │               │
     │                 │     INSERT alumno_asistencia    │
     │                 │     INSERT comentarios_clase    │
     │                 │     ────────────>               │
     │                 │                 │               │
     │                 │                 │    "Listo!"   │
     │                 │                 │──────────────>│
     │                 │                 │               │
```

---

## 10. Diferencias Clave: Legacy vs Nuevo Sistema

| Aspecto | Legacy | Nuevo (Node) |
|---------|--------|--------------|
| QR | Estatico (codigo fijo 5 min) | Dinamico (cambia cada round) |
| Validacion | Codigo + tiempo + red | Criptografica (TOTP + firma) |
| Identificacion | RUT manual | Device enrollment (FIDO2) |
| Encuesta | Integrada en flujo | Separada (post-validacion) |
| Almacenamiento | Solo BD legacy | BD Node + sync a legacy |
| Anti-fraude | Solo restriccion IP | Multi-round + metricas |

---

## 11. Puntos de Integracion Identificados

### 10.1 Datos que Legacy Provee

Para **Profesor** (al abrir sesion):
- `idCurso`, `idSemestre`, `fecha`, `bloque`, `tipo`
- `usuario` (email del profesor)
- Datos del curso via `get_def_curso()`
- Datos del profesor via `get_def_profesor()`

Para **Alumno** (al marcar asistencia):
- `codigo` (de la URL del QR)
- `rut` (ingresado por alumno o de sesion si esta logueado)

### 10.2 Datos que Nuevo Sistema Debe Retornar

Para persistir en legacy:
- `codigo` (de la sesion)
- `rut` (del alumno validado)
- `ip` (origen de la peticion)
- Respuestas de encuesta (segun tipo)

### 10.3 Endpoint de Integracion Propuesto

```
POST /api/node/mark-attendance
{
    "codigo": "CVYAFO",
    "rut": "186875052",
    "ip": "172.16.1.100",
    "certainty": 95.5,
    "encuesta": {
        "tipo": 5,
        "nota": 6.5,
        "importante": "...",
        "confuso": "...",
        "positivo": "...",
        "negativo": "..."
    }
}
```

---

## 12. Referencias

- `main_curso.php` - Flujo profesor
- `asist.php` - Flujo alumno
- `db.inc` - Funciones auxiliares
- `asist_curso.php` - Resumen de asistencia
- `roseta.md` - Especificacion de integracion
