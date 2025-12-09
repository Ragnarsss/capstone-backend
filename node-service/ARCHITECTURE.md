# Arquitectura del Servicio Node.js

## Separation of Concerns (SoC) Estricto

Esta aplicacion sigue principios estrictos de separacion de responsabilidades para mantener un codigo limpio, mantenible y testeable.

## Estructura del Proyecto

```
node-service/
├── src/
│   ├── backend/              # Modulos de dominio backend (DDD)
│   │   ├── qr-projection/    # Logica de proyeccion de QR via WebSocket
│   │   ├── attendance/       # Logica de asistencia y validacion
│   │   ├── enrollment/       # Logica de enrollment FIDO2
│   │   └── auth/             # JWT utils compartidos
│   ├── plugins/              # Plugins de Fastify (concerns transversales)
│   │   └── frontend-plugin.ts
│   ├── frontend/             # Aplicacion frontend (cliente)
│   │   ├── features/         # Modulos frontend (enrollment, qr-host, etc)
│   │   ├── shared/           # Utilidades compartidas frontend
│   │   └── types/            # Tipos TypeScript
│   ├── shared/               # Infraestructura compartida backend
│   │   ├── config/           # Configuracion centralizada
│   │   ├── infrastructure/   # Clientes y repos compartidos
│   │   │   ├── valkey/       # ValkeyClient, ProjectionPoolRepository, ActiveSessionRepository
│   │   │   ├── database/     # PostgreSQL pool
│   │   │   └── crypto/       # AesGcmService
│   │   └── types/            # Tipos compartidos
│   ├── middleware/           # Middlewares Fastify
│   ├── app.ts                # Composicion de aplicacion (SOLO backend)
│   └── index.ts              # Entry point
├── vite.config.ts            # Configuracion Vite (SOLO frontend)
└── package.json              # Dependencias
```

## Capas y Responsabilidades

### 1. Modulos Backend (`src/backend/`)

Organizados siguiendo Domain-Driven Design (DDD):

```
backend/
├── qr-projection/
│   ├── domain/              # Entidades, value objects, reglas de negocio
│   │   ├── models.ts        # QRPayload, QRPayloadEnvelope, etc
│   │   ├── session-id.ts    # Value Object para IDs de sesion
│   │   ├── qr-generator.ts  # Generador de payloads (legacy)
│   │   └── services/
│   │       └── payload-builder.service.ts  # Servicio puro de dominio
│   ├── application/         # Casos de uso, servicios de aplicacion
│   │   ├── qr-projection.service.ts        # Orquestador principal
│   │   └── services/
│   │       ├── pool-feeder.service.ts      # Alimenta pool con QRs de estudiantes
│   │       ├── pool-balancer.service.ts    # Balancea pool con QRs falsos
│   │       └── qr-emitter.service.ts       # Emite QRs a intervalos
│   ├── infrastructure/      # Implementaciones concretas (DB, cache)
│   └── presentation/        # Controllers (HTTP, WebSocket)
│       └── websocket-controller.ts
├── attendance/
│   ├── domain/              # Modelos de asistencia
│   ├── application/         # ParticipationService, ValidateScanUseCase
│   ├── infrastructure/      # Adapters, repositorios locales
│   └── presentation/        # Rutas HTTP
└── enrollment/
    ├── domain/              # FIDO2, ECDH
    ├── application/         # Casos de uso enrollment
    ├── infrastructure/      # Crypto services, DB repos
    └── presentation/        # Rutas enrollment
```

**Patron de Servicios (Fase 10):**

```
QRProjectionService (Orquestador)
    │
    ├── PoolBalancer        ─── Mantiene pool con tamaño mínimo (QRs falsos)
    │       │
    │       └── PayloadBuilder  ─── Genera payloads (dominio puro)
    │
    └── QREmitter           ─── Emite QRs del pool via callback
            │
            └── ProjectionPoolRepository ─── Storage en Valkey
```

**Responsabilidad:** Logica de negocio UNICAMENTE backend.

### 2. Plugin de Frontend (`src/plugins/frontend-plugin.ts`)

**Responsabilidad:** Servir el frontend segun el entorno.

- **Desarrollo:** Proxy a Vite dev server (HMR, transpilacion TypeScript)
- **Produccion:** Servir archivos estaticos compilados

**Principio:** Aislar TODA la logica de frontend en un plugin separado.

