# ROADMAP - Fuente de Verdad del Proyecto

> Ultima actualizacion: 2025-12-19
> Base: main consolidado desde fase-22.10.3
> Build: OK | Tests: 262/262 pasando

---

## Resumen de Estado

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 1-18 | Fundamentos, FIDO2, QR, Pipeline, SoC, Access Gateway | COMPLETADA |
| 19-20 | Separacion Dominios y Limpieza Legacy | COMPLETADA |
| 21.1-21.3 | Unificar Frontend, Access Gateway, Eliminar guest/ | COMPLETADA |
| 22.1 | Validacion TOTP | COMPLETADA |
| 22.4 | Extraer Persistencia | COMPLETADA |
| 22.6-22.9 | Inyeccion SessionKeyQuery, QR Ports, Participation, /dev/ | COMPLETADA |
| 22.10-22.10.3 | Mover WebSocketAuth, JWT, Emojis, Zod | COMPLETADA |
| 22.10.4-22.10.10 | Correcciones Auditoria daRulez (secretos, access, traducciones, logger) | COMPLETADA |
| ~~22.10.9~~ | ~~Traducir tests (AAA ya es estándar)~~ | **OMITIDA** |
| **22.2** | **Session Key Binding (CRITICO)** | **COMPLETADA** |
| **22.3** | **Validar AAGUID (CRITICO)** | **COMPLETADA** |
| **22.3.3** | **Test HKDF Compatibility (CRITICO)** | **COMPLETADA** |
| **22.3.1** | **Test Login ECDH Use Case (CRITICO)** | **COMPLETADA** |
| **22.3.2** | **Test QR Generator (MAYOR)** | **COMPLETADA** |
| **22.3.4** | **Test Decrypt Stage (MAYOR)** | **COMPLETADA** |
| **22.5** | **Stats + QR Lifecycle** | **COMPLETADA** |
| ~~22.11-22.12~~ | ~~Deuda Tecnica Opcional~~ | **OMITIDAS** |
| **26.1** | **TOTP Dual Key - evitar exportKey (CRITICO)** | **PENDIENTE** |
| **26.2** | **Eliminar doble escritura session_key** | **PENDIENTE** |
| **26.3** | **Unificar instancias SessionKeyStore** | **PENDIENTE** |
| **26.4** | **Inyectar StudentEncryptionService (CRITICO)** | **PENDIENTE** |
| **26.5** | **Extraer Composition Root** | **PENDIENTE** |
| **26.6** | **Centralizar configuracion** | **PENDIENTE** |
| **23** | **Integracion PHP (Restriction + Puente)** | **PENDIENTE** |
| 24 | Infraestructura y Operaciones | PENDIENTE |
| 25 | Testing E2E y Calidad | PENDIENTE |

---

## Politica de Seleccion de Modelo IA

| Modelo | Usar cuando |
|--------|-------------|
| Sonnet | Tareas bien especificadas, patrones existentes, refactoring mecanico |
| Opus | Decisiones arquitectonicas, ambiguedad, razonamiento complejo, seguridad, criptografia |

---

## Orden de Ejecucion

```mermaid
flowchart TB
    subgraph BLOQUE_A[A: Correcciones daRulez]
        direction LR
        A1[22.10.4<br/>Secretos]
        A2[22.10.5<br/>Microserv]
        A3[22.10.6<br/>Access]
        A4[22.10.7-8<br/>Traducciones]
        A5[22.10.10<br/>Logger]
        A1 --> A2 --> A3 --> A4 --> A5
    end

    subgraph BLOQUE_B[B: Seguridad Critica]
        direction LR
        B1[22.2<br/>Key Binding]
        B2[22.3<br/>AAGUID]
        B1 --> B2
    end

    subgraph BLOQUE_B2[B2: Testing Critico Pre-Manual]
        direction LR
        T1[22.3.3<br/>HKDF Compat]:::done
        T2[22.3.1<br/>Login ECDH]:::done
        T3[22.3.2<br/>QR Generator]:::done
        T4[22.3.4<br/>Decrypt Stage]:::done
        T1 --> T2 --> T3 --> T4
    end

    subgraph BLOQUE_C[C: Arquitectura]
        direction LR
        C1[22.5<br/>Stats+Lifecycle]
    end

    subgraph BLOQUE_D[D: Deuda Tecnica]
        direction LR
        D1[22.11-12<br/>OMITIDAS]
    end

    subgraph BLOQUE_F[F: Correccion Flujo QR]
        direction TB
        F1[26.1<br/>TOTP Dual Key]:::critical
        F2[26.2<br/>Eliminar Doble Escritura]
        F3[26.3<br/>Singleton Store]
        F4[26.4<br/>Inyectar Encryption]:::critical
        F5[26.5<br/>Composition Root]
        F6[26.6<br/>Centralizar Config]
        F1 --> F2 --> F3
        F1 --> F4 --> F5 --> F6
    end

    subgraph BLOQUE_E[E: Integracion PHP]
        direction LR
        E1[23.1<br/>Restriction]
        E2[23.2<br/>Puente HTTP]
        E1 --> E2
    end

    BLOQUE_A --> BLOQUE_B
    BLOQUE_B --> BLOQUE_B2
    BLOQUE_B2 --> BLOQUE_C
    BLOQUE_C --> BLOQUE_D
    BLOQUE_D --> BLOQUE_F
    BLOQUE_F --> BLOQUE_E

    style A1 fill:#90EE90
    style A2 fill:#90EE90
    style A3 fill:#90EE90
    style A4 fill:#90EE90
    style A5 fill:#90EE90
    style B1 fill:#90EE90
    style B2 fill:#90EE90
    style T1 fill:#90EE90
    style T2 fill:#90EE90
    style T3 fill:#90EE90
    style T4 fill:#90EE90
    style C1 fill:#90EE90
    style D1 fill:#90EE90
    style F1 fill:#ff6b6b
    style F2 fill:#ffa94d
    style F3 fill:#ffa94d
    style F4 fill:#ff6b6b
    style F5 fill:#ffa94d
    style F6 fill:#69db7c
    style E1 fill:#99ccff
    style E2 fill:#99ccff

    classDef critical fill:#ff6b6b
```

