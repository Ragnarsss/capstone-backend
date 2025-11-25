# Separación de Flujos por Rol (Anfitrión vs Invitado)

**Version:** 2.0
**Fecha:** 2025-11-03
**Estado:** Documento de Arquitectura - Actualizado segun implementacion real

---

## Resumen Ejecutivo

Este documento describe la separación entre dos tipos de usuarios en el sistema:

1. **Anfitrión (Profesor/Docente)**: Proyecta códigos QR para toma de asistencia
2. **Invitado (Estudiante/Alumno)**: Escanea QR y registra asistencia

[WIP] **ARQUITECTURA REAL IMPLEMENTADA:**

- **Separación por Entry Points:** El sistema legacy PHP tiene diferentes botones/URLs que enrutan directamente a cada modo (no detección de rol en iframe)
- **Solo Flujo Anfitrión implementado:** Actualmente solo existe la funcionalidad de proyección QR para profesores
- **JWT contiene rol:** Aunque el iframe NO lo usa actualmente para enrutamiento (se usa entry point)
- **WebSocket con autenticación:** Implementada autenticación JWT obligatoria en primer mensaje (Opción 5B)

---

## Arquitectura Real Implementada

```text
┌──────────────────────────────────────────────────────────────────┐
│                     Usuario con Sesión PHP                        │
│                     (Sistema Legacy)                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
            ┌───────────────┴────────────────┐
            │                                │
    PROFESOR hace click          ALUMNO hace click
    botón "Proyectar QR"        botón "Mi Asistencia"
            │                                │
            ↓                                ↓
    ┌───────────────┐              ┌───────────────┐
    │  PHP Portero  │              │  PHP Portero  │
    │  Emite JWT    │              │  Emite JWT    │
    │ rol:"profesor"│              │ rol:"alumno"  │
    └───────┬───────┘              └───────┬───────┘
            │                              │
            │ abre iframe                  │ abre iframe
            │ /asistencia/app              │ /asistencia/guest
            ↓                              ↓
    ┌──────────────────────┐      ┌──────────────────────────┐
    │  MODO ANFITRIÓN      │      │  MODO INVITADO           │
    │  (Implementado)      │      │  (NO IMPLEMENTADO)       │
    └──────────────────────┘      └──────────────────────────┘
            │                              │
            │ postMessage JWT              │ postMessage JWT
            ↓                              ↓
    Frontend recibe token        Frontend recibe token
            │                              │
            │ WS connect                   │ (futuro)
            ↓                              ↓
    WebSocket /asistencia/ws      GET /enrollment/status?
    (AUTH en primer mensaje)               │
            │                              │
            │ send AUTH {token}    enrolled: true? ─── NO ──┐
            ↓                              │                 │
    Server valida JWT                     YES               │
            │                              │                 │
            │ auth-ok                      ↓                 ↓
            ↓                       MODO ASISTENCIA   MODO ENROLLMENT
    Proyección QR                  (HTTP/REST)       (WebSocket)
    - countdown                    - ECDH login      - FIDO2
    - qr-update cada 3s            - Escanear QR     - WebAuthn
                                   - N rondas        - Penalizaciones
```

**Diferencias clave vs documento anterior:**

- [OK] **Entry Points Separados:** Botones diferentes en legacy PHP → iframes diferentes → NO detección de rol
- [OK] **WebSocket Auth Obligatoria:** Implementada Opción 5B (AUTH como primer mensaje)
- [OK] **Solo Anfitrión funcional:** Flujo Invitado está completamente pendiente de implementación

---

## Payload JWT

El JWT emitido por PHP contiene:

```json
{
  "userId": 123,
  "username": "juan.perez",
  "nombreCompleto": "Juan Pérez",
  "rol": "profesor",
  "iat": 1762159081,
  "exp": 1762159381,
  "iss": "php-service",
  "aud": "node-service"
}
```

**Valores posibles para `rol`:**

- `"profesor"` o `"docente"` → Modo Anfitrión
- `"alumno"` o `"estudiante"` → Modo Invitado

[WIP] **IMPORTANTE:** El campo `rol` existe en el JWT pero **NO se usa para enrutamiento en iframe**. La separación se hace por entry points diferentes en el legacy PHP.

---

## Estrategia de Separación de Flujos

### Opción Implementada: Entry Points Separados

```text
Sistema Legacy PHP:
├── Página profesores
│   └── Botón "Proyectar QR" → abre iframe /asistencia/app
│       └── PHP emite JWT con rol:"profesor"
│       └── iframe carga websocket.client.js
│       └── Conecta WebSocket /asistencia/ws
│
└── Página alumnos (futuro)
    └── Botón "Mi Asistencia" → abre iframe /asistencia/guest
        └── PHP emite JWT con rol:"alumno"
        └── iframe carga guest-app.js (NO EXISTE AÚN)
        └── Verifica enrollment y redirige
```

