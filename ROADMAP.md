# ROADMAP - Plan de Implementacion

> Fuente de verdad para tareas pendientes.
> Ultima actualizacion: 2025-12-16 (agregadas fases 21.1.1, 24, 25)

---

## Resumen de Estado

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 1-16 | Fundamentos, FIDO2, QR, Pipeline | COMPLETADA |
| 17 | SoC Enrollment (automatas, policy) | COMPLETADA |
| 18.0 | Access Gateway Backend | COMPLETADA |
| 18.1 | Simplificar Frontend Enrollment | COMPLETADA |
| **19.1** | **shared/ports/ - Interfaces cross-domain** | COMPLETADA |
| **19.2** | **session/ - Dominio Session** | COMPLETADA |
| **19.3** | **restriction/ - Dominio Restriction** | COMPLETADA |
| **20** | **Limpieza Legacy (7 subfases)** | COMPLETADA |
| **21.1** | **Servicios compartidos enrollment** | COMPLETADA |
| **21.1.1** | **Fix: LoginService sin authClient** | PENDIENTE |
| **21** | **Unificar Frontend** | EN PROGRESO |
| **22** | **Hardening Criptografico** | PENDIENTE |
| **23** | **Puente PHP Produccion** | PENDIENTE |
| **24** | **Infraestructura y Operaciones** | PENDIENTE |
| **25** | **Testing E2E y Calidad** | PENDIENTE |

---

## Politica de Seleccion de Modelo IA

| Modelo | Usar cuando |
|--------|-------------|
| **Sonnet** | Tareas bien especificadas, patrones existentes, refactoring mecanico |
| **Opus** | Decisiones arquitectonicas, ambiguedad, razonamiento complejo, bloqueos |

---

## Arquitectura Objetivo

Ver `spec-architecture.md` para diagramas completos.

```
backend/
├── access/          # Gateway lectura (existe)
├── attendance/      # Validacion QR (existe)
├── auth/            # JWT (existe)
├── enrollment/      # Solo FIDO2 devices (limpiar)
├── session/         # ECDH login (CREAR)
├── restriction/     # Stub PHP (CREAR)
└── shared/
    └── ports/       # Interfaces cross-domain (CREAR)

frontend/features/
├── enrollment/      # UI registro (mantener)
├── qr-reader/       # Lector (refactorizar)
├── qr-host/         # Proyector (mantener)
└── guest/           # ELIMINAR

frontend/shared/
└── services/
    └── enrollment/  # Servicios unificados (CREAR)
```

---

## Fase 19: Separacion de Dominios

**Objetivo:** Extraer Session y Restriction como dominios independientes.
**Rama base:** `fase-19-domain-separation`
**Modelo recomendado global:** Sonnet (tareas mecanicas de mover codigo)

---

### 19.1: Crear shared/ports/ con interfaces cross-domain

**Rama:** `fase-19.1-shared-ports`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** Las interfaces IDeviceQuery, ISessionQuery, IRestrictionQuery son usadas por Access Gateway pero estan en enrollment/. Deben estar en ubicacion neutral.

**Estructura a crear:**

```
shared/ports/
├── device-query.interface.ts
├── session-query.interface.ts
├── restriction-query.interface.ts
└── index.ts
```

**Tareas:**

- [x] Crear carpeta `node-service/src/backend/shared/ports/`
- [x] Mover `enrollment/domain/interfaces/device-query.interface.ts` a `shared/ports/`
- [x] Mover `enrollment/domain/interfaces/session-query.interface.ts` a `shared/ports/`
- [x] Mover `enrollment/domain/interfaces/restriction-query.interface.ts` a `shared/ports/`
- [x] Crear `shared/ports/index.ts` con exports
- [x] Actualizar imports en `access/` para usar `shared/ports/`
- [x] Actualizar imports en `enrollment/` para usar `shared/ports/`
- [x] Eliminar `enrollment/domain/interfaces/` (carpeta vacia)
- [x] Verificar tests: `npm run test` (134/134 passed)

**Criterio de exito:** COMPLETADO - Tests pasando, imports apuntan a shared/ports.
**Commit:** b208425

---

### 19.2: Crear dominio Session

**Rama:** `fase-19.2-session-domain`
**Modelo:** Sonnet
**Dificultad:** Media

**Justificacion:** LoginEcdhUseCase, SessionStateMachine y SessionKeyRepository son logica de sesion, no de enrollment. Segun spec-architecture.md deben estar separados.

**Estructura a crear:**

```
backend/session/
├── application/
│   └── use-cases/
│       └── login-ecdh.use-case.ts
├── domain/
│   ├── state-machines/
│   │   └── session-state-machine.ts
│   └── models.ts (SessionState, SESSION_STATES)
├── infrastructure/
│   ├── repositories/
│   │   └── session-key.repository.ts
│   └── adapters/
│       └── session-query.adapter.ts
├── presentation/
│   └── routes.ts
└── session.module.ts
```

**Tareas:**