**Leyenda:** Rojo oscuro = CRITICO, Naranja = MAYOR, Verde claro = MENOR, Verde = Completada, Azul = Integracion

---

## Arquitectura Objetivo

Segun `spec-architecture.md` y `Caracterizacion del Ecosistema`:

```
backend/
├── access/          # Gateway lectura (4 capas: domain, application, infrastructure, presentation)
├── attendance/      # Validacion QR (Pipeline 12 stages, Stats, Fraud Metrics)
├── auth/            # JWT validation (solo valida, nunca emite)
├── enrollment/      # FIDO2 devices (Orchestrator, Policy 1:1)
├── session/         # ECDH login (session_key con credentialId binding)
├── restriction/     # Integracion PHP (stub → real)
└── shared/ports/    # Interfaces cross-domain
```

---

## BLOQUE A: Correcciones Auditoria daRulez

### Fase 22.10.4: Centralizar secretos en .env y validar en runtime

**Rama:** `fase-22.10.4-centralize-secrets`
**Modelo:** Sonnet
**Severidad:** MAYOR (viola daRulez 6.6)
**Referencia:** daRulez.md seccion 6.6 - "Los secretos nunca se documentan con valores reales"
**Estado:** COMPLETADA (2025-12-18)
**Commit:** e3172f9

**Situación actual:**

1. `.env.example` existe pero le falta `SERVER_MASTER_SECRET`
2. `compose.yaml` tiene valores hardcodeados en lugar de usar `${VAR}` de `.env`
3. `config/index.ts` tiene defaults inseguros que permiten iniciar sin `.env`

**Archivos a modificar:**

- `.env.example` - Agregar variable faltante
- `.env` - Mantener sincronizado con `.env.example`
- `compose.yaml` - Usar variables de entorno sin defaults
- `node-service/src/shared/config/index.ts` - Validar variables críticas

**Tareas:**

- [x] Agregar `SERVER_MASTER_SECRET` a `.env.example` con documentación
- [x] Actualizar `compose.yaml`: agregar `env_file: .env` y usar `${VAR}` sin defaults
- [x] Modificar `config/index.ts`: eliminar defaults y agregar `validateRequiredEnvVars()`
- [x] Verificar build y tests: 155/155 pasando
- [x] Commit atómico: e3172f9

**Criterio de exito:** CUMPLIDO
- Aplicación falla al iniciar sin `.env` con mensaje claro
- `.env.example` contiene TODAS las variables con valores de referencia
- `compose.yaml` usa `env_file` y no tiene secrets hardcodeados

---

### Fase 22.10.5: Eliminar mencion de microservicios

**Rama:** `fase-22.10.5-remove-microservices-mention`
**Modelo:** Sonnet
**Severidad:** MAYOR (viola daRulez 2.1)
**Referencia:** daRulez.md seccion 2.1 - "Microservicios estan prohibidos"
**Estado:** COMPLETADA (2025-12-18)
**Commit:** f36ed52

**Archivo:** `node-service/src/shared/ports/index.ts`

**Tareas:**

- [x] Modificar comentario L11: eliminar "Preparacion para microservicios"
- [x] Reemplazar por beneficios reales: desacoplamiento, testing, cambio de implementaciones
- [x] Verificar: `grep -r "microservicio" node-service/` → 0 resultados
- [x] Build y tests: 155/155 [OK]
- [x] Commit atómico: f36ed52

**Criterio de exito:** CUMPLIDO - Cero menciones de microservicios en codigo.

---

### Fase 22.10.6: Completar segmentacion vertical modulo access

**Rama:** `fase-22.10.6-access-vertical-slicing`
**Modelo:** Opus
**Severidad:** MAYOR (viola daRulez 2.2)
**Referencia:** daRulez.md seccion 2.2 - "Cada modulo contiene: dominio, aplicacion, infraestructura, presentacion"
**Estado:** COMPLETADA (2025-12-18)
**Commit:** d7b863b

**Directorio:** `node-service/src/backend/access/`

**Estructura final:**

```
access/
├── domain/                  # [OK] CREADO
│   ├── models.ts            # AccessState, AccessStateType, AccessAction, AccessDeviceInfo
│   └── index.ts
├── application/services/    # [OK] Actualizado imports
├── infrastructure/          # [OK] CREADO (reservado)
│   └── index.ts
├── presentation/            # Existente
└── __tests__/               # Existente
```

**Tareas:**

- [x] Crear `access/domain/models.ts` con tipos inmutables
- [x] Crear `access/domain/index.ts` con exports
- [x] Crear `access/infrastructure/index.ts` (reservado para futuros adaptadores)
- [x] Mover `AccessState` de application/ a domain/
- [x] Actualizar imports en access-gateway.service.ts
- [x] Re-exportar tipos en application/services/index.ts para compatibilidad
- [x] Build y tests: 155/155 [OK]
- [x] Commit atómico: d7b863b

**Criterio de exito:** CUMPLIDO - Modulo access tiene las 4 capas.

---

### Fases 22.10.7 + 22.10.8: Traducir comentarios (restriction + enrollment)

**Rama:** `fase-22.10.7-8-translate-comments`
**Modelo:** Sonnet
**Severidad:** MENOR (viola daRulez 7.4.1)
**Referencia:** daRulez.md seccion 7.4.1 - "Comentarios solo en espanol"
**Estado:** COMPLETADA (2025-12-18)
**Commit:** c0260dc

