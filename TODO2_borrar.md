# TODO2 - Access Gateway y Dominios Independientes

> Ultima actualizacion: 2025-12-14

---

## Contexto

El sistema de enrollment actual tiene la logica de estado dispersa entre backend y frontend.
El frontend reimplementa (incorrectamente) la logica del automata, violando SoC.

**Solucion:** Implementar Access Gateway como unico punto de lectura de estado.
El frontend solo renderiza segun la respuesta del backend.

**Fuente de verdad:** `spec-enrollment.md`

---

## Politica de Seleccion de Modelo

Cada fase indica el modelo recomendado. El usuario debe cambiar al modelo correspondiente antes de iniciar cada fase.

| Modelo | Usar cuando |
|--------|-------------|
| **Sonnet** | Implementacion bien especificada, patrones existentes, codigo repetitivo |
| **Opus** | Decisiones arquitectonicas, ambiguedad, razonamiento complejo, bloqueos |

**Procedimiento:**

1. Al iniciar una fase, verificar el modelo recomendado
2. Cambiar al modelo indicado en la configuracion de Claude Code
3. Informar al modelo el contexto: "Estamos en fase X.Y, implementando Z"
4. Si hay bloqueos no anticipados, considerar cambiar a Opus

---

## Fase 18.0: Access Gateway (Backend)

**Rama:** `fase-18.0-access-gateway`
**Objetivo:** Crear endpoint `GET /api/access/state` que retorna estado agregado.

**Modelo recomendado:** Sonnet

> **Nota para el usuario:** Antes de iniciar esta fase, cambie al modelo Sonnet.
> Esta fase es implementacion directa con interfaces y patrones bien especificados.
> Sonnet es suficiente y mas eficiente en costo/tiempo.

---

### 18.0.1: Crear IDeviceQuery Interface

**Archivo:** `node-service/src/backend/enrollment/domain/interfaces/device-query.interface.ts`

**Responsabilidad:** Interface read-only para consultar dispositivos.

```typescript
interface IDeviceQuery {
  getActiveDevice(userId: number): Promise<{
    credentialId: string;
    deviceId: number;
  } | null>;
}
```

**Tareas:**

- [ ] Crear archivo `device-query.interface.ts`
- [ ] Definir interface `IDeviceQuery`
- [ ] Exportar desde `domain/interfaces/index.ts`

---

### 18.0.2: Crear ISessionQuery Interface

**Archivo:** `node-service/src/backend/enrollment/domain/interfaces/session-query.interface.ts`

**Responsabilidad:** Interface read-only para verificar sesion activa.

```typescript
interface ISessionQuery {
  hasActiveSession(userId: number): Promise<boolean>;
}
```

**Tareas:**

- [ ] Crear archivo `session-query.interface.ts`
- [ ] Definir interface `ISessionQuery`
- [ ] Exportar desde `domain/interfaces/index.ts`

---

### 18.0.3: Crear IRestrictionQuery Interface

**Archivo:** `node-service/src/backend/enrollment/domain/interfaces/restriction-query.interface.ts`

**Responsabilidad:** Interface read-only para verificar restricciones.

```typescript
interface IRestrictionQuery {
  isBlocked(userId: number): Promise<{
    blocked: boolean;
    reason?: string;
  }>;
}
```

**Tareas:**

- [ ] Crear archivo `restriction-query.interface.ts`
- [ ] Definir interface `IRestrictionQuery`
- [ ] Exportar desde `domain/interfaces/index.ts`

---

### 18.0.4: Implementar Query Adapters

**Archivos:**

- `infrastructure/adapters/device-query.adapter.ts`
- `infrastructure/adapters/session-query.adapter.ts`
- `infrastructure/adapters/restriction-query.adapter.ts`

**Responsabilidad:** Implementar interfaces usando repositorios existentes.

**Tareas:**

- [ ] `DeviceQueryAdapter`: wrapper sobre `DeviceRepository.findActiveByUserId()`
- [ ] `SessionQueryAdapter`: wrapper sobre `SessionKeyRepository.exists()`
- [ ] `RestrictionQueryAdapter`: wrapper sobre `RestrictionService.checkRestrictions()`
- [ ] Exportar desde `infrastructure/adapters/index.ts`

---

### 18.0.5: Implementar AccessGatewayService

**Archivo:** `node-service/src/backend/access/application/services/access-gateway.service.ts`

**Responsabilidad:** Agregar estado de todos los dominios (solo lectura).

```typescript
interface AccessState {
  state: 'NOT_ENROLLED' | 'ENROLLED_NO_SESSION' | 'READY' | 'BLOCKED';
  action: 'enroll' | 'login' | 'scan' | null;
  device?: { credentialId: string; deviceId: number };
  message?: string;
}

class AccessGatewayService {
  constructor(
    private deviceQuery: IDeviceQuery,
    private sessionQuery: ISessionQuery,
    private restrictionQuery: IRestrictionQuery
  ) {}

  async getState(userId: number): Promise<AccessState>;
}
```

