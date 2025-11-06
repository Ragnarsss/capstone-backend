# Esquema de Base de Datos - Arquitectura de 3 Bases de Datos

**Fecha:** 2025-11-05
**Versión:** 3.0 (3 BD Independientes)
**Estado:** Especificación Técnica Oficial

---

## Visión General

El sistema utiliza **tres bases de datos completamente independientes**:

1. **BD PHP Legacy (PostgreSQL)** - Servidor producción PHP
   - Usuarios, profesores, cursos, inscripciones
   - Asistencia tradicional, permisos
   - Acceso: Solo PHP Service mediante funciones `db.inc`

2. **BD Node Cache (Valkey/Redis)** - Datos temporales con TTL
   - Metadatos QR activos
   - Sessions WebSocket
   - Cache de consultas a PHP
   - Acceso: Solo Node Service

3. **BD Node Persistente (PostgreSQL)** - Datos criptográficos
   - Dispositivos FIDO2 enrolados
   - Validaciones de asistencia
   - Resultados finales
   - Schemas: `enrollment`, `attendance`
   - Acceso: Solo Node Service

**Principio fundamental:** NO hay acceso cross-database directo. Comunicación PHP-Node solo via HTTP endpoints con JWT interno.

**Referencia completa:** Ver [08-arquitectura-datos.md](08-arquitectura-datos.md)

---

## BD 1: PHP Legacy (PostgreSQL)

### Descripción

Base de datos del sistema académico existente en servidor de producción PHP.

**Node NO tiene acceso directo.** Todas las consultas se realizan via HTTP endpoints PHP con JWT interno.

### Funciones Disponibles (via db.inc)

**Autenticación:**
- `get_usuario_actual()` - Obtener datos usuario en sesión
- `set_login_cookie($username, $password)` - Establecer cookie sesión
- `check_login()` - Verificar si usuario está logueado

**Profesores:**
- `get_def_profesor($username)` - Obtener definición de profesor
- `get_cursos_profesor($username, $semestre)` - Cursos que imparte
- `can_tomar_asistencia($username, $curso_id)` - Verificar permisos

**Alumnos:**
- `get_alumno_by_rut($rut)` - Obtener datos alumno por RUT
- `get_inscritos_curso($curso_id, $semestre)` - Alumnos inscritos

**Cursos:**
- `get_curso($curso_id)` - Obtener datos de curso
- `get_semestre_actual()` - Obtener semestre vigente

**Asistencia Tradicional:**
- `registrar_asistencia($curso_id, $alumno_id, $fecha, $estado)` - Registro manual
- `get_asistencias_curso($curso_id, $fecha_inicio, $fecha_fin)` - Consultar registros

### Acceso desde Node

Node NO consulta directamente esta BD. Usa cliente HTTP:

```typescript
// Ejemplo: Obtener datos de usuario
const userData = await PHPLegacyClient.getUserById(userId);
// Internamente:
// 1. Genera JWT_INTERNAL (TTL 1hr)
// 2. POST https://php-service/api/get_usuario.php
// 3. PHP ejecuta: get_usuario_actual() via db.inc
// 4. PHP retorna JSON
// 5. Node cachea en Valkey (TTL 300s)
```

### Cache en Valkey

Para minimizar latencia, Node cachea respuestas:

```typescript
// Cache de usuario (TTL 5 min)
cache:php:user:{userId}

// Cache de curso (TTL 10 min)
cache:php:course:{courseId}

// Cache de inscritos (TTL 10 min)
cache:php:enrolled:{courseId}
```

---

## BD 2: Node Cache (Valkey/Redis)

### Descripción

Almacenamiento temporal de alto rendimiento para datos volátiles con TTL automático.

**PHP NO tiene acceso.** Solo Node Service.

### Patrones de Claves

#### Metadatos QR Activos

```plaintext
Clave: qr:session:{sessionId}:{userId}:{round}
Tipo: Hash
TTL: 120 segundos (2 minutos)
Campos:
  - userId: INTEGER
  - ronda: INTEGER
  - timestamp_envio: BIGINT (milisegundos)
  - mostrado_count: INTEGER
  - intentos_fallidos: INTEGER
  - valido: BOOLEAN

Ejemplo:
qr:session:uuid-123:456:1 -> {
  "userId": 456,
  "ronda": 1,
  "timestamp_envio": 1730546400000,
  "mostrado_count": 3,
  "intentos_fallidos": 0,
  "valido": true
}
```