**Archivos modificados:**

- `restriction/application/services/restriction.service.ts`
- `enrollment/domain/services/one-to-one-policy.service.ts`
- `enrollment/application/orchestrators/enrollment-flow.orchestrator.ts`

**Tareas:**

- [x] restriction.service.ts: traducir JSDoc completo y comentarios inline
- [x] one-to-one-policy.service.ts: traducir metodos validate() y revokeViolations()
- [x] enrollment-flow.orchestrator.ts: traducir metodo attemptAccess() y flujo
- [x] Build y tests: 155/155 pasando
- [x] Commit atomico agrupado: c0260dc

**Criterio de exito:** CUMPLIDO - Comentarios de logica de negocio en espanol

---

### Fase 22.10.9: Traducir comentarios - access tests

**Rama:** `fase-22.10.9-translate-access-tests`
**Modelo:** Sonnet
**Severidad:** MENOR (viola daRulez 7.4.1)
**Estado:** ~~PENDIENTE~~ → **OMITIDA**

**Justificación de omisión:** Los comentarios `// Arrange`, `// Act`, `// Assert`, `// Verify` son convención estándar de testing (patrón AAA) y no requieren traducción. No hay comentarios de lógica de negocio en inglés.

---

### Fase 22.10.10: Reemplazar console.log por logger

**Rama:** `fase-22.10.10-use-structured-logger`
**Modelo:** Sonnet
**Severidad:** MENOR
**Estado:** COMPLETADA (2025-12-18)
**Commit:** 831c58d

**Archivo:** `node-service/src/backend/enrollment/presentation/routes.ts`

**Tareas:**

- [x] Importar logger desde `shared/infrastructure/logger`
- [x] L118-L130: Reemplazar console.log por logger.info/logger.warn/logger.error
- [x] Formato estructurado: `logger.info({ userId, userAgent }, 'Client logs received')`
- [x] Usar switch para mapear niveles: error → logger.error, warn → logger.warn, default → logger.info
- [x] Build y tests: 155/155 pasando
- [x] Commit atómico: 831c58d

**Criterio de exito:** CUMPLIDO - No hay console.log en endpoint client-log, logging estructurado implementado

---

## BLOQUE B: Seguridad Critica

### Fase 22.2: Session Key Binding con credentialId

**Objetivo:** Vincular la session_key al dispositivo físico incluyendo credentialId en la derivación HKDF, previniendo replay attacks con shared_secret robado.

**Rama:** `fase-22.2-session-binding`
**Modelo:** Opus
**Severidad:** CRITICA
**Estado:** COMPLETADA (2025-12-18)
**Commit:** 5c2c473

**Criterio de éxito verificable:**

- [x] `grep -n "credentialId" node-service/src/backend/session/` encuentra derivación HKDF
- [x] Test: mismo sharedSecret + diferente credentialId → session_keys diferentes
- [x] Test: mismo sharedSecret + mismo credentialId → session_key idéntica
- [x] Frontend y backend derivan session_key con mismo algoritmo
- [x] Build y tests: 161/161 pasando (6 nuevos)

**Restricciones arquitectónicas:**

- Info string HKDF debe incluir versión: `'attendance-session-key-v1:' + credentialId`
- credentialId viene del enrollment, no se genera nuevo
- Sesiones existentes deben invalidarse (re-login requerido)

**Entregables mínimos:**

- Derivación HKDF modificada para incluir credentialId en backend
- Derivación HKDF equivalente en frontend
- Tests que verifiquen binding correcto

**Referencias:** `14-decision-totp-session-key.md`, `Caracterizacion.md` sección 5

---

### Fase 22.3: Validar AAGUID de dispositivo

**Objetivo:** Rechazar enrollment de dispositivos FIDO2 no autorizados validando AAGUID contra whitelist configurable.

**Rama:** `fase-22.3-aaguid-validation`
**Modelo:** Opus
**Severidad:** CRITICA
**Estado:** COMPLETADA (2025-12-18)
**Commit:** 0844ede, 1296c0a (expansión whitelist + modo permisivo)

**Criterio de éxito verificable:**

- [x] Enrollment con AAGUID no listado retorna HTTP 403
- [x] Enrollment con AAGUID válido procede normalmente
- [x] Variable de entorno `AAGUID_VALIDATION_ENABLED` permite desactivar (dev)
- [x] Logs muestran AAGUID rechazado/aceptado
- [x] Build y tests: 178/178 pasando

**Restricciones arquitectónicas:**

- [x] Whitelist debe ser configurable (no hardcodeada en código) - via config + env vars
- [x] Validación debe ocurrir ANTES de persistir dispositivo - paso 4 del flujo
- [x] Default: habilitado en producción, deshabilitado en desarrollo - AAGUID_VALIDATION_ENABLED

**Entregables mínimos:**

- [x] Whitelist de AAGUIDs autorizados (~20: Windows Hello, Google, Apple, Samsung, Huawei, 1Password, Bitwarden, etc.)
- [x] Validación integrada en flujo de finish-enrollment (paso 4)
- [x] Tests de aceptación y rechazo (17 tests)
- [x] Modo permisivo `AAGUID_ALLOW_UNKNOWN` para fase de transición
- [x] Documentación: cómo agregar nuevos AAGUIDs (en aaguid-validation.service.ts)

**Archivos creados/modificados:**

- `node-service/src/backend/enrollment/domain/services/aaguid-validation.service.ts` (NUEVO)
- `node-service/src/backend/enrollment/domain/services/index.ts` (export)
- `node-service/src/backend/enrollment/application/use-cases/finish-enrollment.use-case.ts` (integración)
- `node-service/src/backend/enrollment/presentation/controllers/finish-enrollment.controller.ts` (HTTP 403)
- `node-service/src/backend/enrollment/presentation/routes.ts` (instanciación)
- `node-service/src/shared/config/index.ts` (config.aaguid)
- `.env.example` (AAGUID_VALIDATION_ENABLED, AAGUID_ALLOW_NULL)
- `domain/services/__tests__/aaguid-validation.service.test.ts` (14 tests)

