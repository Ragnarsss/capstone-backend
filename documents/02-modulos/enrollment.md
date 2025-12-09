# Módulo Enrollment

> Documentación técnica del módulo de inscripción de dispositivos FIDO2 + ECDH

---

## Resumen

El módulo **Enrollment** gestiona la relación 1:1 entre alumnos (RUT) y dispositivos físicos. Combina:

- **FIDO2/WebAuthn**: Registro biométrico del dispositivo
- **ECDH**: Intercambio de claves para derivar `session_key`
- **HKDF**: Derivación de secretos criptográficos

---

## Cuándo Ocurre Enrollment

```mermaid
flowchart TD
    A[Alumno intenta usar sistema] --> B{¿Tiene enrollment activo<br/>en ESTE dispositivo?}
    
    B -->|SÍ| C[LOGIN ECDH<br/>~100ms]
    B -->|NO| D{¿Por qué no tiene?}
    
    D --> E[Primera vez]
    D --> F[Dispositivo nuevo]
    D --> G[Fue desplazado<br/>por otro usuario]
    
    E --> J[ENROLLMENT FIDO2<br/>~30 segundos]
    F --> J
    G --> J
    
    J --> H[Enrollment exitoso<br/>+ incrementa contador]
    
    H --> C
    
    C --> K{¿Penalización activa?}
    
    K -->|NO| L[Puede marcar asistencia]
    K -->|SI| M[NO puede marcar asistencia<br/>hasta que expire]
```

### Escenarios que Requieren Enrollment

| Escenario | Descripción |
|-----------|-------------|
| **Primera vez** | Alumno nunca ha enrolado ningún dispositivo |
| **Dispositivo nuevo** | Alumno intenta usar dispositivo diferente al enrolado |
| **Desplazado** | Otro usuario enroló el dispositivo donde estaba |

> **Nota:** En todos los casos aplica la política 1:1 - el dispositivo anterior queda automáticamente revocado.
>
> **Penalización:** La **primera vez** no tiene penalización. A partir del **segundo enrollment**, el alumno puede enrolarse inmediatamente pero **no puede registrar asistencia** durante un período configurable (crece exponencialmente con cada re-enrollment).

---

## Arquitectura del Módulo

```
src/backend/enrollment/
├── application/
│   ├── enrollment.service.ts          # Orquestador (legacy)
│   └── use-cases/
│       ├── start-enrollment.use-case.ts
│       ├── finish-enrollment.use-case.ts
│       ├── login-ecdh.use-case.ts
│       ├── get-enrollment-status.use-case.ts
│       └── revoke-device.use-case.ts
├── domain/
│   ├── entities/                       # Device, Credential
│   └── models.ts                       # DTOs, interfaces
├── infrastructure/
│   ├── crypto/
│   │   ├── ecdh.service.ts            # Key exchange P-256
│   │   └── hkdf.service.ts            # Derivación de claves
│   ├── fido2/
│   │   └── fido2.service.ts           # SimpleWebAuthn wrapper
│   ├── penalties/
│   │   └── penalty.service.ts         # Penalizaciones en asistencia
│   └── repositories/
│       ├── device.repository.ts       # PostgreSQL
│       ├── enrollment-challenge.repository.ts  # Valkey
│       └── session-key.repository.ts  # Valkey
└── presentation/
    ├── routes.ts                       # Registro de rutas
    └── controllers/                    # HTTP controllers
```

---

## Flujo Detallado

### Fase 1: Registro FIDO2 (Start + Finish)

