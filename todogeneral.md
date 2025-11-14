# INFORME: ANÁLISIS DE FUNCIONES DE MÓDULOS - BACKEND Y FRONTEND

## Contexto General

El sistema sigue una **arquitectura de monolito modular** con **separación estricta de responsabilidades (SoC)** y **Domain-Driven Design (DDD)**. La implementación distingue claramente entre:

- **Módulos Backend** (`node-service/src/modules/`) - Lógica de negocio servidor
- **Módulos Frontend** (`node-service/src/frontend/modules/`) - Lógica cliente navegador
- **Plugin Frontend** (`src/plugins/frontend-plugin.ts`) - Servicio de archivos estáticos/proxy Vite

---

## MÓDULOS BACKEND (Node.js Service)

### 1. Módulo `auth/` - Autenticación JWT

**Ubicación:** `node-service/src/modules/auth/`

**Responsabilidad:** Validación de tokens JWT emitidos por PHP Service

**Componentes:**

#### Application Layer

- **`AuthService`** (`application/auth.service.ts`)
  - Orquesta casos de uso de autenticación
  - `authenticateFromHeader()`: Valida JWT desde header HTTP
  - `verifyToken()`: Valida JWT standalone
  - `generateToken()`: Genera JWT (no usado actualmente, PHP emite)
  - Mapea payload JWT a `AuthenticatedUser`

#### Domain Layer

- **`JWTUtils`** (`domain/jwt-utils.ts`)
  - Lógica pura de validación JWT
  - Verificación de firma HMAC-SHA256
  - Validación de claims (exp, iat, iss, aud)
  - Extracción de token desde header Authorization
- **`UserId`** (`domain/user-id.ts`)
  - Value Object para ID de usuario
- **`AuthenticatedUser`** (`domain/models.ts`)
  - Modelo de dominio para usuario autenticado

#### Presentation Layer

- **`AuthMiddleware`** (`presentation/auth-middleware.ts`)
  - Middleware HTTP para Fastify
  - Intercepta requests y valida JWT
  - Inyecta `request.user` si autenticación exitosa
  - Retorna 401 si falla

**Flujo:**

```text
Request → AuthMiddleware → AuthService → JWTUtils → AuthenticatedUser
```

**Estado:** ✅ Implementado y funcional

---

### 2. Módulo `qr-projection/` - Proyección de QR via WebSocket

**Ubicación:** `node-service/src/modules/qr-projection/`

**Responsabilidad:** Generación, rotación y transmisión de códigos QR dinámicos

**Componentes:**

#### Application Layer

- **`QRProjectionService`** (`application/qr-projection.service.ts`)
  - Orquesta flujo completo de proyección
  - `startProjection()`: Inicia countdown + rotación
  - `stopProjection()`: Detiene rotación activa
  - `generateSessionId()`: Crea ID único de sesión
  - Gestiona timers de rotación (intervalo configurable)
  - Mantiene mapa de intervalos activos por sesión

**Flujo de Proyección:**

1. **Fase Countdown**: N segundos preparatorios (configurable)
2. **Fase Rotación**: Genera nuevo QR cada X segundos
3. **Detención**: Al cerrar WebSocket o manualmente

#### Domain Layer

- **`QRGenerator`** (`domain/qr-generator.ts`)
  - Generación de payloads QR
  - Delegación a renderer (SVG/PNG)
- **`SessionId`** (`domain/session-id.ts`)
  - Value Object para ID de sesión
- **`QRCode`** (`domain/models.ts`)
  - Modelo de código QR generado

#### Infrastructure Layer

- **`QRCodeLibraryRenderer`** (`infrastructure/qrcode-library.renderer.ts`)
  - Implementación concreta con librería `qrcode`
  - Generación SVG/PNG
- **`QRMetadataRepository`** (`infrastructure/qr-metadata.repository.ts`)
  - Persistencia de metadata QR en Valkey (TTL)
  - Schema: `qr:session:{sessionId}:{userId}:{round}`
- **`ProjectionQueueRepository`** (`infrastructure/projection-queue.repository.ts`)
  - Gestión de colas de proyección en Valkey

#### Presentation Layer