**Referencias:** `Caracterizacion.md` sección 4, FIDO2 spec para AAGUIDs conocidos

---

## BLOQUE B2: Testing Critico Pre-Manual

> Prerequisito para pruebas manuales con FIDO2. Verifica que los componentes criticos del flujo funcionan antes de testing manual.

### Fase 22.3.1: Test unitario Login ECDH Use Case

**Rama:** `fase-22.3.1-test-login-ecdh`
**Modelo:** Sonnet
**Severidad:** CRITICA
**Referencia:** daRulez 7.1.1 - "Cada unidad tiene una unica razon para cambiar" (SoC)
**Estado:** COMPLETADA (2025-12-18)
**Commit:** 65f0168

**Situacion resuelta:**

El LoginEcdhUseCase ahora tiene cobertura completa de tests unitarios que verifican derivacion HKDF, almacenamiento en Valkey, manejo de errores y vinculacion 1:1.

**Archivos creados:**

- `node-service/src/backend/session/application/use-cases/__tests__/login-ecdh.use-case.test.ts` (15 tests)

**Tareas:**

- [x] Crear test: dispositivo no encontrado retorna error DEVICE_NOT_FOUND
- [x] Crear test: dispositivo de otro usuario retorna error DEVICE_NOT_OWNED
- [x] Crear test: dispositivo revocado retorna error SESSION_NOT_ALLOWED
- [x] Crear test: flujo exitoso guarda session_key en Valkey con TTL 7200
- [x] Crear test: mismo sharedSecret + diferente credentialId genera session_keys diferentes
- [x] Crear test: actualiza last_used_at del dispositivo
- [x] Validar estado del dispositivo: solo enrolled puede hacer login
- [x] Verificar integracion ECDH + HKDF: sharedSecret -> session_key
- [x] Verificar binding 1:1: session_key vinculada a userId + deviceId
- [x] Build y tests: 202/202 pasando (15 nuevos)
- [x] Commit atomico: 65f0168

**Cobertura de tests:**

| Categoria | Tests |
|-----------|-------|
| Casos de error | 4 |
| Flujo exitoso | 6 |
| Integracion ECDH+HKDF | 2 |
| Validacion de estado | 2 |
| Timestamps | 1 |

**Criterio de exito:** CUMPLIDO - LoginEcdhUseCase tiene cobertura completa de errores y flujo exitoso.

---

### Fase 22.3.2: Test unitario QR Generator

**Rama:** `fase-22.3.2-test-qr-generator`
**Modelo:** Sonnet
**Severidad:** MAYOR
**Referencia:** daRulez 7.1.1 - "Operaciones de escritura deben producir el mismo resultado" (Idempotencia)
**Estado:** COMPLETADA (2025-12-18)
**Commit:** b8b3f1d

**Situacion resuelta:**

El QRGenerator ahora tiene cobertura completa de tests unitarios que verifican generacion de nonce, estructura de payload, round counter, encriptacion AES-GCM y QRs decoy.

**Archivos creados:**

- `node-service/src/backend/qr-projection/domain/__tests__/qr-generator.test.ts` (29 tests)

**Tareas:**

- [x] Crear test: buildPayloadV1 genera estructura correcta (v, sid, uid, r, ts, n)
- [x] Crear test: nonce es string hexadecimal de 32 caracteres
- [x] Crear test: nonces generados son unicos
- [x] Crear test: round counter incrementa por sesion
- [x] Crear test: round counters son independientes por sessionId
- [x] Crear test: resetRoundCounter reinicia contador
- [x] Crear test: encryptPayload genera formato iv.ciphertext.authTag
- [x] Crear test: encryptPayloadWithRandomKey genera formato valido pero indescifrable
- [x] Crear test: generateForStudent genera payload con round especifico
- [x] Crear test: toQRString encripta y retorna formato iv.ciphertext.authTag
- [x] Crear test: generateV1 integra nonce, payload, encriptacion
- [x] Crear test: QRs decoy son indistinguibles de reales (mismo formato)
- [x] Build y tests: 231/231 pasando (29 nuevos)
- [x] Commit atomico: b8b3f1d

**Cobertura de tests:**

| Categoria | Tests |
|-----------|-------|
| Generacion de nonce | 2 |
| Construccion de payload V1 | 7 |
| Round counter | 4 |
| Conversion a string JSON | 2 |
| Encriptacion con AES-GCM | 3 |
| Encriptacion con clave aleatoria/decoys | 3 |
| generateV1 metodo principal | 4 |
| generateForStudent implementacion | 4 |

**Criterio de exito:** CUMPLIDO - QR Generator tiene cobertura completa de generacion, encriptacion y decoys.

---

### Fase 22.3.3: Test compatibilidad HKDF Frontend-Backend

**Rama:** `fase-22.3.3-test-hkdf-compatibility`
**Modelo:** Opus
**Severidad:** CRITICA
**Referencia:** daRulez 1.4.1 - "Seguridad primero: no debilitar el modelo criptografico"
**Estado:** COMPLETADA (2025-12-18)
**Commit:** 9a2a24a

**Situacion resuelta:**

El frontend (`login.service.ts`) y backend (`hkdf.service.ts`) derivan `session_key` independientemente usando HKDF. Se creo test que verifica compatibilidad con vectores fijos.

**Archivos creados:**

- `node-service/src/backend/enrollment/infrastructure/crypto/__tests__/hkdf-compatibility.test.ts` (9 tests)

**Tareas:**

