# Arquitectura del Sistema de Asistencia

**Última actualización:** 2026-01-03

## Resumen

Sistema de asistencia basado en QR criptográficos con arquitectura de Vertical Slices. Opera como módulo independiente integrado al sistema legacy Hawaii mediante JWT.

**Principios arquitectónicos:**

- Desacoplamiento estricto (SoC)
- Cohesión interna por módulo
- Idempotencia de transacciones
- Invariante 1:1 (Una Cuenta ↔ Un Dispositivo)

---

## Definición Arquitectónica

### Relación con Sistema Base

El módulo funciona como "Caja Negra" funcional:

- NO gestiona usuarios ni roles
- Identidad inyectada desde sistema base PHP
- Autenticación delegada al legacy

### Stack Tecnológico

| Componente      | Tecnología           | Propósito                     |
| --------------- | -------------------- | ----------------------------- |
| Frontend Legacy | PHP 7.4 + Apache     | Punto de entrada, emisión JWT |
| Backend         | Node.js 20 + Fastify | Lógica de negocio, WebSocket  |
| Base de Datos   | PostgreSQL 18        | Persistencia                  |
| Cache           | Valkey 7             | Sesiones y estado temporal    |

---

## Arquitectura de Contenedores

5 contenedores orquestados con Podman Compose:

### asistencia-php (JWT Bridge Service)

**Propósito:** Emisión de tokens JWT para usuarios autenticados

**Responsabilidades:**

- Validar sesión PHP legacy (cookie PHPSESSID)
- Generar tokens JWT firmados
- Rate limiting (10 req/min por IP)
- CORS para dominios permitidos

**Stack:**

- Rocky Linux 9
- PHP 7.4
- Redis para rate limiting

**Puerto:**

- Desarrollo y Producción: 9001

**Endpoint:**

- `GET /` - Genera JWT para usuario con sesión activa

**Respuesta:**

```json
{
  "success": true,
  "token": "eyJhbGci...",
  "expiresIn": 300,
  "userId": 123456,
  "username": "usuario@ucn.cl"
}
```

**Recursos (Producción):**

- CPU: 0.5 core
- RAM: 256MB

### asistencia-legacy-php

**Propósito:** Frontend legacy y proxy inverso

**Responsabilidades:**

- Servir aplicación PHP Hawaii existente
- Reverse proxy hacia node-service vía Apache
- Proxy WebSocket (`/asistencia/ws` → node-service)
- Proxy API (`/asistencia/*` → node-service)

**Stack:**

- Rocky Linux 9
- PHP 7.4 + mod_php (MPM prefork)
- Apache 2.4 con mod_proxy, mod_proxy_wstunnel, mod_rewrite
- SSL autofirmado

**Puertos:**

- Desarrollo: 9500 (HTTP), 9505 (HTTPS)
- Producción: Solo interno, expuesto vía Apache host

**Recursos (Producción):**

- CPU: 1 core
- RAM: 512MB

### asistencia-node

**Propósito:** Backend modular con WebSocket y API REST

**Responsabilidades:**

- Validar tokens JWT emitidos por PHP
- Proyección QR vía WebSocket
- API enrollment FIDO2
- Servir frontend compilado (Vite)

**Stack:**

- Node.js 20 LTS (Alpine)
- Fastify + @fastify/websocket
- TypeScript compilado
- Vite para frontend
- ioredis para Valkey

**Arquitectura interna:**

- Monolito modular con vertical slicing
- Capas: presentation, application, domain, infrastructure
- Dependency Injection manual

**Build multi-stage:**

1. builder: Compila TypeScript y Vite
2. production: Solo dist + deps producción
3. development: Hot reload con tsx watch

**Puertos:**

- Desarrollo: 9503, 9504 (expuestos)
- Producción: 3000 (interno, no expuesto)

**Recursos (Producción):**

- CPU: 1 core
- RAM: 512MB

### asistencia-postgres

**Propósito:** Persistencia de datos

**Schemas:**

- `enrollment`: Dispositivos FIDO2 enrolados
- `attendance`: Sesiones de asistencia y validaciones

**Stack:**

- PostgreSQL 18 Alpine
- Migraciones automáticas al iniciar

**Puertos:**

- Desarrollo: 9501 (expuesto)
- Producción: 5432 (interno)

**Recursos (Producción):**

- CPU: 1 core
- RAM: 512MB

**Volumen:** `pgdata` persistente

### asistencia-valkey

**Propósito:** Cache y estado temporal

**Uso:**

- Sesiones criptográficas (`session:userId:{id}`)
- Estado de estudiantes en sesión
- Pool de QRs de proyección

**Stack:**

- Valkey 7 Alpine (fork Redis)

**Puertos:**

- Desarrollo: 9502 (expuesto)
- Producción: 6379 (interno)

**Recursos (Producción):**

- CPU: 1 core
- RAM: 256MB

---

## Integración con Sistema Legacy

### Autenticación Legacy

