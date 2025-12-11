# Estado de Implementacion del Sistema

**Version:** 7.1
**Fecha:** 2025-12-11
**Proposito:** Documento vivo que refleja el estado actual de implementacion de todos los modulos

---

## Resumen Ejecutivo

### Estado General del Proyecto

```text
Flujo Anfitrion:  ████████████████████████ 100% [OK] PRODUCCION
Flujo Invitado:   ████████████████████████  93% [WIP] EN DESARROLLO
  ├─ Enrollment:  ████████████████████████  95% (backend + frontend + state machine)
  ├─ Asistencia:  █████████████████████████ 100% (backend + persistencia + QRs falsos)
  └─ Frontend:    ██████████████████████░░  85% (scanner + crypto + enrollment UI)

Sistema Completo: ████████████████████████  93%
```

### Hitos Completados

- [OK] **Arquitectura JWT completa** (PHP emite, Node valida)
- [OK] **WebSocket con autenticacion segura** (Opcion 5B)
- [OK] **Proyeccion QR para profesores** (funcional en dev + prod)
- [OK] **Monolito Modular con Vertical Slicing** (arquitectura implementada)
- [OK] **QRPayloadV1 con AES-256-GCM** (cifrado funcional con mock key)
- [OK] **Backend Attendance con Rounds e Intentos** (22 tests pasando)
- [OK] **Estado de estudiante en Valkey** (persistencia con TTL)
- [OK] **Frontend Crypto Infrastructure** (16 tests pasando - Fase 6.1)
- [OK] **UI State Machine para Scanner** (23 tests pasando - Fase 6.2)
- [OK] **Room-Aware Multi-Session System** (Fase 6.3)
- [OK] **Validation Pipeline Pattern** (10 stages, 20 tests - Fase 6.4)
- [OK] **Persistencia PostgreSQL** (validaciones, resultados - Fase 7)
- [OK] **Stub Mode para Testing** (bypass FIDO2 en desarrollo)
- [OK] **QRs Falsos con Auto-Balance** (fixed pool size - Fase 8)
- [OK] **Metricas de Fraude** (intentos fraudulentos en Valkey - Fase 8)
- [OK] **FIDO2Service + ECDHService + HkdfService** (backend crypto - Fase 9)
- [OK] **Frontend Enrollment UI** (WebAuthn + ECDH login - Fase 9)
- [OK] **Integracion session_key real** (con fallback mock - Fase 9)
- [OK] **EnrollmentStateMachine** (not_enrolled, pending, enrolled, revoked - Fase 16)
- [OK] **SessionStateMachine** (no_session, session_active, session_expired - Fase 16)
- [OK] **Verificacion deviceFingerprint en login** (con auto-update - Fase 16)

### Proximos Hitos

- [TODO] **Integracion PHP Legacy** (autenticacion delegada - Fase 15)
- [TODO] **Correcciones finales** (hardening criptografico - ver seccion abajo)

---

## Fases de Implementacion

### Historial de Fases Completadas

| Fase | Descripcion | Estado | Commits |
|------|-------------|--------|---------|
| 0 | Baseline - Analisis exploratorio | Completo | `a17bb0e` |
| 1 | QRPayloadV1 estructura | Completo | `d988f2e` |
| 2 | AES-256-GCM cifrado | Completo | `3cd39c4` |
| 3 | Valkey storage | Completo | `e24e1f4` |
| 4 | Endpoint validacion | Completo | `5ce7ea7` |
| 5 | Frontend scanner | Completo | `7f7c8a9` |
| 6 | Rounds e Intentos backend | Completo | `fa66afb` |
| 6.1 | Frontend crypto infrastructure | Completo | 16 tests |
| 6.2 | UI State Machine scanner | Completo | 23 tests |
| 6.3 | Room-Aware Multi-Session | Completo | Multiples commits |
| 6.4 | SoC Refactor - Validation Pipeline | Completo | 12 commits, 20 tests |
| 7 | Persistencia PostgreSQL | Completo | Repositorios + UseCase |
| 8 | QRs Falsos + Metricas Fraude | Completo | 7 commits, 15 tests |
| 9 | FIDO2 + ECDH Enrollment | Completo | 4 commits, 19 tests |
| 16 | EnrollmentStateMachine | Completo | 5 sub-fases, 8 commits |