**Ventajas de este enfoque:**

- [OK] **Mínima invasión al legacy:** No requiere modificar lógica PHP existente
- [OK] **Separación clara:** Cada rol tiene su propia aplicación frontend
- [OK] **No detección de rol necesaria:** El iframe ya sabe qué modo debe cargar
- [OK] **Escalabilidad:** Fácil agregar nuevos roles con nuevos entry points

---

## FLUJO 1: ANFITRIÓN (Profesor/Docente)

### Estado: [OK] COMPLETAMENTE IMPLEMENTADO

#### Características

- [OK] JWT con `rol: "profesor"` o `"docente"`
- [OK] NO pasa por enrollment (no necesita dispositivo registrado)
- [OK] Función: Proyectar QR dinámicos para que alumnos escaneen
- [OK] Usa WebSocket `/asistencia/ws` con autenticación JWT obligatoria

#### Flujo Completo Implementado

```text
1. Usuario (profesor) hace click en botón legacy PHP
2. PHP verifica sesión activa y emite JWT (rol: "profesor")
3. PHP abre iframe que carga /asistencia/app/index.html
4. Iframe recibe JWT vía postMessage
5. Frontend carga websocket.client.js
6. WebSocket abre conexión a ws://localhost:3030/asistencia/ws
7. Frontend envía mensaje AUTH como PRIMER mensaje:
   {
     "type": "AUTH",
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
8. Backend valida JWT con JWTUtils.verify()
9. Backend responde con auth-ok:
   {
     "type": "auth-ok",
     "payload": {
       "userId": 123,
       "username": "juan.perez"
     }
   }
10. Backend inicia proyección:
    - Envía countdown (5, 4, 3, 2, 1...)
    - Envía qr-update cada 3 segundos
11. Frontend proyecta QR en pantalla
```

#### Endpoints Utilizados

| Endpoint | Tipo | Propósito | Estado |
|----------|------|-----------|--------|
| `/api_puente_minodo.php?action=get_token` | HTTP GET | Obtener JWT | [OK] Funcional |
| `/asistencia/ws` | WebSocket | Proyección QR + Auth | [OK] Funcional |

#### Mensajes WebSocket Implementados

**Cliente → Servidor:**

```typescript
// Mensaje AUTH (OBLIGATORIO, primer mensaje)
interface AuthMessageDTO {
  type: 'AUTH';
  token: string; // JWT completo
}

// Timeout: 5 segundos
// Si no se recibe AUTH, servidor cierra con código 4408
```

**Servidor → Cliente:**

```typescript
// Mensaje auth-ok (confirma autenticación)
interface AuthOkMessageDTO {
  type: 'auth-ok';
  payload: {
    userId: number;
    username: string;
  };
}

// Mensaje countdown
interface CountdownMessageDTO {
  type: 'countdown';
  payload: {
    seconds: number; // 5, 4, 3, 2, 1
  };
}

// Mensaje qr-update
interface QRUpdateMessageDTO {
  type: 'qr-update';
  payload: {
    qrData: string;      // data:image/png;base64,...
    timestamp: number;   // Date.now()
    sessionId: string;   // session-{timestamp}-{random}
  };
}
```

#### Códigos de Cierre WebSocket

| Código | Razón | Descripción |
|--------|-------|-------------|
| 4401 | No Authenticated | No se recibió mensaje AUTH |
| 4403 | Invalid Token | JWT inválido o expirado |
| 4408 | Auth Timeout | Timeout de 5s esperando AUTH |
| 1000 | Normal | Cierre normal |

#### Archivos Involucrados

```text
node-service/src/
├── frontend/
│   ├── app/
│   │   ├── index.html              # UI proyección ([OK] funcional)
│   │   └── main.js                 # Lógica proyección ([OK] funcional)
│   └── modules/
│       ├── auth/
│       │   ├── auth.service.js     # Manejo JWT ([OK] funcional)
│       │   └── token-storage.js    # Storage JWT ([OK] funcional)
│       ├── qr-projection/
│       │   ├── qr-projection.component.js  # UI QR ([OK] funcional)
│       │   └── qr-projection.service.js    # Lógica QR ([OK] funcional)
│       └── websocket/
│           └── websocket.client.js # Cliente WS + Auth ([OK] funcional)
│
└── modules/
    └── qr-projection/
        └── presentation/
            ├── websocket-controller.ts  # Handshake AUTH ([OK] funcional)
            └── types.ts                 # DTOs Auth ([OK] funcional)
```