- [x] Crear test: dado sharedSecret fijo (hex) y credentialId fijo, derivar session_key en backend
- [x] Documentar el resultado esperado (bytes hex de la session_key)
- [x] Verificar que frontend usa mismo algoritmo: P-256 ECDH -> 256 bits -> HKDF-SHA256 -> AES-256-GCM
- [x] Crear test: verificar que salt vacio y misma info producen clave identica
- [x] Cubrir edge cases: credentialId largo, caracteres especiales Base64
- [x] Build y tests: 187/187 pasando (9 nuevos)
- [x] Commit atomico: 9a2a24a

**Vector de compatibilidad documentado:**

```
sharedSecret (hex): a1b2c3d4e5f6071829304150617283940a1b2c3d4e5f6071829304150617283
credentialId:       dGVzdC1jcmVkZW50aWFsLWZvci1oZGtmLWNvbXBhdA==
info:               attendance-session-key-v1:dGVzdC1jcmVkZW50aWFsLWZvci1oZGtmLWNvbXBhdA==
session_key (hex):  769ffc0d428712e1713c472d96ac321b43c8dc172e7d8a1e0cf2f3afdff99af9
```

**Criterio de exito:** CUMPLIDO - Test demuestra que backend deriva session_key deterministica y compatible.

---

### Fase 22.3.4: Test unitario Decrypt Stage

**Rama:** `fase-22.3.4-test-decrypt-stage`
**Modelo:** Sonnet
**Severidad:** MAYOR
**Referencia:** daRulez 7.1.1 - "Efectos secundarios (I/O, persistencia) se aislan en infraestructura"
**Estado:** COMPLETADA (2025-12-18)
**Commit:** 1f1fcdf

**Situacion resuelta:

El DecryptStage ahora tiene cobertura completa de tests unitarios que verifican desencriptacion con session_key real, fallback a mock key, manejo de errores y modo STUB_MODE.

**Archivos creados:**

- `node-service/src/backend/attendance/domain/validation-pipeline/stages/__tests__/decrypt.stage.test.ts` (12 tests)

**Tareas:**

- [x] Crear test: con session_key valida, desencripta correctamente
- [x] Crear test: sin session_key, usa fallback mock key
- [x] Crear test: formato invalido retorna error INVALID_FORMAT
- [x] Crear test: desencriptacion fallida retorna error DECRYPTION_FAILED
- [x] Crear test: JSON no parseable retorna error DECRYPTION_FAILED
- [x] Crear test: en STUB_MODE, convierte QRPayloadV1 a StudentResponse
- [x] Crear test: verifica llamada a findByUserId con studentId correcto
- [x] Crear test: crea AesGcmService con session_key especifica
- [x] Build y tests: 243/243 pasando (12 nuevos)
- [x] Commit atomico: 1f1fcdf

**Cobertura de tests:**

| Categoria | Tests |
|-----------|-------|
| Desencriptacion con session_key real | 2 |
| Fallback a mock key | 2 |
| Manejo de errores | 3 |
| Modo STUB_MODE | 3 |
| Integracion SessionKeyQuery | 2 |

**Criterio de exito:** CUMPLIDO - Decrypt Stage tiene cobertura completa de desencriptacion, fallback y errores.

---

## BLOQUE C: Arquitectura

### Fase 22.5: Extraer Stats + QR Lifecycle - COMPLETADO ✅

**Objetivo:** Desacoplar cálculo de estadísticas y generación de QR de `CompleteScanUseCase`, delegando a servicios dedicados que usen ports existentes.

**Rama:** `fase-22.5-stats-qr-lifecycle`
**Modelo:** Opus
**Severidad:** MAYOR
**Fecha completado:** 2025-12-18

**Criterio de éxito verificable:**

- [x] `grep -n "calculateStats\|generateNextQR" node-service/src/backend/attendance/application/complete-scan` no encuentra imports directos ✅
- [x] `CompleteScanUseCase` recibe servicios por inyección, no los instancia ✅
- [x] Tests de UseCase mockean servicios (no lógica real) ✅
- [x] Tests unitarios existen para cada servicio extraído ✅ (19 tests)
- [x] Build y tests: 262/262 pasando ✅

**Entregables completados:**

| Artefacto | Ubicación |
|-----------|-----------|
| IAttendanceStatsCalculator port | shared/ports/attendance-stats.port.ts |
| IQRLifecycleManager port | shared/ports/qr-lifecycle.port.ts |
| AttendanceStatsCalculator service | attendance/domain/services/attendance-stats-calculator.service.ts |
| QRLifecycleService (actualizado) | attendance/application/services/qr-lifecycle.service.ts |
| Tests stats calculator | 11 tests en domain/services/__tests__/ |
| Tests QR lifecycle | 8 tests en application/services/__tests__/ |

**Cambios arquitectónicos:**

- `CompleteScanUseCase` ahora recibe `ServiceDependencies` en constructor
- Factory `createCompleteScanDepsWithPersistence` crea e inyecta servicios
- Stats calculation delegado a `IAttendanceStatsCalculator`
- QR generation/storage/projection delegado a `IQRLifecycleManager`

---

## BLOQUE D: Deuda Tecnica Opcional

### Fases 22.11-22.12

**Modelo:** Sonnet
**Estado:** ~~PENDIENTE~~ → **OMITIDAS** (verificado 2025-12-18)

**Justificación de omisión:**

- **22.11:** Búsqueda de `isDevelopment|isProduction` en backend/ retornó 0 resultados. No hay feature flags legacy.
- **22.12:** No hay container DI legacy detectado. La composición manual actual es intencional y funciona correctamente.

**Resultado:** Estas fases pueden eliminarse del roadmap activo.

---

## BLOQUE F: Correccion Flujo Escaneo QR

> Resuelve problemas criticos detectados en el flujo de escaneo QR que impiden la validacion de asistencia.
> Prerequisito para pruebas manuales end-to-end.

