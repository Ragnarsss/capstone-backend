# Estándar de Nomenclatura - Sistema Asistencia Criptográfica

**Fecha:** 2025-11-04
**Versión:** 1.0
**Aplicación:** Obligatoria para todo el código

---

## Principios Generales

1. **Código técnico:** SIEMPRE en inglés
2. **Documentación de usuario:** Español
3. **Comentarios técnicos:** Inglés
4. **Consistencia:** Mismo patrón en todo el proyecto
5. **Claridad:** Nombres descriptivos sobre nombres cortos

---

## Bases de Datos (PostgreSQL)

### Schemas

```sql
-- Formato: snake_case, singular
CREATE SCHEMA enrollment;    -- ✓ CORRECTO
CREATE SCHEMA attendance;    -- ✓ CORRECTO

CREATE SCHEMA Enrollment;    -- ✗ INCORRECTO (PascalCase)
CREATE SCHEMA enrollments;   -- ✗ INCORRECTO (plural)
```

**Regla:** `snake_case`, singular, inglés

---

### Tablas

```sql
-- Formato: schema.nombre_tabla (snake_case, plural)
CREATE TABLE enrollment.devices;              -- ✓ CORRECTO
CREATE TABLE enrollment.enrollment_history;   -- ✓ CORRECTO
CREATE TABLE attendance.sessions;             -- ✓ CORRECTO
CREATE TABLE attendance.registrations;        -- ✓ CORRECTO
CREATE TABLE attendance.validations;          -- ✓ CORRECTO
CREATE TABLE attendance.results;              -- ✓ CORRECTO

CREATE TABLE enrollment.Device;               -- ✗ INCORRECTO (PascalCase)
CREATE TABLE enrollment.device;               -- ✗ INCORRECTO (singular)
CREATE TABLE EnrollmentDevices;               -- ✗ INCORRECTO (sin schema)
```

**Regla:** `schema.table_name`, `snake_case`, plural, inglés

---

### Columnas

```sql
-- Formato: snake_case
CREATE TABLE enrollment.devices (
  device_id SERIAL PRIMARY KEY,        -- ✓ CORRECTO
  user_id INTEGER NOT NULL,            -- ✓ CORRECTO
  credential_id TEXT UNIQUE,           -- ✓ CORRECTO
  public_key TEXT NOT NULL,            -- ✓ CORRECTO
  handshake_secret TEXT NOT NULL,      -- ✓ CORRECTO
  enrolled_at TIMESTAMP DEFAULT NOW(), -- ✓ CORRECTO
  last_used_at TIMESTAMP,              -- ✓ CORRECTO
  is_active BOOLEAN DEFAULT TRUE       -- ✓ CORRECTO
);

-- INCORRECTO:
deviceId SERIAL,                       -- ✗ camelCase
DeviceID SERIAL,                       -- ✗ PascalCase
DEVICE_ID SERIAL,                      -- ✗ SCREAMING_SNAKE_CASE
```

**Regla:** `snake_case`, descriptivo, inglés

---

### Índices

```sql
-- Formato: idx_{tabla}_{columnas}
CREATE INDEX idx_devices_user_id ON enrollment.devices(user_id);
CREATE INDEX idx_devices_credential_id ON enrollment.devices(credential_id);
CREATE INDEX idx_sessions_professor_id ON attendance.sessions(professor_id);
CREATE INDEX idx_validations_registration ON attendance.validations(registration_id);

-- INCORRECTO:
CREATE INDEX devices_user_id_index;    -- ✗ sin prefijo idx_
CREATE INDEX user_id_idx;              -- ✗ no especifica tabla
CREATE INDEX IDX_DEVICES_USER_ID;      -- ✗ mayúsculas
```

**Regla:** `idx_{table}_{column(s)}`, `snake_case`, inglés

---

### Constraints

```sql
-- Primary Keys: pk_{tabla}
ALTER TABLE enrollment.devices ADD CONSTRAINT pk_devices PRIMARY KEY (device_id);

-- Foreign Keys: fk_{tabla_origen}_{tabla_destino}
ALTER TABLE attendance.registrations
  ADD CONSTRAINT fk_registrations_sessions
  FOREIGN KEY (session_id) REFERENCES attendance.sessions(session_id);

-- Unique: uq_{tabla}_{columnas}
ALTER TABLE enrollment.devices
  ADD CONSTRAINT uq_devices_credential_id
  UNIQUE (credential_id);

-- Check: chk_{tabla}_{descripcion}
ALTER TABLE attendance.results
  ADD CONSTRAINT chk_results_certainty
  CHECK (certainty_score BETWEEN 0 AND 100);
```