---

## FLUJO 2: INVITADO (Estudiante/Alumno)

### Estado: [FAIL] NO IMPLEMENTADO (Solo stubs de backend)

#### Características Planificadas

- [OK] JWT con `rol: "alumno"` o `"estudiante"` (campo existe)
- [FAIL] DEBE verificar enrollment antes de participar (endpoint stub)
- [FAIL] NO usa WebSocket para asistencia (usa HTTP/REST)
- [FAIL] Usa WebSocket SOLO para enrollment (NO EXISTE)
- [FAIL] Usa HTTP/REST para registrar asistencia (NO EXISTE)

#### Flujo Completo Planificado (NO IMPLEMENTADO)

```text
1. Usuario (alumno) hace click en botón legacy PHP
2. PHP verifica sesión activa y emite JWT (rol: "alumno")
3. PHP abre iframe que carga /asistencia/guest/index.html ← NO EXISTE
4. Iframe recibe JWT vía postMessage
5. Frontend carga guest-app.js ← NO EXISTE

┌── 6. GET /minodo-api/enrollment/status (con JWT) ← STUB (retorna false)
│
├── SI enrolled: true ────────────────────┐
│                                         │
│   A. MODO ASISTENCIA (HTTP, NO WebSocket) ← NO IMPLEMENTADO
│   ├── POST /minodo-api/enrollment/login (ECDH) ← STUB
│   ├── Obtiene session_key local
│   ├── Abre interfaz de escaneo QR ← NO EXISTE
│   ├── Escanea QR proyectado por profesor
│   ├── Desencripta con session_key
│   ├── POST /minodo-api/attendance/validate ← NO EXISTE
│   ├── Repite N rondas
│   └── Resultado: PRESENTE/AUSENTE
│
└── NO enrolled: false ───────────────────┐
                                          │
    B. MODO ENROLLMENT (WebSocket) ← NO IMPLEMENTADO
    ├── POST /minodo-api/enrollment/start ← STUB
    ├── Abre WebSocket /enrollment/ws ← NO EXISTE
    ├── Proceso FIDO2/WebAuthn interactivo
    ├── POST /minodo-api/enrollment/finish ← STUB
    ├── ¿Penalización aplicada?
    │   ├── SÍ: Espera tiempo de penalización
    │   │       └── Reintenta verificación
    │   └── NO: Regresa al paso 6
    │           └── Ahora enrolled: true → MODO ASISTENCIA
```

#### Endpoints Planificados (Stubs o No Existen)

| Endpoint | Tipo | Propósito | Estado |
|----------|------|-----------|--------|
| `/api_puente_minodo.php?action=get_token` | HTTP GET | Obtener JWT | [OK] Funcional |
| `/minodo-api/enrollment/status` | HTTP GET | Verificar enrollment | [WIP] Stub (retorna false) |
| `/minodo-api/enrollment/start` | HTTP POST | Iniciar enrollment | [WIP] Stub (challenge fake) |
| `/enrollment/ws` | WebSocket | Enrollment interactivo | [FAIL] NO EXISTE |
| `/minodo-api/enrollment/finish` | HTTP POST | Finalizar enrollment | [WIP] Stub (acepta todo) |
| `/minodo-api/enrollment/login` | HTTP POST | Login ECDH | [WIP] Stub (keys fake) |
| `/minodo-api/attendance/validate` | HTTP POST | Validar ronda asistencia | [FAIL] NO EXISTE |

#### Archivos que FALTAN Crear

```text
node-service/src/
├── frontend/
│   ├── guest/                      # [FAIL] NO EXISTE
│   │   ├── index.html              # UI invitado
│   │   └── main.js                 # Lógica invitado
│   └── modules/
│       ├── enrollment/             # [FAIL] NO EXISTE
│       │   ├── enrollment.component.js
│       │   └── enrollment.service.js
│       └── attendance/             # [FAIL] NO EXISTE
│           ├── scanner.component.js   # Escaneo QR
│           └── attendance.service.js  # Validación
│
└── modules/
    ├── enrollment/
    │   └── presentation/
    │       └── websocket-controller.ts  # [FAIL] NO EXISTE
    └── attendance/                 # [FAIL] NO EXISTE (módulo completo)
        ├── application/
        ├── domain/
        ├── infrastructure/
        └── presentation/
            └── http-controller.ts  # POST /attendance/validate
```

---

## Estado Actual de Implementación (2025-11-03)

### [OK] COMPLETAMENTE FUNCIONAL