### Fase 26.1: TOTP Dual Key - evitar exportKey

**Objetivo:** Resolver el error `Failed to execute 'exportKey' on 'SubtleCrypto': key is not extractable` almacenando una version HMAC de la session_key durante el login.

**Rama:** `fase-26.1-totp-dual-key`
**Modelo:** Opus
**Severidad:** CRITICA
**Referencia:** Error en runtime, bloquea flujo completo de escaneo

**Situacion actual:**

- `generateTOTPu()` en `totp.ts` llama `exportKey('raw', key)` para reimportar como HMAC
- La session_key derivada de ECDH puede no ser extractable dependiendo del navegador/contexto
- El error bloquea completamente el flujo de validacion

**Archivos a modificar:**

| Archivo | Cambio |
|---------|--------|
| `frontend/shared/services/enrollment/session-key.store.ts` | Almacenar `hmacKey` junto a `sessionKey` en `StoredSession` |
| `frontend/shared/services/enrollment/login.service.ts` | Derivar HMAC key durante login y pasarla a store |
| `frontend/shared/crypto/totp.ts` | Recibir HMAC key directamente, eliminar `ensureHmacKey()` |
| `frontend/features/qr-reader/services/qr-scan.service.ts` | Obtener HMAC key del store para TOTP |

**Tareas:**

- [ ] Modificar `StoredSession` interface: agregar `hmacKey: JsonWebKey`
- [ ] En `LoginService.deriveSessionKey()`: derivar segunda key con `usages: ['sign']` para HMAC
- [ ] Actualizar `SessionKeyStore.storeSessionKey()`: recibir y almacenar ambas keys
- [ ] Crear `SessionKeyStore.getHmacKey()`: nuevo metodo que retorna CryptoKey HMAC
- [ ] Simplificar `generateTOTPu()`: recibir HMAC key directamente, sin conversion
- [ ] Actualizar `QRScanService`: usar `getHmacKey()` para TOTP
- [ ] Build y tests: X/X pasando

**Criterio de exito:**

- [ ] `generateTOTPu()` no llama `exportKey()`
- [ ] TOTP se genera correctamente con key HMAC dedicada
- [ ] Error `key is not extractable` eliminado
- [ ] Tests unitarios para derivacion dual

---

### Fase 26.2: Eliminar doble escritura de session_key

**Objetivo:** Eliminar la escritura duplicada que sobrescribe la session_key con datos incompletos.

**Rama:** `fase-26.2-eliminate-duplicate-store`
**Modelo:** Sonnet
**Severidad:** MAYOR
**Referencia:** daRulez 7.1.1 - DRY

**Situacion actual:**

- `LoginService.performLogin()` almacena en singleton con `(sessionKey, totpu, deviceId)`
- `qr-reader/main.ts` vuelve a llamar `storeSessionKey(result.sessionKey, result.totpu)` sin deviceId
- La segunda escritura sobrescribe la primera con datos incompletos

**Archivos a modificar:**

| Archivo | Cambio |
|---------|--------|
| `frontend/features/qr-reader/main.ts` | Eliminar llamada duplicada a `storeSessionKey()` |
| `frontend/features/enrollment/main.ts` | Eliminar llamada duplicada a `storeSessionKey()` |

**Tareas:**

- [ ] En `qr-reader/main.ts:356`: eliminar `await this.sessionKeyStore.storeSessionKey(...)`
- [ ] En `enrollment/main.ts:385`: eliminar `this.sessionKeyStore.storeSessionKey(...)`
- [ ] Verificar que `LoginService.performLogin()` es la unica fuente de escritura
- [ ] Build y tests: X/X pasando

**Criterio de exito:**

- [ ] `grep -n "storeSessionKey" frontend/` muestra solo `login.service.ts` y `session-key.store.ts`
- [ ] deviceId siempre presente en session almacenada

---

### Fase 26.3: Unificar instancias de SessionKeyStore

**Objetivo:** Usar singleton `getSessionKeyStore()` en todo el frontend para evitar inconsistencias.

**Rama:** `fase-26.3-singleton-session-store`
**Modelo:** Sonnet
**Severidad:** MAYOR
**Referencia:** Multiples instancias accediendo al mismo sessionStorage

**Situacion actual:**

- `qr-reader/main.ts:79` crea `new SessionKeyStore()`
- `aes-gcm.ts:38` crea `new SessionKeyStore()`
- `qr-scan.service.ts:143` usa `getSessionKeyStore()` (correcto)
- Tres instancias diferentes accediendo al mismo storage

**Archivos a modificar:**

| Archivo | Cambio |
|---------|--------|
| `frontend/features/qr-reader/main.ts` | Usar `getSessionKeyStore()` |
| `frontend/shared/crypto/aes-gcm.ts` | Usar `getSessionKeyStore()` |

**Tareas:**

- [ ] En `qr-reader/main.ts:79`: cambiar `new SessionKeyStore()` por `getSessionKeyStore()`
- [ ] En `aes-gcm.ts:38`: cambiar `new SessionKeyStore()` por `getSessionKeyStore()`
- [ ] Verificar imports actualizados
- [ ] Build y tests: X/X pasando

**Criterio de exito:**

- [ ] `grep -n "new SessionKeyStore()" frontend/` retorna 0 resultados
- [ ] Todas las referencias usan `getSessionKeyStore()`

---

### Fase 26.4: Inyectar StudentEncryptionService en factory

**Objetivo:** Corregir el factory para que los QRs de rounds 2+ se generen con session_key real, no mock.

**Rama:** `fase-26.4-inject-encryption-service`
**Modelo:** Opus
**Severidad:** CRITICA
**Referencia:** daRulez 1.4.1 - "Seguridad primero"

**Situacion actual:**

