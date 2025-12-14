# ROADMAP - Plan de Implementacion

> Fuente de verdad para tareas pendientes.
> Ultima actualizacion: 2025-12-14

---

## Resumen de Estado

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 1-16 | Fundamentos, FIDO2, QR, Pipeline | COMPLETADA |
| 17 | SoC Enrollment (automatas, policy) | COMPLETADA |
| 18.0 | Access Gateway Backend | COMPLETADA |
| 18.1 | Simplificar Frontend Enrollment | COMPLETADA |
| **19** | **Separacion de Dominios** | PENDIENTE |
| **20** | **Limpieza Legacy** | PENDIENTE |
| **21** | **Unificar Frontend** | PENDIENTE |
| **22** | **Hardening Criptografico** | PENDIENTE |
| **23** | **Puente PHP Produccion** | PENDIENTE |

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
- [x] Verificar tests: `npm run test` (134/134 passed)

**Dependencias:** Requiere 19.1 completada (shared/ports).

**Criterio de exito:** COMPLETADO - Endpoint `POST /api/session/login` registrado, tests pasando.
**Commit:** 0391c98

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
- [x] Verificar tests: `npm run test` (134/134 passed)

**Dependencias:** Requiere 19.1 completada (shared/ports).

**Criterio de exito:** COMPLETADO - Tests pasando, dominio restriction independiente.
**Commit:** 2308b52

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

- [ ] Verificar que frontend NO usa `getStatus()` (grep en frontend/)
- [ ] Eliminar `GetEnrollmentStatusUseCase`
- [ ] Eliminar `EnrollmentStatusController`
- [ ] Remover ruta de `enrollment/presentation/routes.ts`
- [ ] Remover export de `enrollment/application/use-cases/index.ts`
- [ ] Eliminar metodo `getStatus()` de `frontend/features/enrollment/services/enrollment.service.ts`
- [ ] Verificar compilacion: `npm run build`

**Criterio de exito:** `curl /api/enrollment/status` retorna 404.

---

### 20.2: Crear endpoint /api/enrollment/devices

**Rama:** `fase-20.2-devices-endpoint`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** El frontend necesita listar dispositivos para UI de revocacion. Este endpoint reemplaza la parte de listado de /status.

**Tareas:**

- [ ] Crear `GetDevicesUseCase` en `enrollment/application/use-cases/`
- [ ] Crear ruta `GET /api/enrollment/devices` en routes.ts
- [ ] Actualizar `loadDevicesList()` en frontend para usar nuevo endpoint
- [ ] Verificar UI de revocacion funciona

**Criterio de exito:** UI muestra lista de dispositivos correctamente.

---

### 20.3: Eliminar controller legacy

**Rama:** `fase-20.3-remove-legacy-controller`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** `enrollment-controller.ts` duplica rutas ya definidas en routes.ts.

**Tareas:**

- [ ] Verificar que `routes.ts` tiene todas las rutas necesarias
- [ ] Eliminar `enrollment/presentation/enrollment-controller.ts` si existe
- [ ] Verificar compilacion: `npm run build`

**Criterio de exito:** No hay controllers duplicados.

---

### 20.4: Limpiar codigo muerto en enrollment

**Rama:** `fase-20.4-cleanup-dead-code`
**Modelo:** Sonnet
**Dificultad:** Baja

**Tareas:**

- [ ] Eliminar referencias a `penalty` en enrollment.service.ts (codigo muerto)
- [ ] Eliminar `EnrollmentStateMachine` si ya no se usa (reemplazado por DeviceStateMachine)
- [ ] Eliminar imports no usados
- [ ] Verificar tests: `npm run test`