- [x] Crear estructura de carpetas `backend/session/`
- [x] Mover `enrollment/application/use-cases/login-ecdh.use-case.ts` a `session/application/use-cases/`
- [x] Mover `enrollment/domain/state-machines/session-state-machine.ts` a `session/domain/state-machines/`
- [x] Extraer `SessionState` y `SESSION_STATES` de `enrollment/domain/models.ts` a `session/domain/models.ts`
- [x] Mover `enrollment/infrastructure/session-key.repository.ts` a `session/infrastructure/repositories/`
- [x] Mover `enrollment/infrastructure/adapters/session-query.adapter.ts` a `session/infrastructure/adapters/`
- [x] Crear `session/presentation/routes.ts` con `POST /api/session/login`
- [x] Crear `session/session.module.ts` para registro DI
- [x] Actualizar `enrollment/domain/models.ts` para NO exportar SessionState
- [x] Actualizar `enrollment/presentation/routes.ts` para NO registrar /login
- [x] Registrar session.module en `app.ts`
- [x] Actualizar imports en attendance/ y tests
- [x] Actualizar enrollment/infrastructure/adapters/index.ts (eliminar export de SessionQueryAdapter)
- [x] Actualizar enrollment/infrastructure/index.ts (eliminar export de SessionKeyRepository)
- [x] Actualizar enrollment/domain/state-machines/index.ts (eliminar export de SessionStateMachine)
- [x] Actualizar enrollment/application/use-cases/index.ts (eliminar export de LoginEcdhUseCase)
- [x] Verificar tests: `npm run test` (134/134 passed)

**Dependencias:** Requiere 19.1 completada (shared/ports).

**Criterio de exito:** COMPLETADO - Endpoint `POST /api/session/login` registrado, tests pasando, indices de enrollment limpios.
**Commits:** 0391c98, e9dc8e1, f21adc0

---

### 19.3: Crear dominio Restriction

**Rama:** `fase-19.3-restriction-domain`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** RestrictionService es un stub para integracion futura con PHP. Debe tener su propio dominio para cuando se implemente.

**Estructura a crear:**

```
backend/restriction/
├── application/
│   └── services/
│       └── restriction.service.ts (stub)
├── domain/
│   └── models.ts (RestrictionResult)
├── infrastructure/
│   └── adapters/
│       └── restriction-query.adapter.ts
└── restriction.module.ts
```

**Tareas:**

- [x] Crear estructura de carpetas `backend/restriction/`
- [x] Mover `enrollment/domain/services/restriction.service.ts` a `restriction/application/services/`
- [x] Crear `restriction/domain/models.ts` con tipo RestrictionResult
- [x] Mover `enrollment/infrastructure/adapters/restriction-query.adapter.ts` a `restriction/infrastructure/adapters/`
- [x] Crear `restriction/restriction.module.ts` para registro DI
- [x] Registrar restriction.module en `app.ts`
- [x] Actualizar imports en enrollment/domain/services/
- [x] Actualizar enrollment/infrastructure/adapters/index.ts (eliminar export de RestrictionQueryAdapter)
- [x] Actualizar enrollment/domain/services/index.ts (eliminar re-export de RestrictionService)
- [x] Verificar tests: `npm run test` (134/134 passed)

**Dependencias:** Requiere 19.1 completada (shared/ports).

**Criterio de exito:** COMPLETADO - Tests pasando, dominio restriction independiente, indices de enrollment limpios.
**Commits:** 2308b52, 7ce6b8f, f21adc0

---

## Fase 20: Limpieza Legacy

**Objetivo:** Eliminar codigo legacy y endpoints obsoletos.
**Rama base:** `fase-20-cleanup-legacy`
**Modelo recomendado global:** Sonnet

---

### 20.1: Eliminar endpoint /api/enrollment/status

**Rama:** `fase-20.1-remove-enrollment-status`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** Access Gateway (`GET /api/access/state`) reemplaza este endpoint. Ya no hay consumidores.

**Archivos a eliminar:**

- `enrollment/application/use-cases/get-enrollment-status.use-case.ts`
- `enrollment/presentation/controllers/enrollment-status.controller.ts`

**Tareas:**

- [x] Verificar que frontend usa `getStatus()` (encontrado en enrollment, qr-reader, guest)
- [x] Crear `GetDevicesUseCase` para reemplazar funcionalidad
- [x] Crear endpoint `GET /api/enrollment/devices`
- [x] Actualizar frontend para usar `/devices`
- [x] Eliminar `GetEnrollmentStatusUseCase`
- [x] Eliminar `EnrollmentStatusController`
- [x] Remover ruta `/status` de `enrollment/presentation/routes.ts`
- [x] Remover export de `enrollment/application/use-cases/index.ts`
- [x] Eliminar codigo legacy: `enrollment.service.ts`, `enrollment-controller.ts`
- [x] Mover `LoginEcdhController` a session domain
- [x] Verificar compilacion: `npm run build` (exitoso)
- [x] Verificar tests: `npm run test` (134/134 passed)

**Criterio de exito:** COMPLETADO - Endpoint `/devices` funcional, `/status` eliminado.
**Commit:** c372c2f

**Nota:** Fases 20.1 y 20.2 combinadas en un solo commit para mantener funcionalidad.

---

### 20.2: Crear endpoint /api/enrollment/devices

**Rama:** `fase-20.2-devices-endpoint` (combinada con 20.1)
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** El frontend necesita listar dispositivos para UI de revocacion. Este endpoint reemplaza la parte de listado de /status.

**Tareas:**

- [x] Crear `GetDevicesUseCase` en `enrollment/application/use-cases/`
- [x] Crear ruta `GET /api/enrollment/devices` en routes.ts
- [x] Actualizar `loadDevicesList()` en frontend para usar nuevo endpoint
- [x] Actualizar qr-reader y guest modules
- [x] Verificar compilacion y tests