```mermaid
sequenceDiagram
    participant A as Alumno
    participant B as Navegador
    participant S as Servidor
    participant V as Valkey
    participant P as PostgreSQL

    Note over A,P: START ENROLLMENT
    A->>S: POST /enrollment/start<br/>{userId, username}
    S->>P: Obtener dispositivos existentes
    S->>S: Generar challenge + opciones WebAuthn
    S->>V: Guardar challenge (TTL 5 min)
    S->>A: {options}

    Note over A,P: INTERACCIÓN USUARIO
    A->>B: Usa biometría (Touch ID, Face ID, etc.)
    B->>B: navigator.credentials.create()
    B->>A: {credential}

    Note over A,P: FINISH ENROLLMENT
    A->>S: POST /enrollment/finish<br/>{credential, fingerprint}
    S->>V: Recuperar challenge
    S->>S: Verificar attestation WebAuthn
    S->>S: Extraer credentialId + publicKey + aaguid
    
    Note over S: POLÍTICA 1:1
    S->>P: ¿Dispositivo existe con otro usuario?
    alt Sí - otro usuario
        S->>P: Revocar enrollment del otro usuario
    end
    S->>P: ¿Usuario tiene otros dispositivos?
    alt Sí - tiene otros
        S->>P: Revocar todos los dispositivos previos
    end
    
    S->>S: Derivar handshake_secret = HKDF(credentialId + userId + masterSecret)
    S->>P: INSERT device (credentialId, publicKey, handshake_secret)
    
    Note over S,V: PENALIZACIÓN (solo si NO es primera vez)
    S->>V: Incrementar contador enrollments
    S->>V: Calcular período de penalización
    S->>V: Guardar penaltyEndsAt (si aplica)
    
    S->>V: Eliminar challenge
    S->>A: {deviceId, credentialId, aaguid, penaltyInfo}
```

### Fase 2: Login ECDH (Cada Sesión)

```mermaid
sequenceDiagram
    participant A as Alumno
    participant B as Navegador
    participant S as Servidor
    participant V as Valkey
    participant P as PostgreSQL

    Note over A,P: CLIENTE GENERA PAR ECDH
    B->>B: clientKeyPair = ECDH.generateKeyPair()
    
    A->>S: POST /enrollment/login<br/>{credentialId, clientPublicKey}
    
    S->>P: Buscar dispositivo por credentialId
    S->>S: Verificar pertenencia + estado activo
    
    Note over S: KEY EXCHANGE
    S->>S: serverKeyPair = ECDH.generateKeyPair()
    S->>S: sharedSecret = ECDH(serverPrivate, clientPublic)
    S->>S: session_key = HKDF(sharedSecret, "attendance-session-key-v1")
    
    S->>V: Guardar session_key (TTL 2 horas)
    S->>S: TOTPu = TOTP(handshake_secret)
    S->>P: Actualizar last_used_at
    
    S->>A: {serverPublicKey, TOTPu, deviceId}
    
    Note over A,P: CLIENTE DERIVA MISMA CLAVE
    B->>B: sharedSecret = ECDH(clientPrivate, serverPublic)
    B->>B: session_key = HKDF(sharedSecret, "attendance-session-key-v1")
    B->>B: Verificar TOTPu
    
    Note over A,P: LISTO PARA ESCANEAR QRs
```

---

## Secretos Criptográficos

| Secreto | Almacenamiento | TTL | Propósito |
|---------|----------------|-----|-----------|
| `handshake_secret` | PostgreSQL | Permanente | Derivar claves, generar TOTP |
| `session_key` | Valkey | 2 horas | Cifrar/descifrar QRPayloadV1 con AES-256-GCM |
| `sharedSecret` | Memoria | Efímero | Solo para derivar session_key (nunca se transmite) |

### Derivación de Claves (HKDF)

```typescript
// handshake_secret (permanente, en enrollment)
handshake_secret = HKDF(
  ikm: credentialId + userId + masterSecret,
  info: "attendance-handshake-v1",
  length: 32 bytes
)

// session_key (efímera, en login)
session_key = HKDF(
  ikm: sharedSecret,  // resultado de ECDH
  info: "attendance-session-key-v1",
  length: 32 bytes
)
```

---

## Política 1:1 Estricta

```mermaid
flowchart LR
    subgraph Regla
        R1[1 RUT] === R2[máximo 1 Dispositivo activo]
        R3[1 Dispositivo] === R4[máximo 1 RUT activo]
    end
```

### Consecuencias