| Componente | Descripción | Ubicación | Probado |
|------------|-------------|-----------|---------|
| **JWT Emisión** | PHP emite JWT con rol | `php-service/src/api_puente_minodo.php` | [OK] dev + prod |
| **postMessage** | Envío JWT PHP → iframe | `php-service/src/index.php` | [OK] dev + prod |
| **WebSocket Auth** | AUTH como primer mensaje (Opción 5B) | `websocket.client.js` | [OK] dev + prod |
| **WebSocket Handshake** | Validación JWT obligatoria | `websocket-controller.ts` | [OK] dev + prod |
| **Proyección QR** | Countdown + qr-update | `qr-projection-controller.ts` | [OK] dev + prod |
| **Frontend Anfitrión** | UI proyección completa | `/frontend/app/` | [OK] dev + prod |
| **Códigos Cierre WS** | 4401, 4403, 4408 | `websocket-controller.ts` | [OK] probados |

### [WIP] STUBS (Backend sin lógica real)

| Componente | Endpoint | Retorna | Ubicación |
|------------|----------|---------|-----------|
| **Enrollment Status** | GET `/enrollment/status` | `{enrolled: false}` | `enrollment-handler.ts` línea 225 |
| **Enrollment Start** | POST `/enrollment/start` | Challenge fake | `enrollment-handler.ts` línea 127 |
| **Enrollment Finish** | POST `/enrollment/finish` | `{success: true}` | `enrollment-handler.ts` línea 182 |
| **Enrollment Login** | POST `/enrollment/login` | Keys fake | `enrollment-handler.ts` línea 67 |

### [FAIL] NO IMPLEMENTADO (Crítico para flujo Invitado)

| Componente | Descripción | Prioridad |
|------------|-------------|-----------|
| **Frontend Guest** | Aplicación completa para alumnos | [TODO] CRÍTICA |
| **Enrollment WebSocket** | `/enrollment/ws` para proceso FIDO2 | [TODO] CRÍTICA |
| **Attendance Module** | Módulo completo de asistencia | [TODO] CRÍTICA |
| **Attendance Validate** | POST `/attendance/validate` | [TODO] CRÍTICA |
| **Scanner UI** | Interfaz escaneo QR (cámara) | [TODO] CRÍTICA |
| **Lógica FIDO2** | WebAuthn real (no stub) | 🟠 ALTA |
| **Lógica ECDH** | Key exchange completo | 🟠 ALTA |
| **PostgreSQL Data** | Tablas `enrollment.devices`, `attendance.*` | 🟠 ALTA |
| **Valkey Queue** | Cola de proyección + metadatos | [WIP] MEDIA |

###  Resumen de Cobertura

```text
Flujo Anfitrión:  ████████████████████████ 100% [OK] FUNCIONAL
Flujo Invitado:   ████░░░░░░░░░░░░░░░░░░░░  15% [FAIL] NO FUNCIONAL
  ├─ Enrollment:  ██░░░░░░░░░░░░░░░░░░░░░░  10% (solo stubs)
  └─ Asistencia:  ░░░░░░░░░░░░░░░░░░░░░░░░   0% (no existe)

General:          ████████░░░░░░░░░░░░░░░░  57% EN DESARROLLO
```

---

## Plan de Implementación para Flujo Invitado

### Decisión Arquitectónica: Mantener Entry Points Separados

[OK] **NO se modificará** el frontend de Anfitrión para detectar rol
[OK] **SE CREARÁ** un frontend completamente nuevo para Invitado

**Justificación:**

1. **Separation of Concerns (SoC):** Cada rol tiene su propia aplicación
2. **No romper lo funcional:** Anfitrión funciona perfectamente
3. **Facilidad de testing:** Aplicaciones independientes
4. **Escalabilidad:** Fácil agregar nuevos roles

---

### FASE 1: Frontend Guest Básico (Sprint 1 - 3 días)

#### Objetivo

Crear aplicación frontend básica para alumnos que:
- Reciba JWT vía postMessage
- Verifique enrollment status
- Muestre stubs de ambos modos (asistencia/enrollment)

#### Archivos a Crear

```text
node-service/src/frontend/guest/
├── index.html              # UI principal invitado
├── main.js                 # Lógica principal
└── styles.css              # Estilos (opcional)

node-service/src/frontend/modules/
├── enrollment/
│   ├── enrollment.component.js    # UI enrollment
│   └── enrollment.service.js      # Lógica enrollment
└── attendance/
    ├── scanner.component.js       # UI escaneo QR
    └── attendance.service.js      # Lógica asistencia
```