### Fase 16 Completada: EnrollmentStateMachine

**Objetivo alcanzado:** Implementar automatas de estado explicitos para enrollment y sesion

**State Machines implementados:**

```text
EnrollmentStateMachine:
  not_enrolled ─────► pending ─────► enrolled ─────► revoked
       │                 │              │              │
       │                 ▼              │              │
       │           not_enrolled ◄──────┘              │
       │          (TTL expira)                        │
       └──────────────────────────────────────────────┘
                    (nuevo enrollment)

SessionStateMachine:
  no_session ─────► session_active ─────► session_expired
       ▲                 │                     │
       │                 │                     │
       └─────────────────┴─────────────────────┘
                    (TTL o logout)
```

**Componentes implementados:**

```text
src/backend/enrollment/
├── domain/
│   ├── models.ts                         # EnrollmentState, SessionState types
│   └── state-machines/
│       ├── index.ts
│       ├── enrollment-state-machine.ts   # Transiciones enrollment
│       └── session-state-machine.ts      # Transiciones sesion
├── application/use-cases/
│   ├── get-enrollment-status.use-case.ts # inferState() + credentialId fix
│   ├── start-enrollment.use-case.ts      # assertTransition()
│   ├── revoke-device.use-case.ts         # assertTransition()
│   └── login-ecdh.use-case.ts            # canStartSession() + fingerprint
└── infrastructure/repositories/
    └── device.repository.ts              # status field + updateFingerprint()
```

**Sub-fases:**

| Sub-fase | Descripcion | Tests |
|----------|-------------|-------|
| 16.1 | Tipos EnrollmentState y SessionState | 9/9 |
| 16.4 | Migracion DB status column | 8/8 |
| 16.5 | Refactorizar use cases con state machine | 12/12 |
| 16.6 | Debug logs, attestation direct, proxy | 11/11 |
| 16.7 | Verificacion deviceFingerprint en login | 10/10 |

**Migracion DB:**

```sql
-- 003-add-enrollment-status.sql
ALTER TABLE enrollment.devices 
ADD COLUMN status VARCHAR(20) DEFAULT 'enrolled'
CHECK (status IN ('not_enrolled', 'pending', 'enrolled', 'revoked'));
```

---

### Fase 7 Completada: Persistencia PostgreSQL

**Objetivo alcanzado:** Persistir validaciones y resultados en PostgreSQL

**Componentes implementados:**

```text
src/backend/attendance/infrastructure/repositories/
├── index.ts                     # Barrel exports
├── session.repository.ts        # CRUD sesiones
├── registration.repository.ts   # CRUD registros estudiante
├── validation.repository.ts     # CRUD validaciones por round
└── result.repository.ts         # CRUD resultados finales
```

**Repositorios:**

| Repositorio | Métodos | Tabla PostgreSQL |
|-------------|---------|------------------|
| SessionRepository | create, getById, getActiveByProfessor, update, close, cancel | attendance.sessions |
| RegistrationRepository | create, getBySessionAndUser, updateStatus, listActiveBySession | attendance.registrations |
| ValidationRepository | create, complete, getByRound, getResponseTimeStats, countSuccessful | attendance.validations |
| ResultRepository | create, getByRegistration, listBySession, getSessionStats | attendance.results |

**Integración con UseCase:**

- `PersistenceDependencies` interface en CompleteScanUseCase
- `persistValidation()` - Guarda cada round exitoso
- `persistResult()` - Guarda resultado final con estadísticas
- Factory con `enablePostgresPersistence` flag
- Variable `ENABLE_POSTGRES_PERSISTENCE=true` en compose.dev.yaml

**Stub Mode para Testing:**

- `ENROLLMENT_STUB_MODE=true` permite testing sin FIDO2
- `decrypt.stage.ts` detecta QRPayloadV1 y lo convierte a StudentResponse
- Flujo completo probado con persistencia real