**Regla:** Prefijos estándar (`pk_`, `fk_`, `uq_`, `chk_`), `snake_case`, inglés

---

## TypeScript/JavaScript

### Archivos

```bash
# Formato: kebab-case
device.entity.ts                     # ✓ CORRECTO
attendance-session.entity.ts         # ✓ CORRECTO
certainty-calculator.service.ts      # ✓ CORRECTO
validate-round.usecase.ts            # ✓ CORRECTO

Device.entity.ts                     # ✗ INCORRECTO (PascalCase)
attendanceSession.entity.ts          # ✗ INCORRECTO (camelCase)
CertaintyCalculator.service.ts       # ✗ INCORRECTO (PascalCase)
```

**Regla:** `kebab-case`, descriptivo, sufijo tipo (`.entity`, `.service`, `.dto`), inglés

---

### Clases

```typescript
// Formato: PascalCase
class Device { }                      // ✓ CORRECTO
class AttendanceSession { }           // ✓ CORRECTO
class CertaintyCalculator { }         // ✓ CORRECTO
class ValidateRoundUseCase { }        // ✓ CORRECTO

class device { }                      // ✗ INCORRECTO (camelCase)
class attendanceSession { }           // ✗ INCORRECTO (camelCase)
class certainty_calculator { }        // ✗ INCORRECTO (snake_case)
```

**Regla:** `PascalCase`, sustantivo descriptivo, inglés

---

### Interfaces

```typescript
// Formato: PascalCase, prefijo "I" opcional
interface AuthenticatedUser { }      // ✓ CORRECTO
interface IAuthenticatedUser { }     // ✓ CORRECTO (con prefijo)
interface RegisterDTO { }             // ✓ CORRECTO
interface QRPayload { }               // ✓ CORRECTO

interface authenticatedUser { }      // ✗ INCORRECTO (camelCase)
interface IAuthenticateduser { }     // ✗ INCORRECTO (inconsistente)
```

**Regla:** `PascalCase`, prefijo `I` opcional pero consistente, inglés

---

### Variables y Constantes

```typescript
// Variables: camelCase
const userId = 123;                   // ✓ CORRECTO
const sessionKey = deriveKey();       // ✓ CORRECTO
const responseTime = calculateRT();   // ✓ CORRECTO

const user_id = 123;                  // ✗ INCORRECTO (snake_case)
const UserId = 123;                   // ✗ INCORRECTO (PascalCase)

// Constantes globales: SCREAMING_SNAKE_CASE
const MAX_ROUNDS = 3;                 // ✓ CORRECTO
const JWT_SECRET = process.env.JWT;   // ✓ CORRECTO
const TOTP_WINDOW = 30;               // ✓ CORRECTO

const maxRounds = 3;                  // ✗ INCORRECTO (camelCase para const global)
const Max_Rounds = 3;                 // ✗ INCORRECTO (PascalCase mezclado)
```

**Regla:** Variables `camelCase`, constantes globales `SCREAMING_SNAKE_CASE`, inglés

---

### Funciones y Métodos

```typescript
// Formato: camelCase, verbos
function calculateCertainty() { }     // ✓ CORRECTO
function validateTOTP() { }           // ✓ CORRECTO
async function deriveSessionKey() { } // ✓ CORRECTO

function CalculateCertainty() { }     // ✗ INCORRECTO (PascalCase)
function calculate_certainty() { }    // ✗ INCORRECTO (snake_case)
function certainty() { }              // ✗ INCORRECTO (sustantivo, no verbo)
```

**Regla:** `camelCase`, verbo + sustantivo, inglés

---

### Enums

