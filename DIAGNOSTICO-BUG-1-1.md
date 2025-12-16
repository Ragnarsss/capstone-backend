# Diagnóstico: Bug Crítico de Política 1:1 en QR-Reader

**Fecha:** 2025-12-16
**Severidad:** CRÍTICA
**Estado:** ✅ RESUELTO (specs corregidos, tareas agregadas al ROADMAP)

> **NOTA:** Este documento es un análisis histórico. Los problemas identificados fueron corregidos en:
> - `spec-architecture.md`: Agregada sección "Flujo de Revocación Automática", tabla de responsabilidades frontend
> - `spec-qr-validation.md`: Actualizada Fase 0 con deviceFingerprint
> - `ROADMAP.md`: Fase 21.1.3 (revocación automática backend), Fase 21.2 (qr-reader usa Access Gateway)

---

## Síntoma Reportado

Dos usuarios registran asistencia en el mismo dispositivo sin desenrolamiento. La política 1:1 (un usuario por dispositivo, un dispositivo por usuario) no se está aplicando.

---

## Análisis de Cadena

### Problema 1: qr-reader NO consulta Access Gateway

**Ubicación:** `node-service/src/frontend/features/qr-reader/main.ts` línea 170
**Función:** `checkEnrollmentStatus()`

```typescript
private async checkEnrollmentStatus(): Promise<void> {
  // ... verifica sessionKeyStore.hasSessionKey()
  if (hasSessionKey) {
    this.showReadyState();  // ← INCORRECTO: No verifica Access Gateway
  }
}
```

**Problema:**
- qr-reader revisa sessionStorage **localmente**
- NO consulta `/api/access/state` como requiere `spec-qr-validation.md` Fase 0
- NO valida que el `deviceFingerprint` actual sea el del dispositivo enrolado
- Cuando usuario B se loguea en el mismo dispositivo donde B ya está logueado:
  - sessionStorage contiene session_key de usuario A
  - Usuario B reutiliza esa sesión sin revalidación

**Requisito incumplido:**
```text
spec-qr-validation.md Fase 0:
"Antes de escanear QRs, verificar estado:
1. GET /api/access/state
2. Si state !== "READY": Redirigir a enrollment
3. Solo si state === "READY": Puede proceder"
```

**Impacto:**
- ✗ No detecta que el dispositivo ya está enrolado para otro usuario
- ✗ No obliga reenrolamiento
- ✗ Permite uso simultáneo multi-usuario

---

### Problema 2: EnrollmentFlowOrchestrator NO ejecuta desenrolamiento

**Ubicación:** `node-service/src/backend/enrollment/application/orchestrators/enrollment-flow.orchestrator.ts`
**Método:** `processEnrollmentConsent()` (línea 186)

```typescript
async processEnrollmentConsent(
  userId: number,
  consent: ConsentResponse
): Promise<ProcessConsentOutput> {
  // ... retorna qué dispositivos DEBERÍAN revocarse
  return {
    shouldProceed: true,
    devicesToRevoke: [...]  // ← Información, no ACCIÓN
  };
}
```

**Problema:**
- El método retorna **información** ("estos dispositivos deberían revocarse")
- **NO LLAMA** a `OneToOnePolicyService.revokeViolations()`
- Solo genera lista de deviceIds, no ejecuta la revocación en BD

**Código comentado:** `FinishEnrollmentUseCase` línea 37:
```typescript
/**
 * IMPORTANTE: El orchestrator DEBE llamar a 
 * OneToOnePolicyService.revokeViolations()
 * ANTES de llamar a este use case
 */
```

**Impacto:**
- ✗ La revocación nunca sucede (comentario dice que debería)
- ✗ Múltiples dispositivos de un usuario quedan en BD como "activos"
- ✗ Automata evalúa `activeDevices.length > 1` y retorna REQUIRES_REENROLLMENT, pero anterior device **no fue realmente desenrolado**

---

### Problema 3: Flujo de Enrollment NO persiste cambios

**Ubicación:** `node-service/src/frontend/features/qr-reader/main.ts` línea 200+
**Función:** `handleRegisterClick()`

```typescript
private async handleRegisterClick(): Promise<void> {
  // Inicia enrollment frontend
  // Pero NUNCA llama a backend para:
  // 1. POST /api/enrollment/start
  // 2. solicitar consentimiento para revocación
  // 3. POST /api/enrollment/finish
}
```