**Criterio de exito:** COMPLETADO - UI muestra lista de dispositivos correctamente.
**Commit:** c372c2f (mismo que 20.1)

---

### 20.3: Eliminar controller legacy

**Rama:** `fase-20.3-remove-legacy-controller` (combinada con 20.1)
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** `enrollment-controller.ts` duplica rutas ya definidas en routes.ts.

**Tareas:**

- [x] Verificar que `routes.ts` tiene todas las rutas necesarias
- [x] Eliminar `enrollment/presentation/enrollment-controller.ts`
- [x] Eliminar `enrollment/application/enrollment.service.ts`
- [x] Verificar compilacion: `npm run build` (exitoso)

**Criterio de exito:** COMPLETADO - No hay controllers duplicados.
**Commit:** c372c2f (mismo que 20.1)

---

### 20.4: Limpiar codigo muerto en enrollment

**Rama:** `fase-20.4-cleanup-dead-code`
**Modelo:** Sonnet
**Dificultad:** Baja

**Estado:** N/A - Fase mal planteada, no hay codigo muerto

**Analisis realizado:**

- [x] `PenaltyService` - SI se usa activamente (16 referencias en controllers, routes, use cases)
- [x] `EnrollmentStateMachine` - NO existe como archivo, solo es nombre de bloque de test
- [x] `enrollment.service.ts` - Ya eliminado en fase 20.1-20.3

**Criterio de exito:** N/A - No hay codigo muerto que eliminar.

---

### 20.5: Actualizar imports en Access Gateway

**Rama:** `fase-20.5-fix-access-imports`
**Modelo:** Sonnet
**Dificultad:** Baja

**Estado:** COMPLETADA en fase 20.1 (commit c372c2f)

**Justificacion:** Access Gateway importa SessionQueryAdapter, SessionKeyRepository y RestrictionService desde enrollment/ cuando deben importarse desde session/ y restriction/ respectivamente. Esto viola SoC y mantiene acoplamiento innecesario.

**Archivos modificados:**

- `backend/access/presentation/routes.ts`

**Tareas:**

- [x] Actualizar import de SessionQueryAdapter: desde session/infrastructure/adapters/
- [x] Actualizar import de SessionKeyRepository: desde session/infrastructure/repositories/
- [x] Actualizar import de RestrictionQueryAdapter: desde restriction/infrastructure/adapters/
- [x] Actualizar import de RestrictionService: desde restriction/application/services/
- [x] Verificar compilacion: `npm run build`
- [x] Verificar tests: `npm run test` (134/134 passed)

**Dependencias:** Requiere 19.2 y 19.3 completadas.

**Criterio de exito:** COMPLETADO - Access Gateway importa directamente desde dominios session/ y restriction/.
**Commit:** c372c2f (mismo que 20.1-20.3)

---

### 20.6: Actualizar spec-qr-validation.md

**Rama:** `fase-20.6-update-spec-qr`
**Modelo:** Sonnet
**Dificultad:** Trivial

**Justificacion:** spec-qr-validation.md menciona endpoints que no existen o tienen rutas incorrectas, causando confusion al consultar la documentacion.

**Archivos a modificar:**

- `spec-qr-validation.md`
- `spec-architecture.md`

**Tareas:**

- [x] Linea 42: Reemplazar `POST /api/enrollment/flow/check` con `GET /api/access/state`
- [x] Linea 24: Actualizar referencia `/api/enrollment/login` a `/api/session/login`
- [x] Linea 62: Actualizar a `POST /asistencia/api/attendance/register`
- [x] Linea 126: Actualizar a `POST /api/attendance/validate`
- [x] Linea 282: Actualizar referencia de login ECDH a `/api/session/login`
- [x] Verificar spec-architecture.md (sin cambios necesarios)

**Criterio de exito:** COMPLETADO - spec-qr-validation.md refleja endpoints reales implementados.
**Commit:** 9bc38b5

---

### 20.7: Eliminar re-exports legacy en enrollment

**Rama:** `fase-20.7-remove-reexports`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** Enrollment todavia re-exporta componentes de session/ y restriction/ para backward compatibility temporal. Con 20.5 completada, estos re-exports causan confusion y deben eliminarse.

**Archivos a modificar:**

- `enrollment/infrastructure/index.ts`
- `enrollment/domain/services/index.ts`
- `enrollment/infrastructure/adapters/index.ts`
- `enrollment/presentation/controllers/` (LoginEcdhController - codigo muerto)

**Tareas:**

- [x] Eliminar re-export de SessionKeyRepository en enrollment/infrastructure/index.ts
- [x] Eliminar re-export de RestrictionService en enrollment/domain/services/index.ts
- [x] Eliminar re-export de RestrictionQueryAdapter en enrollment/infrastructure/adapters/index.ts
- [x] Eliminar enrollment/presentation/controllers/login-ecdh.controller.ts (codigo muerto, no usado en routes)
- [x] Limpiar enrollment/application/use-cases/index.ts (exports incorrectos de LoginEcdhUseCase)
- [x] Verificar compilacion: `npm run build` (exitoso)
- [x] Verificar tests: `npm run test` (134/134 passed)

**Dependencias:** Requiere 20.5 completada (imports actualizados).

**Criterio de exito:** COMPLETADA - Enrollment solo exporta sus propios componentes, no proxies de otros dominios.

**Nota:** Esta fase se completó implícitamente durante las fases 19.2 y 19.3 cuando se separaron los dominios session y restriction. Verificación realizada el 2025-12-15.

