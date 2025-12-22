# Especificacion de Arquitectura: Dominios y Access Gateway

> Fuente de verdad para la arquitectura del sistema.
> Ultima actualizacion: 2025-12-22

---

## Vision General

Sistema complementario (addon) que valida presencia fisica y unicidad de usuarios mediante FIDO2. Se integra via iframe a un servidor Apache/PHP existente.

### Objetivos

1. **Unicidad:** Garantizar relacion 1:1 usuario-dispositivo
2. **Presencia:** Validar presencia fisica mediante QR criptografico
3. **Seguridad:** Doble autenticacion (JWT de PHP + ECDH local)

**Politica 1:1:** Un usuario por dispositivo; un dispositivo por usuario.

---

## Arquitectura: Dominios Independientes

El sistema se divide en **tres dominios** mas un **gateway de lectura**.

### Principios de Diseno

- **Desacoplado**: Cambios en un dominio no afectan a otros
- **Cohesionado**: Una sola responsabilidad por dominio
- **Idempotente**: Operaciones repetibles sin efectos secundarios

### Diagrama de Componentes

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      ACCESS GATEWAY (solo lectura)                   │
│                                                                      │
│  GET /api/access/state                                              │
│  → { state, action, device?, message? }                             │
│                                                                      │
│  - IDEMPOTENTE: Mismo resultado para mismo estado                   │
│  - NO MUTA: Solo lee de los dominios                                │
│  - DESACOPLADO: No conoce logica interna de cada dominio            │
└─────────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    IDeviceQuery         ISessionQuery       IRestrictionQuery
    (solo lectura)       (solo lectura)       (solo lectura)
         │                    │                    │
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   ENROLLMENT    │  │    SESSION      │  │  RESTRICTION    │
│     DOMAIN      │  │     DOMAIN      │  │    DOMAIN       │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│                 │  │                 │  │                 │
│ POST /enroll/   │  │ POST /session/  │  │ (stub)          │
│      start      │  │      login      │  │                 │
│ POST /enroll/   │  │ DELETE /session │  │ Integracion     │
│      finish     │  │                 │  │ futura con PHP  │
│ DELETE /enroll/ │  │                 │  │                 │
│      device/:id │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Dominio: Enrollment

**Responsabilidad unica:** Registrar y revocar dispositivos FIDO2.

### Endpoints

| Endpoint | Metodo | Descripcion |
| -------- | ------ | ----------- |
| `/api/enrollment/start` | POST | Genera challenge WebAuthn |
| `/api/enrollment/finish` | POST | Verifica y persiste dispositivo |
| `/api/enrollment/devices/:id` | DELETE | Revoca dispositivo |

### Componentes

| Componente | Responsabilidad |
| ---------- | --------------- |
| `StartEnrollmentUseCase` | Solo: generar challenge + opciones WebAuthn |
| `FinishEnrollmentUseCase` | Solo: verificar credential + derivar HKDF + persistir |
| `OneToOnePolicyService` | Validar y revocar violaciones de politica 1:1 |
| `DeviceStateMachine` | Transiciones: not_enrolled → pending → enrolled → revoked |
| `DeviceRepository` | CRUD en PostgreSQL |

### Flujo de Revocación Automática (Política 1:1)

Cuando un usuario intenta enrollar un dispositivo, el sistema **automáticamente** revoca dispositivos conflictivos para mantener la política 1:1.

**Responsabilidad:** `FinishEnrollmentController` DEBE invocar `OneToOnePolicyService.revokeViolations()` ANTES de persistir el nuevo dispositivo.

**Flujo:**

```text
1. Cliente → POST /api/enrollment/start
   → Backend genera challenge FIDO2

2. Cliente completa autenticación biométrica

3. Cliente → POST /api/enrollment/finish {credential, deviceFingerprint}
   → Backend:
      a. Valida respuesta WebAuthn
      b. ANTES de persistir: OneToOnePolicyService.revokeViolations(userId, deviceFingerprint)
         → Revoca dispositivos anteriores del mismo usuario
         → Revoca dispositivos de otros usuarios con mismo deviceFingerprint
      c. Persiste nuevo dispositivo
      d. Retorna éxito

4. Usuario queda enrolado con un solo dispositivo activo
```

**Responsabilidad de cada capa:**

| Capa | Responsabilidad |
| ---- | -------------- |
| `FinishEnrollmentController` | Orquestar: revocar conflictos → persistir → retornar |
| `OneToOnePolicyService` | Ejecutar lógica de revocación en BD |
| `FinishEnrollmentUseCase` | Solo: verificar WebAuthn + derivar HKDF + persistir (NO revocación) |

