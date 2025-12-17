# Roseta de Integración: Sistema Legacy Hawaii → Módulo Asistencia

## Resumen de Autenticación PHP Legacy

### Sesión PHP (`$_SESSION`)

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `$_SESSION['id']` | `int` | ID del profesor en BD, o `-1` si es alumno | `123` |
| `$_SESSION['user']` | `string` | Email (profesor) o RUT sin formato (alumno) | `"juan.perez@ucn.cl"` o `"186875052"` |
| `$_SESSION['root']` | `bool` | Si es superadministrador | `true` / `false` |

### Cómo distinguir Profesor vs Alumno

```php
if ($_SESSION['id'] == -1) {
    // Es ALUMNO - $_SESSION['user'] contiene el RUT
} else {
    // Es PROFESOR - $_SESSION['user'] contiene el email
}
```

---

## Flujo del Profesor (Crea Sesión de Asistencia)

### Datos disponibles ANTES de crear sesión

| Dato | Origen | Tipo | Ejemplo |
|------|--------|------|---------|
| `idCurso` | Parámetro GET `c` | `int` | `429` |
| `idSemestre` | Parámetro GET `s` | `int` | `5` |
| `fecha` | Parámetro GET `fecha` | `string` | `"2025-04-01"` |
| `bloque` | Parámetro GET `bloque` | `int` | `1` |
| `tipo` | Parámetro GET `tipo` | `int` | `1` |
| `usuario` | `$_SESSION['user']` | `string` | `"profesor@ucn.cl"` |

### Datos disponibles DESPUÉS de crear sesión

| Dato | Origen | Tipo | Ejemplo |
|------|--------|------|---------|
| `id` | `$dbh->lastInsertId('asistencia_curso_id_seq')` | `int` | `12345` |
| `codigo` (reserva) | `gen_cod_reserva($id)` | `string` | `"CVYAFO"` |

### Datos obtenibles con funciones legacy

```php
// Nombre y código del curso
$curso = get_def_curso($idCurso);
// Retorna: ['id', 'nombre', 'codigo', 'seccion', ...]

// Horario del bloque
$bloque = get_def_bloque($nombreBloque);
// Retorna: ['id', 'nombre', 'horario', 'minuto_inicio', 'minuto_termino']

// Datos del profesor
$profesor = get_def_profesor($_SESSION['user']);
// Retorna: ['id', 'email', 'nombre', 'rut', ...]

// Datos del semestre
$semestre = get_def_semestre($idSemestre);
// Retorna: datos del semestre
```

---

## Flujo del Alumno (Marca Asistencia)

### Datos disponibles directamente

| Dato | Origen | Tipo | Ejemplo |
|------|--------|------|---------|
| Código QR | Escaneado por alumno | `string` | `"CVYAFO"` |
| RUT | `$_SESSION['user']` | `string` | `"186875052"` |

### Datos obtenibles con consulta (desde código QR)

```sql
SELECT * FROM asistencia_curso WHERE codigo = :codigo
```

Retorna: `id`, `curso`, `semestre`, `fecha`, `bloque`, `usuario` (email profesor), `tipo`, `fechahora_inicio`, `fechahora_termino`

---

## Tipos de Datos por Entidad

### Tabla `asistencia_curso`

| Campo | Tipo PostgreSQL | Tipo PHP | Ejemplo |
|-------|-----------------|----------|---------|
| `id` | `SERIAL` | `int` | `12345` |
| `curso` | `integer` (FK) | `int` | `429` |
| `semestre` | `integer` (FK) | `int` | `5` |
| `fecha` | `integer` | `int` | `20250401` |
| `bloque` | `integer` (FK) | `int` | `1` |
| `codigo` | `text` | `string` | `"CVYAFO"` |
| `fechahora_inicio` | `timestamp` | `string` | `"2025-04-01 08:00:00"` |
| `fechahora_termino` | `timestamp` | `string` | `"2025-04-01 08:05:00"` |
| `usuario` | `text` | `string` | `"profesor@ucn.cl"` |
| `tipo` | `integer` | `int` | `1` |