- `complete-scan-deps.factory.ts:114-118` crea `QRLifecycleService` sin `encryptionService`
- QRs para rounds 2+ se generan con mock key
- Estudiante no puede descifrar QRs generados despues del primero

**Archivos a modificar:**

| Archivo | Cambio |
|---------|--------|
| `backend/attendance/infrastructure/adapters/complete-scan-deps.factory.ts` | Crear e inyectar `StudentEncryptionService` |

**Tareas:**

- [ ] Importar `StudentEncryptionService` y `SessionKeyQueryAdapter`
- [ ] Crear instancia de `SessionKeyQueryAdapter` en el factory
- [ ] Crear instancia de `StudentEncryptionService` con el adapter
- [ ] Pasar `encryptionService` al constructor de `QRLifecycleService`
- [ ] Build y tests: X/X pasando

**Criterio de exito:**

- [ ] `QRLifecycleService` recibe `encryptionService` no-null
- [ ] Log `[QRLifecycle] Sin StudentEncryptionService` no aparece en runtime
- [ ] QRs round 2+ son descifrables por el estudiante

---

### Fase 26.5: Extraer Composition Root de routes.ts

**Objetivo:** Mover la creacion de servicios fuera de la capa de presentacion, respetando SoC.

**Rama:** `fase-26.5-extract-composition-root`
**Modelo:** Sonnet
**Severidad:** MAYOR
**Referencia:** daRulez 2.2 - "Prohibido capas tecnicas transversales compartidas"

**Situacion actual:**

- `routes.ts:56-100` instancia 20+ servicios directamente
- Capa de presentacion conoce detalles de infraestructura
- Dificil de testear y mantener

**Archivos a crear/modificar:**

| Archivo | Cambio |
|---------|--------|
| `backend/attendance/infrastructure/composition-root.ts` | NUEVO: factory de dependencias |
| `backend/attendance/presentation/routes.ts` | Simplificar, usar composition root |

**Tareas:**

- [ ] Crear `composition-root.ts` con funcion `createAttendanceDependencies()`
- [ ] Mover creacion de servicios de `routes.ts` a `composition-root.ts`
- [ ] Exportar objetos pre-construidos: `participationService`, `completeScanUseCase`, etc.
- [ ] Actualizar `routes.ts` para importar dependencias del composition root
- [ ] Build y tests: X/X pasando

**Criterio de exito:**

- [ ] `routes.ts` no tiene `new XxxService()` excepto para validacion de request
- [ ] `composition-root.ts` centraliza todas las instanciaciones
- [ ] Tests pueden mockear el composition root completo

---

### Fase 26.6: Centralizar configuracion (magic numbers)

**Objetivo:** Centralizar valores hardcodeados en configuracion, facilitando ajustes sin modificar codigo.

**Rama:** `fase-26.6-centralize-config`
**Modelo:** Sonnet
**Severidad:** MENOR
**Referencia:** daRulez 7.1.1 - DRY

**Situacion actual:**

Magic numbers dispersos:
- `qr-scan.service.ts`: `COOLDOWN_SECONDS = 3`, `ERROR_RECOVERY_SECONDS = 2`
- `student-session.repository.ts`: `stateTTL = 7200`
- `stats-calculator.ts`: rangos de certeza hardcodeados

**Archivos a modificar:**

| Archivo | Cambio |
|---------|--------|
| `shared/config/index.ts` | Agregar constantes de attendance |
| `frontend/shared/config/index.ts` | Crear archivo config para frontend |
| Archivos con magic numbers | Importar desde config |

**Tareas:**

- [ ] Agregar a `shared/config/index.ts`: `SCAN_COOLDOWN_SECONDS`, `ERROR_RECOVERY_SECONDS`
- [ ] Agregar rangos de certeza: `CERTAINTY_SUSPICIOUS_MIN_MS`, `CERTAINTY_SUSPICIOUS_MAX_MS`
- [ ] Crear `frontend/shared/config/index.ts` con constantes de UI
- [ ] Actualizar archivos para usar imports de config
- [ ] Build y tests: X/X pasando

**Criterio de exito:**

- [ ] `grep -rn "= 3;" frontend/` no encuentra cooldowns hardcodeados
- [ ] Configuracion centralizada y documentada

---

## BLOQUE E: Integracion PHP (FINAL)

### Fase 23.1: Implementar Restriction Service

**Objetivo:** Conectar RestrictionService (actualmente stub) con PHP via HTTP para consultar restricciones reales de usuarios, con cache y fallback fail-open.

**Rama:** `fase-23.1-restriction-integration`
**Modelo:** Opus
**Severidad:** MAYOR

**Criterio de éxito verificable:**

- [ ] `RestrictionService.checkRestrictions()` hace request HTTP a PHP (no es stub)
- [ ] Cache en Valkey reduce requests repetidos (observable en logs)
- [ ] Si PHP no responde (timeout 3s), retorna `{ blocked: false }` (fail-open)
- [ ] Tests con mock HTTP verifican: cache hit, cache miss, timeout, error
- [ ] Contrato HTTP documentado y acordado con equipo PHP
- [ ] Build y tests: X/X pasando

**Restricciones arquitectónicas:**

- Endpoint PHP: `GET /api/restrictions/{userId}` (acordar con equipo PHP)
- Cache TTL: 5 minutos (configurar en Valkey)
- Fallback: fail-open (si PHP cae, no bloquear usuarios)
- Autenticación interna: API key en header (compartida Node↔PHP)

**Entregables mínimos:**

- RestrictionService real que consulta PHP
- Cache en Valkey para reducir carga
- Fallback que permite acceso si PHP no responde
- Documentación del contrato HTTP (request/response)

**Dependencias:** Requiere BLOQUE C + coordinación con equipo PHP

**Referencias:** `spec-architecture.md` sección "Dominio: Restriction"

---

### Fase 23.2: Puente HTTP Node-PHP