**Problema:**
- qr-reader abre enrollmentSection en frontend
- Pero NO dispara flujo de enrollment completo
- `EnrollmentService.startEnrollment()` nunca se llama

**Impacto:**
- ✗ `revokeViolations()` nunca se ejecuta (porque nadie llama a FinishEnrollmentUseCase)
- ✗ Nuevos dispositivos se guardan sin revocar antiguos
- ✗ BD queda corrupta: múltiples deviceId activos para mismo usuario

---

## Estado de la Base de Datos

### Scenario: Usuario A y Usuario B en mismo dispositivo

**Esperado (politica 1:1):**
```sql
-- Usuario A, dispositivo A (enrolado)
SELECT * FROM devices 
WHERE user_id = 100 AND is_active = true
-- Retorna: 1 fila (deviceId=1)

-- Usuario B, dispositivo B (después reenrolarse en dispositivo A)
SELECT * FROM devices 
WHERE user_id = 101 AND is_active = true
-- Retorna: 1 fila (deviceId=2)

-- Dispositivo A: Solo enlazado a usuario B
SELECT * FROM devices WHERE device_fingerprint = 'ABC123'
-- Retorna: 1 fila con user_id=101, deviceId=2
```

**Actual (problema):**
```sql
-- Usuario A
SELECT * FROM devices 
WHERE user_id = 100 AND is_active = true
-- Retorna: 1 fila (deviceId=1) ← Sigue activo

-- Usuario B  
SELECT * FROM devices 
WHERE user_id = 101 AND is_active = true
-- Retorna: 1 fila (deviceId=3) ← Nuevo dispositivo insertado

-- Mismo fingerprint para AMBOS usuarios
SELECT * FROM devices WHERE device_fingerprint = 'ABC123'
-- Retorna: 2 filas (deviceId=1, deviceId=3) ← VIOLACION 1:1
```

**Root Cause:** No se ejecutó `revokeViolations()` al reenrolarse usuario B.

---

## Cadena de Llamadas Requerida (Actual vs. Esperada)

### Actual (Roto):
```
Usuario B abre qr-reader
  ↓
qr-reader.checkEnrollmentStatus()
  ↓ (verifica sessionStorage, NO Access Gateway)
showReadyState() ← INCORRECTO sin validar deviceFingerprint
  ↓
Usuario B presiona "Registrar Asistencia"
  ↓
qr-reader.handleRegisterClick()
  ↓ (NO hace nada, solo abre modal visual)
Usuario B escanea QR
  ↓
POST /api/attendance/validate
  ↓
Pipeline de validación NO tiene etapa de verificación Access Gateway
  ↓
PERMITE REGISTRO ← BUG: Usuario A sigue siendo propietario del deviceId
```

### Esperado (Según specs):

```
Usuario B abre qr-reader
  ↓
qr-reader.checkEnrollmentStatus()
  ↓
GET /api/access/state (con deviceFingerprint)
  ↓
Access Gateway → EnrollmentFlowOrchestrator.attemptAccess()
  ↓
Detecta: deviceFingerprint NO coincide, deviceId=1 es de usuario A
  ↓
Retorna: { state: 'NOT_ENROLLED', action: 'enroll' }
  ↓
qr-reader.showEnrollmentSection()
  ↓
Usuario B presiona "Vincular Dispositivo"
  ↓
qr-reader.handleEnrollClick()
  ↓
POST /api/enrollment/start (crea challenge FIDO2)
  ↓
Usuario B: Huella biométrica
  ↓
POST /api/enrollment/finish
  ↓
Backend:
  1. FinishEnrollmentUseCase.execute()
  2. Verifica respuesta WebAuthn ✓
  3. Detecta: deviceFingerprint 'ABC123' ya existe para usuario A
  4. EnrollmentFlowOrchestrator.processEnrollmentConsent()
     → Retorna: "revoke deviceId=1"
  5. OneToOnePolicyService.revokeViolations(userId=101, 'ABC123')
     → EJECUTA: UPDATE devices SET is_active=false WHERE device_id=1
  6. Crea nuevo device para usuario B (deviceId=3)
  ↓
Ahora usuario B está en estado 'READY'
  ↓
Usuario B presiona "Registrar Asistencia"
  ↓
POST /api/attendance/validate ✓ Valida correctamente
```