```typescript
// Ejemplo de uso
await fastify.register(frontendPlugin, {
  isDevelopment: config.env.isDevelopment,
  viteUrl: config.frontend.viteUrl,
  vitePath: config.frontend.vitePath,
  staticPath: config.frontend.staticPath,
});
```

### 3. Configuracion Centralizada (`src/shared/config/`)

**Responsabilidad:** Toda la configuracion en un solo lugar.

```typescript
export const config = {
  env: { isDevelopment, isProduction },
  server: { host, port },
  frontend: { viteUrl, vitePath, staticPath },
  valkey: { host, port },
  qr: { countdownSeconds, regenerationInterval },
  jwt: { secret, expiresIn, issuer, audience },
};
```

**Principio:** Single source of truth para configuracion.

### 4. Application Bootstrap (`src/app.ts`)

**Responsabilidad:** Composicion de modulos backend UNICAMENTE.

**Orden de registro:**
1. Infraestructura compartida (WebSocket, Valkey)
2. Modulos backend (rutas especificas: `/ws`, `/api/*`)
3. Frontend plugin (catch-all, registrar ULTIMO)

```typescript
export async function createApp() {
  // 1. Infraestructura
  await fastify.register(fastifyWebSocket);
  const valkeyClient = ValkeyClient.getInstance();

  // 2. Modulos backend
  await wsController.register(fastify);
  await enrollmentController.register(fastify);

  // 3. Frontend (ultimo)
  await fastify.register(frontendPlugin, {...});
}
```

**Principio:** app.ts NO contiene logica de frontend directamente.

### 5. Frontend (`src/frontend/`)

**Responsabilidad:** Cliente web que se ejecuta en el navegador.

- Modulos independientes (auth, websocket, qr-projection)
- Comunicacion con backend via WebSocket
- NO mezclado con logica backend

**Principio:** Frontend es un concern completamente separado.

### 6. Vite Config (`vite.config.ts`)

**Responsabilidad:** Configuracion del bundler y dev server UNICAMENTE.

- Configuracion de build
- Dev server settings
- NO contiene logica de proxy a backend (ya no necesario)

**Principio:** Vite solo se preocupa de frontend.

## Flujo de Peticiones

### Desarrollo

```
Usuario (navegador)
  |
  v
Apache:80 (ProxyPass /asistencia)
  |
  v
Fastify:3000 (backend modules)
  |-- /ws       -> WebSocket Controller
  |-- /api/*    -> Enrollment Controller
  |-- /health   -> Health Check
  |-- /*        -> Frontend Plugin
                    |
                    v
                 Vite:5173 (dev server)
                    |-- Transpila TypeScript
                    |-- Sirve archivos fuente
                    |-- Hot Module Replacement
```

### Produccion

```
Usuario (navegador)
  |
  v
Apache:80 (ProxyPass /asistencia)
  |
  v
Fastify:3000 (backend modules)
  |-- /ws       -> WebSocket Controller
  |-- /api/*    -> Enrollment Controller
  |-- /health   -> Health Check
  |-- /*        -> Frontend Plugin
                    |
                    v
                 Archivos estaticos compilados
                 (dist/frontend/)
```

## Ventajas de esta Arquitectura

### 1. Separation of Concerns Estricto

- Backend: `src/modules/`, `src/shared/`, `src/app.ts`
- Frontend: `src/frontend/`, `vite.config.ts`
- Integracion: `src/plugins/frontend-plugin.ts`

### 2. Testabilidad

Cada capa puede testearse independientemente:
- Modulos backend: unit tests sin frontend
- Frontend: tests sin backend (mocks)
- Plugin frontend: tests de integracion

### 3. Mantenibilidad

- Cambios en frontend NO afectan app.ts
- Cambios en backend NO afectan vite.config.ts
- Configuracion centralizada facil de modificar

### 4. Escalabilidad

- Facil agregar nuevos modulos backend
- Facil agregar nuevos modulos frontend
- Plugin pattern permite agregar mas concerns (logging, metrics, etc)

### 5. Claridad

- Cada archivo tiene una responsabilidad clara
- Facil para nuevos desarrolladores entender el codigo
- Documentacion auto-explicativa por estructura

## Principios Aplicados

1. **Single Responsibility Principle (SRP)**
   - Cada modulo, plugin, archivo tiene UNA responsabilidad

2. **Dependency Inversion Principle (DIP)**
   - Modulos dependen de abstracciones (interfaces)
   - Configuracion inyectada via parametros

3. **Open/Closed Principle (OCP)**
   - Abierto a extension (nuevos plugins, modulos)
   - Cerrado a modificacion (app.ts no cambia)