---

## Fase 21: Unificar Frontend

**Objetivo:** Eliminar duplicacion de servicios y features obsoletos.
**Rama base:** `fase-21-unify-frontend`
**Modelo recomendado global:** Sonnet (excepto 21.3)

---

### 21.1: Crear servicios compartidos de enrollment

**Rama:** `fase-21.1-shared-enrollment-services`
**Modelo:** Sonnet
**Dificultad:** Media

**Justificacion:** EnrollmentService, LoginService, SessionKeyStore estan duplicados en enrollment/ y guest/. Deben estar en shared/.

**Estructura a crear:**

```
frontend/shared/services/enrollment/
├── enrollment.service.ts
├── login.service.ts
├── session-key.store.ts
├── access.service.ts
└── index.ts
```

**Tareas:**

- [x] Crear carpeta `frontend/shared/services/enrollment/`
- [x] Unificar `enrollment/services/enrollment.service.ts` y `guest/modules/enrollment/enrollment.service.ts`
- [x] Unificar `enrollment/services/login.service.ts` y `guest/modules/enrollment/login.service.ts`
- [x] Unificar `enrollment/services/session-key.store.ts` y `guest/modules/enrollment/session-key.store.ts`
- [x] Crear `index.ts` con exports
- [x] Actualizar imports en `enrollment/main.ts` para usar shared/
- [x] Actualizar imports en `guest/main.ts` para usar shared/
- [x] Actualizar imports en `qr-reader/main.ts` para usar shared/
- [x] Eliminar servicios duplicados de `enrollment/services/`
- [x] Eliminar carpeta completa `guest/modules/enrollment/`
- [x] Verificar compilacion: `npm run build` (exitoso)
- [x] Verificar tests: `npm run test` (134/134 passed)

**Criterio de exito:** COMPLETADO - Un solo lugar para servicios de enrollment. Features activas (qr-host, qr-reader) compilan correctamente.

**Nota:** El feature `guest/` tiene codigo legacy con imports obsoletos pero NO esta en `vite.config.ts` y NO se compila. Sera eliminado en fase 21.3 segun planificacion.

---

### 21.1.1: Fix LoginService sin authClient

**Rama:** `fase-21.1.1-fix-login-service-authclient`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** Durante la unificacion de servicios (21.1), las instanciaciones de `LoginService` en `enrollment/main.ts` y `qr-reader/main.ts` quedaron sin pasar el parametro `authClient`. Esto causa que `getAuthToken()` retorne `null` y el login ECDH falle con "No se encontró token de autenticación".

**Archivos afectados:**

- `frontend/features/enrollment/main.ts` (linea ~54)
- `frontend/features/qr-reader/main.ts` (linea ~70)

**Problema actual:**

```typescript
// enrollment/main.ts
this.loginService = new LoginService();  // ERROR: Sin authClient

// login.service.ts
private getAuthToken(): string | null {
  return this.authClient?.getToken() ?? null;  // Retorna null!
}
```

**Solucion:**