```typescript
// Formato: PascalCase para tipo, SCREAMING_SNAKE_CASE para valores
enum AttendanceStatus {
  PRESENT = 'PRESENT',                // ✓ CORRECTO
  ABSENT = 'ABSENT',                  // ✓ CORRECTO
  DOUBTFUL = 'DOUBTFUL',              // ✓ CORRECTO
  ERROR = 'ERROR'                     // ✓ CORRECTO
}

enum AttendanceStatus {
  Present = 'PRESENT',                // ✗ INCORRECTO (PascalCase en valor)
  absent = 'absent',                  // ✗ INCORRECTO (lowercase)
}
```

**Regla:** Tipo `PascalCase`, valores `SCREAMING_SNAKE_CASE`, inglés

---

## Directorios

```bash
# Formato: kebab-case
node-service/src/modules/attendance/       # ✓ CORRECTO
node-service/src/modules/enrollment/       # ✓ CORRECTO
node-service/src/shared/config/            # ✓ CORRECTO
database/migrations/                       # ✓ CORRECTO

node-service/src/Modules/Attendance/       # ✗ INCORRECTO (PascalCase)
node-service/src/modules/Enrollment/       # ✗ INCORRECTO (PascalCase)
node-service/src/shared_config/            # ✗ INCORRECTO (snake_case)
```

**Regla:** `kebab-case` o `lowercase`, plural cuando aplica, inglés

---

## Rutas HTTP

```typescript
// Formato: kebab-case, lowercase
app.post('/attendance/register');          // ✓ CORRECTO
app.post('/attendance/validate');          // ✓ CORRECTO
app.get('/enrollment/status');             // ✓ CORRECTO
app.post('/enrollment/start');             // ✓ CORRECTO

app.post('/Attendance/Register');          // ✗ INCORRECTO (PascalCase)
app.post('/attendance_register');          // ✗ INCORRECTO (snake_case)
app.post('/attendanceRegister');           // ✗ INCORRECTO (camelCase)
```

**Regla:** `kebab-case`, lowercase, RESTful, inglés

---

## WebSocket Mensajes

```typescript
// Formato: kebab-case para type
interface MessageDTO {
  type: 'auth-ok' | 'qr-update' | 'countdown';  // ✓ CORRECTO
  payload: any;
}

interface MessageDTO {
  type: 'AuthOk' | 'QRUpdate' | 'CountDown';    // ✗ INCORRECTO (PascalCase)
  type: 'auth_ok' | 'qr_update';                // ✗ INCORRECTO (snake_case)
}
```

**Regla:** `kebab-case`, descriptivo, inglés

---

## Comentarios

### Comentarios de Código (Inglés)

```typescript
// ✓ CORRECTO
// Derive session key using HKDF
const sessionKey = await deriveKey(sharedSecret);

// Validate TOTP with 30s window
if (!validateTOTP(token, secret, 30)) {
  throw new Error('Invalid TOTP');
}

// ✗ INCORRECTO (español en código)
// Derivar clave de sesión usando HKDF
const sessionKey = await deriveKey(sharedSecret);
```

**Regla:** Inglés técnico en comentarios de código

---

### Documentación JSDoc (Inglés)

```typescript
/**
 * Calculate certainty score based on response times
 *
 * @param responseTimes - Array of response times in milliseconds
 * @returns Certainty score (0-100)
 */
function calculateCertainty(responseTimes: number[]): number {
  // implementation
}
```

**Regla:** JSDoc completo en inglés

---

### Comentarios Usuario (Español)

```typescript
// Para mensajes mostrados al usuario:
throw new Error('Dispositivo no enrolado'); // ✓ CORRECTO (mensaje usuario)
console.log('Sesión iniciada correctamente'); // ✓ CORRECTO (log usuario)

// Pero código interno en inglés:
if (!isEnrolled) { // ✓ CORRECTO (lógica interna)
  throw new Error('Device not enrolled');
}
```

**Regla:** Mensajes de usuario en español, lógica interna en inglés

---

## Git

### Branches

```bash
# Formato: tipo/PART{X}-T{Y}.{Z}.{W}-descripcion-breve
git checkout -b feature/PART1-T1.1.1-create-schema
git checkout -b fix/PART2-T2.3.5-encryption-bug
git checkout -b docs/PART4-T4.8.1-readme-guest

# INCORRECTO:
git checkout -b Feature/part1-t1.1.1           # ✗ PascalCase
git checkout -b PART1_T1.1.1                   # ✗ sin tipo
git checkout -b part1-crear-schema             # ✗ sin código tarea
```