#### Cola de Proyección QR

```plaintext
Clave: proyeccion:session:{sessionId}
Tipo: List (FIFO)
TTL: 300 segundos (5 minutos)
Contenido: Payloads QR encriptados (JSON base64)

Operaciones:
  - LPUSH: Agregar nuevo QR a cola
  - LRANGE: Obtener QR activos para proyección
  - LREM: Remover QR validado o expirado
```

#### Cache de Consultas PHP

```plaintext
Clave: cache:php:user:{userId}
Tipo: String (JSON)
TTL: 300 segundos (5 minutos)
Contenido: Datos usuario desde BD Legacy

Clave: cache:php:course:{courseId}
Tipo: String (JSON)
TTL: 600 segundos (10 minutos)
Contenido: Datos curso desde BD Legacy

Clave: cache:php:enrolled:{courseId}
Tipo: String (JSON)
TTL: 600 segundos (10 minutos)
Contenido: Lista inscritos desde BD Legacy
```

#### Sesiones WebSocket

```plaintext
Clave: ws:auth:{connectionId}
Tipo: String (JSON)
TTL: 60 segundos
Contenido: {userId, username, rol, authenticated_at}

Clave: ws:projection:{sessionId}
Tipo: Set
TTL: 7200 segundos (2 horas)
Contenido: connectionIds activos en proyección
```

### Comandos Típicos

```typescript
// Almacenar metadata QR
await valkey.hset(`qr:session:${sessionId}:${userId}:${round}`, {
  userId,
  ronda: round,
  timestamp_envio: Date.now(),
  mostrado_count: 0,
  intentos_fallidos: 0,
  valido: true
});
await valkey.expire(`qr:session:${sessionId}:${userId}:${round}`, 120);

// Agregar a cola proyección
await valkey.lpush(`proyeccion:session:${sessionId}`, payloadEncriptado);

// Cache consulta PHP
await valkey.setex(`cache:php:user:${userId}`, 300, JSON.stringify(userData));

// Verificar cache antes de HTTP
const cached = await valkey.get(`cache:php:user:${userId}`);
if (cached) return JSON.parse(cached);
```

---

## BD 3: Node Persistente (PostgreSQL)

### Descripción

Base de datos persistente del módulo Node, normalizada a Tercera Forma Normal (FN3).

**PHP NO tiene acceso directo.** Si PHP necesita datos, consulta via HTTP endpoint Node con JWT interno.

### Justificación FN3

**Ventajas sobre JSONB:**
- Queries SQL estándar (sin funciones JSONB complejas)
- Índices convencionales más rápidos
- Validación de integridad referencial
- Mejor para reportes y agregaciones

**Ventajas sobre FN4:**
- Menos tablas (más simple)
- Menos JOINs complejos
- Performance predecible
- Más fácil de mantener

---

## Schema: enrollment

### Tabla: enrollment.devices

Almacena dispositivos FIDO2 enrolados.

```sql
CREATE SCHEMA IF NOT EXISTS enrollment;

CREATE TABLE enrollment.devices (
  device_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  handshake_secret TEXT NOT NULL,
  aaguid TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  attestation_format TEXT,
  sign_count INTEGER DEFAULT 0,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Índices
CREATE UNIQUE INDEX idx_devices_credential_id ON enrollment.devices(credential_id);
CREATE INDEX idx_devices_user_id ON enrollment.devices(user_id);
CREATE INDEX idx_devices_aaguid ON enrollment.devices(aaguid);
CREATE INDEX idx_devices_active ON enrollment.devices(is_active) WHERE is_active = TRUE;

-- Comentarios
COMMENT ON TABLE enrollment.devices IS
  'Dispositivos FIDO2/WebAuthn enrolados por usuarios';

COMMENT ON COLUMN enrollment.devices.credential_id IS
  'ID único de la credencial WebAuthn (base64)';

COMMENT ON COLUMN enrollment.devices.handshake_secret IS
  'Secret derivado con HKDF para generación de TOTPu';

COMMENT ON COLUMN enrollment.devices.aaguid IS
  'Authenticator Attestation GUID (identifica modelo)';

COMMENT ON COLUMN enrollment.devices.sign_count IS
  'Contador de firmas (anti-clonación)';
```