**Tareas:**

- [ ] Crear directorio `backend/access/`
- [ ] Crear `access-gateway.service.ts`
- [ ] Implementar logica de `spec-enrollment.md` seccion "Access Gateway"
- [ ] Inyectar dependencias via constructor

---

### 18.0.6: Crear AccessStateController

**Archivo:** `node-service/src/backend/access/presentation/controllers/access-state.controller.ts`

**Responsabilidad:** Manejar `GET /api/access/state`

**Tareas:**

- [ ] Crear `access-state.controller.ts`
- [ ] Extraer `userId` del JWT
- [ ] Llamar `accessGatewayService.getState(userId)`
- [ ] Retornar respuesta sin wrappers

---

### 18.0.7: Registrar Ruta y DI

**Archivos:**

- `backend/access/presentation/routes.ts`
- `backend/access/access.module.ts`

**Tareas:**

- [ ] Crear `routes.ts` con `GET /api/access/state`
- [ ] Crear `access.module.ts` para DI
- [ ] Registrar modulo en `app.ts`

---

### 18.0.8: Tests Unitarios Access Gateway

**Archivo:** `node-service/src/backend/access/__tests__/access-gateway.service.test.ts`

**Tareas:**

- [ ] Test: Usuario bloqueado retorna BLOCKED
- [ ] Test: Usuario sin dispositivo retorna NOT_ENROLLED
- [ ] Test: Usuario con dispositivo sin sesion retorna ENROLLED_NO_SESSION
- [ ] Test: Usuario con sesion activa retorna READY
- [ ] Test: Respuesta incluye device cuando aplica
- [ ] Test: Respuesta incluye message solo cuando BLOCKED

**Minimo:** 6 tests

---

## Fase 18.1: Simplificar Frontend

**Rama:** `fase-18.1-frontend-simplification`
**Objetivo:** Frontend renderiza unicamente segun respuesta del backend.

**Modelo recomendado:** Sonnet (Opus si hay bloqueos en 18.1.3-5)

> **Nota para el usuario:** Antes de iniciar esta fase, cambie al modelo Sonnet.
> Si encuentra dificultades en las sub-fases 18.1.3-18.1.5 (refactorizacion del
> codigo existente), considere cambiar a Opus para mejor comprension del contexto.

---

### 18.1.1: Crear AccessService (Frontend)

**Archivo:** `node-service/src/frontend/features/enrollment/services/access.service.ts`

**Responsabilidad:** Cliente HTTP para `GET /api/access/state`

```typescript
class AccessService {
  async getState(): Promise<AccessState>;
}
```

**Tareas:**

- [ ] Crear `access.service.ts`
- [ ] Implementar `getState()` con fetch
- [ ] Manejar errores de red

---

### 18.1.2: Crear renderByState() Centralizado

**Archivo:** `node-service/src/frontend/features/enrollment/main.ts`

**Responsabilidad:** Metodo unico que renderiza UI segun estado.

```typescript
private renderByState(state: AccessState): void {
  switch (state.state) {
    case 'NOT_ENROLLED':
      this.showEnrollSection();
      break;
    case 'ENROLLED_NO_SESSION':
      this.showLoginSection(state.device!.credentialId);
      break;
    case 'READY':
      this.showGoToScannerButton();
      break;
    case 'BLOCKED':
      this.showBlockedMessage(state.message);
      break;
  }
}
```

**Tareas:**

- [ ] Crear metodo `renderByState()`
- [ ] Implementar casos para los 4 estados
- [ ] Agregar `showBlockedMessage()` si no existe

---

### 18.1.3: Refactorizar handleAuthReady()

**Archivo:** `node-service/src/frontend/features/enrollment/main.ts`

**Antes:**

```typescript
// Logica dispersa con multiples condiciones
if (hasSessionKey) { ... }
else if (status.deviceCount > 0) { ... }
else { ... }
```

**Despues:**

```typescript
private async handleAuthReady(): Promise<void> {
  const state = await this.accessService.getState();
  this.renderByState(state);
}
```

**Tareas:**

- [ ] Inyectar `AccessService`
- [ ] Reemplazar `loadEnrollmentStatus()` con `accessService.getState()`
- [ ] Usar `renderByState()` en lugar de condicionales

---

### 18.1.4: Auto-continuacion del Flujo

**Responsabilidad:** Despues de cada operacion exitosa, consultar nuevo estado.

```typescript
// Despues de enrollment exitoso
const finishResult = await this.enrollmentService.finishEnrollment(credential);
if (finishResult.success) {
  const state = await this.accessService.getState();
  this.renderByState(state); // Automaticamente muestra login
}

// Despues de login exitoso
const loginResult = await this.loginService.performLogin(credentialId);
if (loginResult.success) {
  this.sessionKeyStore.storeSessionKey(...);
  const state = await this.accessService.getState();
  this.renderByState(state); // Automaticamente muestra "Ir al Scanner"
}
```

**Tareas:**