Sistema Hawaii usa Google OAuth 2.0:

1. Usuario accede a `/hawaii/`
2. Si no hay sesión, redirige a Google OAuth
3. Callback con code, intercambio por access_token
4. GET `/oauth2/v3/userinfo` obtiene email
5. Busca en BD: tabla `profesor` o `alumno`
6. Guarda sesión PHP

**Estructura sesión PHP:**

```php
$_SESSION['id']   // int: ID profesor, o -1 si alumno
$_SESSION['user'] // string: email (profesor) o RUT (alumno)
$_SESSION['root'] // bool: superadministrador
```

**Distinción profesor vs alumno:**

```php
if ($_SESSION['id'] == -1) {
    // Alumno - $_SESSION['user'] contiene RUT
} else {
    // Profesor - $_SESSION['user'] contiene email
}
```

### Inyección de Identidad

**Flujo JWT Bridge Service:**

1. Usuario autenticado en Hawaii tiene cookie PHPSESSID
2. Frontend en iframe hace fetch a JWT Bridge Service (puerto 9001)
3. Cookie PHPSESSID se envía automáticamente (same-origin)
4. JWT Bridge valida sesión PHP y genera token firmado
5. Frontend recibe JWT y lo almacena
6. JWT usado en header `Authorization: Bearer <token>` para requests

**JWT Bridge Service:**

Endpoint: `GET http://localhost:9001/`

Request:

```bash
curl -b "PHPSESSID=abc123..." http://localhost:9001/
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGci...",
  "expiresIn": 300,
  "userId": 123456,
  "username": "usuario@ucn.cl"
}
```

Claims JWT:

- `userId`: ID de usuario (BIGINT)
- `username`: Email (profesor) o RUT (alumno)
- `rol`: "profesor" o "alumno"
- `iat`: Timestamp emisión
- `exp`: Timestamp expiración (5 minutos)
- `jti`: ID único del token

**Transport:** JWT nunca en URL, solo en header `Authorization: Bearer <token>`

### Tipos de Datos por Entidad

**Tabla asistencia_curso:**

| Campo             | Tipo PostgreSQL | Ejemplo               |
| ----------------- | --------------- | --------------------- |
| id                | SERIAL          | 12345                 |
| curso             | integer (FK)    | 429                   |
| semestre          | integer (FK)    | 5                     |
| fecha             | integer         | 20250401              |
| bloque            | integer (FK)    | 1                     |
| codigo            | text            | "CVYAFO"              |
| fechahora_inicio  | timestamp       | "2025-04-01 08:00:00" |
| fechahora_termino | timestamp       | "2025-04-01 08:05:00" |
| usuario           | text            | "profesor@ucn.cl"     |
| tipo              | integer         | 1                     |

**Funciones legacy disponibles:**

```php
get_def_curso($idCurso)        // Retorna datos del curso
get_def_bloque($nombreBloque)  // Retorna horario del bloque
get_def_profesor($email)       // Retorna datos del profesor
get_def_semestre($idSemestre)  // Retorna datos del semestre
```

---

## Conceptos Arquitectónicos

### Control de Acceso (Access Gateway)

Barrera de entrada lógica que determina capacidad operativa del usuario.

**Input:** JWT (Identidad) + Device Fingerprint (Hardware)

**Mecanismo:** Cliente consulta estado (`GET /state`). Gateway valida política 1:1 contrastando identidad con hardware en BD.

**Estados deterministas:**

- `NOT_ENROLLED`: Usuario nuevo o dispositivo no reconocido
- `ENROLLED_NO_SESSION`: Vinculación correcta, requiere handshake
- `READY`: Sesión activa, listo para operar
- `BLOCKED`: Restricción activa

### Subsistema de Enrolamiento

Gestiona vinculación física mediante FIDO2. Implementado como Autómata Finito.

**Resolución de conflictos (cambio de dispositivo):**

1. Revocación Universal: Elimina TODOS los vínculos previos de `userId` y `fingerprint`
2. Vinculación: Crea nexo exclusivo `userId` ↔ `credentialId`
3. Persistencia: Operación atómica, sin estados intermedios

**Capas de protección anti-compartir:**

| Capa                       | Mecanismo                             | Protección                                           |
| -------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Platform Authenticator     | `authenticatorAttachment: 'platform'` | Solo autenticadores integrados (TPM, Secure Enclave) |
| Non-Syncable Credential    | `residentKey: 'discouraged'`          | Evita sincronización vía iCloud/Google               |
| Device Fingerprint Binding | `deviceFingerprint` en BD             | Valida coincidencia navegador/dispositivo            |

**Implicación:** Un estudiante NO puede:

- Usar llave USB (bloqueado capa 1)
- Compartir credencial sincronizada (bloqueado capa 2)
- Iniciar sesión desde otro dispositivo (bloqueado capa 3)

### Gestión de Sesión Criptográfica

Transforma validación de identidad en capacidad operativa mediante criptografía efímera.

**Flujo de Login:**