**Campos principales:**
- `device_id`: PK auto-incremental
- `user_id`: FK a sistema legacy (no manejado aquí)
- `credential_id`: Único por dispositivo (WebAuthn)
- `public_key`: ECDSA P-256 en formato PEM
- `handshake_secret`: Derivado con HKDF
- `aaguid`: Identificador del autenticador
- `sign_count`: Contador anti-clonación

**Satisface FN3:**
- PK única (`device_id`)
- No dependencias transitivas
- Todos los campos dependen de PK

---

### Tabla: enrollment.enrollment_history

Auditoría de eventos de enrollment.

```sql
CREATE TABLE enrollment.enrollment_history (
  history_id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES enrollment.devices(device_id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('enrolled', 'revoked', 're-enrolled', 'updated')),
  reason TEXT,
  performed_at TIMESTAMP DEFAULT NOW(),
  performed_by INTEGER, -- userId del actor
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices
CREATE INDEX idx_enrollment_history_device ON enrollment.enrollment_history(device_id);
CREATE INDEX idx_enrollment_history_user ON enrollment.enrollment_history(user_id);
CREATE INDEX idx_enrollment_history_performed_at ON enrollment.enrollment_history(performed_at DESC);

-- Comentarios
COMMENT ON TABLE enrollment.enrollment_history IS
  'Auditoría de eventos de enrollment y re-enrollment';

COMMENT ON COLUMN enrollment.enrollment_history.action IS
  'Tipo de evento: enrolled, revoked, re-enrolled, updated';
```

**Campos principales:**
- `history_id`: PK auto-incremental
- `device_id`: FK a `enrollment.devices` (nullable)
- `action`: Enum de eventos
- `reason`: Texto libre explicativo
- `metadata`: JSONB para datos adicionales (permitido en FN3 para auditoría)

**Satisface FN3:**
- PK única (`history_id`)
- FK válida a `devices`
- metadata JSONB justificado (datos no estructurados de auditoría)

---

## Schema: attendance

### Tabla: attendance.sessions

Sesiones de asistencia creadas por profesores.

```sql
CREATE SCHEMA IF NOT EXISTS attendance;

CREATE TABLE attendance.sessions (
  session_id SERIAL PRIMARY KEY,
  professor_id INTEGER NOT NULL,
  professor_name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  room TEXT NOT NULL,
  semester TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  max_rounds INTEGER DEFAULT 3 CHECK (max_rounds BETWEEN 1 AND 10),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sessions_professor ON attendance.sessions(professor_id);
CREATE INDEX idx_sessions_status ON attendance.sessions(status);
CREATE INDEX idx_sessions_start_time ON attendance.sessions(start_time DESC);
CREATE INDEX idx_sessions_course ON attendance.sessions(course_code);

-- Comentarios
COMMENT ON TABLE attendance.sessions IS
  'Sesiones de asistencia (clases) creadas por profesores';

COMMENT ON COLUMN attendance.sessions.max_rounds IS
  'Número de rondas de validación requeridas (1-10)';

COMMENT ON COLUMN attendance.sessions.status IS
  'Estado de la sesión: active, closed, cancelled';
```

**Campos principales:**
- `session_id`: PK auto-incremental
- `professor_id`: FK a sistema legacy
- `course_code`: Código de asignatura
- `max_rounds`: Rondas configuradas (1-10)
- `status`: Estado de sesión

**Satisface FN3:**
- PK única (`session_id`)
- Datos del curso almacenados (desnormalización justificada para performance)
- No dependencias transitivas

---

### Tabla: attendance.registrations

Anuncios de participación de estudiantes.

```sql
CREATE TABLE attendance.registrations (
  registration_id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES attendance.sessions(session_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  device_id INTEGER REFERENCES enrollment.devices(device_id) ON DELETE SET NULL,
  queue_position INTEGER NOT NULL,
  registered_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'processing', 'completed', 'failed')),

  UNIQUE(session_id, user_id) -- Un usuario una vez por sesión
);

-- Índices
CREATE INDEX idx_registrations_session ON attendance.registrations(session_id);
CREATE INDEX idx_registrations_user ON attendance.registrations(user_id);
CREATE INDEX idx_registrations_status ON attendance.registrations(status);
CREATE INDEX idx_registrations_queue ON attendance.registrations(session_id, queue_position);

-- Comentarios
COMMENT ON TABLE attendance.registrations IS
  'Anuncios de participación de estudiantes en sesiones';

COMMENT ON COLUMN attendance.registrations.queue_position IS
  'Posición en cola de proyección (orden de llegada)';

COMMENT ON COLUMN attendance.registrations.status IS
  'Estado: active, processing, completed, failed';
```