**IMPORTANTE:** No se solicita consentimiento explícito. La revocación es **automática y silenciosa** para mantener la seguridad 1:1.

### Estados del Dispositivo

```text
not_enrolled ──► pending ──► enrolled
                    │            │
                    │            ▼
                    └───────► revoked
```

---

## Dominio: Session

**Responsabilidad unica:** Establecer y terminar sesiones ECDH.

### Endpoints - Session

| Endpoint | Metodo | Descripcion |
| -------- | ------ | ----------- |
| `/api/session/login` | POST | ECDH key exchange, deriva session_key |
| `/api/session` | DELETE | Invalida session_key (opcional) |

### Componentes - Session

| Componente | Responsabilidad |
| ---------- | --------------- |
| `LoginEcdhUseCase` | Solo: ECDH + derivar session_key + generar TOTPu |
| `SessionStateMachine` | Verificar si estado permite sesion (`isEnabled()`) |
| `SessionKeyRepository` | CRUD en Valkey con TTL 2 horas |

### Flujo Login ECDH

```text
1. Cliente genera par ECDH efimero
2. POST /session/login { credentialId, clientPublicKey }
3. Servidor deriva shared secret con ECDH
4. Servidor deriva session_key con HKDF
5. Servidor guarda session_key en Valkey (TTL 2h)
6. Respuesta: { serverPublicKey, totpu }
7. Cliente deriva session_key localmente
```

### Deuda Tecnica: Dependencias Inter-Dominio

Actualmente `LoginEcdhUseCase` importa directamente de Enrollment:

- `DeviceRepository` (para buscar dispositivo por credentialId)
- `EcdhService`, `HkdfService` (para derivacion de claves)

Esto viola el principio de dominios independientes. La solucion ideal seria:

- Crear puertos en `shared/ports/` para estas dependencias
- Session usaria adaptadores que implementan los puertos

**Estado:** Documentado como deuda tecnica. El acoplamiento es funcional y no causa problemas en la practica actual. Se priorizara desacoplar si Session crece en complejidad.

---

## Dominio: Restriction (stub)

**Responsabilidad unica:** Verificar restricciones de acceso.

### Interfaz

```typescript
interface IRestrictionQuery {
  isBlocked(userId: number): Promise<{
    blocked: boolean;
    reason?: string;
  }>;
}
```

### Estado Actual

Stub que siempre retorna `{ blocked: false }`. Integracion futura con PHP para:

- Suspensiones temporales
- Restricciones de horario
- Bloqueos administrativos

---

## Access Gateway

**Responsabilidad unica:** Leer estado agregado de todos los dominios.

### Endpoint

```text
GET /api/access/state
Authorization: Bearer {jwt}

Response (sin wrappers):
{
  "state": "NOT_ENROLLED" | "ENROLLED_NO_SESSION" | "READY" | "BLOCKED",
  "action": "enroll" | "login" | "scan" | null,
  "device": {                    // Solo si tiene dispositivo
    "credentialId": "abc123",
    "deviceId": 1
  },
  "message": "..."              // Solo si BLOCKED
}
```

### Logica (solo lectura)

```typescript
async getState(userId: number, deviceFingerprint: string): Promise<AccessState> {
  // 1. Verificar restricciones
  const restriction = await this.restrictionQuery.isBlocked(userId);
  if (restriction.blocked) {
    return { state: 'BLOCKED', action: null, message: restriction.reason };
  }

  // 2. Verificar enrollment + política 1:1 via EnrollmentFlowOrchestrator
  const enrollmentResult = await this.orchestrator.attemptAccess(userId, deviceFingerprint);
  
  if (enrollmentResult.result === 'REQUIRES_ENROLLMENT') {
    return { state: 'NOT_ENROLLED', action: 'enroll' };
  }
  
  if (enrollmentResult.result === 'REQUIRES_REENROLLMENT') {
    // deviceFingerprint no coincide con dispositivo enrolado
    return { state: 'NOT_ENROLLED', action: 'enroll', 
             message: 'Re-enrollment required' };
  }

  // ACCESS_GRANTED: Usuario enrolado y deviceFingerprint válido
  const device = enrollmentResult.device;

  // 3. Verificar sesion
  const hasSession = await this.sessionQuery.hasActiveSession(userId);
  if (!hasSession) {
    return { state: 'ENROLLED_NO_SESSION', action: 'login', device };
  }

  return { state: 'READY', action: 'scan', device };
}
```