```typescript
// enrollment/main.ts
this.loginService = new LoginService(this.authClient);  // CORRECTO: Con authClient

// qr-reader/main.ts
this.loginService = new LoginService(this.authClient);  // CORRECTO: Con authClient
```

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-21.1.1-fix-login-service-authclient`
3. Realizar cambios
4. Commit atomico: `git commit -m "fix(frontend): pasar authClient a LoginService en enrollment y qr-reader"`
5. Merge a rama base cuando tests pasen

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear rama de trabajo desde rama base
- [ ] Modificar `enrollment/main.ts`: cambiar `new LoginService()` a `new LoginService(this.authClient)`
- [ ] Modificar `qr-reader/main.ts`: cambiar `new LoginService()` a `new LoginService(this.authClient)`
- [ ] Verificar compilacion (dentro del contenedor): `podman exec asistencia-node npm run build`
- [ ] Verificar tests (dentro del contenedor): `podman exec asistencia-node npm run test`
- [ ] Probar flujo manualmente en navegador (login ECDH debe funcionar)
- [ ] Commit con mensaje descriptivo

**Dependencias:** Requiere 21.1 completada.

**Nota:** Todos los comandos npm DEBEN ejecutarse dentro del contenedor. El host NO tiene npm instalado (ver PROJECT-CONSTITUTION.md Art. 3.2).

**Criterio de exito:** El boton "Iniciar Sesion" en enrollment ejecuta login ECDH exitosamente sin error "No se encontró token de autenticación".

---

### 21.2: Refactorizar qr-reader para usar Access Gateway

**Rama:** `fase-21.2-qr-reader-access-gateway`
**Modelo:** Sonnet
**Dificultad:** Media

**Justificacion:** qr-reader importa directamente de enrollment/ (cross-feature) y tiene logica de inferencia legacy.

**Archivo:** `frontend/features/qr-reader/main.ts`

**Antes (lineas 27-30):**

```typescript
import { EnrollmentService } from '../enrollment/services/enrollment.service';
import { LoginService } from '../enrollment/services/login.service';
```

**Despues:**

```typescript
import { AccessService } from '../../shared/services/access.service';
```

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-21.2-qr-reader-access-gateway`
3. Realizar refactorizacion
4. Commit: `git commit -m "refactor(qr-reader): usar Access Gateway en lugar de inferencia local"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Copiar `AccessService` de enrollment/ a shared/services/
- [ ] Reemplazar logica de inferencia con `accessService.getState()`
- [ ] Si `state !== READY`: redirigir a enrollment feature
- [ ] Eliminar imports de EnrollmentService, LoginService
- [ ] Eliminar variable hasSessionKey como condicion
- [ ] Verificar compilacion: `podman exec asistencia-node npm run build`
- [ ] Verificar tests: `podman exec asistencia-node npm run test`
- [ ] Verificar flujo manualmente en navegador
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** qr-reader no importa de enrollment/, usa Access Gateway.

---

### 21.3: Eliminar feature guest/

**Rama:** `fase-21.3-remove-guest`
**Modelo:** Opus
**Dificultad:** Alta

**Justificacion:** guest/ reimplementa la state machine completa. Con Access Gateway, enrollment/ puede hacer todo.

**Consideraciones:**

- guest/ puede tener funcionalidad de postMessage que enrollment/ no tiene
- Necesita verificar que enrollment/ funciona en iframe
- Puede requerir agregar soporte iframe a enrollment/

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-21.3-remove-guest`
3. Migrar funcionalidad necesaria, eliminar guest/
4. Commit: `git commit -m "refactor(frontend): eliminar feature guest/, unificar en enrollment/"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Analizar diferencias entre guest/main.ts y enrollment/main.ts
- [ ] Identificar funcionalidad unica de guest/ (postMessage, estados)
- [ ] Si enrollment/ no soporta iframe: agregar soporte
- [ ] Si enrollment/ no tiene postMessage: agregar ParentMessenger
- [ ] Verificar enrollment/ funciona embebido en iframe
- [ ] Actualizar referencias en PHP simulator
- [ ] Eliminar carpeta `frontend/features/guest/`
- [ ] Verificar compilacion: `podman exec asistencia-node npm run build`
- [ ] Verificar tests: `podman exec asistencia-node npm run test`
- [ ] Verificar flujo completo manualmente
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Solo existe enrollment/ para flujo de estudiante.

---

## Fase 22: Hardening Criptografico

**Objetivo:** Completar validaciones de seguridad pendientes.
**Rama base:** `fase-22-hardening`
**Modelo recomendado global:** Opus (seguridad requiere razonamiento cuidadoso)

**Recordatorio de entorno:** Todos los comandos npm DEBEN ejecutarse dentro del contenedor Node. El host NO tiene npm instalado (PROJECT-CONSTITUTION.md Art. 3.2).

---

### 22.1: Validar TOTPu en Pipeline

**Rama:** `fase-22.1-totp-validation`
**Modelo:** Opus
**Dificultad:** Alta

**Justificacion:** Actualmente el backend no valida que el TOTPu enviado por el cliente sea correcto.

**Archivo:** `backend/attendance/application/validation-pipeline/stages/`

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-22.1-totp-validation`
3. Implementar stage de validacion
4. Commit: `git commit -m "feat(attendance): agregar validacion de TOTPu en pipeline"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear `totp-validation.stage.ts`
- [ ] Obtener session_key del usuario desde Valkey
- [ ] Generar TOTP esperado con session_key
- [ ] Comparar con TOTPu del payload
- [ ] Configurar ventana de tolerancia (+/-30 segundos)
- [ ] Agregar stage al pipeline en posicion correcta
- [ ] Crear tests unitarios
- [ ] Verificar tests (dentro del contenedor): `podman exec asistencia-node npm run test`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Payload con TOTPu incorrecto es rechazado.

---

### 22.2: Session Key Binding con credentialId

**Rama:** `fase-22.2-session-binding`
**Modelo:** Opus
**Dificultad:** Alta

**Justificacion:** La session_key debe estar ligada al dispositivo especifico para prevenir replay.

**Archivo:** `session/infrastructure/services/hkdf.service.ts` (despues de moverlo)

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-22.2-session-binding`
3. Implementar binding
4. Commit: `git commit -m "feat(session): agregar binding de session_key con credentialId"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Modificar `deriveSessionKey()` para incluir credentialId en info HKDF
- [ ] Actualizar frontend para derivar igual
- [ ] Considerar migracion de sesiones existentes
- [ ] Agregar tests
- [ ] Verificar tests (dentro del contenedor): `podman exec asistencia-node npm run test`
- [ ] Commit con mensaje descriptivo

**Consideraciones de migracion:**

- Opcion A: Forzar re-login para todos (simple)
- Opcion B: Periodo de transicion con ambos metodos (complejo)

**Criterio de exito:** session_key diferente para diferentes credentialId.

---

### 22.3: Validar AAGUID de dispositivo

**Rama:** `fase-22.3-aaguid-validation`
**Modelo:** Opus
**Dificultad:** Media

**Justificacion:** AAGUID identifica el modelo de autenticador. Puede usarse para whitelist/blacklist.

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-22.3-aaguid-validation`
3. Implementar extraccion y almacenamiento
4. Commit: `git commit -m "feat(enrollment): extraer y almacenar AAGUID de dispositivo"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Extraer AAGUID en FinishEnrollmentUseCase
- [ ] Almacenar AAGUID en tabla devices
- [ ] (Opcional) Crear whitelist de AAGUIDs permitidos
- [ ] Agregar tests
- [ ] Verificar tests (dentro del contenedor): `podman exec asistencia-node npm run test`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** AAGUID almacenado en BD para cada dispositivo.

---

## Fase 23: Puente PHP Produccion

**Objetivo:** Integrar con el sistema PHP existente para produccion.
**Rama base:** `fase-23-php-bridge`
**Modelo recomendado global:** Sonnet (integracion bien definida)

**Recordatorio de entorno:** Todos los comandos npm DEBEN ejecutarse dentro del contenedor Node. El host NO tiene npm instalado (PROJECT-CONSTITUTION.md Art. 3.2).

---

### 23.1: Endpoint interno para marcar asistencia

**Rama:** `fase-23.1-internal-attendance`
**Modelo:** Sonnet
**Dificultad:** Media

**Justificacion:** El sistema Node valida QR, pero PHP debe registrar la asistencia en su BD.

**Estructura:**

```
backend/attendance/presentation/routes/
  internal.routes.ts
