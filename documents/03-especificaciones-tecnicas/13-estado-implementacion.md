# Estado de Implementación del Sistema

**Versión:** 4.0  
**Fecha:** 2025-01  
**Propósito:** Documento vivo que refleja el estado actual de implementación de todos los módulos

---

## Resumen Ejecutivo

### Estado General del Proyecto

```text
Flujo Anfitrión:  ████████████████████████ 100% [OK] PRODUCCIÓN
Flujo Invitado:   ██████████████████░░░░░░  70% [WIP] EN DESARROLLO
  ├─ Enrollment:  ██░░░░░░░░░░░░░░░░░░░░░░  10% (stubs backend)
  ├─ Asistencia:  ████████████████████░░░░  85% (backend refactorizado + frontend OK)
  └─ Frontend:    ██████████████░░░░░░░░░░  55% (scanner + crypto + UI states OK)

Sistema Completo: ██████████████████░░░░░░  72%
```

### Hitos Completados

- [OK] **Arquitectura JWT completa** (PHP emite, Node valida)
- [OK] **WebSocket con autenticación segura** (Opción 5B)
- [OK] **Proyección QR para profesores** (funcional en dev + prod)
- [OK] **Monolito Modular con Vertical Slicing** (arquitectura implementada)
- [OK] **QRPayloadV1 con AES-256-GCM** (cifrado funcional con mock key)
- [OK] **Backend Attendance con Rounds e Intentos** (22 tests pasando)
- [OK] **Estado de estudiante en Valkey** (persistencia con TTL)
- [OK] **Frontend Crypto Infrastructure** (16 tests pasando - Fase 6.1)
- [OK] **UI State Machine para Scanner** (23 tests pasando - Fase 6.2)
- [OK] **Room-Aware Multi-Session System** (Fase 6.3)
- [OK] **Validation Pipeline Pattern** (10 stages, 20 tests - Fase 6.4)

### Próximos Hitos

- [TODO] **Persistencia PostgreSQL** (attendance.validations, results)
- [TODO] **QRs Falsos Adicionales** (señuelos mejorados)
- [TODO] **Enrollment FIDO2 + ECDH** (proceso real)
- [TODO] **Integración PHP Legacy** (autenticación delegada)

---

## Fases de Implementación

### Historial de Fases Completadas

| Fase | Descripción | Estado | Commits |
|------|-------------|--------|---------|
| 0 | Baseline - Análisis exploratorio | ✅ Completo | `a17bb0e` |
| 1 | QRPayloadV1 estructura | ✅ Completo | `d988f2e` |
| 2 | AES-256-GCM cifrado | ✅ Completo | `3cd39c4` |
| 3 | Valkey storage | ✅ Completo | `e24e1f4` |
| 4 | Endpoint validación | ✅ Completo | `5ce7ea7` |
| 5 | Frontend scanner | ✅ Completo | `7f7c8a9` |
| 6 | Rounds e Intentos backend | ✅ Completo | `fa66afb` |
| 6.1 | Frontend crypto infrastructure | ✅ Completo | 16 tests |
| 6.2 | UI State Machine scanner | ✅ Completo | 23 tests |
| 6.3 | Room-Aware Multi-Session | ✅ Completo | Múltiples commits |
| 6.4 | SoC Refactor - Validation Pipeline | ✅ Completo | 12 commits, 20 tests |

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
| Start Enrollment | [WIP] Stub | Retorna challenge fake |
| Finish Enrollment | [WIP] Stub | Acepta cualquier credential |
| Login ECDH | [WIP] Stub | Retorna keys fake |
| WebSocket Controller | [FAIL] No existe | Crítico para flujo real |
| FIDO2 Service | [FAIL] No existe | Pendiente Fase 9 |
| ECDH Service | [FAIL] No existe | Pendiente Fase 9 |

**Estado general:** [WIP] **10% - Solo Stubs**

---

## Estado por Módulo Frontend

### Frontend: features/attendance (Scanner QR)

| Componente | Estado | Notas |
|------------|--------|-------|
| Camera View | [OK] Funcional | UI cámara + overlay + states |
| QR Scan Service | [OK] Funcional | Descifra + debug logs |
| API Client | [OK] Funcional | Maneja expectedRound |
| AES-GCM Crypto | [OK] Funcional | Web Crypto API |
| Mock Keys | [OK] Funcional | MOCK_SESSION_KEY |

**Estado general:** [OK] **55% - Crypto + UI states completos**

---

### Frontend: features/enrollment

| Componente | Estado | Notas |
|------------|--------|-------|
| Enrollment UI | [FAIL] No existe | Pendiente Fase 9 |
| WebAuthn Integration | [FAIL] No existe | Pendiente Fase 9 |

**Estado general:** [FAIL] **0%**

---

## Infraestructura

### Base de Datos: PostgreSQL 18

| Schema/Tabla | Estado | Notas |
|--------------|--------|-------|
| Schema `enrollment` | [OK] Creado | DDL en migrations |
| `enrollment.devices` | [OK] Tabla existe | Sin uso desde código |
| Schema `attendance` | [OK] Creado | DDL en migrations |
| `attendance.sessions` | [OK] Tabla existe | Sin uso desde código |
| `attendance.registrations` | [OK] Tabla existe | Sin uso desde código |
| `attendance.validations` | [OK] Tabla existe | Sin uso desde código |
| `attendance.results` | [OK] Tabla existe | Sin uso desde código |

**Estado general:** [OK] **100% Estructura** - Pendiente Fase 7 para uso real

---

### Cache: Valkey 7

| Uso | Estado | Notas |
|-----|--------|-------|
| Cliente base | [OK] Funcional | ValkeyClient implementado |
| Student Session State | [OK] Funcional | `student:{sessionId}:{studentId}` |
| QR Metadata | [OK] Funcional | `qr:{nonce}` con TTL |
| Room Round Tracking | [OK] Funcional | Fase 6.3 |

**Estado general:** [OK] **80% - En uso activo**

---

## Matriz Mock vs Producción

| Componente | Mock (Actual) | Producción |
|------------|---------------|------------|
| session_key | `MOCK_SESSION_KEY` hardcodeada | Derivada de ECDH en login/sesión |
| TOTPu | No implementado | TOTP real de **session_key** |
| userId | Parámetro en request | Extraído de JWT de PHP |
| Enrollment | Stubs | FIDO2/WebAuthn real |

---

## Fases Pendientes

### Fase 7: Persistencia PostgreSQL
**Estimado: 6-8 horas**

- [ ] Repositorios con patrón Repository
- [ ] Persistencia de sesiones y validaciones
- [ ] Recuperación ante reinicio del servicio
- [ ] Índices para queries frecuentes

### Fase 8: QRs Falsos Adicionales
**Estimado: 2-4 horas**

- [ ] Generación de QR señuelo adicionales
- [ ] Estrategias de distribución de falsos
- [ ] Métricas de intentos fraudulentos

### Fase 9: FIDO2 + ECDH para Enrolamiento
**Estimado: 12-16 horas**

- [ ] Flujo de enrolamiento con WebAuthn
- [ ] Intercambio de claves ECDH
- [ ] Almacenamiento seguro de credenciales
- [ ] Reemplazo de MOCK_SESSION_KEY

### Fase 10: Integración PHP Legacy
**Estimado: 4-6 horas**

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

**Última actualización:** 2025-01  
**Rama activa:** `fase-6-4-refactor-soc-validation`  
**Próximo paso:** Merge a main, planificación Fase 7