### Tabla `curso` (via `get_def_curso()`)

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| `id` | `int` | `429` |
| `nombre` | `string` | `"Programación Avanzada"` |
| `codigo` | `string` | `"ECIN-00360"` |
| `seccion` | `string` | `"1"` |

### Tabla `bloque` (via `get_def_bloque()`)

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| `id` | `int` | `1` |
| `nombre` | `string` | `"1-2"` |
| `horario` | `string` | `"08:00 - 09:30"` |
| `minuto_inicio` | `int` | `480` |
| `minuto_termino` | `int` | `570` |

### Tabla `profesor` (via `get_def_profesor()`)

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| `id` | `int` | `123` |
| `email` | `string` | `"juan.perez@ucn.cl"` |
| `nombre` | `string` | `"Juan Pérez"` |
| `rut` | `string` | `"12345678-9"` |

---

## Estructura JSON Propuesta para Comunicación con Módulo

### Para el Profesor (al abrir el módulo)

```json
{
  "tipo": "PROFESOR",
  "sesion": {
    "id": 12345,
    "codigo": "CVYAFO",
    "fecha": "2025-04-01",
    "fechahoraInicio": "2025-04-01T08:00:00",
    "fechahoraTermino": "2025-04-01T08:05:00",
    "tipo": 1
  },
  "curso": {
    "id": 429,
    "nombre": "Programación Avanzada",
    "codigo": "ECIN-00360",
    "seccion": "1"
  },
  "bloque": {
    "id": 1,
    "nombre": "1-2",
    "horario": "08:00 - 09:30"
  },
  "profesor": {
    "id": 123,
    "nombre": "Juan Pérez",
    "email": "juan.perez@ucn.cl"
  },
  "semestre": {
    "id": 5
  }
}
```

### Para el Alumno (al marcar asistencia)

```json
{
  "tipo": "ALUMNO",
  "alumno": {
    "rut": "186875052"
  },
  "codigoQR": "CVYAFO"
}
```

---

## Mecanismo de Integración Existente

El sistema legacy tiene trazas de integración via iframe + postMessage:

1. **Legacy abre modal/iframe** apuntando al módulo
2. **Legacy genera JWT** con datos del usuario
3. **Envía via `postMessage`** después de que carga el iframe
4. **Módulo recibe** y procesa

### Archivos relevantes en legacy

- `main_curso.php` - Abre modal para asistencia
- `api_get_asistencia_token.php` - Genera JWT
- `api/abrir_asistencia.php` - Crea sesión de asistencia
- `db.inc` - Funciones auxiliares (`get_def_curso`, `get_def_profesor`, etc.)

---

## Funciones Legacy Disponibles (en `db.inc`)

| Función | Descripción |
|---------|-------------|
| `is_logged_in()` | Retorna `true` si hay sesión activa |
| `get_usuario_actual()` | Retorna email/RUT del usuario |
| `has_super_access()` | Retorna `true` si es admin |
| `get_def_curso($id)` | Datos del curso |
| `get_def_bloque($nombre)` | Datos del bloque horario |
| `get_def_profesor($email)` | Datos del profesor |
| `get_def_semestre($id)` | Datos del semestre |
| `get_auth_token($email)` | Busca usuario en BD |
| `can_tomar_asistencia($curso, $semestre)` | Verifica permisos |

---

## PUENTE: Integración Node ↔ Legacy con Mínima Intervención

### Decisión del Profesor: Sistema Completo

El profesor elige al crear la sesión si usa sistema **ANTIGUO** o **NUEVO**. 
No se mezclan: exposición y captura van juntas del mismo sistema.