```

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-23.1-internal-attendance`
3. Implementar endpoint
4. Commit: `git commit -m "feat(attendance): agregar endpoint interno para marcar asistencia"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear `POST /api/internal/mark-attendance`
- [ ] Schema: `{ codigo, rut, ip, certainty, encuesta? }`
- [ ] Validar header `X-Node-Signature` (secreto compartido)
- [ ] Retornar resultado de validacion
- [ ] Agregar tests
- [ ] Verificar tests (dentro del contenedor): `podman exec asistencia-node npm run test`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** PHP puede llamar a Node para marcar asistencia.

---

### 23.2: Controller PHP para recibir

**Rama:** `fase-23.2-php-controller`
**Modelo:** Sonnet
**Dificultad:** Media

**Ubicacion:** `php-service/src/asistencia-node-integration/`

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-23.2-php-controller`
3. Implementar controller PHP
4. Commit: `git commit -m "feat(php): agregar controller para recibir asistencia de Node"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear `MarkAttendanceController.php`
- [ ] Agregar ruta en Router (si existe)
- [ ] Validar firma de Node
- [ ] Insertar en BD de PHP
- [ ] Retornar confirmacion
- [ ] Probar flujo manualmente
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Asistencia aparece en sistema PHP.

---

### 23.3: Encuesta post-validacion

**Rama:** `fase-23.3-survey`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** El sistema legacy requiere encuesta despues de marcar asistencia.

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-23.3-survey`
3. Implementar componente de encuesta
4. Commit: `git commit -m "feat(frontend): agregar componente de encuesta post-validacion"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear componente `SurveyForm.ts` en frontend
- [ ] Mostrar tras validacion exitosa
- [ ] Enviar respuestas a Node
- [ ] Node envia a PHP junto con asistencia
- [ ] Verificar compilacion: `podman exec asistencia-node npm run build`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Encuesta se muestra y guarda.

---

### 23.4: Notificacion al parent (postMessage)

**Rama:** `fase-23.4-parent-notification`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** El iframe debe notificar al parent PHP cuando termina.

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-23.4-parent-notification`
3. Implementar postMessage
4. Commit: `git commit -m "feat(frontend): agregar notificacion postMessage al parent PHP"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Implementar `postMessage({ type: 'ATTENDANCE_COMPLETE' })`
- [ ] Implementar `postMessage({ type: 'CLOSE_IFRAME' })`
- [ ] PHP listener para cerrar modal
- [ ] Verificar compilacion: `podman exec asistencia-node npm run build`
- [ ] Verificar flujo completo manualmente
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Modal se cierra automaticamente tras exito.

---

## Fase 24: Infraestructura y Operaciones

**Objetivo:** Preparar el sistema para despliegue en produccion con configuracion robusta.
**Rama base:** `fase-24-infrastructure`
**Modelo recomendado global:** Sonnet (tareas de configuracion bien definidas)

**Recordatorio de entorno:** Todos los comandos npm DEBEN ejecutarse dentro del contenedor Node. El host NO tiene npm instalado (PROJECT-CONSTITUTION.md Art. 3.2).

---

### 24.1: Consolidar y ejecutar migraciones de base de datos

**Rama:** `fase-24.1-run-migrations`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** Las migraciones 001, 002 y 003 estan fragmentadas. Para simplificar el mantenimiento y evitar errores de orden, se consolidaron en un solo archivo `001-schema.sql` con todas las columnas y indices necesarios. Los archivos 002 y 003 originales deben eliminarse.

**Archivos modificados/creados:**

- `database/migrations/001-schema.sql` (consolidado - YA CREADO)
- `database/init.sh` (sin emoticones - YA ACTUALIZADO)

**Archivos a eliminar:**

- `database/migrations/001-initial-schema.sql` (obsoleto)
- `database/migrations/002-add-transports.sql` (consolidado en 001)
- `database/migrations/003-add-enrollment-status.sql` (consolidado en 001)

**Estrategia de migracion:**

1. **Desarrollo**: Eliminar volumen existente y recrear desde cero
2. **Produccion**: Si ya hay datos, ejecutar 002 y 003 manualmente antes de consolidar

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-24.1-consolidate-migrations`
3. Eliminar archivos obsoletos
4. Commit: `git commit -m "refactor(database): consolidar migraciones en 001-schema.sql"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [x] Crear `database/migrations/001-schema.sql` consolidado (HECHO)
- [x] Actualizar `database/init.sh` sin emoticones (HECHO)
- [ ] Eliminar `database/migrations/001-initial-schema.sql`
- [ ] Eliminar `database/migrations/002-add-transports.sql`
- [ ] Eliminar `database/migrations/003-add-enrollment-status.sql`
- [ ] Detener contenedores: `podman compose -f compose.dev.yaml down`
- [ ] Eliminar volumen de BD: `podman volume rm asistencia_postgres-data` (si existe)
- [ ] Recrear contenedores: `podman compose -f compose.dev.yaml up -d`
- [ ] Verificar tablas: `podman exec asistencia-db psql -U postgres -d asistencia -c '\dt enrollment.*'`
- [ ] Verificar columnas: `podman exec asistencia-db psql -U postgres -d asistencia -c '\d enrollment.devices'`
- [ ] Crear `database/README.md` documentando el proceso
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Consulta `SELECT status, transports FROM enrollment.devices` ejecuta sin error, mostrando que ambas columnas existen.

---

### 24.2: Configurar variables de entorno para produccion

**Rama:** `fase-24.2-env-production`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** Los archivos `compose.*.yaml.example` deben documentarse y los valores sensibles (JWT_SECRET, DB passwords) deben manejarse correctamente.

**Archivos a revisar/crear:**

- `compose.prod.yaml` (crear desde example)
- `.env.example` (documentar variables requeridas)

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-24.2-env-production`
3. Realizar cambios
4. Commit: `git commit -m "config(env): documentar variables de entorno para produccion"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear `.env.example` con todas las variables necesarias documentadas
- [ ] Documentar diferencias entre dev y prod en README.md
- [ ] Verificar que secrets no esten hardcodeados en codigo (grep para passwords, secrets)
- [ ] Agregar validacion de variables requeridas al arranque de Node
- [ ] Verificar compilacion: `podman exec asistencia-node npm run build`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Sistema arranca correctamente con variables de `.env` en produccion.

---

### 24.3: Health checks y monitoreo basico

**Rama:** `fase-24.3-health-checks`
**Modelo:** Sonnet
**Dificultad:** Media

**Justificacion:** Los contenedores necesitan health checks para orquestadores (Podman, Kubernetes) y para detectar fallos de conectividad a PostgreSQL/Valkey.

**Endpoints a crear:**

```
GET /api/health          -> { status: 'ok', timestamp }
GET /api/health/ready    -> { db: 'ok', valkey: 'ok', ... }
GET /api/health/live     -> { status: 'ok' }
```

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-24.3-health-checks`
3. Implementar endpoints
4. Commit: `git commit -m "feat(health): agregar endpoints de health check"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear `backend/shared/health/health.routes.ts`
- [ ] Implementar verificacion de conexion a PostgreSQL
- [ ] Implementar verificacion de conexion a Valkey
- [ ] Verificar tests: `podman exec asistencia-node npm run test`
- [ ] Agregar health checks en `compose.prod.yaml`
- [ ] Documentar endpoints en README.md
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** `curl localhost:3000/api/health/ready` retorna estado de todos los servicios.

---

### 24.4: Logging estructurado

**Rama:** `fase-24.4-structured-logging`
**Modelo:** Sonnet
**Dificultad:** Media

**Justificacion:** Los logs actuales usan `console.log` sin estructura. Para produccion se requiere JSON estructurado con niveles (info, warn, error) y correlacion de requests.

**Archivos a modificar:**

- `backend/shared/logging/` (crear)
- Todos los archivos que usan `console.log`

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-24.4-structured-logging`
3. Implementar servicio de logging
4. Commit: `git commit -m "feat(logging): implementar logging estructurado con Pino"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear servicio de logging con Pino (ya incluido en Fastify)
- [ ] Configurar formato JSON en produccion, pretty en desarrollo
- [ ] Agregar request-id a cada request para correlacion
- [ ] Reemplazar `console.log` criticos por logger estructurado
- [ ] Configurar rotacion de logs si aplica
- [ ] Verificar tests: `podman exec asistencia-node npm run test`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Logs en produccion son JSON parseables con request-id.

---

## Fase 25: Testing E2E y Calidad

**Objetivo:** Asegurar calidad del sistema con tests automatizados y validacion de flujos completos.
**Rama base:** `fase-25-testing-quality`
**Modelo recomendado global:** Opus (requiere diseno de estrategia de testing)

**Recordatorio de entorno:** Todos los comandos npm DEBEN ejecutarse dentro del contenedor Node. El host NO tiene npm instalado (PROJECT-CONSTITUTION.md Art. 3.2).

---

### 25.1: Tests de integracion para Access Gateway

**Rama:** `fase-25.1-access-gateway-integration-tests`
**Modelo:** Sonnet
**Dificultad:** Media

**Justificacion:** Access Gateway es el punto central de lectura de estado. Debe tener tests que verifiquen todos los estados posibles: NOT_ENROLLED, ENROLLED_NO_SESSION, READY, BLOCKED.

**Archivo a crear:**

- `backend/access/__tests__/access-gateway.integration.test.ts`

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-25.1-access-gateway-integration-tests`
3. Crear tests
4. Commit: `git commit -m "test(access): agregar tests de integracion para Access Gateway"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Test: Usuario sin dispositivo -> `state: NOT_ENROLLED`
- [ ] Test: Usuario con dispositivo sin sesion -> `state: ENROLLED_NO_SESSION`
- [ ] Test: Usuario con dispositivo y sesion -> `state: READY`
- [ ] Test: Usuario bloqueado -> `state: BLOCKED`
- [ ] Test: JWT invalido -> `401 Unauthorized`
- [ ] Verificar tests (dentro del contenedor): `podman exec asistencia-node npm run test`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** 100% de cobertura de estados en Access Gateway.

---

### 25.2: Tests E2E para flujo de enrollment

**Rama:** `fase-25.2-e2e-enrollment`
**Modelo:** Opus
**Dificultad:** Alta

**Justificacion:** El flujo enrollment -> login ECDH -> session_key es critico y debe probarse end-to-end con un navegador real (Playwright).

**Dependencias externas:**

- Playwright
- Contenedores corriendo (PostgreSQL, Valkey, Node)

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-25.2-e2e-enrollment`
3. Implementar tests
4. Commit: `git commit -m "test(e2e): agregar tests E2E para flujo de enrollment"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Instalar Playwright (dentro del contenedor): `podman exec asistencia-node npm install -D @playwright/test`
- [ ] Crear `tests/e2e/enrollment.spec.ts`
- [ ] Test: Enrollment completo con WebAuthn mock
- [ ] Test: Login ECDH genera session_key valida
- [ ] Test: Revocacion de dispositivo
- [ ] Agregar script `npm run test:e2e` en package.json
- [ ] Documentar como ejecutar tests E2E
- [ ] Commit con mensaje descriptivo

**Consideraciones:**

- WebAuthn requiere mock de `navigator.credentials.create()`
- Usar virtual authenticators de Playwright si disponible

**Criterio de exito:** Test E2E pasa en CI sin intervencion manual.

---

### 25.3: Tests E2E para flujo de asistencia QR

**Rama:** `fase-25.3-e2e-attendance`
**Modelo:** Opus
**Dificultad:** Alta

**Justificacion:** El flujo completo QR host -> scan -> validacion -> registro es el objetivo final del sistema.

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-25.3-e2e-attendance`
3. Implementar tests
4. Commit: `git commit -m "test(e2e): agregar tests E2E para flujo de asistencia QR"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Crear `tests/e2e/attendance.spec.ts`
- [ ] Test: QR host genera codigo valido cada 30s
- [ ] Test: QR reader escanea y valida correctamente
- [ ] Test: Payload con TOTPu incorrecto es rechazado
- [ ] Test: Replay attack es detectado
- [ ] Verificar tests (dentro del contenedor): `podman exec asistencia-node npm run test:e2e`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Flujo completo de asistencia funciona en test automatizado.

---

### 25.4: Cobertura de codigo y reporte

**Rama:** `fase-25.4-code-coverage`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** Medir cobertura de tests permite identificar areas no probadas.

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-25.4-code-coverage`
3. Configurar cobertura
4. Commit: `git commit -m "config(test): agregar reporte de cobertura de codigo"`