**Criterio de exito:** No hay codigo muerto en enrollment/.

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
└── index.ts
```

**Tareas:**

- [ ] Crear carpeta `frontend/shared/services/enrollment/`
- [ ] Unificar `enrollment/services/enrollment.service.ts` y `guest/modules/enrollment/enrollment.service.ts`
- [ ] Unificar `enrollment/services/login.service.ts` y `guest/modules/enrollment/login.service.ts`
- [ ] Unificar `enrollment/services/session-key.store.ts` y `guest/modules/enrollment/session-key.store.ts`
- [ ] Crear `index.ts` con exports
- [ ] Actualizar imports en `enrollment/main.ts` para usar shared/
- [ ] Actualizar imports en `guest/` para usar shared/ (temporalmente, hasta eliminar guest)
- [ ] Eliminar servicios duplicados de `enrollment/services/`
- [ ] Verificar compilacion: `npm run build`

**Criterio de exito:** Un solo lugar para servicios de enrollment.

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

**Tareas:**

- [ ] Copiar `AccessService` de enrollment/ a shared/services/
- [ ] Reemplazar logica de inferencia con `accessService.getState()`
- [ ] Si `state !== READY`: redirigir a enrollment feature
- [ ] Eliminar imports de EnrollmentService, LoginService
- [ ] Eliminar variable hasSessionKey como condicion
- [ ] Verificar flujo manualmente

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

**Tareas:**

- [ ] Analizar diferencias entre guest/main.ts y enrollment/main.ts
- [ ] Identificar funcionalidad unica de guest/ (postMessage, estados)
- [ ] Si enrollment/ no soporta iframe: agregar soporte
- [ ] Si enrollment/ no tiene postMessage: agregar ParentMessenger
- [ ] Verificar enrollment/ funciona embebido en iframe
- [ ] Actualizar referencias en PHP simulator
- [ ] Eliminar carpeta `frontend/features/guest/`
- [ ] Verificar flujo completo manualmente

**Criterio de exito:** Solo existe enrollment/ para flujo de estudiante.

---

## Fase 22: Hardening Criptografico

**Objetivo:** Completar validaciones de seguridad pendientes.
**Rama base:** `fase-22-hardening`
**Modelo recomendado global:** Opus (seguridad requiere razonamiento cuidadoso)

---

### 22.1: Validar TOTPu en Pipeline

**Rama:** `fase-22.1-totp-validation`
**Modelo:** Opus
**Dificultad:** Alta

**Justificacion:** Actualmente el backend no valida que el TOTPu enviado por el cliente sea correcto.

**Archivo:** `backend/attendance/application/validation-pipeline/stages/`

**Tareas:**

- [ ] Crear `totp-validation.stage.ts`
- [ ] Obtener session_key del usuario desde Valkey
- [ ] Generar TOTP esperado con session_key
- [ ] Comparar con TOTPu del payload
- [ ] Configurar ventana de tolerancia (±30 segundos)
- [ ] Agregar stage al pipeline en posicion correcta
- [ ] Crear tests unitarios
- [ ] Verificar tests: `npm run test`

**Criterio de exito:** Payload con TOTPu incorrecto es rechazado.

---

### 22.2: Session Key Binding con credentialId

**Rama:** `fase-22.2-session-binding`
**Modelo:** Opus
**Dificultad:** Alta

**Justificacion:** La session_key debe estar ligada al dispositivo especifico para prevenir replay.

**Archivo:** `session/infrastructure/services/hkdf.service.ts` (despues de moverlo)

**Tareas:**

- [ ] Modificar `deriveSessionKey()` para incluir credentialId en info HKDF
- [ ] Actualizar frontend para derivar igual
- [ ] Considerar migracion de sesiones existentes
- [ ] Agregar tests

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

**Tareas:**

- [ ] Extraer AAGUID en FinishEnrollmentUseCase
- [ ] Almacenar AAGUID en tabla devices
- [ ] (Opcional) Crear whitelist de AAGUIDs permitidos
- [ ] Agregar tests

**Criterio de exito:** AAGUID almacenado en BD para cada dispositivo.

---

## Fase 23: Puente PHP Produccion

**Objetivo:** Integrar con el sistema PHP existente para produccion.
**Rama base:** `fase-23-php-bridge`
**Modelo recomendado global:** Sonnet (integracion bien definida)

---

### 23.1: Endpoint interno para marcar asistencia

**Rama:** `fase-23.1-internal-attendance`
**Modelo:** Sonnet
**Dificultad:** Media

**Justificacion:** El sistema Node valida QR, pero PHP debe registrar la asistencia en su BD.

**Estructura:**

```
backend/attendance/presentation/routes/
└── internal.routes.ts
```

**Tareas:**

- [ ] Crear `POST /api/internal/mark-attendance`
- [ ] Schema: `{ codigo, rut, ip, certainty, encuesta? }`
- [ ] Validar header `X-Node-Signature` (secreto compartido)
- [ ] Retornar resultado de validacion
- [ ] Agregar tests

**Criterio de exito:** PHP puede llamar a Node para marcar asistencia.

---

### 23.2: Controller PHP para recibir

**Rama:** `fase-23.2-php-controller`
**Modelo:** Sonnet
**Dificultad:** Media

**Ubicacion:** `php-service/src/asistencia-node-integration/`

**Tareas:**

- [ ] Crear `MarkAttendanceController.php`
- [ ] Agregar ruta en Router (si existe)
- [ ] Validar firma de Node
- [ ] Insertar en BD de PHP
- [ ] Retornar confirmacion

**Criterio de exito:** Asistencia aparece en sistema PHP.

---

### 23.3: Encuesta post-validacion

**Rama:** `fase-23.3-survey`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** El sistema legacy requiere encuesta despues de marcar asistencia.

**Tareas:**

- [ ] Crear componente `SurveyForm.ts` en frontend
- [ ] Mostrar tras validacion exitosa
- [ ] Enviar respuestas a Node
- [ ] Node envia a PHP junto con asistencia

**Criterio de exito:** Encuesta se muestra y guarda.

---

### 23.4: Notificacion al parent (postMessage)

**Rama:** `fase-23.4-parent-notification`
**Modelo:** Sonnet
**Dificultad:** Baja

**Justificacion:** El iframe debe notificar al parent PHP cuando termina.

**Tareas:**

- [ ] Implementar `postMessage({ type: 'ATTENDANCE_COMPLETE' })`
- [ ] Implementar `postMessage({ type: 'CLOSE_IFRAME' })`
- [ ] PHP listener para cerrar modal
- [ ] Verificar flujo completo

**Criterio de exito:** Modal se cierra automaticamente tras exito.

---

## Diagrama de Dependencias

```
Fase 19.1 (shared/ports)
    │
    ├──► Fase 19.2 (session domain)
    │         │
    │         └──► Fase 22.2 (session binding)
    │
    └──► Fase 19.3 (restriction domain)

Fase 20.1-20.4 (cleanup) ──► Fase 21 (unify frontend)
                                    │
                                    └──► Fase 21.3 (remove guest)

Fase 22.1 (TOTP) ──┐
Fase 22.2 (binding)├──► Fase 23 (PHP bridge)
Fase 22.3 (AAGUID)─┘
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