**Datos verificados en PostgreSQL:**
- 3 validaciones en `attendance.validations`
- 1 resultado con stats en `attendance.results`

---

### Fase 8 Completada: QRs Falsos y Métricas de Fraude

**Objetivo alcanzado:** Generar QRs señuelo indistinguibles y rastrear intentos fraudulentos

**Estrategia implementada: Fixed Pool Size**

```text
┌─────────────────────────────────────────────────────────────┐
│              Pool de Proyección (minPoolSize=10)             │
├─────────────────────────────────────────────────────────────┤
│  Caso 1: 3 estudiantes registrados                          │
│  [Real][Real][Real][Fake][Fake][Fake][Fake][Fake][Fake][Fake]│
│   3 reales + 7 falsos = 10 QRs                              │
├─────────────────────────────────────────────────────────────┤
│  Caso 2: 12 estudiantes registrados                         │
│  [Real][Real][Real][Real][Real][Real][Real][Real][Real]...  │
│   12 reales + 0 falsos = 12 QRs (sin fakes)                 │
└─────────────────────────────────────────────────────────────┘
```

**Componentes implementados:**

```text
src/backend/attendance/
├── application/
│   └── fake-qr-generator.ts         # [NUEVO] Generación QRs falsos
├── infrastructure/
│   ├── fraud-metrics.repository.ts  # [NUEVO] Métricas en Valkey
│   └── projection-pool.repository.ts # removeFakeQRs() agregado
└── presentation/
    └── routes.ts                     # 6 endpoints /dev/*
```

**FakeQRGenerator:**

| Método | Propósito |
|--------|-----------|  
| `calculateFakesNeeded()` | Calcula cuántos fakes agregar |
| `balancePool()` | Balancea pool a minPoolSize |
| `injectIntoPool()` | Inyecta N fakes manualmente |
| `updateConfig()` | Actualiza minPoolSize dinámicamente |

**FraudMetricsRepository:**

| Clave Valkey | Contenido |
|--------------|-----------|  
| `fraud:count:{sessionId}:{type}` | Contador por tipo de fraude |
| `fraud:attempts:{sessionId}` | Lista de intentos (JSON) |
| `fraud:students:{sessionId}` | Set de studentIds sospechosos |

**Tipos de fraude rastreados:**
- `invalid_qr` - QR no descifrable
- `fake_qr` - QR fake detectado
- `repeated_scan` - Intento duplicado
- `expired_qr` - QR expirado/consumido

**Dev Endpoints (requiere DEV_ENDPOINTS=true):**

| Endpoint | Método | Propósito |
|----------|--------|-----------|  
| `/attendance/dev/fakes` | POST | Inyectar fakes manualmente |
| `/attendance/dev/balance` | POST | Balancear pool a minPoolSize |
| `/attendance/dev/pool/:sessionId` | GET | Ver contenido del pool |
| `/attendance/dev/fraud/:sessionId` | GET | Ver métricas de fraude |
| `/attendance/dev/config` | GET | Ver configuración actual |
| `/attendance/dev/config` | PATCH | Actualizar minPoolSize |

**Tests:** 15/15 pasando en `test-fase8.sh`

---

### Fase 6.4 Completada: Validation Pipeline Pattern

**Objetivo alcanzado:** Refactorizar monolito de validación en pipeline con stages reutilizables

**Arquitectura implementada:**