- **`WebSocketController`** (`presentation/websocket-controller.ts`)
  - Endpoint `/ws` para conexiones WebSocket
  - Autenticación obligatoria vía `WebSocketAuthGuard`
  - Orquesta callbacks de countdown/QR update
  - Gestiona cleanup al cerrar conexión
- **`WebSocketAuthGuard`** (`presentation/websocket-auth.guard.ts`)
  - Validación JWT en primer mensaje WebSocket
  - Timeout de autenticación (5s configurable)
  - Códigos de cierre personalizados:
    - `4401`: No autenticado
    - `4403`: Token inválido
    - `4408`: Timeout autenticación

**Protocolo WebSocket:**

```typescript
// Cliente → Servidor (primer mensaje obligatorio)
{ type: 'AUTH', token: 'jwt...' }

// Servidor → Cliente (respuesta autenticación)
{ type: 'auth-ok', username: '...' }

// Servidor → Cliente (countdown)
{ type: 'countdown', payload: { seconds: 5 } }

// Servidor → Cliente (QR actualizado)
{ type: 'qr-update', payload: { qrData: '...', timestamp: ..., sessionId: '...' } }

// Servidor → Cliente (error)
{ type: 'error', payload: { message: '...' } }
```

**Estado:** ✅ Implementado y funcional

---

### 3. Módulo `enrollment/` - Enrolamiento FIDO2

**Ubicación:** `node-service/src/modules/enrollment/`

**Responsabilidad:** Registro de dispositivos FIDO2/WebAuthn y login ECDH

**Componentes:**

#### Application Layer

- **`EnrollmentService`** (`application/enrollment.service.ts`)
  - `createEnrollmentChallenge()`: Genera challenge FIDO2 + opciones WebAuthn
  - `verifyAndCompleteEnrollment()`: Valida attestation y registra dispositivo
  - `checkEnrollmentStatus()`: Consulta estado de enrolamiento
  - `performECDHLogin()`: Login con ECDH key exchange
  - Configuración WebAuthn:
    - Authenticator: `platform` (biométrico integrado)
    - User verification: `required`
    - Resident key: `required`
    - Algoritmos: ES256 (-7), RS256 (-257)
    - TTL challenge: 5 minutos

#### Domain Layer

- **`WebAuthnOptions`** (`domain/models.ts`)
  - Opciones para credential creation
  - Configuración RP (Relying Party)
- **`EnrollmentChallenge`** (`domain/models.ts`)
  - Modelo de challenge temporal

#### Infrastructure Layer

- **`EnrollmentChallengeRepository`** (`infrastructure/enrollment-challenge.repository.ts`)
  - Persistencia temporal de challenges en Valkey (TTL 5min)
- **`SessionKeyRepository`** (`infrastructure/session-key.repository.ts`)
  - Gestión de claves de sesión ECDH

#### Presentation Layer
- **`EnrollmentController`** (`presentation/enrollment-controller.ts`)
  - Rutas HTTP protegidas con `AuthMiddleware`:
    - `POST /api/enrollment/start`: Inicia enrolamiento
    - `POST /api/enrollment/finish`: Completa enrolamiento
    - `POST /api/enrollment/login`: Login ECDH
    - `GET /api/enrollment/status`: Estado de enrolamiento
  - Serialización de DTOs (Request/Response)

**Flujo Enrolamiento:**
1. Frontend llama `/api/enrollment/start`
2. Backend genera challenge + opciones WebAuthn
3. Frontend invoca `navigator.credentials.create()`
4. Usuario autentica con biométrico
5. Frontend envía credential a `/api/enrollment/finish`
6. Backend valida attestation y almacena en PostgreSQL

**Estado:** 🚧 Parcialmente implementado (stubs en verificación WebAuthn)

**TODOs:**
- Validación real de attestation FIDO2
- Extracción y almacenamiento de public key
- Derivación de `handshake_secret` con HKDF
- Integración con schema PostgreSQL `enrollment.devices`

---

## MÓDULOS FRONTEND (Cliente Web)

### 1. Módulo `auth/` - Gestión de Tokens JWT

**Ubicación:** `node-service/src/frontend/modules/auth/`

