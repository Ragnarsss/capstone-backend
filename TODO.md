# TODO - Sistema de Asistencia con QR Dinamico

> Ultima actualizacion: 2025-12-10

---

## Fases Completadas

### Fases 1-5: Fundamentos ✅
Estructura base, contenedores Podman, integracion PHP/Node.js, QR dinamicos AES-256-GCM, validacion basica.

### Fase 6: Arquitectura y Refactorizacion ✅
SessionService, Round-Aware System, Multi-Salon, Validation Pipeline (10 stages), 20 tests unitarios.

### Fase 7: Persistencia PostgreSQL ✅
SessionRepository, ValidationRepository, RegistrationRepository, ResultRepository, integracion con CompleteScanUseCase.

### Fase 8: QRs Falsos y Metricas de Fraude ✅
PoolBalancer con fakes, FraudMetricsRepository, dev endpoints, 15 tests de integracion.

### Fase 9: Enrollment FIDO2 + ECDH ✅
FIDO2Service, ECDHService, HkdfService, UseCases, Frontend UI, session_key, Frontend Guest (SoC), Politica 1:1 Enrollment.

### Fase 10: Refactoring Proyeccion QR (SoC) ✅
PayloadBuilder, PoolFeeder, PoolBalancer, QREmitter, QRProjectionService como orquestador, repos en shared/.

### Fase 11: Desacoplamiento SoC y Patrones de Dominio ✅
QRPayloadV1 en shared/types, validador centralizado, interfaces IQRGenerator/IPoolBalancer/IQRPayloadRepository, constantes centralizadas, entidad StudentSession, Pipeline Factory, eliminacion de codigo deprecado.

### Fase 13: Control de Logs por Entorno ✅
Logger centralizado (`shared/infrastructure/logger.ts`), logs debug/info solo en desarrollo, vite drop console en produccion, migracion de ~25 archivos backend a logger, test-fase13.sh.

### Fase 12: Simulador de Desarrollo PHP ✅
Dev Simulator completo (`php-service/src/dev-simulator/`), login mock, dashboards profesor/alumno, JWT real via `asistencia-node-integration`, postMessage para iframes, 106 tests. Accesible desde raiz (9500/9505) con `<base href>`.

### Fase 14: Integracion Session Key Real ✅
Legacy Bridge (postMessage PHP-Node), verificacion enrollment en qr-reader, eliminacion MOCK_SESSION_KEY en produccion (frontend), integracion SessionKeyRepository en PoolFeeder (generacion QR) y DecryptStage (validacion).

---

## Fases Pendientes

> **Arquitectura:** Vertical Slicing + Clean Architecture (Ports & Adapters)
> **Referencia:** `documents/01-contexto/flujo_legacy.md`, `roseta.md`

---

## Fase 14: Integracion Session Key Real

**Objetivo:** Conectar enrollment con attendance, eliminar MOCK_SESSION_KEY
**Estimado:** 5 horas

---

### Fase 14.1: Legacy Bridge en Frontend Node ✅
**Tiempo:** 1.5 horas

- [x] Crear `frontend/shared/services/legacy-bridge.service.ts`
- [x] Implementar listener `AUTH_TOKEN` → almacenar JWT via AuthClient
- [x] Implementar listener `SESSION_CONTEXT` → guardar en store
- [x] Crear `frontend/shared/stores/legacy-context.store.ts`
- [x] Integrar bridge en `qr-host/main.ts`
- [x] Integrar bridge en `qr-reader/main.ts`
- [x] Script: `test-fase14-1.sh`

### Fase 14.2: Verificacion Enrollment en qr-reader ✅
**Tiempo:** 1 hora

- [x] En `qr-reader/main.ts`, verificar enrollment antes de escaneo
- [x] Si no enrolado → mostrar UI de enrollment inline
- [x] Si enrolado pero sin session_key → trigger login ECDH
- [x] Obtener session_key de SessionKeyStore
- [x] Script: `test-fase14-2.sh`

### Fase 14.3: Eliminar MOCK_SESSION_KEY del Frontend
**Tiempo:** 45 min
**Estado:** EN PROGRESO

- [x] Modificar `aes-gcm.ts` para usar mock SOLO en desarrollo (import.meta.env.DEV)
- [x] Error claro si no hay session_key en produccion
- [x] Script: `test-fase14-3.sh`
- [x] Commit y merge

### Fase 14.4: Session Key Real en Backend (Generacion QR) ✅
**Tiempo:** 1.5 horas