**Tareas:**

- [ ] Verificar estado del repositorio: `git status`
- [ ] Configurar Vitest para generar reporte de cobertura
- [ ] Agregar script `npm run test:coverage` en package.json
- [ ] Establecer umbral minimo de cobertura (ej: 70%)
- [ ] Generar badge de cobertura para README.md
- [ ] Identificar archivos con baja cobertura
- [ ] Verificar (dentro del contenedor): `podman exec asistencia-node npm run test:coverage`
- [ ] Commit con mensaje descriptivo

**Criterio de exito:** Reporte de cobertura disponible en `coverage/index.html`.

---

## Diagrama de Dependencias

```
Fase 19.1 (shared/ports)
    │
    ├──► Fase 19.2 (session domain)
    │         │
    │         ├──► Fase 20.5 (fix access imports)
    │         │
    │         └──► Fase 22.2 (session binding)
    │
    └──► Fase 19.3 (restriction domain)
              │
              └──► Fase 20.5 (fix access imports)

Fase 20.1-20.4 (cleanup) ──┐
Fase 20.5 (fix imports)    ├──► Fase 20.7 (remove reexports) ──► Fase 21 (unify frontend)
Fase 20.6 (update spec)    ┘                                           │
                                                                        ▼
                                                                  Fase 21.1 (shared services)
                                                                        │
                                                                        ├──► Fase 21.1.1 (fix LoginService)
                                                                        │
                                                                        ├──► Fase 21.2 (qr-reader refactor)
                                                                        │
                                                                        └──► Fase 21.3 (remove guest)

Fase 22.1 (TOTP) ──┐
Fase 22.2 (binding)├──► Fase 23 (PHP bridge) ──► Fase 24 (infrastructure)
Fase 22.3 (AAGUID)─┘                                    │
                                                        └──► Fase 25 (testing E2E)

Fase 24.1 (migrations) ◄── Independiente, puede ejecutarse en cualquier momento
Fase 24.2 (env vars)   ◄── Independiente, puede ejecutarse en cualquier momento
```

---

## Criterios de Aceptacion Global

1. **Dominios Independientes:** Cada carpeta en backend/ tiene una sola responsabilidad
2. **Access Gateway:** Unico punto de lectura de estado
3. **Sin Inferencia Frontend:** Frontend solo renderiza segun backend
4. **Sin Codigo Legacy:** No existe /api/enrollment/status, guest/, controller duplicado
5. **Tests Pasan:** `npm run test` sin errores
6. **Documentacion Actualizada:** spec-architecture.md refleja realidad

---

## Referencias

- `spec-architecture.md` - Arquitectura de dominios (fuente de verdad)
- `spec-qr-validation.md` - Flujo de validacion QR
- `PROJECT-CONSTITUTION.md` - Principios arquitectonicos
- `daRulez.md` - Reglas de desarrollo