**Responsabilidad:** Recepción, almacenamiento y provisión de tokens JWT del padre PHP

**Componentes:**

#### Application Layer
- **`AuthService`** (`application/auth.service.ts`)
  - Escucha mensajes `postMessage` desde PHP
  - Almacena JWT en `sessionStorage` via `TokenStorage`
  - Provee token para WebSocket y HTTP requests
  - Notifica callbacks cuando autenticación completa
  - Maneja renovación de token (`TOKEN_REFRESH`)

**Protocolo postMessage:**
```typescript
// PHP → Iframe (autenticación inicial)
{ type: 'AUTH_TOKEN', token: 'jwt...' }

// PHP → Iframe (renovación)
{ type: 'TOKEN_REFRESH', token: 'jwt...' }
```

#### Infrastructure Layer
- **`TokenStorage`** (`infrastructure/token-storage.ts`)
  - Abstracción sobre `sessionStorage`
  - Key: `auth_token`
  - Métodos: `save()`, `get()`, `clear()`

**Flujo:**
```
PHP emite JWT → postMessage → AuthService → TokenStorage → sessionStorage
WebSocket/HTTP solicita token → AuthService.getToken() → sessionStorage
```

**Estado:** ✅ Implementado y funcional

---

### 2. Módulo `websocket/` - Cliente WebSocket

**Ubicación:** `node-service/src/frontend/modules/websocket/`

**Responsabilidad:** Conexión WebSocket autenticada y gestión de mensajes

**Componentes:**

#### Infrastructure Layer
- **`WebSocketClient`** (`infrastructure/websocket.client.ts`)
  - Establece conexión WSS/WS según protocolo página
  - Detecta contexto `/asistencia/` para ruteo correcto
  - Autenticación automática al abrir conexión
  - Timeout de autenticación (5s)
  - Reconexión automática (3s delay)
  - Sistema de eventos para tipos de mensaje
  - Métodos:
    - `connect()`: Establece conexión
    - `on(type, handler)`: Suscribe a tipo de mensaje
    - `send(message)`: Envía mensaje al servidor

**Detección de Contexto:**
```typescript
// Si estamos en Apache proxy /asistencia/
let wsPath = '/ws';
if (window.location.pathname.startsWith('/asistencia')) {
  wsPath = '/asistencia/ws';
}
const wsUrl = protocol + '//' + window.location.host + wsPath;
```

**Manejo de Mensajes:**
```typescript
wsClient.on('auth-ok', (payload) => { /* autenticado */ });
wsClient.on('countdown', (payload) => { /* mostrar countdown */ });
wsClient.on('qr-update', (payload) => { /* actualizar QR */ });
wsClient.on('error', (payload) => { /* mostrar error */ });
```

**Estado:** ✅ Implementado y funcional

---

### 3. Módulo `qr-projection/` - Proyección de QR (Vista)

**Ubicación:** `node-service/src/frontend/modules/qr-projection/`

**Responsabilidad:** Renderizado de estados de proyección QR

**Componentes:**

#### Application Layer
- **`QRProjectionService`** (`application/qr-projection.service.ts`)
  - Orquesta lógica de presentación
  - Suscribe eventos WebSocket
  - Delega renderizado a `QRProjectionComponent`
  - Transiciones de estado:
    - Connecting → Connected → Countdown → QR Display → Error

#### Presentation Layer
- **`QRProjectionComponent`** (`presentation/qr-projection.component.ts`)
  - Manipulación del DOM
  - Renderizado de QR como imagen SVG/base64
  - Métodos:
    - `showConnecting()`: "Conectando..."
    - `showConnected()`: "Conexión establecida"
    - `showCountdown(seconds)`: Muestra contador regresivo
    - `showQRCode(qrData)`: Renderiza código QR
    - `showError(message)`: Muestra error

**Estructura DOM:**
```html
<div id="qr-container">
  <div id="qr-status"><!-- Estado conexión --></div>
  <div id="qr-countdown"><!-- Countdown --></div>
  <div id="qr-display"><!-- QR Image --></div>
</div>
```

**Estado:** ✅ Implementado y funcional

---