#### Checklist Sprint 1

- [ ] Crear `node-service/src/frontend/guest/index.html`
  - Estructura HTML básica
  - Div para auth listener
  - Div para status
  - Div para contenido dinámico

- [ ] Crear `node-service/src/frontend/guest/main.js`
  - postMessage listener para JWT
  - Llamada GET `/minodo-api/enrollment/status`
  - Función `mostrarModoAsistencia()` (stub con alert)
  - Función `mostrarModoEnrollment()` (stub con alert)

- [ ] Actualizar Fastify para servir `/asistencia/guest/*`
  - Agregar ruta estática en `app.ts`

- [ ] Crear entry point en PHP legacy
  - Botón "Mi Asistencia" que abre iframe `/asistencia/guest/`

- [ ] Testing manual:
  - Verificar que iframe carga
  - Verificar que recibe JWT
  - Verificar que llama a enrollment/status
  - Verificar que muestra mensaje correcto

---

### FASE 2: Módulo Attendance (Sprint 2 - 5 días)

#### Objetivo

Implementar módulo completo de asistencia para alumnos enrolados:
- Interfaz de escaneo QR con cámara
- Desencriptación con session_key
- Validación de rondas

#### Archivos a Crear

```text
node-service/src/modules/attendance/
├── application/
│   ├── usecases/
│   │   └── validate-qr.usecase.ts     # Lógica validación QR
│   └── dto/
│       ├── validate-qr.dto.ts          # DTO request
│       └── validation-result.dto.ts    # DTO response
├── domain/
│   ├── entities/
│   │   └── attendance-session.entity.ts
│   └── value-objects/
│       └── qr-payload.vo.ts
├── infrastructure/
│   ├── repositories/
│   │   └── attendance.repository.ts    # PostgreSQL
│   └── crypto/
│       └── qr-decrypt.service.ts       # Desencriptar QR
└── presentation/
    └── http-controller.ts              # POST /attendance/validate
```

#### Checklist Sprint 2

- [ ] Crear esquema PostgreSQL `attendance`
  ```sql
  CREATE SCHEMA IF NOT EXISTS attendance;
  
  CREATE TABLE attendance.sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active'
  );
  
  CREATE TABLE attendance.validations (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES attendance.sessions(id),
    round_number INTEGER NOT NULL,
    qr_scanned_at TIMESTAMP NOT NULL,
    response_time_ms INTEGER NOT NULL,
    result VARCHAR(20) NOT NULL
  );
  ```

- [ ] Implementar `validate-qr.usecase.ts`
  - Validar formato QR
  - Desencriptar con session_key
  - Calcular RT (response time)
  - Guardar en PostgreSQL

- [ ] Implementar `http-controller.ts`
  - POST `/minodo-api/attendance/validate`
  - Validar JWT
  - Llamar usecase

- [ ] Frontend: `scanner.component.js`
  - Solicitar permiso cámara
  - Integrar librería jsQR
  - Detectar QR y enviar a backend

- [ ] Testing:
  - Profesor proyecta QR
  - Alumno escanea con cámara
  - Backend valida y guarda
  - Verificar PostgreSQL

---

### FASE 3: Enrollment WebSocket (Sprint 3 - 7 días)

#### Objetivo

Implementar proceso completo de enrollment con FIDO2/WebAuthn

#### Archivos a Crear

```text
node-service/src/modules/enrollment/
├── application/
│   ├── usecases/
│   │   ├── process-enrollment.usecase.ts
│   │   └── handle-penalties.usecase.ts
│   └── dto/
│       └── enrollment-ws-message.dto.ts
├── infrastructure/
│   ├── fido2/
│   │   └── webauthn.service.ts         # Lógica FIDO2
│   └── crypto/
│       └── ecdh.service.ts              # Key exchange
└── presentation/
    └── websocket-controller.ts          # /enrollment/ws
```

#### Checklist Sprint 3

- [ ] Implementar WebSocket handler `/enrollment/ws`
  - Registro de conexiones por userId
  - Manejo de mensajes tipo `join`, `credential`, `error`

- [ ] Implementar FIDO2/WebAuthn
  - Generar challenge real
  - Verificar credential con librería `@simplewebauthn/server`
  - Guardar en PostgreSQL `enrollment.devices`

- [ ] Implementar ECDH
  - Generar par de claves servidor
  - Derivar handshake_secret
  - Retornar serverPublicKey

- [ ] Implementar penalizaciones
  - Contador de intentos fallidos
  - Tiempo de espera exponencial
  - Mensaje WebSocket `penalizacion`

