# PLAN PARTE 3: Módulo Enrollment Backend Real

**Fecha:** 2025-11-04
**Versión:** 2.0
**Estado:** Planificación consolidada
**Duración estimada:** 4-5 días

---

## Índice

1. [Contexto y Objetivos](#contexto-y-objetivos)
2. [Dependencias](#dependencias)
3. [Alcance](#alcance)
4. [Sprint Detallado](#sprint-detallado)
5. [Archivos a Crear/Modificar](#archivos-a-crearmodificar)
6. [Criterios de Aceptación](#criterios-de-aceptación)

---

## Contexto y Objetivos

### Objetivo Principal

Reemplazar stubs actuales con implementación real de FIDO2/WebAuthn, incluyendo ECDH key exchange, WebSocket enrollment, sistema de penalizaciones y validación AAGUID.

### Estado Actual

- Sistema: 57% completo
- Enrollment stubs: 10% (solo mocks)
- Base de datos: Schemas creados (PARTE 1)
- WebSocket infrastructure: Disponible

### Independencia

**Depende de PARTE 1 (Base datos).** NO depende de PARTE 2 ni 4.

---

## Dependencias

### Pre-requisitos

- **PARTE 1 completada:** Schema `enrollment.*` creado
- Librería `@simplewebauthn/server` instalada
- Valkey para challenges (TTL 5min)

### Outputs para Otras Partes

- **PARTE 2:** Validación de enrollment antes de asistencia
- **PARTE 4:** Endpoints + WebSocket para enrollment

---

## Alcance

### Incluye

**Domain Layer:**
- Entities: `Device`, `EnrollmentChallenge`, `ECDHSession`
- Value Objects: `CredentialId`, `PublicKey`, `HandshakeSecret`
- Services: `FIDO2Validator`, `AAGUIDValidator`

**Infrastructure:**
- FIDO2Service (WebAuthn real)
- ECDHService (key exchange P-256)
- HKDFService (derivación secrets)
- Repositories + PenaltyService

**Application:**
- Use Cases reales (no stubs)
- DTOs con validaciones estrictas

**Presentation:**
- HTTP endpoints actualizados
- WebSocket `/enrollment/ws`

### NO Incluye

- Frontend (PARTE 4)
- Asistencia (PARTE 2)

---

## Sprint Detallado

### Resumen de User Stories

| User Story | Tareas | Estimación | Prioridad |
|------------|--------|------------|-----------|
| 3.1 Domain Layer | 6 | 16h | P0 |
| 3.2 Domain Services | 4 | 21h | P0 |
| 3.3 Infrastructure Crypto | 5 | 34h | P0 |
| 3.4 Infrastructure Repos | 5 | 28h | P0-P1 |
| 3.5 Application Layer | 6 | 41h | P0-P1 |
| 3.6 Presentation Layer | 7 | 30h | P0-P1 |
| 3.7 Testing E2E | 6 | 28h | P1-P2 |
| 3.8 Documentación | 3 | 6h | P2 |

**Total:** 45 tareas, ~204 horas (~5 días para 1 dev full-time)

---

## Archivos a Crear/Modificar

```bash
node-service/src/modules/enrollment/
├── domain/
│   ├── entities/
│   │   ├── device.entity.ts (actualizar)
│   │   ├── enrollment-challenge.entity.ts (nuevo)
│   │   └── ecdh-session.entity.ts (nuevo)
│   ├── value-objects/
│   │   ├── credential-id.vo.ts (nuevo)
│   │   ├── public-key.vo.ts (nuevo)
│   │   └── handshake-secret.vo.ts (nuevo)
│   └── services/
│       ├── fido2-validator.service.ts (nuevo)
│       └── aaguid-validator.service.ts (nuevo)
├── infrastructure/
│   ├── fido2/
│   │   └── fido2.service.ts (nuevo)
│   ├── crypto/
│   │   ├── ecdh.service.ts (nuevo)
│   │   └── hkdf.service.ts (nuevo)
│   ├── repositories/
│   │   ├── device.repository.ts (actualizar)
│   │   ├── enrollment-history.repository.ts (nuevo)
│   │   └── challenge.repository.ts (nuevo)
│   └── penalties/
│       └── penalty.service.ts (nuevo)
├── application/
│   ├── usecases/
│   │   ├── start-enrollment.usecase.ts (reemplazar)
│   │   ├── finish-enrollment.usecase.ts (reemplazar)
│   │   ├── login.usecase.ts (reemplazar)
│   │   └── verify-device.usecase.ts (nuevo)
│   └── dtos/ (actualizar todos)
├── presentation/
│   ├── enrollment.controller.ts (reemplazar)
│   ├── websocket-controller.ts (nuevo)
│   ├── enrollment.routes.ts (actualizar)
│   └── types.ts (actualizar)
└── __tests__/
    ├── unit/
    │   ├── fido2-validator.test.ts
    │   └── ecdh.test.ts
    ├── integration/
    │   └── enrollment-flow.test.ts
    └── e2e/
        └── enrollment-login.test.ts
```

---

## Tareas Críticas (P0)

### Domain Layer (6 tareas)

**PART3-T3.1.1:** Actualizar `Device.entity.ts` con campos completos
- Estimación: S (3h)
- Campos: credential_id, public_key, aaguid, sign_count

**PART3-T3.1.2-6:** Implementar entities y VOs restantes
- Challenge, ECDH Session, CredentialId, PublicKey, HandshakeSecret
- Total: 13h

### Infrastructure Crypto (3 tareas críticas)

**PART3-T3.3.1:** Implementar `FIDO2Service.ts`
- Estimación: L (12h)
- Wrapper de `@simplewebauthn/server`
- Métodos: `generateRegistrationOptions()`, `verifyRegistrationResponse()`

**PART3-T3.3.2:** Implementar `ECDHService.ts`
- Estimación: M (8h)
- Key exchange ECDH P-256
- Métodos: `generateKeyPair()`, `deriveSharedSecret()`

**PART3-T3.3.3:** Implementar `HKDFService.ts`
- Estimación: M (6h)
- Derivación handshake_secret
- HKDF con SHA-256

### Application Layer (4 tareas críticas)

**PART3-T3.5.1:** Reemplazar `StartEnrollmentUseCase.ts`
- Estimación: M (8h)
- Genera challenge real con FIDO2Service
- Challenge aleatorio 32 bytes, TTL 5min

**PART3-T3.5.2:** Reemplazar `FinishEnrollmentUseCase.ts`
- Estimación: L (14h)
- Valida credential, extrae publicKey, deriva secrets
- Guarda en DB, retorna deviceId

**PART3-T3.5.3:** Reemplazar `LoginECDHUseCase.ts`
- Estimación: L (12h)
- ECDH key exchange + generación TOTPu
- Deriva session_key, genera TOTPu

**PART3-T3.5.4:** Implementar `VerifyDeviceUseCase.ts`
- Estimación: M (6h)
- Verifica sign_count anti-clonación
- Detecta clonación, incrementa counter

### Presentation Layer (5 tareas críticas)

**PART3-T3.6.1-4:** Actualizar endpoints HTTP
- `/enrollment/start`, `/enrollment/finish`
- `/enrollment/login`, `/enrollment/status`
- Total: 17h

**PART3-T3.6.5:** Implementar `WebSocketController` para enrollment
- Estimación: L (10h)
- Canal interactivo para FIDO2
- Auth JWT + códigos cierre 4401/4403

---

## Sistema de Penalizaciones

### Implementación (PART3-T3.4.4)

```typescript
// PenaltyService.ts
class PenaltyService {
  async increment(userId: number): Promise<void>
  async isBlocked(userId: number): Promise<boolean>
  async reset(userId: number): Promise<void>
  async getDelayMinutes(userId: number): Promise<number>
}
```

### Escala de Penalización

```
Device 1: 0 min delay
Device 2: 5 min delay
Device 3: 30 min delay
Device 4+: Exponencial (máx 24h)
```

### Storage en Valkey

```
Key: penalty:{userId}
Value: {attempts: number, blockedUntil: timestamp}
TTL: 24 horas
```

---

## WebSocket Enrollment

### Mensajes Cliente → Servidor

```typescript
interface AuthMessageDTO {
  type: 'AUTH';
  token: string;
}

interface CredentialMessageDTO {
  type: 'CREDENTIAL';
  credential: PublicKeyCredential;
}
```

### Mensajes Servidor → Cliente

```typescript
interface ChallengeMessageDTO {
  type: 'CHALLENGE';
  payload: {
    challenge: string;
    options: PublicKeyCredentialCreationOptions;
  };
}

interface SuccessMessageDTO {
  type: 'SUCCESS';
  payload: {
    deviceId: string;
    enrolled: true;
  };
}

interface PenaltyMessageDTO {
  type: 'PENALTY';
  payload: {
    delayMinutes: number;
    reason: string;
  };
}
```

---

## Criterios de Aceptación

1. FIDO2/WebAuthn validación real (no stubs)
2. ECDH key exchange completo
3. Derivación handshake_secret con HKDF
4. WebSocket `/enrollment/ws` funcional
5. Persistencia en PostgreSQL `enrollment.devices`
6. Sistema de penalizaciones implementado
7. AAGUID validation
8. Sign counter anti-clonación
9. Tests unitarios y E2E pasando (coverage >80%)
10. Documentación actualizada

---

## Referencias

- [03-flujo-enrolamiento.md](documents/planificacion/03-flujo-enrolamiento.md) - Flujo completo FIDO2
- [02-componentes-criptograficos.md](documents/planificacion/02-componentes-criptograficos.md) - ECDH, HKDF
- [06-diagramas-secuencia.md](documents/planificacion/06-diagramas-secuencia.md) - Diagramas detallados

---

## Estado de Implementación

Ver [documents/planificacion/13-estado-implementacion.md](documents/planificacion/13-estado-implementacion.md) para el estado actualizado de este plan.

**Última actualización:** 2025-11-06

---

**Próximos pasos:** Sprint Planning PARTE 3
