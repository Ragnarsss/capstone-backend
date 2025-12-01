# Estado de Implementación del Sistema

**Versión:** 2.0  
**Fecha:** 2025-11-28  
**Propósito:** Documento vivo que refleja el estado actual de implementación de todos los módulos

---

## Resumen Ejecutivo

### Estado General del Proyecto

```text
Flujo Anfitrión:  ████████████████████████ 100% [OK] PRODUCCIÓN
Flujo Invitado:   ██████████░░░░░░░░░░░░░░  40% [WIP] EN DESARROLLO
  ├─ Enrollment:  ██░░░░░░░░░░░░░░░░░░░░░░  10% (stubs backend)
  ├─ Asistencia:  ██████████████░░░░░░░░░░  60% (backend con rounds OK)
  └─ Frontend:    ██████░░░░░░░░░░░░░░░░░░  25% (scanner basico OK)

Sistema Completo: ██████████████░░░░░░░░░░  62%
```

### Hitos Completados

- [OK] **Arquitectura JWT completa** (PHP emite, Node valida)
- [OK] **WebSocket con autenticación segura** (Opción 5B)
- [OK] **Proyección QR para profesores** (funcional en dev + prod)
- [OK] **Monolito Modular con Vertical Slicing** (arquitectura implementada)
- [OK] **QRPayloadV1 con AES-256-GCM** (cifrado funcional con mock key)
- [OK] **Backend Attendance con Rounds e Intentos** (22 tests pasando)
- [OK] **Estado de estudiante en Valkey** (persistencia con TTL)

### Próximos Hitos

- [WIP] **Frontend Invitado con crypto** (descifrado QR + flujo rounds)
- [TODO] **Persistencia PostgreSQL** (attendance.validations, results)
- [TODO] **Enrollment WebSocket** (proceso FIDO2 interactivo)

---

## Fases de Implementación (Rama fase-6-persistencia-asistencia)

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
| 6.1 | Frontend crypto + rounds | 🔄 En curso | - |

### Fase Actual: 6.1 - Frontend Crypto Integration

**Objetivo:** Integrar frontend con flujo completo de cifrado/descifrado

**Tareas pendientes:**

1. Cliente descifra QR con session_key (mock)
2. Cliente trackea expectedRound
3. Cliente genera TOTPu (mock)
4. Cliente cifra respuesta
5. Manejar expectedRound en respuestas
6. Estados: complete, noMoreAttempts

---

## Estado por Módulo Backend

### Módulo: attendance (Validación Asistencia)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| **Application Layer** | | | |
| QR Generator | `application/qr-generator.ts` | [OK] Funcional | AES-256-GCM + QRPayloadV1 |
| Validation Service | `application/attendance-validation.service.ts` | [OK] Funcional | Rounds + intentos + stats |
| Participation Service | `application/participation.service.ts` | [OK] Funcional | Register + status + refresh |
| **Domain Layer** | | | |
| Models | `domain/models.ts` | [OK] Funcional | QRPayloadV1, StudentState, etc |
| **Infrastructure Layer** | | | |
| Session Repository | `infrastructure/student-session.repository.ts` | [OK] Funcional | Valkey con TTL |
| Valkey Store | `infrastructure/valkey-store.ts` | [OK] Funcional | QR metadata storage |
| Crypto Service | `infrastructure/crypto.ts` | [OK] Funcional | AES-256-GCM encrypt/decrypt |
| **Presentation Layer** | | | |
| Routes | `presentation/routes.ts` | [OK] Funcional | 4 endpoints REST |
| Types | `presentation/types.ts` | [OK] Funcional | DTOs request/response |

**Estado general:** [OK] **60% Funcional** (backend completo, falta persistencia PostgreSQL)

**Endpoints implementados:**

- [OK] POST `/attendance/register` → Registra estudiante + genera primer QR
- [OK] GET `/attendance/status` → Estado actual del estudiante
- [OK] POST `/attendance/validate` → Valida round + avanza estado
- [OK] POST `/attendance/refresh-qr` → Genera nuevo QR para round actual

**Sistema de Rounds e Intentos:**

```text
maxRounds = 3    (ciclos QR a completar exitosamente)
maxAttempts = 3  (oportunidades si falla un round)

Éxito en round → advance to next round
Fallo en round → consume intento, restart desde round 1
Sin intentos   → {noMoreAttempts: true}
```

**Tests:** 22/22 pasando (`scripts/test-fase6.sh`)

---

### Módulo: auth (Autenticación JWT)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| JWT Emisión | `php-service/src/lib/jwt.php` | [OK] Funcional | PHP emite JWT con HS256 |
| JWT Validación | `node-service/src/shared/config/index.ts` | [OK] Funcional | JWTUtils.verify() |
| Middleware HTTP | `node-service/src/middleware/*.ts` | [OK] Funcional | Fastify hooks |
| WebSocket Auth | `websocket-controller.ts` | [OK] Funcional | Handshake con timeout 5s |

**Estado general:** [OK] **100% Funcional**

---

### Módulo: qr-projection (Proyección QR)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| QR Generation | `application/usecases/generate-qr.usecase.ts` | [OK] Funcional | Genera QR con qrcode |
| WebSocket Controller | `presentation/websocket-controller.ts` | [OK] Funcional | Auth + proyección |
| HTTP Controller | `presentation/qr-projection-controller.ts` | [OK] Funcional | Healthcheck |

**Estado general:** [OK] **100% Funcional**

---

### Módulo: enrollment (Registro de Dispositivos)