- [x] Login ECDH debe almacenar session_key en Valkey: `session:{userId}:key`
- [x] PoolFeeder: obtener session_key del alumno desde Valkey al generar QR
- [x] Cifrar QR con session_key real del alumno (no MOCK)
- [x] Mantener fallback mock SOLO si no hay session_key (desarrollo)
- [x] Script: `test-fase14-4.sh`

### Fase 14.5: Session Key Real en Backend (Validacion) ✅
**Tiempo:** 1 hora

- [x] Modificar `decrypt.stage.ts` para obtener session_key de Valkey
- [x] Lookup: `session:{studentId}:key`
- [x] Mantener fallback mock SOLO si no hay session_key (desarrollo)
- [x] Overloads para retrocompatibilidad
- [x] Script: `test-fase14-5.sh`

---

## Fase 15: Puente PHP - Node (Produccion)

**Objetivo:** Comunicacion bidireccional para flujo completo
**Ubicacion:** `asistencia-node-integration/` (VA a produccion)
**Estimado:** 6 horas

---

### Fase 15.1: Endpoint Node para Notificar Asistencia
**Tiempo:** 1 hora

- [ ] Crear `backend/attendance/presentation/routes/internal.routes.ts`
- [ ] Implementar `POST /api/internal/mark-attendance`
- [ ] Schema: `{codigo, rut, ip, certainty, encuesta?}`
- [ ] Validar header `X-Node-Signature` con secret compartido
- [ ] Responder `{success, codigo, rut, timestamp}`
- [ ] Script: `test-fase15-1.sh`

### Fase 15.2: Controller PHP para Recibir Asistencia
**Tiempo:** 1.5 horas

- [ ] Crear `presentation/api/MarkAttendanceController.php`
- [ ] Agregar ruta `/api/mark-attendance` en Router.php
- [ ] Validar firma `X-Node-Signature`
- [ ] Preparar SQL template para `alumno_asistencia`
- [ ] Preparar SQL template para `comentarios_clase` segun tipo
- [ ] En dev-simulator: log + mock response
- [ ] Script: `test-fase15-2.sh`

### Fase 15.3: Encuesta Post-Validacion
**Tiempo:** 2 horas

- [ ] Recibir `tipo_encuesta` en SESSION_CONTEXT desde PHP
- [ ] Crear componente `SurveyForm.ts` con plantillas tipo 2-8
- [ ] Mostrar encuesta tras validacion exitosa de rounds
- [ ] Al enviar, incluir respuestas en mark-attendance
- [ ] Script: `test-fase15-3.sh`

### Fase 15.4: Notificacion al Parent (iframe)
**Tiempo:** 45 min

- [ ] Implementar `postMessage({type: 'ATTENDANCE_COMPLETE', ...})`
- [ ] Implementar `postMessage({type: 'CLOSE_IFRAME'})`
- [ ] En modales PHP, escuchar mensajes y cerrar
- [ ] Limpiar estado frontend tras completar
- [ ] Script: `test-fase15-4.sh`

### Fase 15.5: Limpieza y Documentacion
**Tiempo:** 30 min

- [ ] Eliminar `MOCK_SESSION_KEY` cuando no es stub mode
- [ ] Actualizar README de asistencia-node-integration
- [ ] Actualizar `13-estado-implementacion.md`
- [ ] Script: `test-fase15-5.sh` (integracion completa)

---

## Fase 16: Automata Enrollment FIDO2 (PRIORIDAD)

**Objetivo:** Formalizar flujo FIDO2 como automata explicito, centralizando estados y transiciones
**Ubicacion:** `backend/enrollment/domain/state-machines/`
**Estimado:** 8 horas
**Prioridad:** ALTA - Ejecutar ANTES de Fase 15

---

### Fase 16.1: Tipos de Estado
**Tiempo:** 30 min

- [ ] Crear `EnrollmentState = 'not_enrolled' | 'pending' | 'enrolled' | 'revoked'` en `domain/models.ts`
- [ ] Crear `SessionState = 'no_session' | 'session_active' | 'session_expired'` en `domain/models.ts`
- [ ] Script: `test-fase16-1.sh`

### Fase 16.2: Enrollment State Machine
**Tiempo:** 1.5 horas

- [ ] Crear `domain/state-machines/enrollment-state-machine.ts`
- [ ] Tabla de transiciones validas como `Map<EnrollmentState, EnrollmentState[]>`
- [ ] Metodo `canTransition(from, to): boolean`
- [ ] Metodo `getValidTransitions(from): EnrollmentState[]`
- [ ] Metodo `assertTransition(from, to): void` (throws si invalida)
- [ ] Script: `test-fase16-2.sh`

