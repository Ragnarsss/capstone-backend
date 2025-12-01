# PLAN PARTE 3 - Modulo Enrollment Backend

**Fecha:** 2025-11-04  
**Actualizado:** 2025-11-28  
**Version:** 3.0  
**Estado:** NO INICIADO (solo stubs)

---

## Resumen de Estado

| Componente | Estado | Notas |
|------------|--------|-------|
| Endpoints HTTP | STUB | Retornan datos fake |
| FIDO2/WebAuthn | NO EXISTE | Dependencia no instalada |
| ECDH Key Exchange | NO EXISTE | Necesario para session_key real |
| WebSocket enrollment | NO EXISTE | Canal interactivo |
| Persistencia PostgreSQL | NO USADO | Tablas existen pero vacias |
| Sistema penalizaciones | NO EXISTE | |

---

## Contexto

El modulo de enrollment actualmente tiene **stubs** que permiten probar el flujo de attendance con mocks. La implementacion real requiere:

1. **FIDO2/WebAuthn** para vincular dispositivos
2. **ECDH** para derivar session_key sin transmitirla
3. **HKDF** para derivar handshake_secret
4. **TOTPu basado en session_key** (no handshake_secret)

Ver `14-decision-totp-session-key.md` para la decision sobre TOTPu.

---

## Arquitectura Objetivo

```
node-service/src/backend/enrollment/
├── application/
│   ├── enrollment.service.ts       # Orquesta flujo
│   └── login.service.ts            # ECDH login
├── domain/
│   └── models.ts                   # Device, Challenge, etc
├── infrastructure/
│   ├── fido2/
│   │   └── fido2.service.ts        # @simplewebauthn/server
│   ├── crypto/
│   │   ├── ecdh.service.ts         # Key exchange P-256
│   │   └── hkdf.service.ts         # Derivacion secrets
│   ├── postgres/
│   │   └── device.repository.ts    # CRUD enrollment.devices
│   └── penalties/
│       └── penalty.service.ts      # Delays exponenciales
└── presentation/
    ├── routes.ts                   # HTTP endpoints
    └── websocket-controller.ts     # Canal interactivo
```

---

## Fases de Implementacion

### Fase E-0: Dependencias

**Objetivo:** Instalar libreria WebAuthn

**Tareas:**

1. Agregar `@simplewebauthn/server` a package.json
2. Agregar `@simplewebauthn/types`
3. Reconstruir contenedor
4. Verificar compilacion

**Verificacion:**

```bash
podman exec asistencia-node npm list @simplewebauthn/server
```

---

### Fase E-1: Servicios Crypto

**Objetivo:** Implementar HKDF y ECDH

**Archivos:**

- `infrastructure/crypto/hkdf.service.ts`
- `infrastructure/crypto/ecdh.service.ts`

**Funciones:**

```typescript
// HKDF
deriveHandshakeSecret(credentialId, visitorId, masterSecret): Buffer
deriveSessionKey(sharedSecret): Buffer

// ECDH
generateKeyPair(): { publicKey, privateKey }
deriveSharedSecret(privateKey, peerPublicKey): Buffer
```

---

### Fase E-2: Device Repository

**Objetivo:** CRUD para enrollment.devices

**Metodos:**

- `save(device)` - INSERT
- `findByVisitorId(id)` - SELECT
- `findByCredentialId(id)` - SELECT
- `updateSignCount(id, count)` - UPDATE
- `deactivate(id)` - UPDATE is_active = false

---

### Fase E-3: FIDO2 Service

**Objetivo:** Wrapper de @simplewebauthn/server

**Metodos:**

```typescript
generateRegistrationOptions(visitor, rpId): PublicKeyCredentialCreationOptions
verifyRegistrationResponse(response, challenge): VerifiedRegistration
generateAuthenticationOptions(devices): PublicKeyCredentialRequestOptions
verifyAuthenticationResponse(response, device): VerifiedAuthentication
```

---

### Fase E-4: Start Enrollment Real

**Objetivo:** Reemplazar stub de /enrollment/start

**Flujo:**

1. Validar visitor existe (via PHP)
2. Verificar no hay device activo
3. Generar challenge (32 bytes)
4. Almacenar en Valkey (TTL 5 min)
5. Retornar options WebAuthn

---

### Fase E-5: Finish Enrollment Real

**Objetivo:** Reemplazar stub de /enrollment/finish

**Flujo:**

1. Recuperar challenge de Valkey
2. Verificar response con FIDO2Service
3. Extraer publicKey, credentialId, aaguid
4. Derivar handshake_secret con HKDF
5. Guardar en enrollment.devices
6. Retornar deviceId

---

### Fase E-6: Login ECDH

**Objetivo:** Implementar key exchange

**Flujo:**

1. Cliente envia pubKey_cliente + WebAuthn assertion
2. Servidor valida assertion
3. Servidor genera par ECDH efimero
4. Servidor calcula shared_secret
5. Servidor deriva session_key
6. Servidor retorna pubKey_servidor
7. Cliente calcula mismo session_key

**Resultado:** Ambos tienen session_key sin transmitirla

---

### Fase E-7: Sistema Penalizaciones

**Objetivo:** Delays exponenciales por re-enrollment

**Escala:**

| Device # | Delay |
|----------|-------|
| 1 | 0 min |
| 2 | 5 min |
| 3 | 30 min |
| 4+ | Exponencial (max 24h) |

**Storage:** Valkey con TTL 24h

---

### Fase E-8: WebSocket Enrollment

**Objetivo:** Canal interactivo para FIDO2

**Mensajes:**

- `AUTH` - Cliente envia JWT
- `CHALLENGE` - Servidor envia options
- `CREDENTIAL` - Cliente envia credential
- `SUCCESS` - Enrollment completado
- `PENALTY` - Delay aplicado

**Codigos cierre:** 4401, 4403, 4408

---

## Prioridad

Este modulo es **bloqueante** para:

- session_key real (eliminar MOCK_SESSION_KEY)
- TOTPu real
- Binding de dispositivo

Sin embargo, el flujo de attendance puede probarse completamente con mocks.

---

## Estimacion Total

| Fase | Horas |
|------|-------|
| E-0 Dependencias | 1h |
| E-1 Crypto Services | 4h |
| E-2 Device Repository | 3h |
| E-3 FIDO2 Service | 6h |
| E-4 Start Real | 3h |
| E-5 Finish Real | 5h |
| E-6 Login ECDH | 6h |
| E-7 Penalizaciones | 3h |
| E-8 WebSocket | 5h |
| **Total** | **36h** |

---

## Referencias

- `02-componentes-criptograficos.md` - FIDO2, ECDH, HKDF
- `03-flujo-enrolamiento.md` - Flujo detallado
- `14-decision-totp-session-key.md` - Decision sobre TOTPu