| Acción | Resultado |
|--------|----------|
| Juan enrola por **primera vez** | Sin penalización - puede marcar asistencia inmediatamente |
| Juan enrola celular nuevo (ya tenía uno) | Celular viejo → **REVOCADO** + **no puede marcar asistencia** por X minutos |
| Pedro toma celular de Juan y lo enrola | Enrollment de Juan → **REVOCADO**. Juan debe re-enrolarse y tendrá penalización |
| Juan (desplazado) enrola otro dispositivo | Enrollment inmediato, pero **no puede marcar asistencia** por X minutos |

---

## Sistema de Penalizaciones

La penalización **NO impide enrolarse**, pero **SÍ impide registrar asistencia** durante un período configurable.

```mermaid
flowchart TD
    E1[Enrollment #1] --> P1[Sin penalización]
    E2[Enrollment #2] --> P2[No puede marcar asistencia<br/>por X minutos]
    E3[Enrollment #3] --> P3[No puede marcar asistencia<br/>por X×3 minutos]
    E4[Enrollment #4] --> P4[No puede marcar asistencia<br/>por X×9 minutos]
    E5[Enrollment #5+] --> P5[No puede marcar asistencia<br/>por período máximo]
```

### Qué Puede y No Puede Hacer el Alumno Penalizado

| Acción | Permitido |
|--------|----------|
| Enrolarse en nuevo dispositivo | SI, inmediatamente |
| Login ECDH | SI |
| Escanear QRs | SI |
| **Registrar asistencia** | **NO** (durante penalización) |
| Ver estado de sesión | SI |

### Configuración

```bash
# Variables de entorno
PENALTY_BASE_MINUTES=5
PENALTY_MULTIPLIER=3
PENALTY_MAX_MINUTES=1440  # 24 horas
```

### Lógica

```typescript
function getPenaltyMinutes(enrollmentCount: number): number {
  if (enrollmentCount <= 1) return 0; // Primera vez sin penalización
  
  const penalty = PENALTY_BASE_MINUTES * Math.pow(PENALTY_MULTIPLIER, enrollmentCount - 2);
  return Math.min(penalty, PENALTY_MAX_MINUTES);
}

// En validación de asistencia:
function canMarkAttendance(userId: number): boolean {
  const penalty = getPenaltyInfo(userId);
  if (penalty.isActive) {
    throw new Error(`Penalización activa hasta ${penalty.endsAt}`);
  }
  return true;
}
```

---

## Endpoints HTTP

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/enrollment/start` | Iniciar enrollment FIDO2 | JWT |
| POST | `/api/enrollment/finish` | Completar enrollment FIDO2 | JWT |
| POST | `/api/enrollment/login` | Login ECDH (obtener session_key) | JWT |
| GET | `/api/enrollment/status` | Estado de enrollment del usuario | JWT |
| DELETE | `/api/enrollment/devices/:deviceId` | Revocar dispositivo | JWT |

### Rate Limiting

- **Enrollment** (start, finish): 5 intentos por minuto
- **Login ECDH**: 10 intentos por minuto

---

## Diferencia Clave

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│   ENROLLMENT (~30 segundos)                                               │
│   • Requiere biometría del usuario                                       │
│   • Genera credentialId + publicKey + handshake_secret                   │
│   • Persiste en PostgreSQL                                                │
│   • Aplica penalizaciones                                                 │
│   • Ocurre cuando NO hay enrollment activo válido                        │
│                                                                           │
│   LOGIN ECDH (~100ms)                                                     │
│   • No requiere interacción del usuario                                  │
│   • Key exchange efímero (Perfect Forward Secrecy)                       │
│   • Genera session_key temporal (2h en Valkey)                           │
│   • Ocurre cuando SÍ hay enrollment activo válido                        │
│                                                                           │
│   INCENTIVO: Mantener tu dispositivo = puede marcar asistencia          │
│   DESINCENTIVO: Cambiar dispositivo = no puede marcar asistencia (temp)  │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Referencias

- `node-service/src/backend/enrollment/` - Código fuente
- `documents/03-especificaciones-tecnicas/14-decision-totp-session-key.md` - Decisión arquitectónica
- [WebAuthn Spec](https://www.w3.org/TR/webauthn-2/) - W3C WebAuthn Level 2
- [RFC 5869](https://tools.ietf.org/html/rfc5869) - HKDF specification