---

## Resumen de Causas Raíz

| # | Componente | Causa | Efecto |
|---|-----------|-------|--------|
| 1 | qr-reader | No consulta `/api/access/state` | Permite entrar sin validación 1:1 |
| 2 | qr-reader | No dispara flujo de enrollment | revokeViolations nunca se ejecuta |
| 3 | EnrollmentFlowOrchestrator | processEnrollmentConsent solo retorna info | No persiste revocaciones en BD |
| 4 | Attendance Pipeline | No verifica Access Gateway | No bloquea registros inválidos |

---

## Solución Requerida

### Fase 21.2: Refactorizar qr-reader para usar Access Gateway

**Objetivo:** qr-reader consulta `/api/access/state` y obliga flujo correcto según respuesta.

**Cambios:**

1. **qr-reader.checkEnrollmentStatus():** 
   - ✓ Llamar a `AccessService.getState()`
   - ✓ Pasar `deviceFingerprint` en query params
   - ✓ Renderizar según respuesta.state

2. **qr-reader.handleEnrollClick():**
   - ✓ Llamar a `EnrollmentService.startEnrollment()`
   - ✓ Disparar flujo FIDO2 completo
   - ✓ Pasar `deviceFingerprint` a `/api/enrollment/finish`

3. **Attendance Pipeline:**
   - ✓ Considerar agregar validación de Access Gateway antes de procesar QR
   - O: Validar que `studentId` en QR coincida con usuario logueado + Access Gateway

---

---

## ✅ RESOLUCIÓN IMPLEMENTADA

### Specs Corregidos (2025-12-16)

**spec-architecture.md:**
- ✅ Agregada sección "Flujo de Revocación Automática (Política 1:1)"
- ✅ Documentado que `FinishEnrollmentController` DEBE ejecutar `revokeViolations()`
- ✅ Actualizado pseudocódigo de `Access Gateway.getState()` con parámetro `deviceFingerprint`
- ✅ Agregada tabla "Frontend: Responsabilidades por Feature" que documenta qr-reader DEBE verificar Access Gateway

**spec-qr-validation.md:**
- ✅ Actualizada Fase 0 para incluir `deviceFingerprint` en llamada a Access Gateway
- ✅ Clarificado paso de generación de deviceFingerprint antes de consultar estado

### Tareas Agregadas a ROADMAP

**Fase 21.1.3: Implementar revocación automática 1:1 en enrollment**
- Objetivo: `FinishEnrollmentController` ejecuta `OneToOnePolicyService.revokeViolations()` antes de persistir
- Soluciona: Problema #2 y #3 (EnrollmentFlowOrchestrator incompleto, flujo de enrollment no persiste cambios)
- Estado: PENDIENTE

**Fase 21.2: Refactorizar qr-reader para usar Access Gateway**
- Objetivo: qr-reader consulta `/api/access/state` SIEMPRE antes de permitir escaneo
- Soluciona: Problema #1 (qr-reader NO consulta Access Gateway)
- Estado: PENDIENTE
- Dependencia: Requiere 21.1.3 completada

### Criterios de Éxito

Al completar Fases 21.1.3 y 21.2:

1. ✅ Usuario B intenta usar qr-reader en dispositivo de Usuario A → **redirigido a enrollment**
2. ✅ Usuario B completa enrollment → **Usuario A desenrolado automáticamente**
3. ✅ Base de datos mantiene política 1:1: **un deviceFingerprint por usuario activo**
4. ✅ Access Gateway detecta violaciones 1:1 y retorna `REQUIRES_REENROLLMENT`

---

## Referencias

- `spec-qr-validation.md` Fase 0: Verificación de Estado (PRERREQUISITO) ✅ ACTUALIZADO
- `spec-architecture.md`: Access Gateway como gateway de lectura ✅ ACTUALIZADO
- `ROADMAP.md` Fase 21.1.3: Revocación automática backend
- `ROADMAP.md` Fase 21.2: qr-reader usa Access Gateway
- `FinishEnrollmentUseCase.ts` línea 37: Comentario sobre revokeViolations (a corregir en 21.1.3)
- `EnrollmentFlowOrchestrator.ts` línea 186: processEnrollmentConsent incompleto (a corregir en 21.1.3)