### 4. Módulo `qr-reader/` - Lector de QR (Cámara)

**Ubicación:** `node-service/src/frontend/modules/qr-reader/`

**Responsabilidad:** Captura y lectura de códigos QR desde cámara

**Componentes:**

#### Application Layer
- **`QRReaderService`** (`application/qr-reader.service.ts`)
  - Orquesta flujo de lectura
  - Gestión de estados (waiting-auth, ready, scanning)
  - `markAuthReady()`: Habilita lectura tras autenticación
  - `start()`: Inicia cámara y escaneo
  - `stop()`: Detiene cámara

#### Infrastructure Layer
- **`CameraManager`** (`infrastructure/camera-manager.ts`)
  - Gestión de `MediaStream` (getUserMedia)
  - Integración con librería de escaneo QR (jsQR u otra)
  - Procesamiento de frames en loop
  - Callbacks de éxito/error

#### Presentation Layer
- **`QRReaderComponent`** (`presentation/qr-reader.component.ts`)
  - Renderizado de video preview
  - Controles de inicio/stop
  - Display de resultado de escaneo
  - Feedback visual de estados
  - Métodos:
    - `mount()`: Inserta componente en DOM
    - `showWaitingAuth()`: "Esperando autenticación..."
    - `showReady()`: Botón "Iniciar lectura"
    - `showScanning()`: Preview de cámara activo
    - `showResult(text)`: Muestra QR decodificado
    - `showError(message)`: Muestra error

**Flujo:**
1. Autenticación JWT completa
2. `markAuthReady()` habilita botón
3. Usuario presiona "Iniciar"
4. Solicita permiso cámara
5. Stream de video → procesamiento frames → detección QR
6. Al detectar QR: muestra texto bajo vista de cámara
7. Usuario presiona "Detener" o cierra

**Estado:** ✅ Implementado y funcional

---

## INFRAESTRUCTURA COMPARTIDA

### `shared/config/` - Configuración Centralizada

**Responsabilidad:** Single source of truth para configuración del sistema

**Estructura:**
```typescript
export const config = {
  env: {
    isDevelopment: boolean,
    isProduction: boolean,
  },
  server: {
    host: string,
    port: number,
  },
  frontend: {
    viteUrl: string,      // Dev: http://localhost:5173
    vitePath: string,     // Path /asistencia
    staticPath: string,   // Producción: dist/
  },
  valkey: {
    host: string,
    port: number,
  },
  qr: {
    countdownSeconds: number,
    regenerationInterval: number,
  },
  jwt: {
    secret: string,
    expiresIn: string,
    issuer: string,
    audience: string,
  },
};
```

**Fuente:** Variables de entorno + valores por defecto

---

### `shared/infrastructure/valkey/` - Cliente Valkey (Redis)

**Responsabilidad:** Singleton para conexión Valkey/Redis

**Componentes:**
- **`ValkeyClient`** (`valkey-client.ts`)
  - Singleton con configuración inyectada
  - Métodos: `set()`, `get()`, `del()`, `setex()`, `ping()`, `close()`
  - Usado por:
    - `QRMetadataRepository`: Metadata QR temporal
    - `ProjectionQueueRepository`: Colas de proyección
    - `EnrollmentChallengeRepository`: Challenges FIDO2
    - `SessionKeyRepository`: Claves ECDH

---

### `plugins/frontend-plugin.ts` - Servicio de Frontend

**Responsabilidad:** Servir archivos frontend según entorno

**Modo Desarrollo:**
- Proxy reverso a Vite Dev Server (puerto 5173)
- Hot Module Replacement (HMR) activo
- TypeScript transpilado en tiempo real

**Modo Producción:**
- Servir archivos estáticos desde `dist/`
- Assets pre-compilados y optimizados

**Orden de Registro:** ÚLTIMO en `app.ts` (catch-all routes)

**Configuración:**
```typescript
await fastify.register(frontendPlugin, {
  isDevelopment: config.env.isDevelopment,
  viteUrl: 'http://localhost:5173',
  vitePath: '/asistencia',
  staticPath: './dist',
});
```

---

## ORDEN DE CARGA EN `app.ts`