**Regla:** `tipo/PART{X}-T{Y}.{Z}.{W}-descripcion`, `kebab-case`, inglés

---

### Commits

```bash
# Formato: PART{X}-T{Y}.{Z}.{W}: Descripcion concisa

git commit -m "PART1-T1.1.1: Create initial schema file"
git commit -m "PART2-T2.3.5: Implement AES-256-GCM encryption service"
git commit -m "PART4-T4.2.3: Integrate navigator.credentials.create()"

# INCORRECTO:
git commit -m "create schema"                  # ✗ sin código tarea
git commit -m "part1-t1.1.1: crear schema"    # ✗ lowercase + español
git commit -m "PART1-T1.1.1 Create schema"    # ✗ sin dos puntos
```

**Regla:** `PART{X}-T{Y}.{Z}.{W}: Descripción`, inglés, imperativo

---

## Variables de Entorno

```bash
# Formato: SCREAMING_SNAKE_CASE
JWT_SECRET=secret123                  # ✓ CORRECTO
DB_HOST=localhost                     # ✓ CORRECTO
POSTGRES_USER=asistencia             # ✓ CORRECTO
SERVER_MASTER_SECRET=secret456        # ✓ CORRECTO

jwtSecret=secret123                   # ✗ INCORRECTO (camelCase)
Jwt-Secret=secret123                  # ✗ INCORRECTO (kebab-case)
jwt_secret=secret123                  # ✗ INCORRECTO (lowercase)
```

**Regla:** `SCREAMING_SNAKE_CASE`, descriptivo, inglés

---

## Resumen por Contexto

| Contexto | Convención | Ejemplo |
|----------|------------|---------|
| **PostgreSQL Schemas** | `snake_case` singular | `enrollment`, `attendance` |
| **PostgreSQL Tables** | `snake_case` plural | `devices`, `sessions` |
| **PostgreSQL Columns** | `snake_case` | `user_id`, `created_at` |
| **PostgreSQL Indices** | `idx_{table}_{columns}` | `idx_devices_user_id` |
| **Archivos TS/JS** | `kebab-case` | `device.entity.ts` |
| **Clases** | `PascalCase` | `Device`, `AttendanceSession` |
| **Interfaces** | `PascalCase` | `AuthenticatedUser` |
| **Variables** | `camelCase` | `userId`, `sessionKey` |
| **Constantes** | `SCREAMING_SNAKE_CASE` | `MAX_ROUNDS`, `JWT_SECRET` |
| **Funciones** | `camelCase` verbo | `calculateCertainty()` |
| **Enums** | `PascalCase` / `SCREAMING_SNAKE_CASE` | `AttendanceStatus.PRESENT` |
| **Directorios** | `kebab-case` | `attendance/`, `enrollment/` |
| **Rutas HTTP** | `kebab-case` lowercase | `/attendance/register` |
| **WebSocket Types** | `kebab-case` | `auth-ok`, `qr-update` |
| **Git Branches** | `tipo/codigo-tarea-desc` | `feature/PART1-T1.1.1-schema` |
| **Git Commits** | `CODIGO: Descripcion` | `PART1-T1.1.1: Create schema` |
| **Variables Entorno** | `SCREAMING_SNAKE_CASE` | `JWT_SECRET`, `DB_HOST` |

---

## Idiomas

### Código (Inglés)

- Variables, funciones, clases
- Comentarios técnicos
- Nombres de archivos
- Rutas HTTP
- Documentación JSDoc

### Usuario (Español)

- Mensajes de error visibles
- Logs informativos de usuario
- Documentación README para usuarios finales
- Comentarios de alto nivel en docs

---

## Validación

### Herramientas

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit"
  },
  "eslintConfig": {
    "rules": {
      "camelcase": ["error", { "properties": "never" }],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          "selector": "class",
          "format": ["PascalCase"]
        },
        {
          "selector": "interface",
          "format": ["PascalCase"]
        },
        {
          "selector": "variable",
          "format": ["camelCase", "UPPER_CASE"]
        }
      ]
    }
  }
}
```

---

**Última actualización:** 2025-11-04
**Aplicable a:** Todo el proyecto
**Obligatorio:** Sí
