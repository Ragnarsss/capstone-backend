# TODO - Sistema de Asistencia con QR Dinamico

> Ultima actualizacion: 2025-12-11

---

## Fases Completadas

### Fases 1-5: Fundamentos

Estructura base, contenedores Podman, integracion PHP/Node.js, QR dinamicos AES-256-GCM, validacion basica.

### Fase 6: Arquitectura y Refactorizacion

SessionService, Round-Aware System, Multi-Salon, Validation Pipeline (10 stages), 20 tests unitarios.

### Fase 7: Persistencia PostgreSQL

SessionRepository, ValidationRepository, RegistrationRepository, ResultRepository, integracion con CompleteScanUseCase.

### Fase 8: QRs Falsos y Metricas de Fraude

PoolBalancer con fakes, FraudMetricsRepository, dev endpoints, 15 tests de integracion.

### Fase 9: Enrollment FIDO2 + ECDH

FIDO2Service, ECDHService, HkdfService, UseCases, Frontend UI, session_key, Frontend Guest (SoC), Politica 1:1 Enrollment.

### Fase 10: Refactoring Proyeccion QR (SoC)

PayloadBuilder, PoolFeeder, PoolBalancer, QREmitter, QRProjectionService como orquestador, repos en shared/.

### Fase 11: Desacoplamiento SoC y Patrones de Dominio

QRPayloadV1 en shared/types, validador centralizado, interfaces IQRGenerator/IPoolBalancer/IQRPayloadRepository, constantes centralizadas, entidad StudentSession, Pipeline Factory, eliminacion de codigo deprecado.

### Fase 12: Simulador de Desarrollo PHP

Dev Simulator completo (`php-service/src/dev-simulator/`), login mock, dashboards profesor/alumno, JWT real via `asistencia-node-integration`, postMessage para iframes, 106 tests.

### Fase 13: Control de Logs por Entorno

Logger centralizado (`shared/infrastructure/logger.ts`), logs debug/info solo en desarrollo, vite drop console en produccion, migracion de ~25 archivos backend a logger.

### Fase 14: Integracion Session Key Real

Legacy Bridge (postMessage PHP-Node), verificacion enrollment en qr-reader, eliminacion MOCK_SESSION_KEY en produccion (frontend), integracion SessionKeyRepository en PoolFeeder (generacion QR) y DecryptStage (validacion).

### Fase 16: Automata Enrollment FIDO2

EnrollmentStateMachine, SessionStateMachine, migracion DB `status` column, refactorizacion use cases con validacion de transiciones, verificacion deviceFingerprint en login ECDH con auto-update.

---

## EN PROGRESO

### Fase 17: Refactorizacion SoC Enrollment

**Objetivo:** Aplicar SoC estricta al modulo enrollment segun `flujo-automata-enrolamiento.md`
**Rama base:** `fase-17-soc-enrollment`

**Principios:**

- State Machines: Solo transiciones, sin logica de negocio
- Use Cases: Delgados, una responsabilidad
- Services: Logica de dominio aislada
- Orchestrator: Coordina el flujo completo

---

#### 17.1: Configurar Vitest

**Rama:** `fase-17.1-vitest-setup`
**Estado:** COMPLETADO

- [x] Instalar vitest como devDependency
- [x] Integrar config test en vite.config.ts (no archivo separado)
- [x] Migrar tests existentes de `node:test` a vitest
- [x] Agregar script `npm run test` y `npm run test:watch`
- [x] Verificar tests pasan: 92 tests (20 stages + 37 enrollment + 35 session)

---

#### 17.2: Renombrar EnrollmentStateMachine a DeviceStateMachine

**Rama:** `fase-17.2-device-state-machine`
**Estado:** COMPLETADO

- [x] Renombrar archivo: `enrollment-state-machine.ts` -> `device-state-machine.ts`
- [x] Renombrar clase: `EnrollmentStateMachine` -> `DeviceStateMachine`
- [x] Actualizar imports en todos los archivos que usen la clase
- [x] Actualizar tests: `enrollment-state-machine.test.ts` -> `device-state-machine.test.ts`
- [x] Verificar tests pasan: 92 tests OK

**Justificacion:** El nombre `DeviceStateMachine` refleja mejor que maneja estados del dispositivo FIDO2, no del proceso de enrollment.

---

#### 17.3: Eliminar canStartSession de DeviceStateMachine

**Rama:** `fase-17.3-remove-can-start-session`
**Estado:** COMPLETADO

