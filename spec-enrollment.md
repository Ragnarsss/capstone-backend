# Especificacion: Acceso y Enrollment FIDO2

## Precondiciones

- Usuario autenticado en el sistema (JWT de PHP)
- Usuario solicita registrar asistencia

---

## Objetivo

Garantizar que cada usuario registre asistencia desde **un unico dispositivo** mediante enrolamiento biometrico FIDO2.

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
|----------|--------|-------------|
| `/api/enrollment/start` | POST | Genera challenge WebAuthn |
| `/api/enrollment/finish` | POST | Verifica y persiste dispositivo |
| `/api/enrollment/devices/:id` | DELETE | Revoca dispositivo |

### Componentes

| Componente | Responsabilidad |
|------------|-----------------|
| `StartEnrollmentUseCase` | Solo: generar challenge + opciones WebAuthn |
| `FinishEnrollmentUseCase` | Solo: verificar credential + derivar HKDF + persistir |
| `OneToOnePolicyService` | Validar y revocar violaciones de politica 1:1 |
| `DeviceStateMachine` | Transiciones: not_enrolled → pending → enrolled → revoked |
| `DeviceRepository` | CRUD en PostgreSQL |

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

### Endpoints

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/session/login` | POST | ECDH key exchange, deriva session_key |
| `/api/session` | DELETE | Invalida session_key (opcional) |

### Componentes

| Componente | Responsabilidad |
|------------|-----------------|
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
async getState(userId: number): Promise<AccessState> {
  // 1. Verificar restricciones
  const restriction = await this.restrictionQuery.isBlocked(userId);
  if (restriction.blocked) {
    return { state: 'BLOCKED', action: null, message: restriction.reason };
  }

  // 2. Verificar enrollment
  const device = await this.deviceQuery.getActiveDevice(userId);
  if (!device) {
    return { state: 'NOT_ENROLLED', action: 'enroll' };
  }

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
|--------|-------------|--------|
| `NOT_ENROLLED` | Usuario sin dispositivo registrado | `enroll` |
| `ENROLLED_NO_SESSION` | Tiene dispositivo pero sin session_key | `login` |
| `READY` | Tiene session_key activa | `scan` |
| `BLOCKED` | Restriccion activa | ninguna |

---

## Frontend: Renderizado por Estado

El frontend solo consulta el AccessGateway y renderiza segun la respuesta.

```typescript
async function checkAndRender(): Promise<void> {
  const state = await accessService.getState();

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