- [ ] Frontend: `enrollment.component.js`
  - Conectar WebSocket `/enrollment/ws`
  - Manejar mensajes del servidor
  - Llamar navigator.credentials.create()
  - Mostrar UI de progreso

- [ ] Testing:
  - Enrollment exitoso
  - Enrollment fallido con penalización
  - Verificar PostgreSQL `enrollment.devices`javascript
if (event.data.type === 'AUTH_TOKEN') {
  jwtToken = event.data.token;
  sessionStorage.setItem('jwt_token', jwtToken);
  isAuthenticated = true;

  // ← NUEVO: Decodificar JWT para extraer rol
  const payload = JSON.parse(atob(jwtToken.split('.')[1]));
  const rol = payload.rol || 'alumno';

  console.log('[JWT] Token recibido. Rol:', rol, 'Usuario:', payload.username);

  // ← NUEVO: Redirigir según rol
  if (rol === 'profesor' || rol === 'docente') {
    // ANFITRIÓN: Proyección WebSocket
    console.log('[Modo] ANFITRIÓN - Iniciando proyección');
    statusEl.textContent = 'Modo Proyección - Iniciando...';
    connect(); // ← Ya existente, abre WebSocket /asistencia/ws

  } else {
    // INVITADO: Verificar enrollment
    console.log('[Modo] INVITADO - Verificando enrolamiento');
    statusEl.textContent = 'Verificando enrolamiento...';
    verificarEnrollment();
  }
}

---

## Checklist de Implementación Completo

### [OK] FASE 0: Flujo Anfitrión (COMPLETADO)

- [x] **0.1** WebSocket `/asistencia/ws` con autenticación JWT
- [x] **0.2** Frontend de proyección QR completo
- [x] **0.3** Mensajes AUTH, auth-ok, countdown, qr-update
- [x] **0.4** Códigos de cierre 4401, 4403, 4408
- [x] **0.5** Testing dev + prod funcional

### [TODO] FASE 1: Frontend Guest Básico (Sprint 1 - 3 días)

- [ ] **1.1** Crear `/frontend/guest/index.html` con estructura básica
- [ ] **1.2** Crear `/frontend/guest/main.js` con postMessage listener
- [ ] **1.3** Implementar llamada GET `/enrollment/status`
- [ ] **1.4** Stubs de `mostrarModoAsistencia()` y `mostrarModoEnrollment()`
- [ ] **1.5** Agregar ruta Fastify para servir `/asistencia/guest/*`
- [ ] **1.6** Crear entry point en PHP legacy (botón "Mi Asistencia")
- [ ] **1.7** Testing: iframe carga, recibe JWT, llama endpoint

**Entregable:** Frontend guest funcional con stubs

### 🟠 FASE 2: Módulo Attendance (Sprint 2 - 5 días)

- [ ] **2.1** Crear schema PostgreSQL `attendance` (sessions, validations)
- [ ] **2.2** Crear entidades, VOs y DTOs del módulo attendance
- [ ] **2.3** Implementar `validate-qr.usecase.ts` (validación + RT)
- [ ] **2.4** Crear HTTP controller POST `/attendance/validate`
- [ ] **2.5** Frontend: `scanner.component.js` (acceso cámara)
- [ ] **2.6** Integrar librería jsQR para detección
- [ ] **2.7** Implementar desencriptación con session_key
- [ ] **2.8** Testing: Profesor proyecta → alumno escanea → validación

**Entregable:** Flujo asistencia funcional (1 ronda mínimo)

### 🟠 FASE 3: Enrollment WebSocket (Sprint 3 - 7 días)

- [ ] **3.1** Crear WebSocket handler `/enrollment/ws`
- [ ] **3.2** Implementar `webauthn.service.ts` (FIDO2 real)
- [ ] **3.3** Implementar `ecdh.service.ts` (key exchange completo)
- [ ] **3.4** Implementar `handle-penalties.usecase.ts`
- [ ] **3.5** Frontend: `enrollment.component.js` (WebSocket client)
- [ ] **3.6** Integrar navigator.credentials.create() en frontend
- [ ] **3.7** Conectar con PostgreSQL `enrollment.devices`
- [ ] **3.8** Testing: Enrollment exitoso + penalizaciones

**Entregable:** Enrollment completo funcional

### [WIP] FASE 4: N-Rondas y Optimización (Sprint 4 - 3 días)

- [ ] **4.1** Implementar lógica de N rondas en attendance
- [ ] **4.2** Implementar cálculo RT (response time)
- [ ] **4.3** Implementar validación TOTPu y TOTPs
- [ ] **4.4** Implementar resultado final (PRESENTE/AUSENTE)
- [ ] **4.5** Valkey: Cola de proyección + metadatos
- [ ] **4.6** Testing completo end-to-end
- [ ] **4.7** Testing de carga (múltiples alumnos simultáneos)