**Campos principales:**
- `registration_id`: PK auto-incremental
- `session_id`: FK a `attendance.sessions`
- `user_id`: Estudiante que se registra
- `device_id`: FK a `enrollment.devices` (nullable)
- `queue_position`: Orden de llegada
- `status`: Estado del procesamiento

**Satisface FN3:**
- PK única (`registration_id`)
- FKs válidas
- UNIQUE constraint evita duplicados
- No dependencias transitivas

---

### Tabla: attendance.validations

Registro de validaciones individuales por ronda (FN3 estricta).

```sql
CREATE TABLE attendance.validations (
  validation_id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES attendance.registrations(registration_id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),

  -- Timestamps
  qr_generated_at TIMESTAMP NOT NULL,
  qr_scanned_at TIMESTAMP,
  response_received_at TIMESTAMP,

  -- Tiempos calculados
  response_time_ms INTEGER CHECK (response_time_ms >= 0),

  -- Validaciones
  totpu_valid BOOLEAN,
  totps_valid BOOLEAN,
  rt_valid BOOLEAN,
  secret_valid BOOLEAN,

  -- Estado
  validation_status TEXT CHECK (validation_status IN ('success', 'failed', 'timeout', 'invalid')),
  failed_attempts INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(registration_id, round_number) -- Una validación por ronda
);

-- Índices
CREATE INDEX idx_validations_registration ON attendance.validations(registration_id);
CREATE INDEX idx_validations_round ON attendance.validations(registration_id, round_number);
CREATE INDEX idx_validations_status ON attendance.validations(validation_status);
CREATE INDEX idx_validations_created_at ON attendance.validations(created_at DESC);

-- Comentarios
COMMENT ON TABLE attendance.validations IS
  'Validaciones individuales por ronda (una fila por ronda)';

COMMENT ON COLUMN attendance.validations.response_time_ms IS
  'Tiempo de respuesta en milisegundos (RT)';

COMMENT ON COLUMN attendance.validations.totpu_valid IS
  'TOTP de usuario válido (true/false)';

COMMENT ON COLUMN attendance.validations.totps_valid IS
  'TOTP de sistema válido (true/false)';
```

**Campos principales:**
- `validation_id`: PK auto-incremental
- `registration_id`: FK a `attendance.registrations`
- `round_number`: Número de ronda (1, 2, 3, ...)
- `response_time_ms`: RT calculado
- Flags de validación (TOTP, RT, secret)
- `validation_status`: Resultado

**Satisface FN3:**
- PK única (`validation_id`)
- FK válida
- UNIQUE constraint (`registration_id`, `round_number`)
- Cada campo depende solo de PK
- No dependencias transitivas

---

### Tabla: attendance.results

Resultado final consolidado por estudiante/sesión.

```sql
CREATE TABLE attendance.results (
  result_id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES attendance.registrations(registration_id) ON DELETE CASCADE,

  -- Estadísticas calculadas
  total_rounds INTEGER NOT NULL CHECK (total_rounds >= 0),
  successful_rounds INTEGER NOT NULL CHECK (successful_rounds >= 0),
  failed_rounds INTEGER NOT NULL DEFAULT 0,

  avg_response_time_ms FLOAT CHECK (avg_response_time_ms >= 0),
  std_dev_response_time FLOAT CHECK (std_dev_response_time >= 0),
  min_response_time_ms FLOAT CHECK (min_response_time_ms >= 0),
  max_response_time_ms FLOAT CHECK (max_response_time_ms >= 0),
  median_response_time_ms FLOAT CHECK (median_response_time_ms >= 0),

  -- Resultado final
  certainty_score FLOAT NOT NULL CHECK (certainty_score BETWEEN 0 AND 100),
  final_status TEXT NOT NULL CHECK (final_status IN ('PRESENT', 'ABSENT', 'DOUBTFUL', 'ERROR')),

  calculated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(registration_id) -- Un resultado por registro
);

-- Índices
CREATE INDEX idx_results_registration ON attendance.results(registration_id);
CREATE INDEX idx_results_status ON attendance.results(final_status);
CREATE INDEX idx_results_certainty ON attendance.results(certainty_score DESC);
CREATE INDEX idx_results_calculated_at ON attendance.results(calculated_at DESC);

-- Comentarios
COMMENT ON TABLE attendance.results IS
  'Resultado final consolidado con estadísticas';

COMMENT ON COLUMN attendance.results.certainty_score IS
  'Umbral de certeza (0-100). >= 70% = PRESENTE';

COMMENT ON COLUMN attendance.results.final_status IS
  'Resultado final: PRESENT, ABSENT, DOUBTFUL, ERROR';
```