---

## Estados del Sistema

| Estado | Descripcion | Accion |
| ------ | ----------- | ------- |
| `NOT_ENROLLED` | Usuario sin dispositivo registrado | `enroll` |
| `ENROLLED_NO_SESSION` | Tiene dispositivo pero sin session_key | `login` |
| `READY` | Tiene session_key activa | `scan` |
| `BLOCKED` | Restriccion activa | ninguna |

---

## Frontend: Responsabilidades por Feature

Cada feature frontend tiene una responsabilidad específica y DEBE consultar Access Gateway antes de operar.

| Feature | Responsabilidad | Verifica Access Gateway |
| ------- | --------------- | ----------------------- |
| `enrollment/` | UI de enrollment + login ECDH. Punto de entrada para nuevos usuarios | ✓ Sí (en mount) |
| `qr-reader/` | UI de escaneo QR. Requiere estado `READY` para operar | ✓ **SÍ (OBLIGATORIO antes de escanear)** |
| `qr-host/` | Proyector de QRs. No requiere enrollment (solo sesión activa) | ✗ No (solo verifica clase activa) |

### enrollment/: Flujo de Estado

Renderiza UI según respuesta de Access Gateway:

```typescript
async function checkAndRender(): Promise<void> {
  const state = await accessService.getState(deviceFingerprint);

  switch (state.state) {
    case 'NOT_ENROLLED':
      showEnrollSection();
      break;
    case 'ENROLLED_NO_SESSION':
      showLoginSection(state.device.credentialId);
      break;
    case 'READY':
      showGoToScannerButton();
      break;
    case 'BLOCKED':
      showBlockedMessage(state.message);
      break;
  }
}
```

### qr-reader/: Flujo de Verificación (OBLIGATORIO)

**ANTES de permitir escaneo**, qr-reader DEBE verificar Access Gateway:

```typescript
async function checkEnrollmentStatus(): Promise<void> {
  const deviceFingerprint = DeviceFingerprintGenerator.generate();
  const state = await accessService.getState(deviceFingerprint);

  switch (state.state) {
    case 'NOT_ENROLLED':
    case 'ENROLLED_NO_SESSION':
      // Redirigir a /features/enrollment/
      window.location.href = '/features/enrollment/';
      break;
    case 'READY':
      // Permitir escaneo
      showScannerUI();
      break;
    case 'BLOCKED':
      showBlockedMessage(state.message);
      break;
  }
}
```

**IMPORTANTE:** qr-reader NO debe tener lógica de enrollment propia. Solo verifica estado y redirige si necesario.

---

## Diagrama de Secuencia

```text
┌────────┐     ┌─────────────┐     ┌────────────┐     ┌─────────┐
│Frontend│     │AccessGateway│     │ Enrollment │     │ Session │
└───┬────┘     └──────┬──────┘     └─────┬──────┘     └────┬────┘
    │                 │                  │                 │
    │ GET /access/state                  │                 │
    │────────────────>│                  │                 │
    │                 │ hasDevice?       │                 │
    │                 │─────────────────>│                 │
    │                 │ hasSession?      │                 │
    │                 │────────────────────────────────────>
    │                 │                  │                 │
    │ {state: ENROLLED_NO_SESSION}       │                 │
    │<────────────────│                  │                 │
    │                 │                  │                 │
    │ POST /session/login                │                 │
    │──────────────────────────────────────────────────────>
    │                 │                  │                 │
    │ {serverPublicKey, totpu}           │                 │
    │<──────────────────────────────────────────────────────
    │                 │                  │                 │
    │ GET /access/state                  │                 │
    │────────────────>│                  │                 │
    │                 │                  │                 │
    │ {state: READY, action: scan}       │                 │
    │<────────────────│                  │                 │
```

---

## Integracion con Validacion QR

Una vez en estado `READY`, el usuario puede marcar asistencia.
Ver `spec-qr-validation.md` para el flujo completo de escaneo.

Prerequisitos:

- Estado `READY` (verificado via `/api/access/state`)
- session_key almacenada en sessionStorage
- Sesion de clase activa

---

## Referencias

- `spec-qr-validation.md` - Flujo de escaneo QR
- `PROJECT-CONSTITUTION.md` - Articulo 2.3: Separation of Concerns
- `daRulez.md` - Reglas de desarrollo