**Entregable:** Sistema completo operacional

### [OK] FASE 5: Documentación Final (Sprint 5 - 2 días)

- [ ] **5.1** Actualizar diagramas de secuencia
- [ ] **5.2** Documentar DA-011: Entry points separados
- [ ] **5.3** Actualizar README con flujos completos
- [ ] **5.4** Crear guía de testing por rol
- [ ] **5.5** Documentar troubleshooting común

---

## Plan de Testing por Rol

### Testing Flujo Anfitrión ([OK] Probado)

```bash
# Ambiente dev
podman compose -f compose.dev.yaml up

# Ambiente prod
podman compose -f compose.prod.yaml up

# Navegador
firefox http://localhost:9500/

# Verificar en consola:
[Auth] Token recibido y almacenado
[WebSocket] Estableciendo conexion...
[WebSocket] Enviando mensaje AUTH
[WebSocket] Mensaje recibido: {"type":"auth-ok",...}
[WebSocket] Mensaje recibido: {"type":"countdown",...}
[WebSocket] Mensaje recibido: {"type":"qr-update",...}
```

### Testing Flujo Invitado ([WIP] Pendiente)

```bash
# 1. Configurar entry point PHP legacy
# Crear botón "Mi Asistencia" que abra iframe /asistencia/guest/

# 2. Abrir navegador
firefox http://localhost:9500/

# 3. Click en "Mi Asistencia"

# 4. Verificar llamada a enrollment/status
# Consola navegador:
[Auth] Token recibido
[Enrollment] Consultando estado...
[Enrollment] Estado: {enrolled: false}
[Enrollment] Iniciando modo enrollment...

# 5. Verificar WebSocket /enrollment/ws
# (actualmente dará error, esperado)
```

# 5. Verificar en consola:
[JWT] Token recibido. Rol: alumno Usuario: test.user
[Modo] INVITADO - Verificando enrolamiento
[Enrollment] Consultando estado...
[Enrollment] Estado: {success: true, enrolled: false}
[Enrollment] [NO] Usuario NO enrolado, iniciando enrollment
[Enrollment] Iniciando proceso...
[Enrollment] Challenge recibido
[Enrollment] Abriendo WebSocket /enrollment/ws
# ERROR: WebSocket /enrollment/ws no existe (esperado)