### Fase 16.3: Session State Machine
**Tiempo:** 1 hora

- [ ] Crear `domain/state-machines/session-state-machine.ts`
- [ ] Tabla de transiciones validas
- [ ] Precondicion: solo permite transiciones si `enrollmentState === 'enrolled'`
- [ ] Metodo `isEnabled(enrollmentState): boolean`
- [ ] Script: `test-fase16-3.sh`

### Fase 16.4: Migracion Base de Datos
**Tiempo:** 45 min

- [ ] Crear `database/migrations/003-add-enrollment-status.sql`
- [ ] Columna `status TEXT DEFAULT 'enrolled' CHECK (status IN ('pending', 'enrolled', 'revoked'))`
- [ ] Migrar datos: `is_active=false` → `status='revoked'`, `is_active=true` → `status='enrolled'`
- [ ] Actualizar `device.entity.ts` con campo `status: EnrollmentState`
- [ ] Actualizar `DeviceRepository` para leer/escribir `status`
- [ ] Script: `test-fase16-4.sh`

### Fase 16.5: Refactorizar Use Cases
**Tiempo:** 2 horas

- [ ] `StartEnrollmentUseCase`: validar `canTransition(current, 'pending')` antes de ejecutar
- [ ] `FinishEnrollmentUseCase`: validar transicion + actualizar `status` en DB
- [ ] `RevokeDeviceUseCase`: validar transicion + invalidar session_key en Valkey (eager)
- [ ] Script: `test-fase16-5.sh`

### Fase 16.6: Fix GetEnrollmentStatus + credentialId
**Tiempo:** 45 min

- [ ] Agregar `credentialId` a `DeviceInfo` interface (FIX BUG)
- [ ] Retornar `credentialId` en response de `/api/enrollment/status`
- [ ] Retornar estado del automata en response
- [ ] Script: `test-fase16-6.sh`

### Fase 16.7: Verificacion Dispositivo en LoginEcdh
**Tiempo:** 1 hora

- [ ] Validar `credentialId` del cliente vs DB
- [ ] Si `deviceFingerprint` cambio pero `credentialId` OK → actualizar fingerprint (probable update OS)
- [ ] Si `credentialId` no coincide → ofrecer re-enrollment con penalty
- [ ] Script: `test-fase16-7.sh`

### Fase 16.8: Tests y Documentacion
**Tiempo:** 30 min

- [ ] Script `test-fase16.sh` (integracion completa)
- [ ] Actualizar `documents/02-modulos/enrollment.md` con diagramas de automata
- [ ] Commit y merge

---

## Diagrama de Dependencias

```
Fase 14 (Session Key Real) ✅
    │
    ├──────────────────────────────┐
    ▼                              ▼
Fase 16 (Automata Enrollment)    Fase 15 (Puente Produccion)
[PRIORIDAD - hacer primero]            │
    │                                  │
    16.1 ─► 16.2 ─► 16.3              │
                      │                │
                    16.4               │
                      │                │
              16.5 ─► 16.6 ─► 16.7    │
                             │        │
                           16.8       │
                             │        │
                             ▼        ▼
                    [Enrollment robusto antes de produccion]
                             │
                             ▼
                    15.1 ─► 15.2 ─► 15.3 ─► 15.4 ─► 15.5
```

---

## Resumen de Tiempos

| Fase | Descripcion | Sub-fases | Tiempo |
|------|-------------|-----------|--------|
| 14 | Session Key Real | 5 | ~5 h ✅ |
| **16** | **Automata Enrollment** | **8** | **~8 h** |
| 15 | Puente Produccion | 5 | ~6 h |
| **Total Pendiente** | | **13** | **~14 h** |

---

## Comandos de Desarrollo

```bash
# Verificar TypeScript
podman compose -f compose.yaml -f compose.dev.yaml exec node-service npx tsc --noEmit

# Ejecutar script de fase
bash scripts/test-faseN.sh

# Reconstruir contenedores
podman compose -f compose.yaml -f compose.dev.yaml up --build
```

---

## Referencias

- `daRulez.md` - Reglas del proyecto
- `PROJECT-CONSTITUTION.md` - Principios arquitectonicos
- `documents/01-contexto/flujo_legacy.md` - Flujo sistema Hawaii
- `roseta.md` - Roseta de integracion PHP-Node
- `documents/03-especificaciones-tecnicas/13-estado-implementacion.md` - Estado detallado