**Orden crítico** para evitar conflictos de rutas:

```typescript
// 1. INFRAESTRUCTURA COMPARTIDA
await fastify.register(fastifyWebSocket);
const valkeyClient = ValkeyClient.getInstance();

// 2. DEPENDENCY INJECTION
const jwtUtils = new JWTUtils(config.jwt);
const authService = new AuthService(jwtUtils);
const authMiddleware = new AuthMiddleware(authService);
// ... otros servicios

// 3. MÓDULOS BACKEND (rutas específicas)
await wsController.register(fastify);          // /ws
await enrollmentController.register(fastify);  // /api/enrollment/*
fastify.get('/health', ...);                   // /health

// 4. FRONTEND PLUGIN (catch-all, último)
await fastify.register(frontendPlugin, {...});
```

**Razón:** El frontend plugin captura `/*`, por lo que debe registrarse después de todas las rutas backend específicas.

---

## RESUMEN FUNCIONAL

### Backend (Node.js)

| Módulo | Estado | Función Principal |
|--------|--------|-------------------|
| **auth** | ✅ Completo | Validación JWT, middleware HTTP |
| **qr-projection** | ✅ Completo | Generación y rotación QR via WebSocket |
| **enrollment** | 🚧 Parcial | Enrolamiento FIDO2 (stubs en validación) |

### Frontend (Cliente Web)

| Módulo | Estado | Función Principal |
|--------|--------|-------------------|
| **auth** | ✅ Completo | Recepción y almacenamiento JWT via postMessage |
| **websocket** | ✅ Completo | Cliente WebSocket autenticado con reconexión |
| **qr-projection** | ✅ Completo | Renderizado de QR recibidos via WebSocket |
| **qr-reader** | ✅ Completo | Lectura QR desde cámara dispositivo |

### Infraestructura

| Componente | Estado | Función Principal |
|-----------|--------|-------------------|
| **config** | ✅ Completo | Configuración centralizada |
| **ValkeyClient** | ✅ Completo | Singleton Redis/Valkey |
| **frontend-plugin** | ✅ Completo | Proxy Vite (dev) / Static files (prod) |

---

## PRINCIPIOS ARQUITECTÓNICOS APLICADOS

### Separation of Concerns (SoC)
- Backend y frontend completamente separados
- Módulos con responsabilidad única
- Plugin frontend aislado del core backend

### Domain-Driven Design (DDD)
- Capas: Domain → Application → Infrastructure → Presentation
- Value Objects: `UserId`, `SessionId`
- Repositories para persistencia

### Dependency Injection
- Composition Root en `app.ts`
- Configuración inyectada en constructores
- Facilita testing y mantenibilidad

### Vertical Slicing
- Cada módulo encapsula su dominio completo
- No hay dependencias cruzadas entre módulos de dominio
- Shared infrastructure es la única excepción controlada

---

## RECOMENDACIONES

### Prioridad Alta
1. **Completar validación WebAuthn real** en `EnrollmentService`
   - Integrar librería `@simplewebauthn/server`
   - Validar attestation y assertion
   - Extraer y almacenar public key

2. **Implementar schema PostgreSQL** `enrollment.devices`
   - Migración SQL con estructura FIDO2
   - AAGUID, credentialId, publicKey, counter

3. **Implementar ECDH key exchange real**
   - Derivación `handshake_secret` con HKDF
   - Integración con crypto nativo Node.js

### Prioridad Media
4. **Módulo `attendance/`** (futuro)
   - Validación N rondas QR
   - Cálculo umbral de certeza
   - Registro en PostgreSQL

5. **Testing automatizado**
   - Unit tests para servicios
   - Integration tests para controllers
   - E2E tests para flujos completos

### Prioridad Baja
6. **Optimizaciones de rendimiento**
   - Pool de conexiones PostgreSQL
   - Compresión WebSocket
   - Caché de QR generados

---

**Fin del informe**

Este análisis documenta la arquitectura modular actual, separación de responsabilidades y estado de implementación de cada componente del sistema. La estructura sigue los principios establecidos en el README.md y mantiene coherencia con el enfoque de vertical slicing y DDD.