# 6. Implementar WebSocket /enrollment/ws para continuar
```

---

## Orden de Implementación Recomendado

### [OK] Sprint 0: Flujo Anfitrión (COMPLETADO)

**Duración:** 2 semanas (completado)

**Logros:**

- [OK] WebSocket con autenticación JWT (Opción 5B)
- [OK] Frontend proyección QR completo
- [OK] Testing dev + prod exitoso

### [TODO] Sprint 1: Frontend Guest Básico (1-2 días)

**Objetivo:** Crear aplicación invitado con stubs

**Tareas:**

1. Crear frontend guest (index.html + main.js)
2. Agregar entry point en PHP legacy
3. Testing: iframe carga y llama a enrollment/status

**Entregable:** Alumnos ven stubs "Modo no implementado aún"

### 🟠 Sprint 2: Modo Asistencia (3-5 días)

**Objetivo:** Asistencia funcional (1 ronda mínimo)

**Tareas:**

1. Crear módulo attendance completo
2. Implementar escáner QR con cámara
3. Endpoint POST `/attendance/validate`
4. Testing end-to-end con profesor

**Entregable:** Flujo completo profesor → alumno → validación

### 🟠 Sprint 3: Enrollment WebSocket (5-7 días)

**Objetivo:** Enrollment FIDO2 funcional

**Tareas:**

1. WebSocket handler `/enrollment/ws`
2. Implementar FIDO2/WebAuthn real
3. ECDH key exchange completo
4. Sistema de penalizaciones

**Entregable:** Enrollment completo operacional

### [WIP] Sprint 4: N-Rondas y Optimización (3-5 días)

**Objetivo:** Sistema completo y optimizado

**Tareas:**

1. N rondas en asistencia
2. Validación TOTPu/TOTPs
3. Resultado PRESENTE/AUSENTE
4. Testing de carga

**Entregable:** Sistema 100% funcional

---

## Impacto y Riesgos

### [OK] Impacto Positivo (Arquitectura Actual)

- [OK] **Entry points separados:** Mínima invasión al legacy PHP
- [OK] **SoC estricto:** Cada rol tiene su aplicación
- [OK] **WebSocket seguro:** Autenticación JWT obligatoria
- [OK] **Código mantenible:** Arquitectura modular bien definida
- [OK] **Testing independiente:** Cada flujo se prueba por separado
- [OK] **Escalabilidad:** Fácil agregar nuevos roles

### [WIP] Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| WebSocket /enrollment/ws falla en prod | Media | Alto | Testing exhaustivo + fallback HTTP |
| Incompatibilidad FIDO2 dispositivos | Alta | Medio | Detección + mensaje claro |
| Cámara no disponible navegador | Media | Alto | Permisos explícitos + guía |
| jsQR lento en dispositivos antiguos | Media | Medio | Optimizar resolución + loader |
| PostgreSQL no poblado correctamente | Baja | Alto | Migraciones + seeds de prueba |

---

## Criterios de Éxito

### Definición de "Hecho"

Esta propuesta se considera **completamente implementada** cuando:

1. [OK] **Flujo Anfitrión:** Proyección QR funcional (COMPLETADO)
2. [FAIL] **Flujo Invitado enrolado:** Escaneo QR funcional (PENDIENTE)
3. [FAIL] **Flujo Invitado no enrolado:** Enrollment FIDO2 funcional (PENDIENTE)
4. [FAIL] **N rondas:** Sistema de validación múltiple funcional (PENDIENTE)
5. [FAIL] **Penalizaciones:** Sistema de penalizaciones funcional (PENDIENTE)
6. [FAIL] **Testing automatizado:** >80% cobertura (PENDIENTE)
7. [WIP] **Documentación:** Actualizada parcialmente (EN PROGRESO)

### Metricas de Exito (Objetivos)

- **Cobertura codigo:** >80% (actual: ~60% solo Anfitrion)
- **Tiempo response:** <2s validacion QR
- **Tasa error:** <1% enrollment
- **Usabilidad:** Flujo intuitivo sin documentacion adicional
- **Disponibilidad:** >99% uptime produccion

### Estado Actual (2025-11-03)

```text
Flujo Anfitrión:   ████████████████████████ 100% [OK] PRODUCCIÓN
Flujo Invitado:    ████░░░░░░░░░░░░░░░░░░░░  15% [FAIL] DESARROLLO
  ├─ Enrollment:   ██░░░░░░░░░░░░░░░░░░░░░░  10% (stubs)
  └─ Asistencia:   ░░░░░░░░░░░░░░░░░░░░░░░░   0% (no existe)

Sistema Completo:  ████████░░░░░░░░░░░░░░░░  57%
```

---

## Referencias Cruzadas

### Documentos Relacionados

- [09-protocolo-websocket.md](09-protocolo-websocket.md) - Protocolo WebSocket con auth JWT
- [10-guia-integracion-php-node.md](../10-guia-integracion-php-node.md) - Integración PHP ↔ Node
- [03-flujo-enrolamiento.md](03-flujo-enrolamiento.md) - Flujo FIDO2 detallado
- [04-flujo-asistencia.md](04-flujo-asistencia.md) - Flujo N rondas detallado
- [07-decisiones-arquitectonicas.md](07-decisiones-arquitectonicas.md) - Decisiones arquitectónicas

### Decisiones Arquitectónicas Relacionadas

- **DA-010:** Autenticación JWT en WebSocket (Opción 5B)
- **DA-011:** Separación por entry points (no detección rol en iframe)
- **DA-008:** Monolito Modular con Vertical Slicing
- **DA-009:** Frontend modular con SoC estricto

---

## Aprobación y Siguientes Pasos

### Estado de Revisión

| Aspecto | Estado | Fecha |
|---------|--------|-------|
| Arquitectura Real | [OK] Validada | 2025-11-03 |
| Flujo Anfitrión | [OK] En producción | 2025-11-03 |
| Plan Flujo Invitado | [WIP] Pendiente aprobación | - |
| Estimaciones | [WIP] Pendiente validación | - |

### Próximos Pasos Inmediatos

1. **Aprobar Sprint 1** (Frontend Guest Básico)
2. **Asignar recursos** (desarrolladores, tiempo)
3. **Definir prioridad** (¿urgente o puede esperar?)
4. **Comenzar implementación** Sprint 1 si se aprueba

### Preguntas Pendientes

- ¿Se requiere implementación completa antes de fin de 2025?
- Hay presupuesto para librerias jsQR o similares?
- Dispositivos minimos soportados? (para FIDO2)
- Se requiere fallback HTTP si WebSocket falla?

---

**Documento actualizado:** 2025-11-03  
**Proxima revision:** Despues de completar Sprint 1