```
┌─────────────────────────────────────────────────────────────────┐
│ PROFESOR: Elige sistema al crear sesión                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ SISTEMA ANTIGUO (legacy completo):                             │
│   - Exposición: QR estático con código (CVYAFO)                │
│   - Captura: asist.php → alumno ingresa RUT + encuesta         │
│   - Tablas: asistencia_curso, alumno_asistencia, comentarios   │
│                                                                 │
│ SISTEMA NUEVO (módulo Node completo):                          │
│   - Exposición: QR dinámico multi-round via iframe             │
│   - Captura: Escaneo + validación criptográfica via iframe     │
│   - Tablas: attendance.* (Node) + legacy (al finalizar)        │
│   - Encuesta: Mostrada por módulo Node tras validación         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Arquitectura de Coexistencia

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PHP LEGACY (Producción)                         │
│                                                                     │
│  - Maneja sesiones de usuario (profesor/alumno)                    │
│  - Crea asistencia_curso con código (CVYAFO)                       │
│  - Abre iframe/modal hacia módulo Node                             │
│  - Indica modo: exposición (profesor) o captura (alumno)           │
│  - Recibe resultados de Node y persiste en tablas legacy           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ iframe + postMessage (JWT con datos)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MÓDULO NODE (iframe)                            │
│                                                                     │
│  PROFESOR (modo=projection):                                       │
│    - Recibe: código sesión, datos curso, datos profesor            │
│    - Proyecta QRs dinámicos multi-round                            │
│    - Muestra lista de alumnos validados en tiempo real             │
│                                                                     │
│  ALUMNO (modo=capture):                                            │
│    - Recibe: RUT (del enrolamiento), código sesión                 │
│    - Verifica enrolamiento de dispositivo                          │
│    - Escanea y valida QRs multi-round                              │
│    - Al completar: muestra encuesta (según tipo de sesión)         │
│    - Notifica a Legacy: asistencia + respuestas encuesta           │
│                                                                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ POST a endpoints Legacy
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Legacy)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────┐   │
│  │ asistencia_     │  │ alumno_         │  │ comentarios_      │   │
│  │ curso           │  │ asistencia      │  │ clase             │   │
│  │ (codigo=CVYAFO) │  │ (id_registro,   │  │ (encuesta)        │   │
│  │                 │  │  id_alumno)     │  │                   │   │
│  └─────────────────┘  └─────────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo Completo: Sistema Nuevo

#### Fase 1: Profesor abre sesión

```
1. Profesor en main_curso.php elige "Sistema Nuevo"
2. Legacy crea asistencia_curso (código = CVYAFO)
3. Legacy abre iframe hacia módulo Node con datos:
   - modo: "projection"
   - codigo: "CVYAFO"
   - curso, semestre, bloque, profesor (via JWT o postMessage)
4. Módulo Node inicia proyección de QRs dinámicos
```

#### Fase 2: Alumno accede via iframe

```
1. Legacy detecta que sesión usa "Sistema Nuevo"
2. Legacy abre iframe hacia módulo Node con datos:
   - modo: "capture"
   - codigo: "CVYAFO"
   - rut: del alumno (viene de $_SESSION o formulario previo)
3. Módulo Node verifica enrolamiento del dispositivo
```

#### Fase 3: Enrolamiento (si es necesario)

```
┌─────────────────────────────────────────────────────────────────┐
│ ALUMNO: Primer uso o dispositivo diferente                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ CASO A: Sin dispositivo enrolado                               │
│   → Módulo muestra: "Enrolar Dispositivo" (botón)              │
│   → Alumno presiona → WebAuthn/FIDO2 silencioso                │
│   → Guarda en enrollment.devices (RUT ↔ dispositivo)           │
│   → Continúa a captura QR                                      │
│                                                                 │
│ CASO B: Dispositivo diferente al enrolado                      │
│   → Módulo muestra: "Dispositivo no reconocido"                │
│   → Opción: "Re-enrolar" (aplica período de castigo)           │
│   → Si acepta: nuevo enrolamiento, castigo activo              │
│   → Durante castigo: no puede usar sistema nuevo               │
│                                                                 │
│ CASO C: Dispositivo coincide                                   │
│   → Continúa directo a captura QR                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Fase 4: Validación multi-round