4. **Separation of Concerns (SoC)**
   - Backend, frontend, configuracion, plugins separados
   - NO mezcla de responsabilidades

## Restricciones Arquitecturales

Esta aplicacion funciona bajo restricciones especificas:

1. **Servidor PHP Legacy No Modificable**
   - PHP maneja autenticacion de usuarios
   - PHP sirve el modal/iframe principal
   - Node.js solo accesible via PHP (no directo)

2. **Frontend en Iframe**
   - Embebido en modal de servidor PHP
   - Autenticacion via JWT postMessage
   - Aislado de aplicacion principal PHP

3. **WebSocket para Datos en Tiempo Real**
   - QR codes entregados via WebSocket (no HTTP)
   - Autenticacion JWT en handshake
   - Alta frecuencia de actualizacion

Por estas restricciones, NO se usa:
- fastify-vite (para SSR/isomorficas)
- Acceso directo a Vite desde host
- Modificaciones a servidor PHP

## Configuracion de Entorno

### Variables de Entorno

```bash
# Entorno
NODE_ENV=production|development

# Servidor
HOST=0.0.0.0
PORT=3000

# Frontend (solo desarrollo)
VITE_URL=http://localhost:5173
VITE_BASE_PATH=/asistencia/
STATIC_PATH=/app/dist/frontend

# Valkey
VALKEY_HOST=valkey
VALKEY_PORT=6379

# JWT (debe coincidir con PHP)
JWT_SECRET=CAMBIAR_EN_PRODUCCION
```

### Modo Desarrollo

```bash
npm run dev
```

Ejecuta:
- `tsx watch src/index.ts` (backend con hot reload)
- `vite` (frontend dev server con HMR)

### Modo Produccion

```bash
npm run build    # Compila backend + frontend
npm start        # Ejecuta dist/index.js
```

## Proximos Pasos

Para extender esta arquitectura:

1. **Agregar nuevo modulo backend:**
   - Crear en `src/backend/nuevo-modulo/`
   - Seguir estructura DDD (domain, application, infrastructure, presentation)
   - Registrar controller en `src/app.ts`

2. **Agregar nuevo modulo frontend:**
   - Crear en `src/frontend/features/nuevo-modulo/`
   - Seguir patron de componentes con services

3. **Agregar nuevo plugin:**
   - Crear en `src/plugins/nuevo-plugin.ts`
   - Registrar en `src/app.ts`
   - Documentar responsabilidad

4. **Agregar servicio compartido:**
   - Crear en `src/shared/infrastructure/`
   - Exportar desde barrel (index.ts)
   - Documentar por que es compartido

## Glosario de Servicios

### QR Projection Module

| Servicio | Capa | Responsabilidad |
|----------|------|-----------------|
| `PayloadBuilder` | Domain | Construir QRPayloadV1 (puro, sin side effects) |
| `PoolFeeder` | Application | Alimentar pool con QRs de estudiantes |
| `PoolBalancer` | Application | Mantener pool con tamaño mínimo usando fakes |
| `QREmitter` | Application | Emitir QRs a intervalos regulares |
| `QRProjectionService` | Application | Orquestar ciclo de vida de proyección |
| `WebSocketController` | Presentation | Manejar conexiones WebSocket |

### Attendance Module

| Servicio | Capa | Responsabilidad |
|----------|------|-----------------|
| `ParticipationService` | Application | Registrar estudiantes, generar QRs |
| `ValidateScanUseCase` | Application | Validar QRs escaneados |
| `CompleteScanUseCase` | Application | Completar escaneo y persistir |

> **Nota**: `FakeQRGenerator` fue eliminado en Fase 11-9. Usar `PoolBalancer` de qr-projection.

### Shared Infrastructure

| Componente | Ubicación | Responsabilidad |
|------------|-----------|-----------------|
| `ValkeyClient` | shared/infrastructure/valkey | Cliente Redis singleton |
| `ProjectionPoolRepository` | shared/infrastructure/valkey | Pool de QRs para proyección |
| `ActiveSessionRepository` | shared/infrastructure/valkey | Sesión activa global |
| `AesGcmService` | shared/infrastructure/crypto | Encriptación AES-256-GCM |
| `PostgresPool` | shared/infrastructure/database | Pool de conexiones PostgreSQL |

## Referencias

- [Fastify Documentation](https://fastify.dev/)
- [Vite Documentation](https://vite.dev/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