**Campos principales:**
- `result_id`: PK auto-incremental
- `registration_id`: FK a `attendance.registrations`
- Estadísticas agregadas (avg, std_dev, min, max, median)
- `certainty_score`: 0-100
- `final_status`: Enum resultado

**Satisface FN3:**
- PK única (`result_id`)
- FK válida
- UNIQUE constraint (un resultado por registro)
- Estadísticas calculadas (no redundancia, se derivan de validations)
- No dependencias transitivas

---

## Relaciones y Constraints

### Diagrama ER

```
enrollment.devices
    ├─── enrollment.enrollment_history (FK: device_id)
    └─── attendance.registrations (FK: device_id)

attendance.sessions
    └─── attendance.registrations (FK: session_id)
             ├─── attendance.validations (FK: registration_id)
             └─── attendance.results (FK: registration_id)
```

### Foreign Keys

```sql
-- Enrollment
ALTER TABLE enrollment.enrollment_history
  ADD CONSTRAINT fk_history_devices
  FOREIGN KEY (device_id) REFERENCES enrollment.devices(device_id) ON DELETE SET NULL;

-- Attendance
ALTER TABLE attendance.registrations
  ADD CONSTRAINT fk_registrations_sessions
  FOREIGN KEY (session_id) REFERENCES attendance.sessions(session_id) ON DELETE CASCADE;

ALTER TABLE attendance.registrations
  ADD CONSTRAINT fk_registrations_devices
  FOREIGN KEY (device_id) REFERENCES enrollment.devices(device_id) ON DELETE SET NULL;

ALTER TABLE attendance.validations
  ADD CONSTRAINT fk_validations_registrations
  FOREIGN KEY (registration_id) REFERENCES attendance.registrations(registration_id) ON DELETE CASCADE;

ALTER TABLE attendance.results
  ADD CONSTRAINT fk_results_registrations
  FOREIGN KEY (registration_id) REFERENCES attendance.registrations(registration_id) ON DELETE CASCADE;
```

---

## Queries Comunes

### 1. Verificar dispositivo enrolado

```sql
SELECT device_id, credential_id, aaguid, enrolled_at
FROM enrollment.devices
WHERE user_id = 123 AND is_active = TRUE;
```

### 2. Registrar participación

```sql
INSERT INTO attendance.registrations (session_id, user_id, device_id, queue_position)
VALUES (456, 123, 789, (
  SELECT COALESCE(MAX(queue_position), 0) + 1
  FROM attendance.registrations
  WHERE session_id = 456
));
```

### 3. Guardar validación de ronda

```sql
INSERT INTO attendance.validations (
  registration_id, round_number, qr_generated_at, qr_scanned_at,
  response_received_at, response_time_ms, totpu_valid, totps_valid,
  rt_valid, secret_valid, validation_status
) VALUES (
  10, 1, '2025-11-04 10:00:00', '2025-11-04 10:00:01',
  '2025-11-04 10:00:01.200', 1200, TRUE, TRUE, TRUE, TRUE, 'success'
);
```

### 4. Calcular resultado final

```sql
-- Obtener todas las validaciones de un registro
SELECT
  COUNT(*) AS total_rounds,
  COUNT(CASE WHEN validation_status = 'success' THEN 1 END) AS successful_rounds,
  AVG(response_time_ms) AS avg_rt,
  STDDEV(response_time_ms) AS std_dev_rt,
  MIN(response_time_ms) AS min_rt,
  MAX(response_time_ms) AS max_rt,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms) AS median_rt
FROM attendance.validations
WHERE registration_id = 10
  AND validation_status = 'success';

-- Insertar resultado
INSERT INTO attendance.results (
  registration_id, total_rounds, successful_rounds,
  avg_response_time_ms, std_dev_response_time,
  min_response_time_ms, max_response_time_ms, median_response_time_ms,
  certainty_score, final_status
) VALUES (
  10, 3, 3,
  1216.67, 76.38, 1150.0, 1300.0, 1200.0,
  95.0, 'PRESENT'
);
```