- [ ] Agregar `getState()` despues de `finishEnrollment()` exitoso
- [ ] Agregar `getState()` despues de `performLogin()` exitoso
- [ ] Remover llamadas manuales a `showLoginSection()`, `showGoToScannerButton()`

---

### 18.1.5: Eliminar Logica de Inferencia

**Responsabilidad:** Remover codigo que infiere estado en frontend.

**Tareas:**

- [ ] Remover variable `hasSessionKey` como condicion de estado
- [ ] Remover uso de `status.deviceCount` para inferir estado
- [ ] Remover `loadEnrollmentStatus()` si ya no se usa

---

## Fase 18.2: Cleanup Legacy (Opcional)

**Rama:** `fase-18.2-cleanup-legacy`
**Objetivo:** Deprecar endpoints y codigo obsoleto.

**Modelo recomendado:** Sonnet

> **Nota para el usuario:** Antes de iniciar esta fase, cambie al modelo Sonnet.
> Esta fase es cleanup simple: agregar comentarios y headers de deprecacion.

---

### 18.2.1: Deprecar /api/enrollment/status

**Archivo:** `node-service/src/backend/enrollment/presentation/controllers/enrollment-status.controller.ts`

**Tareas:**

- [ ] Agregar comentario `@deprecated` en controller
- [ ] Agregar header `Deprecation` en respuesta
- [ ] Verificar que ningun otro feature use este endpoint (qr-reader, guest)
- [ ] Si no hay dependencias, planificar remocion futura

---

### 18.2.2: Evaluar Wrappers de Respuesta

**Contexto:** Los endpoints actuales retornan respuestas con wrappers:

- `/api/enrollment/status` retorna `{ enrollment: { ... } }`
- `/api/enrollment/finish` retorna `{ device: { ... } }`
- `/api/session/login` retorna `{ session: { ... } }`

**Decision:** Mantener por compatibilidad. El nuevo `/api/access/state` retorna sin wrappers.

**Tareas:**

- [ ] Documentar que endpoints legacy mantienen wrappers
- [ ] Nuevo endpoint `/api/access/state` es la forma recomendada

---

## Criterios de Aceptacion

1. `GET /api/access/state` retorna estado sin wrappers
2. Frontend renderiza UI basandose unicamente en respuesta del backend
3. Despues de enrollment exitoso, automaticamente muestra login
4. Despues de login exitoso, automaticamente muestra "Ir al Scanner"
5. No hay logica de inferencia de estado en frontend
6. Tests del AccessGateway pasan (minimo 6)
7. Tests existentes siguen pasando

---

## Diagrama de Dependencias

```text
Fase 17.10 [COMPLETADA]
    |
    v
Fase 18.0: Access Gateway (Backend)
    |
    18.0.1 IDeviceQuery
    |
    18.0.2 ISessionQuery
    |
    18.0.3 IRestrictionQuery
    |
    18.0.4 Query Adapters
    |
    18.0.5 AccessGatewayService
    |
    18.0.6 AccessStateController
    |
    18.0.7 Routes + DI
    |
    18.0.8 Tests
    |
    v
Fase 18.1: Simplificar Frontend
    |
    18.1.1 AccessService (frontend)
    |
    18.1.2 renderByState()
    |
    18.1.3 Refactorizar handleAuthReady()
    |
    18.1.4 Auto-continuacion
    |
    18.1.5 Eliminar inferencia
    |
    v
Fase 18.2: Cleanup Legacy (Opcional)
```

---

## Resumen de Archivos

| Accion | Archivo |
|--------|---------|
| CREAR | `backend/access/` (nuevo modulo) |
| CREAR | `domain/interfaces/device-query.interface.ts` |
| CREAR | `domain/interfaces/session-query.interface.ts` |
| CREAR | `domain/interfaces/restriction-query.interface.ts` |
| CREAR | `infrastructure/adapters/device-query.adapter.ts` |
| CREAR | `infrastructure/adapters/session-query.adapter.ts` |
| CREAR | `infrastructure/adapters/restriction-query.adapter.ts` |
| CREAR | `access/application/services/access-gateway.service.ts` |
| CREAR | `access/presentation/controllers/access-state.controller.ts` |
| CREAR | `access/presentation/routes.ts` |
| CREAR | `access/access.module.ts` |
| CREAR | `access/__tests__/access-gateway.service.test.ts` |
| CREAR | `frontend/features/enrollment/services/access.service.ts` |
| MODIFICAR | `frontend/features/enrollment/main.ts` |
| MODIFICAR | `app.ts` (registrar modulo access) |
| DEPRECAR | `enrollment/presentation/controllers/enrollment-status.controller.ts` |

---

## Referencias

- `spec-enrollment.md` - Arquitectura de dominios (fuente de verdad)
- `spec-qr-validation.md` - Flujo de validacion QR
- `PROJECT-CONSTITUTION.md` - Articulo 2.3: Separation of Concerns
- `daRulez.md` - Reglas de desarrollo