```text
┌─────────────────────────────────────────────────────────────┐
│                    CompleteScanUseCase                       │
│  (Orquesta validación + side effects)                       │
├─────────────────────────────────────────────────────────────┤
│                    ValidateScanUseCase                       │
│  (Validación pura, sin side effects)                        │
├─────────────────────────────────────────────────────────────┤
│                 ValidationPipelineRunner                     │
│  (Ejecuta stages en secuencia, falla rápido)                │
├─────────────────────────────────────────────────────────────┤
│                        Stages                                │
│  ┌────────┐ ┌─────────┐ ┌───────────┐ ┌──────────┐         │
│  │Decrypt │→│Structure│→│ Ownership │→│Load QR   │→ ...    │
│  └────────┘ └─────────┘ └───────────┘ └──────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**10 Stages implementados:**

| Stage | Tipo | Responsabilidad |
|-------|------|-----------------|
| `decryptPayloadStage` | Sync | Descifra QR con AES-GCM |
| `validateStructureStage` | Sync | Valida formato QRPayloadV1 |
| `validateOwnershipStage` | Sync | Verifica que uid coincide con estudiante |
| `loadQrStateStage` | Async | Carga estado del QR desde Valkey |
| `validateQrExistsStage` | Sync | Verifica que QR existe |
| `validateQrNotConsumedStage` | Sync | Verifica QR no consumido |
| `loadStudentStateStage` | Async | Carga estado estudiante desde Valkey |
| `validateStudentNotDuplicateStage` | Sync | Verifica no duplicado en round |
| `validateStudentNotPausedStage` | Sync | Verifica estudiante no pausado |
| `validateStudentNotCompletedStage` | Sync | Verifica estudiante no completado |
| `validateRoundMatchStage` | Sync | Verifica round del QR coincide con actual |

**Componentes creados:**

- `ValidationContext` - Objeto inmutable que fluye por el pipeline
- `ValidationPipelineRunner` - Ejecutor genérico de stages
- `ValidateScanUseCase` - Caso de uso de validación pura
- `CompleteScanUseCase` - Caso de uso completo con efectos
- `StatsCalculator` - Cálculo de estadísticas extraído a dominio
- `ErrorMapper` - Mapeo de errores de dominio a respuestas HTTP
- 3 Adapters para inversión de dependencias

**Tests:** 20/20 pasando para stages

**Código eliminado:** `AttendanceValidationService` (415 líneas legacy)

---

## Estado por Módulo Backend

### Módulo: attendance (Validación Asistencia)

```text
src/backend/attendance/
├── application/
│   ├── index.ts                     # Barrel exports
│   ├── validate-scan.usecase.ts     # Validación pura [NUEVO]
│   ├── complete-scan.usecase.ts     # Flujo completo [NUEVO]
│   ├── qr-generator.ts              # Generación de QRs
│   └── participation.service.ts     # Registro y estado
├── domain/
│   ├── models.ts                    # QRPayloadV1, StudentState, etc
│   ├── stats-calculator.ts          # Cálculo de stats [NUEVO]
│   └── validation-pipeline/         # [NUEVO]
│       ├── context.ts               # ValidationContext
│       ├── runner.ts                # PipelineRunner
│       ├── stage.interface.ts       # Interfaces Stage/SyncStage
│       └── stages/                  # 10 stages individuales
├── infrastructure/
│   ├── index.ts                     # Barrel exports
│   ├── adapters/                    # [NUEVO]
│   │   ├── qr-state.adapter.ts
│   │   ├── student-state.adapter.ts
│   │   └── complete-scan-deps.adapter.ts
│   ├── student-session.repository.ts
│   ├── valkey-store.ts
│   └── crypto.ts
├── presentation/
│   ├── routes.ts                    # Rutas HTTP (usa CompleteScanUseCase)
│   ├── error-mapper.ts              # Mapeo errores→HTTP [NUEVO]
│   └── types.ts                     # DTOs
└── __tests__/
    └── stages.test.ts               # 20 tests [NUEVO]