- [x] Eliminar metodo `canStartSession()` de `DeviceStateMachine`
- [x] Eliminar tests de `canStartSession` en `device-state-machine.test.ts`
- [x] En `LoginEcdhUseCase`: usar `SessionStateMachine.isEnabled(device.status)` en lugar de `DeviceStateMachine.canStartSession()`
- [x] Verificar tests pasan

**Justificacion:** `canStartSession` viola SoC - DeviceStateMachine no debe saber sobre sesiones. SessionStateMachine ya tiene `isEnabled()`.

---

#### 17.4: Crear OneToOnePolicyService

**Rama:** `fase-17.4-one-to-one-policy`
**Estado:** COMPLETADO

- [x] Crear `domain/services/one-to-one-policy.service.ts`
- [x] Extraer logica de politica 1:1 de `FinishEnrollmentUseCase` (lineas 120-158)
- [x] Metodos: `validate(userId, credentialId)`, `revokeViolations(userId, newCredentialId)`, `isDuplicateEnrollment()`
- [x] Crear `__tests__/one-to-one-policy.service.test.ts` con mocks (24 tests)
- [x] Interface `IDeviceRepositoryForPolicy` para inyeccion de dependencias

**Interfaz implementada:**

```typescript
interface PolicyValidationResult {
  compliant: boolean;
  violations?: {
    deviceConflict?: { userId: number; credentialId: string };
    userConflict?: { deviceIds: number[] };
  };
}

interface RevokeResult {
  previousUserUnlinked?: { userId: number; reason: string };
  ownDevicesRevoked: number;
}
```

---

#### 17.5: Crear EnrollmentFlowOrchestrator

**Rama:** `fase-17.5-enrollment-orchestrator`
**Estado:** COMPLETADO

- [x] Crear `application/orchestrators/enrollment-flow.orchestrator.ts`
- [x] Implementar flujo de `flujo-automata-enrolamiento.md`:
  - `attemptAccess(userId, deviceFingerprint)` -> CheckEnrolado + EvaluarUnoAUno
  - `processEnrollmentConsent(userId, consent)` -> ProcesoEnrolamiento
- [x] Interfaces: `IDeviceRepositoryForOrchestrator`, `IPolicyServiceForOrchestrator`
- [x] Crear `__tests__/enrollment-flow.orchestrator.test.ts` (18 tests)
- [x] Enums: `AccessResult`, `ConsentResponse`

**Flujo implementado:**

```
attemptAccess():
  1. checkEnrollmentStatus() -> CheckEnrolado
  2. if enrolled: evaluateOneToOne() -> EvaluarUnoAUno
  3. if cumple 1:1: return ACCESS_GRANTED
  4. else: return REQUIRES_ENROLLMENT | REQUIRES_REENROLLMENT
```

---

#### 17.6: Refactorizar StartEnrollmentUseCase

**Rama:** `fase-17.6-slim-start-enrollment`

- [ ] Eliminar inferencia de estado (usar DeviceStateMachine.inferState externamente)
- [ ] Eliminar verificacion de penalizacion (mover a orchestrator)
- [ ] Mantener SOLO: generar challenge FIDO2 + guardar en Valkey
- [ ] Actualizar tests
- [ ] Verificar tests pasan

**Responsabilidad final:** Solo genera opciones WebAuthn y guarda challenge.

---

#### 17.7: Refactorizar FinishEnrollmentUseCase

**Rama:** `fase-17.7-slim-finish-enrollment`

- [ ] Eliminar logica de politica 1:1 (ya esta en OneToOnePolicyService)
- [ ] Eliminar registro de penalizacion (mover a orchestrator)
- [ ] Mantener SOLO: verificar WebAuthn + derivar HKDF + guardar dispositivo
- [ ] Actualizar tests
- [ ] Verificar tests pasan

**Responsabilidad final:** Solo verifica credential y persiste dispositivo.

---

#### 17.8: Refactorizar LoginEcdhUseCase

**Rama:** `fase-17.8-slim-login-ecdh`

- [ ] Eliminar verificacion de fingerprint (mover a orchestrator o crear FingerprintService)
- [ ] Usar `SessionStateMachine.isEnabled()` para verificar estado
- [ ] Mantener SOLO: ECDH + derivar session_key + generar TOTP + guardar
- [ ] Actualizar tests
- [ ] Verificar tests pasan

**Responsabilidad final:** Solo realiza key exchange y crea session.

---

#### 17.9: Crear RestrictionService (Stub)

**Rama:** `fase-17.9-restriction-service`

