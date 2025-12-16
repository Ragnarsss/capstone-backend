# ROADMAP - Plan de Implementacion

> Fuente de verdad para tareas pendientes.
> Ultima actualizacion: 2025-12-16

**Ultimo commit consolidado:** bf5c514 (Merge fase-21.1-shared-enrollment-services)

**Estado actual del proyecto:**
- Migraciones consolidadas en `001-schema.sql` v2.0.0
- Servicios compartidos creados en `frontend/shared/services/enrollment/`
- Branches consolidadas en main (ancla de seguridad establecida)
- Archivos legacy de migraciones pendientes de eliminar (001-initial, 002, 003)

---

## Resumen de Estado

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 1-18 | Fundamentos, FIDO2, QR, Pipeline, SoC, Access Gateway | COMPLETADA |
| 19-20 | Separacion Dominios y Limpieza Legacy | COMPLETADA |
| **21.1** | **Servicios compartidos enrollment** | COMPLETADA |
| **21.1.1** | **Fix: LoginService sin authClient** | COMPLETADA |
| **21.1.2** | **Access Gateway con Orchestrator** | COMPLETADA |
| **21.1.3** | **Revocación automática 1:1** | PENDIENTE |
| **21.2** | **qr-reader usa Access Gateway** | PENDIENTE |
| **21.3** | **Eliminar feature guest/** | PENDIENTE |
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

## Arquitectura Actual

Ver `spec-architecture.md` para diagramas completos.

```
backend/
├── access/          # Gateway lectura ✅
├── attendance/      # Validacion QR ✅
├── auth/            # JWT ✅
├── enrollment/      # Solo FIDO2 devices ✅
├── session/         # ECDH login ✅
├── restriction/     # Stub PHP ✅
└── shared/ports/    # Interfaces cross-domain ✅

frontend/features/
├── enrollment/      # UI registro ✅
├── qr-reader/       # Lector (refactorizar - 21.2)
├── qr-host/         # Proyector ✅
└── guest/           # ELIMINAR (21.3)

frontend/shared/services/enrollment/  # Servicios unificados ✅
```

---

## Fases 1-18: Fundamentos del Sistema - COMPLETADAS

**Trabajo realizado:**

- **Fases 1-16:** Sistema base con FIDO2, QR criptografico, pipeline de validacion
- **Fase 17:** SoC Enrollment con automatas (EnrollmentFlowOrchestrator), OneToOnePolicyService
- **Fase 18:** Access Gateway backend y simplificacion frontend

**Arquitectura lograda:** Sistema funcional con enrollment FIDO2, validacion QR, y gateway de lectura.

---

## Fases 19-20: Separacion de Dominios y Limpieza Legacy - COMPLETADAS

**Estado:** COMPLETADAS
**Commits principales:** b208425, 0391c98, e9dc8e1, f21adc0, 2308b52, 7ce6b8f, c372c2f, 9bc38b5

**Trabajo realizado:**

- **Fase 19:** Separacion de dominios session/ y restriction/ de enrollment/
  - Creado `shared/ports/` con interfaces cross-domain (IDeviceQuery, ISessionQuery, IRestrictionQuery)
  - Dominio `session/` con LoginEcdhUseCase, SessionStateMachine, SessionKeyRepository
  - Dominio `restriction/` con RestrictionService (stub) y adapters
  - Endpoint `POST /api/session/login` registrado
  - Tests: 134/134 pasando

- **Fase 20:** Limpieza de codigo legacy y endpoints obsoletos
  - Eliminado endpoint `/api/enrollment/status`, reemplazado por `GET /api/enrollment/devices`
  - Eliminados controllers duplicados y codigo muerto
  - Access Gateway actualizado para importar desde session/ y restriction/
  - Actualizado spec-qr-validation.md con endpoints correctos
  - Eliminados re-exports legacy en enrollment/
  - Compilacion y tests exitosos

**Arquitectura resultante:**

```
backend/
├── access/          # Gateway lectura (usa shared/ports/)
├── session/         # ECDH login (POST /api/session/login)
├── restriction/     # Stub PHP (listo para implementacion)
├── enrollment/      # Solo FIDO2 devices (limpio)
├── attendance/      # Validacion QR
├── auth/            # JWT
└── shared/ports/    # Interfaces cross-domain
```

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

- [x] Verificar estado del repositorio: `git status`
- [x] Crear rama de trabajo: `git checkout -b fase-21.1.1-fix-login-service-authclient`
- [x] Modificar `enrollment/main.ts`: cambiar `new LoginService()` a `new LoginService(this.authClient)`
- [x] Modificar `qr-reader/main.ts`: cambiar `new LoginService()` a `new LoginService(this.authClient)`
- [x] Verificar compilacion: `npm run build` (exitoso)
- [x] Verificar tests: `npm run test` (134/134 passed)
- [ ] Probar flujo manualmente en navegador (pendiente validacion usuario)
- [x] Commit con mensaje descriptivo

**Dependencias:** Requiere 21.1 completada (YA COMPLETADA).

**Criterio de exito:** COMPLETADA - El boton "Iniciar Sesion" en enrollment debe ejecutar login ECDH exitosamente sin error "No se encontró token de autenticación".

**Commit:** bb0d90a

---

### 21.1.2: Refactorizar Access Gateway para usar EnrollmentFlowOrchestrator

**Rama:** `fase-21.1.2-access-gateway-orchestrator`
**Modelo:** Opus
**Dificultad:** Alta
**Recordatorio:** Comandos npm DEBEN ejecutarse dentro del contenedor Node (PROJECT-CONSTITUTION.md Art. 3.2)
**Estado:** COMPLETADA
**Commit:** 04a8df6

**Justificacion:** Access Gateway tiene validacion manual que duplica logica del automata EnrollmentFlowOrchestrator. Esto causa bug critico donde multiples usuarios en el mismo dispositivo NO son detectados porque Access Gateway no valida deviceFingerprint (politica 1:1). El orchestrator YA implementa el automata completo con validacion de deviceFingerprint pero NO se esta usando.

**Problema actual (RESUELTO):**

- Access Gateway hace queries directas sin validar deviceFingerprint
- EnrollmentFlowOrchestrator.attemptAccess() existe pero no se llama
- Bug: Multiples usuarios en mismo dispositivo bypasean enrollment

**Arquitectura lograda:**

```
Access Gateway → EnrollmentFlowOrchestrator.attemptAccess(userId, deviceFingerprint)
                 ↓
                 ACCESS_GRANTED | REQUIRES_ENROLLMENT | REQUIRES_REENROLLMENT
```

**Cambios realizados:**

- [x] Refactorizado `AccessGatewayService` para recibir `EnrollmentFlowOrchestrator`
- [x] Agregado parámetro `deviceFingerprint` a `getState()`
- [x] Mapeado resultados del orchestrator a estados del Gateway:
  - `ACCESS_GRANTED` → verificar sesion → `READY` o `ENROLLED_NO_SESSION`
  - `REQUIRES_ENROLLMENT` → `NOT_ENROLLED`
  - `REQUIRES_REENROLLMENT` → `NOT_ENROLLED` (forzar reenrolamiento)
- [x] Actualizado `routes.ts` para inyectar orchestrator
- [x] Actualizado `AccessStateController` para recibir deviceFingerprint desde query params
- [x] Implementado `DeviceFingerprintGenerator` en frontend
- [x] Actualizado `AccessService` para generar y enviar deviceFingerprint
- [x] Reescrito todos los tests de Access Gateway
- [x] Verificado: `podman exec asistencia-node npm run build` (exitoso)
- [x] Verificado: `podman exec asistencia-node npm run test` (136/136 passed)
- [x] Commit atomico: `04a8df6` con mensaje descriptivo

**Dependencias:** Requiere 21.1.1 completada (LoginService fix).

**Criterio de exito:** COMPLETADO ✅
- Access Gateway usa orchestrator para toda validacion de enrollment
- Multiples usuarios en mismo dispositivo son detectados y bloqueados correctamente
- deviceFingerprint fluye correctamente frontend → backend
- Tests comprueban mapeo correcto de AccessResult → AccessState
- Build y tests exitosos

---

### 21.1.3: Implementar revocación automática 1:1 en enrollment

**Rama:** `fase-21.1.3-auto-revoke-enrollment`
**Modelo:** Opus
**Dificultad:** Alta
**Recordatorio:** Comandos npm DEBEN ejecutarse dentro del contenedor Node (PROJECT-CONSTITUTION.md Art. 3.2)
**Estado:** COMPLETADA
**Commits:** d0ff3a6, 9bb4a19

**Justificacion:** Actualmente `FinishEnrollmentController` NO ejecuta `OneToOnePolicyService.revokeViolations()`. Esto causa que múltiples usuarios puedan enrollarse en el mismo dispositivo sin desenrolamiento automático, violando la política 1:1. El comentario en `FinishEnrollmentUseCase` (línea 37) indica que "el orchestrator DEBE llamar a revokeViolations() ANTES", pero nadie lo hace.

**Problema actual (RESUELTO):**

- `POST /api/enrollment/finish` persiste nuevo dispositivo sin revocar conflictos
- `processEnrollmentConsent()` solo retorna información, no ejecuta revocación
- Base de datos queda con múltiples deviceId activos para mismo deviceFingerprint
- Política 1:1 se viola silenciosamente

**Arquitectura lograda:**

```
POST /api/enrollment/finish
  ↓
FinishEnrollmentController:
  1. Validar WebAuthn ✓
  2. OneToOnePolicyService.revokeViolations(userId, deviceFingerprint) ✓
  3. FinishEnrollmentUseCase.execute() (persiste) ✓
  4. Retornar éxito ✓
```

**Cambios realizados:**

- [x] Verificado estado del repositorio: `git status`
- [x] Creada rama: `git checkout -b fase-21.1.3-auto-revoke-enrollment`
- [x] Modificado `routes.ts`: instanciar `OneToOnePolicyService` y pasarlo a `FinishEnrollmentController`
- [x] Modificado `FinishEnrollmentController`:
  - [x] Agregado `OneToOnePolicyService` como dependencia del constructor
  - [x] ANTES de llamar a `useCase.execute()`: ejecutar `policyService.revokeViolations(userId, deviceFingerprint)`
  - [x] Capturar y loggear información de revocación (previousUserUnlinked, ownDevicesRevoked)
- [x] Actualizado tests de `FinishEnrollmentController`:
  - [x] Mockeado `OneToOnePolicyService.revokeViolations()`
  - [x] Verificado que se llama ANTES de persistir
  - [x] Test: revocación de dispositivos del mismo usuario
  - [x] Test: revocación de dispositivos de otros usuarios (mismo fingerprint)
- [x] Agregado `DeviceRepository.findActiveByDeviceFingerprint()` para buscar conflictos
- [x] Optimizado `DeviceFingerprintGenerator` para dispositivos móviles (Android/iOS)
- [x] Corregido bug de inconsistencia de hash: AccessService usaba `generate()` (8 chars) en lugar de `generateAsync()` (32 chars SHA-256)
- [x] Verificada compilacion: `podman exec asistencia-node npm run build` (exitoso)
- [x] Verificados tests: `podman exec asistencia-node npm run test` (136/136 passed)
- [x] Commits atomicos: 
  - `d0ff3a6`: feat(enrollment): implementar revocación automática 1:1 con deviceFingerprint
  - `9bb4a19`: fix(frontend): usar mismo algoritmo de hash para deviceFingerprint

**Dependencias:** Requiere 21.1.2 completada (Access Gateway con orchestrator).

**Criterio de exito:** COMPLETADO ✅
- `FinishEnrollmentController` ejecuta `revokeViolations()` automáticamente
- Base de datos mantiene política 1:1 (un deviceFingerprint por usuario activo)
- Tests verifican revocación automática (136/136 passed)
- `DeviceFingerprintGenerator` optimizado para estabilidad en móviles
- Hash consistente (SHA-256) entre AccessService y EnrollmentService

---

### 21.2: Refactorizar qr-reader para usar Access Gateway

**Rama:** `fase-21.2-qr-reader-access-gateway`
**Modelo:** Sonnet
**Dificultad:** Media
**Recordatorio:** Comandos npm DEBEN ejecutarse dentro del contenedor Node (PROJECT-CONSTITUTION.md Art. 3.2)
**Estado:** COMPLETADA

**Justificacion:** qr-reader hace verificación local con `sessionKeyStore.hasSessionKey()` y **NO consulta Access Gateway** como requiere `spec-qr-validation.md` Fase 0. Esto permite que múltiples usuarios usen el mismo dispositivo sin revalidación, violando la política 1:1.

**Problema actual (RESUELTO):**

- `checkEnrollmentStatus()` revisa sessionStorage **localmente**
- NO consulta `/api/access/state` con `deviceFingerprint`
- NO valida que el dispositivo actual pertenece al usuario logueado
- Usuario B puede reutilizar session_key de usuario A sin revalidación

**Arquitectura lograda:**

```
qr-reader.checkEnrollmentStatus()
  ↓
1. Generar deviceFingerprint (DeviceFingerprintGenerator)
2. GET /api/access/state?deviceFingerprint={fingerprint}
3. Switch según state:
   - NOT_ENROLLED → window.location.href = '/features/enrollment/'
   - ENROLLED_NO_SESSION → window.location.href = '/features/enrollment/'
   - READY → showScannerUI()
   - BLOCKED → showBlockedMessage()
```

**Archivos afectados:**

- `frontend/features/qr-reader/main.ts` (método `checkEnrollmentStatus()`)
- `frontend/features/qr-reader/index.html` (eliminar secciones enrollment/login inline si existen)

**Flujo Git:**

1. Verificar estado: `git status`
2. Crear rama: `git checkout -b fase-21.2-qr-reader-access-gateway`
3. Realizar cambios atomicos
4. Commit: `git commit -m "refactor(qr-reader): delegar validacion a Access Gateway"`
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

**Cambios realizados:**

- [x] Verificado estado del repositorio: `git status`
- [x] Creada rama: `git checkout -b fase-21.2-qr-reader-access-gateway`
- [x] Verificado que `AccessService` existe en `shared/services/enrollment/` (creado en 21.1)
- [x] Modificado `qr-reader/main.ts`:
  - [x] Importado `AccessService` y `AccessState` desde `shared/services/enrollment/`
  - [x] En `checkEnrollmentStatus()`: reemplazada lógica local con llamada a Access Gateway
  - [x] Llamada a `accessService.getState()` (genera deviceFingerprint internamente)
  - [x] Switch según `state`:
    * `NOT_ENROLLED` → `showEnrollmentSection()` (permite enrollment inline)
    * `ENROLLED_NO_SESSION` → `showLoginSection(device)` (permite login inline)
    * `READY` → `showReadyState()` (permitir registro)
    * `BLOCKED` → `showEnrollmentSection()` con mensaje de bloqueo
  - [x] Actualizado `showLoginSection()` para aceptar device del AccessState
  - [x] Mantenidas secciones inline de enrollment/login (por diseño UX)
- [x] Verificada compilacion: `podman exec asistencia-node npm run build` (exitoso)
- [x] Verificados tests: `podman exec asistencia-node npm run test` (136/136 passed)
- [ ] Pendiente: Probar flujo completo manualmente con múltiples usuarios

**Dependencias:** 
- Requiere 21.1.2 completada (Access Gateway con orchestrator) ✅
- Requiere 21.1.3 completada (revocación automática en backend) ✅

**Criterio de exito:** COMPLETADO ✅
- qr-reader consulta Access Gateway con deviceFingerprint
- Valida política 1:1 antes de permitir acceso
- Múltiples usuarios en mismo dispositivo son detectados correctamente
- Tests pasan sin regresiones (136/136)

**Criterio de exito:** 
- qr-reader **NO tiene lógica de enrollment propia**
- qr-reader **SIEMPRE** consulta Access Gateway antes de permitir escaneo
- qr-reader redirige a `/features/enrollment/` si estado no es `READY`
- Flujo manual: Usuario B en dispositivo de Usuario A → forzado a re-enrollar → Usuario A desenrolado

---

### 21.3: Eliminar feature guest/

**Rama:** `fase-21.3-remove-guest`
**Modelo:** Opus
**Dificultad:** Alta
**Recordatorio:** Comandos npm DEBEN ejecutarse dentro del contenedor Node (PROJECT-CONSTITUTION.md Art. 3.2)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
**Recordatorio:** Comandos npm DEBEN ejecutarse dentro del contenedor Node (PROJECT-CONSTITUTION.md Art. 3.2)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
**Recordatorio:** Comandos npm DEBEN ejecutarse dentro del contenedor Node (PROJECT-CONSTITUTION.md Art. 3.2)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
**Recordatorio:** Comandos npm DEBEN ejecutarse dentro del contenedor Node (PROJECT-CONSTITUTION.md Art. 3.2)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

**Tareas:**

- [x] Verificar estado del repositorio: `git status`
- [x] Crear `database/migrations/001-schema.sql` consolidado v2.0.0
- [x] Actualizar `database/init.sh` sin emoticones
- [x] Actualizar `database/README.md` documentando consolidacion
- [x] Actualizar `db-schema.md` con columnas faltantes (transports, status)
- [ ] Eliminar `database/migrations/001-initial-schema.sql`
- [ ] Eliminar `database/migrations/002-add-transports.sql`
- [ ] Eliminar `database/migrations/003-add-enrollment-status.sql`
- [ ] Detener contenedores: `podman compose -f compose.dev.yaml down`
- [ ] Eliminar volumen de BD: `podman volume rm asistencia_postgres-data` (si existe)
- [ ] Recrear contenedores: `podman compose -f compose.dev.yaml up -d`
- [ ] Verificar tablas: `podman exec asistencia-db psql -U postgres -d asistencia -c '\dt enrollment.*'`
- [ ] Verificar columnas: `podman exec asistencia-db psql -U postgres -d asistencia -c '\d enrollment.devices'`
- [ ] Commit eliminacion de archivos legacy

**Estado:** PARCIALMENTE COMPLETADA - Archivos consolidados creados, falta eliminar archivos legacy y recrear volumen.

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
**Recordatorio:** Comandos npm DEBEN ejecutarse dentro del contenedor Node (PROJECT-CONSTITUTION.md Art. 3.2)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
5. Merge a main preservando ultimos 4 commits sin mergear (daRulez.md regla 35)

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