```

| Componente | Estado | Notas |
|------------|--------|-------|
| CompleteScanUseCase | [OK] Funcional | Orquesta validación + efectos |
| ValidateScanUseCase | [OK] Funcional | Validación pura |
| ValidationPipeline | [OK] Funcional | 10 stages, runner genérico |
| StatsCalculator | [OK] Funcional | Extraído a dominio |
| ErrorMapper | [OK] Funcional | HTTP status codes |
| Adapters | [OK] Funcional | 3 adapters para DI |
| QR Generator | [OK] Funcional | AES-256-GCM + QRPayloadV1 |
| Participation Service | [OK] Funcional | Register + status + refresh |
| Student Session Repo | [OK] Funcional | Valkey con TTL |
| Valkey Store | [OK] Funcional | QR metadata storage |
| Crypto Service | [OK] Funcional | AES-256-GCM encrypt/decrypt |

**Estado general:** [OK] **85% Funcional** (backend refactorizado, falta PostgreSQL)

**Endpoints implementados:**

- [OK] POST `/attendance/register` → Registra estudiante + genera primer QR
- [OK] GET `/attendance/status` → Estado actual del estudiante
- [OK] POST `/attendance/validate` → Valida round + avanza estado (usa CompleteScanUseCase)
- [OK] POST `/attendance/refresh-qr` → Genera nuevo QR para round actual

**Tests:** 20+ tests pasando

---

### Módulo: auth (Autenticación JWT)

| Componente | Estado | Notas |
|------------|--------|-------|
| JWT Emisión (PHP) | [OK] Funcional | PHP emite JWT con HS256 |
| JWT Validación (Node) | [OK] Funcional | JWTUtils.verify() |
| Middleware HTTP | [OK] Funcional | Fastify hooks |
| WebSocket Auth | [OK] Funcional | Handshake con timeout 5s |

**Estado general:** [OK] **100% Funcional**

---

### Módulo: qr-projection (Proyección QR)

| Componente | Estado | Notas |
|------------|--------|-------|
| QR Generation | [OK] Funcional | Genera QR con qrcode |
| WebSocket Controller | [OK] Funcional | Auth + proyección |
| HTTP Controller | [OK] Funcional | Healthcheck |

**Estado general:** [OK] **100% Funcional**

---

### Módulo: enrollment (Registro de Dispositivos)

| Componente | Estado | Notas |
|------------|--------|-------|
| Fido2Service | [OK] Funcional | @simplewebauthn/server v11 |
| EcdhService | [OK] Funcional | P-256, key exchange |
| HkdfService | [OK] Funcional | Derivación + TOTP |
| StartEnrollmentUseCase | [OK] Funcional | Con penalizaciones |
| FinishEnrollmentUseCase | [OK] Funcional | HKDF + PostgreSQL |
| LoginEcdhUseCase | [OK] Funcional | Session key en Valkey |
| RevokeDeviceUseCase | [OK] Funcional | Soft delete |
| DeviceRepository | [OK] Funcional | CRUD enrollment.devices |
| SessionKeyRepository | [OK] Funcional | Valkey TTL 2h |
| EnrollmentChallengeRepository | [OK] Funcional | Valkey TTL 5min |
| PenaltyService | [OK] Funcional | Delays exponenciales |

**Estado general:** [OK] **90% Funcional** (falta WebSocket para assertion)

**Endpoints implementados:**

- [OK] POST `/api/enrollment/start` → Inicia enrollment FIDO2
- [OK] POST `/api/enrollment/finish` → Completa enrollment
- [OK] GET `/api/enrollment/status` → Estado de dispositivos
- [OK] POST `/api/enrollment/login` → ECDH key exchange
- [OK] DELETE `/api/enrollment/devices/:id` → Revocar dispositivo

---

## Estado por Módulo Frontend

### Frontend: features/enrollment (Registro FIDO2)

| Componente | Estado | Notas |
|------------|--------|-------|
| EnrollmentService | [OK] Funcional | @simplewebauthn/browser |
| LoginService | [OK] Funcional | ECDH con Web Crypto |
| SessionKeyStore | [OK] Funcional | sessionStorage + JWK |
| Enrollment UI | [OK] Funcional | Lista dispositivos + revoke |

**Estado general:** [OK] **90% Funcional**

---

### Frontend: features/qr-reader (Scanner QR)

| Componente | Estado | Notas |
|------------|--------|-------|
| Camera View | [OK] Funcional | UI cámara + overlay + states |
| QR Scan Service | [OK] Funcional | Descifra + debug logs |
| API Client | [OK] Funcional | Maneja expectedRound |
| AES-GCM Crypto | [OK] Funcional | Web Crypto API |
| Session Key Integration | [OK] Funcional | Usa SessionKeyStore con fallback mock |

**Estado general:** [OK] **85% Funcional**

---

## Infraestructura

### Base de Datos: PostgreSQL 18

| Schema/Tabla | Estado | Notas |
|--------------|--------|-------|
| Schema `enrollment` | [OK] Creado | DDL en migrations |
| `enrollment.devices` | [OK] En uso | DeviceRepository + transports |
| Schema `attendance` | [OK] Creado | DDL en migrations |
| `attendance.sessions` | [OK] En uso | SessionRepository |
| `attendance.registrations` | [OK] En uso | RegistrationRepository |
| `attendance.validations` | [OK] En uso | ValidationRepository |
| `attendance.results` | [OK] En uso | ResultRepository |

**Estado general:** [OK] **100% Estructura + Repositorios**

---

### Cache: Valkey 7

| Uso | Estado | Notas |
|-----|--------|-------|
| Cliente base | [OK] Funcional | ValkeyClient implementado |
| Student Session State | [OK] Funcional | `student:{sessionId}:{studentId}` |
| QR Metadata | [OK] Funcional | `qr:{nonce}` con TTL |
| Room Round Tracking | [OK] Funcional | Fase 6.3 |
| Enrollment Challenges | [OK] Funcional | `enrollment:challenge:{userId}` TTL 5min |
| Session Keys | [OK] Funcional | `session:{userId}:key` TTL 2h |
| Penalty Counters | [OK] Funcional | `penalty:{userId}:enrollment` |

**Estado general:** [OK] **95% - En uso activo**

---

## Matriz Mock vs Producción

| Componente | Mock (Dev) | Producción |
|------------|------------|------------|
| session_key | `MOCK_SESSION_KEY` fallback | Derivada de ECDH en login |
| TOTPu | Generado pero no validado | TOTP real de **handshake_secret** |
| userId | Parámetro en request | Extraído de JWT de PHP |
| Enrollment | FIDO2 real (con fallback) | FIDO2/WebAuthn completo |

---

## Correcciones Finales (Hardening)

Mejoras no críticas identificadas en revisión de seguridad. El sistema funciona correctamente sin estas, pero aumentan robustez.

### Prioridad Alta

| Corrección | Archivo | Acción |
|------------|---------|--------|
| **TOTPu no validado** | `validation-pipeline/stages/` | Agregar stage que valide TOTPu en payload de respuesta |

### Prioridad Media

| Corrección | Archivo | Acción |
|------------|---------|--------|
| **Attestation sin validación AAGUID** | `fido2.service.ts` | Validar AAGUIDs contra lista de authenticators confiables, o cambiar a `attestationType: 'none'` |
| **Session key sin binding** | `hkdf.service.ts` | Incluir `credentialId` en derivación de session_key para binding explícito |

### Prioridad Baja (Opcional)

| Corrección | Archivo | Notas |
|------------|---------|-------|
| **TOTP usa SHA256** | `hkdf.service.ts` | RFC 4226 usa SHA1. No es problema de seguridad pero impide interoperabilidad con apps TOTP estándar |
| **Device Fingerprint débil** | Frontend | OK como está - es secundario, `credentialId` es el identificador real |

---

## Fases Pendientes

### Fase 15: Integración PHP Legacy

**Rama:** `fase-15-integracion-php`

- [ ] Endpoints de sincronización con PHP
- [ ] Autenticación delegada
- [ ] Mapeo de usuarios existentes

---

## Referencias

- `TODO.md` - Lista de tareas actualizada
- `daRulez.md` - Reglas del proyecto
- `flujo-validacion-qr-20251128.md` - Flujo completo documentado
- `14-decision-totp-session-key.md` - Decisión sobre TOTPu
- `database/migrations/001-initial-schema.sql` - Schema DB

---

**Última actualización:** 2025-12-11
**Rama activa:** `fase-16.8-tests-docs`
**Próximo paso:** Correcciones finales (TOTPu) → Fase 15 (PHP Legacy)