```
1. Alumno escanea QRs proyectados
2. Módulo valida cada round (TOTPu, timestamp, etc.)
3. Al completar N rounds exitosos:
   → Calcula certainty score
   → Muestra: "Asistencia registrada (95% certeza)"
   → Notifica a Legacy y CIERRA iframe
```

#### Fase 5: Encuesta en Legacy

```
┌─────────────────────────────────────────────────────────────────┐
│ LEGACY: Encuesta después de validación exitosa                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Node notifica a Legacy: {codigo, rut, certainty, ip}        │
│                                                                 │
│ 2. Legacy registra en alumno_asistencia                        │
│                                                                 │
│ 3. Legacy cierra iframe de Node                                │
│                                                                 │
│ 4. Legacy muestra encuesta al alumno (según tipo de sesión):   │
│    - Tipo 2: nota, comentarios, objetivo, horarios, mejoras    │
│    - Tipo 3: solo comentarios                                  │
│    - Tipo 4: one minute paper                                  │
│    - etc.                                                       │
│                                                                 │
│ 5. RUT ya conocido (vino de Node), no lo pide de nuevo         │
│                                                                 │
│ 6. Al enviar: INSERT en comentarios_clase (lógica legacy)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Fase 6: Persistencia en Legacy

Node envía solo datos de asistencia a Legacy:

```typescript
// Node → PHP (después de validación exitosa)
await fetch('http://php-legacy/api/node/mark-attendance', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-Signature': jwtToken  // firmado con secret compartido
  },
  body: JSON.stringify({
    codigo: 'CVYAFO',
    rut: '186875052',
    ip: '192.168.1.100',
    certainty: 95.5
  })
});
```

Legacy recibe, registra asistencia, y luego muestra encuesta (lógica 100% legacy).

### Endpoints Nuevos en Legacy

#### `api/node/mark-attendance.php`

```php
<?php
require_once("../../db.inc");
header('Content-Type: application/json');

// Verificar firma (opcional pero recomendado)
$token = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
// ... validar JWT

$data = json_decode(file_get_contents('php://input'), true);
$codigo = $data['codigo'];
$rut = $data['rut'];
$ip = $data['ip'] ?? $_SERVER['REMOTE_ADDR'];

try {
    $dbh = db_open();

    // Registrar asistencia
    $sql = "INSERT INTO alumno_asistencia (id_alumno, id_registro, ip_origen, fechahora) 
            VALUES (
                (SELECT id FROM alumno WHERE lower(rut) = lower(:rut)), 
                (SELECT id FROM asistencia_curso WHERE codigo = :codigo), 
                :ip, CURRENT_TIMESTAMP
            )";
    $stmt = $dbh->prepare($sql);
    $stmt->bindParam(':rut', $rut);
    $stmt->bindParam(':codigo', $codigo);
    $stmt->bindParam(':ip', $ip);
    $stmt->execute();

    // Responder con éxito + datos para que Legacy muestre encuesta
    echo json_encode([
        'success' => true,
        'rut' => $rut,
        'codigo' => $codigo
    ]);
} catch(PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
```

Legacy luego usa el RUT recibido para mostrar la encuesta (sin pedirlo de nuevo).

### Resumen de Cambios en Legacy

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `main_curso.php` | Opción para elegir sistema + abrir iframe | +10 |
| `asist.php` | Detectar sistema nuevo y abrir iframe | +5 |
| `api/node/complete-attendance.php` | **NUEVO** - recibe asistencia + encuesta | ~60 |

**Total: ~75 líneas nuevas, lógica existente intacta**

### Tablas que NO se modifican

- ✅ `asistencia_curso` - se sigue usando igual
- ✅ `alumno_asistencia` - se sigue usando igual  
- ✅ `alumno` - no se toca
- ✅ `comentarios_clase` - se sigue usando igual (Node envía datos)

### Compatibilidad con Podman

El stack actual ya soporta esta integración:
- `node-service` en red `asistencia-network` 
- `php-service` alcanza Node via `http://node-service:3000`
- Legacy alcanza Podman via IP o proxy Apache
- Todo via iframes, sin navegación fuera del contexto Legacy