| Componente | Estado | Notas |
|------------|--------|-------|
| Start Enrollment | [WIP] Stub | Retorna challenge fake |
| Finish Enrollment | [WIP] Stub | Acepta cualquier credential |
| Login ECDH | [WIP] Stub | Retorna keys fake |
| WebSocket Controller | [FAIL] No existe | Crítico para flujo real |
| FIDO2 Service | [FAIL] No existe | Pendiente |
| ECDH Service | [FAIL] No existe | Pendiente |

**Estado general:** [WIP] **10% - Solo Stubs**

---

## Estado por Módulo Frontend

### Frontend: features/attendance (Scanner QR)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| Camera View | `camera-view.component.ts` | [OK] Funcional | UI cámara + overlay |
| QR Scan Service | `qr-scan.service.ts` | [WIP] Parcial | Escanea pero NO descifra |
| API Client | `attendance-api.client.ts` | [WIP] Parcial | Falta manejar expectedRound |

**Estado general:** [WIP] **25% - Escanea pero sin crypto**

**Pendiente Fase 6.1:**

- [ ] Descifrar QR con session_key (mock)
- [ ] Verificar r === expectedRound
- [ ] Construir response con TOTPu
- [ ] Cifrar response
- [ ] Manejar {complete, noMoreAttempts, expectedRound}
- [ ] UI para progreso de rounds

---

### Frontend: features/enrollment

| Componente | Estado | Notas |
|------------|--------|-------|
| Enrollment UI | [FAIL] No existe | Pendiente |
| WebAuthn Integration | [FAIL] No existe | Pendiente |

**Estado general:** [FAIL] **0%**

---

## Infraestructura

### Base de Datos: PostgreSQL 18

| Schema/Tabla | Estado | Notas |
|--------------|--------|-------|
| Schema `enrollment` | [OK] Creado | DDL en 001-initial-schema.sql |
| `enrollment.devices` | [OK] Tabla existe | Sin datos |
| `enrollment.enrollment_history` | [OK] Tabla existe | Sin datos |
| Schema `attendance` | [OK] Creado | DDL en 001-initial-schema.sql |
| `attendance.sessions` | [OK] Tabla existe | Sin datos |
| `attendance.registrations` | [OK] Tabla existe | Sin datos |
| `attendance.validations` | [OK] Tabla existe | Sin datos |
| `attendance.results` | [OK] Tabla existe | Sin datos |

**Estado general:** [OK] **100% Estructura** - Schemas y tablas creados, sin uso desde código

---

### Cache: Valkey 7

| Uso | Estado | Notas |
|-----|--------|-------|
| Cliente base | [OK] Funcional | ValkeyClient implementado |
| Student Session State | [OK] Funcional | `student:{sessionId}:{studentId}` |
| QR Metadata | [OK] Funcional | `qr:{nonce}` con TTL |
| Sessions storage | [FAIL] No usado | Pendiente |

**Estado general:** [OK] **70% - En uso activo para attendance**

---

## Matriz Mock vs Producción

| Componente | Mock (Actual) | Producción |
|------------|---------------|------------|
| session_key | `MOCK_SESSION_KEY` hardcodeada | Derivada de ECDH en enrolamiento |
| TOTPu | No implementado | TOTP real de handshake_secret |
| userId | Parámetro en request | Extraído de JWT de PHP |
| Enrollment | Stubs | FIDO2/WebAuthn real |

---

## Plan de Continuación

### Fase 6.1: Frontend Crypto Integration (Siguiente)

**Objetivo:** Frontend puede descifrar QR, validar rounds, enviar respuesta cifrada

**Archivos a modificar:**

```text
node-service/src/frontend/features/attendance/
├── qr-scan.service.ts          # REESCRIBIR - flujo crypto completo
├── attendance-api.client.ts    # MODIFICAR - manejar expectedRound
├── camera-view.component.ts    # MODIFICAR - UI estados rounds

node-service/src/frontend/shared/
├── crypto/                     # NUEVO directorio
│   ├── aes-gcm.ts             # Encrypt/decrypt AES-256-GCM
│   └── mock-keys.ts           # MOCK_SESSION_KEY temporal
```

**Estimación:** 4-6 horas

---

### Fase 7: Persistencia PostgreSQL

**Objetivo:** Guardar validaciones y resultados en DB

**Implementar:**

1. `AttendanceRepository` (PostgreSQL)
2. `ResultRepository` (PostgreSQL)
3. Integración con services existentes
4. Migration para índices adicionales

**Estimación:** 6-8 horas

---

### Fase 8: QRs Falsos en Proyector

**Objetivo:** Mezclar QRs reales con señuelos

**Implementar:**

1. Generación de N QRs por ciclo
2. Solo 1 es del estudiante real
3. Los demás son señuelos indescifrabls
4. Rotación visual

**Estimación:** 4-6 horas

---

### Fase 9: Enrolamiento FIDO2 Real

**Objetivo:** Reemplazar stubs con WebAuthn real

**Dependencias:**

- @simplewebauthn/server
- WebSocket /enrollment/ws

**Estimación:** 8-12 horas

---

### Fase 10: Integración PHP

**Objetivo:** Login real desde PHP, JWT con userId real

**Implementar:**

1. PHP llama a Node para verificar enrollment
2. Node extrae userId de JWT
3. Eliminar mocks de userId

**Estimación:** 4-6 horas

---

## Referencias

- `flujo-validacion-qr-20251128.md` - Flujo completo documentado
- `PLAN-4-b-Modulo-Attendance-Backend.md` - Plan original backend
- `PLAN-4-d-Frontend-Aplicacion-Invitado.md` - Plan original frontend
- `database/migrations/001-initial-schema.sql` - Schema DB

---

**Última actualización:** 2025-11-28  
**Rama activa:** `fase-6-persistencia-asistencia`  
**Próximo paso:** Implementar Fase 6.1 (Frontend Crypto Integration)