**Objetivo:** Establecer comunicación bidireccional completa Node↔PHP: notificar asistencias a PHP, consultar datos maestros desde PHP, health checks mutuos.

**Rama:** `fase-23.2-node-php-bridge`
**Modelo:** Opus
**Severidad:** MAYOR

**Criterio de éxito verificable:**

- [ ] Al completar asistencia, Node notifica a PHP (fire-and-forget)
- [ ] Node puede consultar detalles de sesión desde PHP (con cache)
- [ ] Endpoint `/health` en Node verifica conectividad con PHP
- [ ] Cliente HTTP tiene retry logic y timeouts configurables
- [ ] Documentación completa de todos los endpoints Node↔PHP
- [ ] Build y tests: X/X pasando

**Restricciones arquitectónicas:**

- Notificación: fire-and-forget (no bloquear pipeline de attendance)
- Master data sync: cachear en Valkey (sesiones no cambian frecuentemente)
- Autenticación: misma API key que 23.1
- Retry: backoff exponencial (500ms, 1s, 2s)

**Entregables mínimos:**

- Servicio notificador de asistencia (Node→PHP)
- Repository de datos maestros (PHP→Node con cache)
- Cliente HTTP robusto con retry y timeout
- Health check bidireccional
- Documentación de integración y runbook de troubleshooting

**Dependencias:** Requiere 23.1 + endpoints PHP implementados

**Referencias:** `spec-architecture.md` sección 2.3

---

## Fases Futuras (24-25)

### Fase 24: Infraestructura y Operaciones

**Objetivo:** Preparar sistema para producción con gestión de secretos, monitoreo y procedimientos de recuperación.

**Modelo:** Opus
**Severidad:** MAYOR

**Criterio de éxito verificable:**

- [ ] Secretos gestionados via vault o equivalente (no en archivos)
- [ ] Alertas configuradas para errores críticos
- [ ] Procedimiento de backup probado y documentado
- [ ] Runbook de despliegue completo

---

### Fase 25: Testing E2E y Calidad

**Objetivo:** Validar flujos completos end-to-end, medir rendimiento bajo carga, y completar auditoría de seguridad.

**Modelo:** Opus
**Severidad:** MAYOR

**Criterio de éxito verificable:**

- [ ] Tests E2E cubren: enrollment → login → escaneo → asistencia registrada
- [ ] Tests de carga: sistema soporta X usuarios concurrentes sin degradación
- [ ] Auditoría de seguridad: 0 vulnerabilidades críticas
- [ ] Documentación de usuario completa

---

## Documentos de Referencia

| Documento | Proposito | Ubicacion |
|-----------|-----------|-----------|
| `daRulez.md` | Reglas de desarrollo (FUENTE DE VERDAD) | Raiz |
| `spec-architecture.md` | Arquitectura y dominios | Raiz |
| `spec-qr-validation.md` | Flujo de validacion QR | Raiz |
| `Caracterizacion del Ecosistema.md` | Vision completa del sistema | documents/04-caracterizacion/ |
| `14-decision-totp-session-key.md` | Derivacion de claves TOTP | documents/03-especificaciones-tecnicas/ |
| `db-schema.md` | Esquema de base de datos | Raiz |

---

## Proxima Accion

Ejecutar en orden estricto:

**BLOQUE A - Compliance daRulez:** [OK] COMPLETADO
1. [OK] **22.10.4** - Centralizar secretos (commit e3172f9)
2. [OK] **22.10.5** - Eliminar microservicios (commit f36ed52)
3. [OK] **22.10.6** - Completar modulo access (commit d7b863b)
4. [OK] **22.10.7-8** - Traducir comentarios (commit c0260dc)
5. [OMITIDA] **22.10.9** - Tests ya usan convencion AAA
6. [OK] **22.10.10** - Logger estructurado (commit 831c58d)

**BLOQUE B - Seguridad Critica:** [OK] COMPLETADO
7. [OK] **22.2** - Session Key Binding con credentialId (commit 5c2c473)
8. [OK] **22.3** - AAGUID Validation con whitelist (commits 0844ede, 1296c0a)

**BLOQUE B2 - Testing Critico Pre-Manual:** [OK] COMPLETADO
9. [OK] **22.3.3** - Test compatibilidad HKDF Frontend-Backend (commit 9a2a24a)
10. [OK] **22.3.1** - Test unitario Login ECDH Use Case (commit 65f0168)
11. [OK] **22.3.2** - Test unitario QR Generator (commit b8b3f1d)
12. [OK] **22.3.4** - Test unitario Decrypt Stage (commit 1f1fcdf)

**BLOQUE C - Arquitectura:** [OK] COMPLETADO
13. [OK] **22.5** - Stats + QR Lifecycle extraction (commit 0755ca1)

**BLOQUE F - Correccion Flujo Escaneo QR:**
14. [ ] **26.1** - TOTP Dual Key (CRITICO) - Modelo: Opus
15. [ ] **26.2** - Eliminar doble escritura session_key - Modelo: Sonnet
16. [ ] **26.3** - Unificar instancias SessionKeyStore - Modelo: Sonnet
17. [ ] **26.4** - Inyectar StudentEncryptionService (CRITICO) - Modelo: Opus
18. [ ] **26.5** - Extraer Composition Root - Modelo: Sonnet
19. [ ] **26.6** - Centralizar configuracion - Modelo: Sonnet

**BLOQUE E - Integracion PHP (FINAL):**
20. [ ] **23.1** - Restriction Integration
21. [ ] **23.2** - Puente HTTP Node-PHP

**Fases omitidas:**
- ~~22.10.9~~ - Comentarios tests ya usan convencion AAA estandar
- ~~22.11-22.12~~ - No hay flags legacy ni DI container

---

*Este documento es la fuente de verdad para tareas pendientes del proyecto.*