- [ ] Crear `domain/services/restriction.service.ts` (stub)
- [ ] Interfaz: `checkRestrictions(userId): Promise<RestrictionResult>`
- [ ] Stub retorna `{ blocked: false }` siempre
- [ ] Documentar que sera implementado por servicio externo (PHP)
- [ ] Integrar en EnrollmentFlowOrchestrator
- [ ] Crear test basico

**Proposito:** Preparar integracion con modulo de restricciones temporales (horarios, suspensiones).

---

#### 17.10: Documentacion y Cleanup

**Rama:** `fase-17.10-docs-cleanup`

- [ ] Actualizar `flujo-automata-enrolamiento.md` con arquitectura final
- [ ] Actualizar `13-estado-implementacion.md`
- [ ] Eliminar codigo muerto
- [ ] Verificar todos los tests pasan
- [ ] Merge a main

---

## Pendiente

### Correcciones Finales (Hardening)

Mejoras no criticas identificadas en revision de seguridad.

#### Prioridad Alta

- [ ] **TOTPu no validado** - Agregar stage en `validation-pipeline/stages/` que valide TOTPu en payload de respuesta

#### Prioridad Media

- [ ] **Attestation sin validacion AAGUID** - En `fido2.service.ts`: validar AAGUIDs contra lista de authenticators confiables, o cambiar a `attestationType: 'none'`
- [ ] **Session key sin binding** - En `hkdf.service.ts`: incluir `credentialId` en derivacion de session_key

#### Prioridad Baja (Opcional)

- [ ] **TOTP usa SHA256** - RFC 4226 usa SHA1. No es problema de seguridad pero impide interoperabilidad con apps TOTP estandar

---

### Fase 15: Puente PHP - Node (Produccion)

**Objetivo:** Comunicacion bidireccional para flujo completo
**Ubicacion:** `asistencia-node-integration/` (VA a produccion)
**Dependencia:** Completar Fase 17 primero

#### 15.1: Endpoint Node para Notificar Asistencia

- [ ] Crear `backend/attendance/presentation/routes/internal.routes.ts`
- [ ] Implementar `POST /api/internal/mark-attendance`
- [ ] Schema: `{codigo, rut, ip, certainty, encuesta?}`
- [ ] Validar header `X-Node-Signature` con secret compartido

#### 15.2: Controller PHP para Recibir Asistencia

- [ ] Crear `presentation/api/MarkAttendanceController.php`
- [ ] Agregar ruta `/api/mark-attendance` en Router.php
- [ ] Validar firma `X-Node-Signature`

#### 15.3: Encuesta Post-Validacion

- [ ] Recibir `tipo_encuesta` en SESSION_CONTEXT desde PHP
- [ ] Crear componente `SurveyForm.ts`
- [ ] Mostrar encuesta tras validacion exitosa

#### 15.4: Notificacion al Parent (iframe)

- [ ] Implementar `postMessage({type: 'ATTENDANCE_COMPLETE', ...})`
- [ ] Implementar `postMessage({type: 'CLOSE_IFRAME'})`

#### 15.5: Limpieza y Documentacion

- [ ] Actualizar README de asistencia-node-integration
- [ ] Actualizar `13-estado-implementacion.md`

---

## Diagrama de Dependencias

```
Fase 16 [COMPLETADA]
    |
    v
Fase 17: Refactorizacion SoC Enrollment [EN PROGRESO]
    |
    17.1 Vitest
    |
    17.2 DeviceStateMachine (rename)
    |
    17.3 Eliminar canStartSession
    |
    17.4 OneToOnePolicyService
    |
    17.5 EnrollmentFlowOrchestrator
    |
    17.6 Slim StartEnrollmentUseCase
    |
    17.7 Slim FinishEnrollmentUseCase
    |
    17.8 Slim LoginEcdhUseCase
    |
    17.9 RestrictionService (stub)
    |
    17.10 Docs + Cleanup
    |
    v
Correcciones Finales (Hardening)
    |
    v
Fase 15: Puente PHP-Node (Produccion)
```

---

## Referencias

- `daRulez.md` - Reglas del proyecto
- `PROJECT-CONSTITUTION.md` - Principios arquitectonicos
- `flujo-automata-enrolamiento.md` - Flujo de enrollment (fuente de verdad)
- `documents/03-especificaciones-tecnicas/13-estado-implementacion.md` - Estado detallado
- `documents/03-especificaciones-tecnicas/14-decision-totp-session-key.md` - Decision TOTPu