1. **FIDO2/WebAuthn:**

   - Cliente prueba posesión de `privateKey`
   - Servidor valida con `publicKey` almacenada
   - `privateKey` NUNCA sale del Secure Enclave

2. **Handshake ECDH:**

   - Cliente y servidor generan pares efímeros
   - Intercambian llaves públicas
   - Ambos calculan: `shared_secret = ECDH(privKey_local, pubKey_remoto)`

3. **Derivación de Clave:**

   - Ambos derivan: `session_key = HKDF-SHA256(shared_secret)`
   - `session_key` NUNCA se transmite por red
   - Garantiza Perfect Forward Secrecy (PFS)

4. **Destrucción de Efímeros:**
   - Claves privadas ECDH se destruyen inmediatamente
   - Compromiso futuro no afecta sesiones pasadas

**Persistencia en Valkey:**

```
key: session:userId:{userId}
value: {
  sessionKey: Buffer,
  userId: number,
  deviceId: number,  // Vinculación 1:1
  createdAt: timestamp
}
TTL: 2 horas
```

**TOTPu (Time-based OTP del Usuario):**

- Derivación: `TOTPu = TOTP(session_key)` RFC 6238
- Validación temporal anti-replay (ventana ±30 segundos)
- Cambia por sesión (mayor seguridad que TOTP estático)

### Registro en Sesión de Clase

Antes de escanear QRs, estudiante se registra en sesión activa.

**Flujo:**

1. Cliente verifica estado `READY` (`GET /api/access/state`)
2. `POST /api/attendance/register {sessionId, studentId}`
3. Validaciones servidor:
   - Sesión existe y está activa
   - Usuario no registrado previamente
   - Cumple requisitos académicos
4. Inicialización:
   - Crea `StudentState` en Valkey con progreso
   - Genera QR inicial `round: 1` cifrado con `session_key`
   - Agrega QR al pool de proyección
5. Response: `{success: true, expectedRound: 1, qrPayload: <encrypted>}`

**Post-Registro:**

- QR entra en rotación con proyector
- Pool Balancer mantiene mínimo 10 QRs (rellena con señuelos)

**Invariante:** Sin registro, estudiante NO tiene QRs en pool.

### Proyección de QR (Host Slice)

Generación y emisión de credenciales ópticas. Proyección continua sin sincronización con lectores.

**Características:**

- QRs cambian cada ~333ms
- Pool contiene QRs reales + señuelos (fakes)
- Cifrado dedicado por estudiante con `session_key`
- Pool Balancer mantiene ratio real/fake

---

## Flujos Operacionales

### Flujo Profesor

1. Login en Hawaii (Google OAuth)
2. Accede a curso
3. Crea sesión de asistencia:
   - Genera código reserva (ej: "CVYAFO")
   - Registra en `asistencia_curso`
   - Define `fechahora_inicio` y `fechahora_termino`
4. Click "Proyectar QR":
   - PHP emite JWT con contexto de sesión
   - Abre modal con iframe
   - Frontend recibe JWT vía `postMessage`
   - WebSocket conecta a proyector
   - QRs rotan cada 333ms

### Flujo Alumno

1. Login en Hawaii (Google OAuth)
2. Verifica estado dispositivo (`GET /state`)
3. Si `NOT_ENROLLED`: Enrollment FIDO2
4. Si `ENROLLED_NO_SESSION`: Login ECDH
5. Estado `READY`: Click "Tomar Asistencia"
6. PHP emite JWT
7. Abre modal con iframe, recibe JWT
8. Registra en sesión de clase (`POST /register`)
9. Abre lector cámara
10. Escanea QR con su `round` actual
11. Envía QR cifrado al servidor
12. Pipeline de validación (12 stages)
13. Si válido: Avanza round o completa asistencia
14. Redirige a encuesta legacy (comentarios_clase)

---

## Datos Disponibles por Contexto

### Profesor (al crear sesión)

Datos previos:

- `idCurso`, `idSemestre`, `fecha`, `bloque`, `tipo` (GET params)
- `usuario` (`$_SESSION['user']`)

Datos posteriores:

- `id` (lastInsertId)
- `codigo` (gen_cod_reserva)

### Alumno (al marcar asistencia)

Datos directos:

- Código QR escaneado
- RUT (`$_SESSION['user']`)

Datos desde código QR (query BD):

- `id`, `curso`, `semestre`, `fecha`, `bloque`, `usuario`, `tipo`
- `fechahora_inicio`, `fechahora_termino`

---

## Referencias

- [PLAN_IMPLEMENTACION_ENERO_2025.md](../../implementacion-final/PLAN_IMPLEMENTACION_ENERO_2025.md)
- [ARQUITECTURA_PENDIENTE.md](../../implementacion-final/ARQUITECTURA_PENDIENTE.md)
- Módulos: [auth.md](../modulos/auth.md), [attendance.md](../modulos/attendance.md), [qr-projection.md](../modulos/qr-projection.md)