### 5. Reporte de asistencia por sesión

```sql
SELECT
  s.session_id,
  s.course_name,
  s.start_time,
  COUNT(DISTINCT r.registration_id) AS total_students,
  COUNT(DISTINCT CASE WHEN res.final_status = 'PRESENT' THEN r.registration_id END) AS present,
  COUNT(DISTINCT CASE WHEN res.final_status = 'ABSENT' THEN r.registration_id END) AS absent,
  AVG(res.certainty_score) AS avg_certainty
FROM attendance.sessions s
LEFT JOIN attendance.registrations r ON r.session_id = s.session_id
LEFT JOIN attendance.results res ON res.registration_id = r.registration_id
WHERE s.session_id = 456
GROUP BY s.session_id, s.course_name, s.start_time;
```

---

## Ventajas de este Esquema FN3

### 1. Simplicidad vs JSONB

```sql
-- Con JSONB (complejo):
SELECT jsonb_array_elements(round_times::jsonb)::int AS rt
FROM attendance.records
WHERE user_id = 123;

-- Con FN3 (simple):
SELECT response_time_ms AS rt
FROM attendance.validations v
JOIN attendance.registrations r ON r.registration_id = v.registration_id
WHERE r.user_id = 123;
```

### 2. Performance con Índices

```sql
-- Índices funcionan correctamente en FN3:
EXPLAIN SELECT * FROM attendance.validations
WHERE registration_id = 10 AND round_number = 2;
-- → Index Scan using idx_validations_round

-- Índices en JSONB son menos eficientes:
EXPLAIN SELECT * FROM attendance.records
WHERE round_times @> '[1200]'::jsonb;
-- → Seq Scan (más lento)
```

### 3. Integridad Referencial

```sql
-- FN3 garantiza integridad:
DELETE FROM attendance.registrations WHERE registration_id = 10;
-- → CASCADE automático: elimina validations y results

-- JSONB no tiene integridad:
-- Si eliminas registro, los datos JSONB quedan huérfanos
```

### 4. Queries Agregadas

```sql
-- FN3: Agregaciones nativas SQL
SELECT
  registration_id,
  AVG(response_time_ms),
  STDDEV(response_time_ms)
FROM attendance.validations
GROUP BY registration_id;

-- JSONB: Requiere funciones complejas
SELECT
  user_id,
  AVG((jsonb_array_elements(round_times::jsonb))::int)
FROM attendance.records
GROUP BY user_id;
```

---

## Migración desde Esquema Anterior

Si existiera un esquema previo con JSONB:

```sql
-- Paso 1: Crear nuevas tablas (DDL arriba)

-- Paso 2: Migrar datos
INSERT INTO attendance.validations (
  registration_id, round_number, response_time_ms, validation_status
)
SELECT
  r.registration_id,
  ROW_NUMBER() OVER (PARTITION BY r.registration_id) AS round_number,
  (jsonb_array_elements_text(old.round_times::jsonb))::int AS response_time_ms,
  'success' AS validation_status
FROM old_attendance_records old
JOIN attendance.registrations r ON r.user_id = old.user_id;

-- Paso 3: Verificar
SELECT COUNT(*) FROM attendance.validations;

-- Paso 4: Drop tabla antigua
DROP TABLE old_attendance_records;
```

---

## Comparación Final

| Aspecto | JSONB | FN3 | FN4 |
|---------|-------|-----|-----|
| Simplicidad Queries | ✗ Bajo | ✓ Alto | ~ Medio |
| Performance Índices | ✗ Bajo | ✓ Alto | ✓ Alto |
| Integridad Referencial | ✗ No | ✓ Sí | ✓ Sí |
| Número de Tablas | 1-2 | 4 | 5-6 |
| Complejidad JOINs | ✓ Bajo | ~ Medio | ✗ Alto |
| Flexibilidad Esquema | ✓ Alta | ~ Media | ✗ Baja |
| Mantenibilidad | ~ Media | ✓ Alta | ~ Media |

**Recomendación:** FN3 es el balance óptimo para este proyecto.

---

**Versión:** 2.0 (FN3)
**Fecha:** 2025-11-04
**Estado:** Especificación Técnica Oficial
