# PLAN PARTE 4 - Frontend Aplicacion Invitado

**Fecha:** 2025-11-04  
**Actualizado:** 2025-11-28  
**Version:** 3.0  
**Estado:** EN PROGRESO (25%)

---

## Resumen de Estado

| Componente | Estado | Notas |
|------------|--------|-------|
| Scanner QR basico | COMPLETADO | Escanea con jsQR |
| UI Camara | COMPLETADO | Overlay visual |
| Descifrado QR | PENDIENTE | Fase 6.1 |
| Manejo de rounds | PENDIENTE | Fase 6.1 |
| UI Enrollment | NO EXISTE | Depende de backend |
| WebAuthn integration | NO EXISTE | Depende de backend |

---

## Arquitectura Actual

```
node-service/src/frontend/
├── index.html                      # Entry point
├── features/
│   ├── attendance/
│   │   ├── camera-view.component.ts   # UI camara
│   │   ├── qr-scan.service.ts         # Logica escaneo
│   │   └── attendance-api.client.ts   # Llamadas API
│   └── enrollment/
│       └── (vacio)
└── shared/
    ├── api/
    │   └── api-client.ts           # HTTP base
    └── crypto/
        └── (vacio - crear en 6.1)
```

---

## Fases de Implementacion

### Fase 6.1: Frontend Crypto + Rounds (SIGUIENTE)

**Objetivo:** Cliente descifra QR, valida round, envia respuesta cifrada

**Archivos a crear:**

```
node-service/src/frontend/shared/crypto/
├── aes-gcm.ts          # Encrypt/decrypt con Web Crypto API
└── mock-keys.ts        # MOCK_SESSION_KEY temporal
```

**Archivos a modificar:**

| Archivo | Cambio |
|---------|--------|
| `qr-scan.service.ts` | Descifrar QR, verificar round, pausar scan |
| `attendance-api.client.ts` | Manejar expectedRound, complete, noMoreAttempts |
| `camera-view.component.ts` | UI progreso rounds (1/3, 2/3, 3/3) |

**Flujo a implementar:**

```
1. Escanear QR (base64 cifrado)
2. Descifrar con session_key
3. Verificar: payload.r === expectedRound
4. Si no es mio o round incorrecto → ignorar, seguir escaneando
5. Si es mio y round correcto:
   - Pausar escaneo
   - Construir response con ts_client
   - Cifrar response
   - POST /validate
   - Recibir expectedRound (siguiente) o complete
   - Actualizar UI
   - Reanudar escaneo si no complete
```

**Estados UI:**

| Estado | Visual |
|--------|--------|
| Escaneando | Overlay verde "Buscando QR..." |
| Procesando | Overlay amarillo "Validando..." |
| Round OK | Overlay verde "1/3 completado" |
| Completo | Modal verde "Asistencia registrada" |
| Sin intentos | Modal rojo "Acercate al profesor" |

**Estimacion:** 4-6 horas

---

### Fase F-1: UI Enrollment

**Objetivo:** Pantalla para registrar dispositivo

**Depende de:** Backend enrollment real (Fase E-3+)

**Componentes:**

```
node-service/src/frontend/features/enrollment/
├── enrollment-view.component.ts    # UI principal
├── enrollment.service.ts           # Logica + API calls
└── enrollment.styles.css           # Estilos
```

**Estados:**

1. `NOT_ENROLLED` - Mostrar boton "Registrar dispositivo"
2. `ENROLLING` - Solicitar biometria/PIN
3. `ENROLLED` - Mostrar "Dispositivo registrado"
4. `ERROR` - Mostrar mensaje de error

---

### Fase F-2: WebAuthn Integration

**Objetivo:** Llamar navigator.credentials.create()

**Depende de:** Backend enrollment real

**Funciones:**

```typescript
// En enrollment.service.ts
async startEnrollment(): Promise<PublicKeyCredentialCreationOptions>
async createCredential(options): Promise<Credential>
async finishEnrollment(credential): Promise<{deviceId}>
```

---

### Fase F-3: ECDH Login Frontend

**Objetivo:** Key exchange al iniciar sesion

**Depende de:** Backend login ECDH

**Funciones:**

```typescript
// En shared/crypto/ecdh.ts
async generateKeyPair(): Promise<CryptoKeyPair>
async deriveSharedSecret(privateKey, serverPublicKey): Promise<CryptoKey>
async deriveSessionKey(sharedSecret): Promise<CryptoKey>
```

**Flujo:**

1. Generar par ECDH efimero
2. Llamar /enrollment/login con pubKey
3. Recibir pubKey servidor
4. Derivar session_key localmente
5. Almacenar en memoria (NO localStorage)

---

## State Machine

```
Estados del cliente:

INIT
  ↓ (recibe JWT via postMessage)
NOT_ENROLLED ──────────────────→ ENROLLING
  ↓ (ya tiene device)              ↓
ENROLLED ←─────────────────────────┘
  ↓ (sesion activa)
SCANNING ←─────────────────────────┐
  ↓ (round validado)               │
  ├── (mas rounds) ────────────────┘
  ↓ (completo)
COMPLETED
  ↓ (cerrar)
INIT
```

---

## Tecnologias

| Tecnologia | Uso | Soporte |
|------------|-----|---------|
| Web Crypto API | AES-GCM, ECDH | Todos los browsers modernos |
| WebAuthn | FIDO2 credentials | Chrome 67+, Firefox 60+, Safari 13+ |
| getUserMedia | Acceso camara | Requiere HTTPS |
| jsQR | Deteccion QR | Libreria pura JS |

---

## Prioridades

1. **Fase 6.1** - Inmediato (desbloquea testing E2E)
2. **Fase F-1/F-2** - Cuando backend enrollment este listo
3. **Fase F-3** - Cuando ECDH login este listo

---

## Estimacion Total

| Fase | Horas | Dependencia |
|------|-------|-------------|
| 6.1 Crypto + Rounds | 4-6h | Ninguna |
| F-1 UI Enrollment | 3h | Backend E-3 |
| F-2 WebAuthn | 4h | Backend E-4, E-5 |
| F-3 ECDH Login | 4h | Backend E-6 |
| **Total** | **15-17h** | |

---

## Referencias

- `flujo-validacion-qr-20251128.md` - Flujo cliente-servidor
- `camera-view.component.ts` - Componente actual
- `qr-scan.service.ts` - Servicio actual
