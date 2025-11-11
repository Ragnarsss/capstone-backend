# PLAN PARTE 4 - Frontend Aplicación Invitado

**Fecha:** 2025-11-04

**Versión:** 2.0

**Estado:** Planificación consolidada

**Duración estimada:** 3-4 días

---

## Índice

1. [Contexto y Objetivos](#contexto-y-objetivos)
2. [Dependencias](#dependencias)
3. [Alcance](#alcance)
4. [Sprint Detallado](#sprint-detallado)
5. [Archivos a Crear](#archivos-a-crear)
6. [Criterios de Aceptación](#criterios-de-aceptación)

---

## Contexto y Objetivos

### Objetivo Principal

Crear aplicación frontend completa para estudiantes, incluyendo enrollment con WebAuthn, escáner QR con cámara y validación de asistencia N rondas.

### Estado Actual

- Sistema: 57% completo
- Frontend Anfitrión: 100% funcional
- Frontend Invitado: 0% (NO EXISTE)
- APIs Backend: Listas (PARTE 2 y 3)

### Independencia

**Depende de PARTE 2 y 3 (APIs backend).** NO depende de PARTE 1 directamente.

---

## Dependencias

### Pre-requisitos

- **PARTE 2 completada:** APIs `/attendance/*`
- **PARTE 3 completada:** APIs `/enrollment/*` + WebSocket
- jsQR library instalada
- Web Crypto API disponible (browser)

### Tecnologías Requeridas

```json
{
  "dependencies": {
    "jsqr": "^1.4.0"
  },
  "browser": {
    "crypto.subtle": "native",
    "navigator.credentials": "WebAuthn API",
    "navigator.mediaDevices": "getUserMedia"
  }
}
```

---

## Alcance

### Incluye

**Estructura Base:**

- HTML responsive mobile-first
- State machine (NO_ENROLLED → ENROLLED → SCANNING → COMPLETED)
- postMessage listener para JWT

**Módulo Enrollment:**

- UI enrollment + WebAuthn integration
- `navigator.credentials.create()`
- ECDH key generation client-side

**Módulo Scanner:**

- Acceso a cámara
- Detección QR con jsQR
- Overlay visual

**Módulo Attendance:**

- Desencriptación QR con session_key
- Lógica N rondas
- Generación TOTPu
- Visualización progreso y resultado

**Shared Utils:**

- Crypto utils (ECDH, AES, TOTP)
- Auth service (reutilizado)
- WebSocket client (reutilizado)

### NO Incluye

- Backend (PARTE 2 y 3)
- Frontend Anfitrión (ya existe)

---

## Sprint Detallado

### Resumen de User Stories

| User Story | Tareas | Estimación | Prioridad |
|------------|--------|------------|-----------|
| 4.1 Estructura Base | 5 | 12h | P0 |
| 4.2 Módulo Enrollment | 6 | 22h | P0 |
| 4.3 Módulo Login ECDH | 5 | 22h | P0 |
| 4.4 Módulo Scanner | 6 | 27h | P0 |
| 4.5 Módulo Attendance | 8 | 34h | P0-P1 |
| 4.6 Integración Completa | 4 | 15h | P0-P1 |
| 4.7 Testing Frontend | 5 | 30h | P1 |
| 4.8 Documentación | 3 | 7h | P2 |

**Total:** 42 tareas, ~169 horas (~4 días para 1 dev full-time)

---

## Archivos a Crear

```bash
node-service/src/frontend/guest/
├── index.html                    # UI principal invitado
├── main.js                       # State machine + orquestación
└── modules/
    ├── enrollment/
    │   ├── enrollment.component.js
    │   ├── enrollment.service.js
    │   └── enrollment.styles.css
    ├── scanner/
    │   ├── scanner.component.js
    │   ├── scanner.service.js
    │   └── scanner.styles.css
    └── attendance/
        ├── attendance.component.js
        ├── attendance.service.js
        └── attendance.styles.css

node-service/src/frontend/shared/
├── styles/
│   └── guest.css                 # Estilos globales
└── utils/
    └── crypto.js                 # ECDH, AES, TOTP
```

---

## State Machine

### Estados Principales

```javascript
const States = {
  INIT: 'INIT',                           // Recibiendo JWT
  NO_ENROLLED: 'NO_ENROLLED',             // Sin dispositivo
  ENROLLING: 'ENROLLING',                 // Proceso enrollment
  ENROLLED: 'ENROLLED',                   // Dispositivo listo
  WAITING_SESSION: 'WAITING_SESSION',     // Esperando sesión
  SCANNING: 'SCANNING',                   // Escaneando QR (N rondas)
  COMPLETED: 'COMPLETED',                 // Resultado final
  ERROR: 'ERROR'                          // Error crítico
};
```

### Transiciones

```text
INIT → NO_ENROLLED (enrollment status = false)
INIT → ENROLLED (enrollment status = true)
NO_ENROLLED → ENROLLING (click "Enrolar")
ENROLLING → ENROLLED (enrollment success)
ENROLLED → SCANNING (sesión activa + register OK)
SCANNING → SCANNING (ronda validada, siguiente)
SCANNING → COMPLETED (todas las rondas completas)
COMPLETED → WAITING_SESSION (nueva sesión)
* → ERROR (errores críticos)
```

---

## Tareas Críticas (P0)

### User Story 4.1: Estructura Base (5 tareas)

**PART4-T4.1.1:** Crear estructura carpetas `frontend/guest`

- Estimación: XS (15min)
- Carpetas: `modules/`, `shared/`

**PART4-T4.1.2:** Crear `index.html` base

- Estimación: S (2h)
- HTML5 responsive con viewport

**PART4-T4.1.3:** Crear `main.js` con state machine

- Estimación: M (6h)
- Estados y transiciones documentadas

**PART4-T4.1.4:** Implementar `postMessage` listener

- Estimación: S (2h)
- Recibe JWT desde PHP, valida origin

**PART4-T4.1.5:** Crear `guest.css` estilos base

- Estimación: S (3h)
- Variables CSS, grid/flexbox, mobile-first

---

#### User Story 4.2

##### Tareas - User Story 4.2

### User Story 4.2: Módulo Enrollment (6 tareas)

**PART4-T4.2.1:** Crear `enrollment.component.js`

- Estimación: M (6h)
- UI enrollment (botones, mensajes, loading)

**PART4-T4.2.2:** Crear `enrollment.service.js`

- Estimación: M (8h)
- Lógica enrollment + API calls

**PART4-T4.2.3:** Integrar `navigator.credentials.create()`

- Estimación: M (6h)
- WebAuthn API, manejo success/cancel/error

**PART4-T4.2.4:** Implementar error handling enrollment

- Estimación: S (3h)
- Mensajes claros por tipo error

**PART4-T4.2.5:** Crear `enrollment.styles.css`

- Estimación: S (2h)
- Responsive, accesible, loading states

**PART4-T4.2.6:** Integrar con state machine

- Estimación: S (3h)
- Transiciones NO_ENROLLED → ENROLLING → ENROLLED

---

#### User Story 4.3

##### Tareas - User Story 4.3

### User Story 4.3: Login ECDH (5 tareas)

**PART4-T4.3.1:** Implementar ECDH key generation en `crypto.js`

- Estimación: M (6h)
- `generateKeyPair()` con `crypto.subtle`
- Curva P-256

**PART4-T4.3.2:** Implementar ECDH derivation en `crypto.js`

- Estimación: M (6h)
- `deriveSharedSecret()` con pubKey servidor
- Deriva session_key idéntico

**PART4-T4.3.3:** Integrar `navigator.credentials.get()` para login

- Estimación: M (5h)
- WebAuthn assertion + ECDH pubKey

**PART4-T4.3.4:** Guardar `session_key` y `TOTPu` en memoria

- Estimación: S (2h)
- Variables memoria (NO localStorage)

**PART4-T4.3.5:** Tests unitarios `crypto.js`

- Estimación: S (4h)
- Coverage > 80%

---

### User Story 4.4: Módulo Scanner (6 tareas)

**PART4-T4.4.1:** Crear `scanner.component.js`

- Estimación: M (6h)
- UI cámara (video element, overlay)

**PART4-T4.4.2:** Crear `scanner.service.js`

- Estimación: M (8h)
- `getUserMedia` + jsQR integration

**PART4-T4.4.3:** Integrar jsQR para detección

- Estimación: M (6h)
- Loop scan 10fps, callback onQR

**PART4-T4.4.4:** Implementar permisos cámara error handling

- Estimación: S (3h)
- `NotAllowedError`, `NotFoundError`

**PART4-T4.4.5:** Crear `scanner.styles.css`

- Estimación: S (3h)
- Fullscreen, overlay, responsive

**PART4-T4.4.6:** Optimizar performance scanning

- Estimación: S (4h)
- Reducir resolución canvas, `requestAnimationFrame`
- <50ms por frame en mobile

---

#### User Story 4.5

##### Tareas - User Story 4.5

### User Story 4.5: Módulo Attendance (8 tareas)

**PART4-T4.5.1:** Crear `attendance.component.js`

- Estimación: M (6h)
- UI progreso, rondas, resultado

**PART4-T4.5.2:** Crear `attendance.service.js`

- Estimación: L (10h)
- Lógica N rondas (register, validate, result)

**PART4-T4.5.3:** Implementar desencriptación QR con `session_key`

- Estimación: M (6h)
- AES-256-GCM decrypt en `crypto.js`

**PART4-T4.5.4:** Implementar generación TOTPu en `crypto.js`

- Estimación: M (5h)
- TOTP compatible con servidor, window 30s

**PART4-T4.5.5:** Implementar lógica N rondas

- Estimación: M (8h)
- Loop: scan → decrypt → validate → next

**PART4-T4.5.6:** Visualización progreso

- Estimación: S (3h)
- Barra, contador, feedback real-time

**PART4-T4.5.7:** Pantalla resultado final

- Estimación: S (3h)
- PRESENTE/AUSENTE + certeza, colores

**PART4-T4.5.8:** Crear `attendance.styles.css`

- Estimación: S (3h)
- Animaciones, responsive

---

#### User Story 4.6

##### Tareas - User Story 4.6

### User Story 4.6: Integración Completa (4 tareas)

**PART4-T4.6.1:** Integrar enrollment → login → attendance en `main.js`

- Estimación: M (6h)
- Orquestación flujo completo

**PART4-T4.6.2:** Error handling global

- Estimación: S (4h)
- Captura errores, mensajes, recovery

**PART4-T4.6.3:** Loading states para todas acciones

- Estimación: S (3h)
- Spinners, mensajes "Procesando..."

**PART4-T4.6.4:** Logs debug (removibles en prod)

- Estimación: S (2h)
- console.log con prefijo [DEBUG]

---

#### User Story 4.7

##### Tareas - User Story 4.7

### User Story 4.7: Testing (5 tareas)

**PART4-T4.7.1:** Setup entorno testing frontend

- Estimación: S (4h)
- Jest + @testing-library/dom

**PART4-T4.7.2:** Tests unitarios `crypto.js`

- Estimación: M (5h)
- ECDH, AES, TOTP
- Coverage > 85%

**PART4-T4.7.3:** Tests integración services

- Estimación: M (6h)
- Mock fetch para API calls

**PART4-T4.7.4:** Tests E2E con Playwright

- Estimación: L (10h)
- Flujo completo enrollment → attendance
- Chrome, Firefox, Safari

**PART4-T4.7.5:** Tests compatibilidad navegadores

- Estimación: M (5h)
- WebAuthn + getUserMedia
- Lista navegadores soportados

---

## Crypto Utils (crypto.js)

### Funciones Principales

```javascript
// ECDH
async function generateKeyPair(): Promise<{publicKey, privateKey}>
async function deriveSharedSecret(privateKey, serverPublicKey): Promise<CryptoKey>
async function deriveSessionKey(sharedSecret): Promise<CryptoKey>

// AES-256-GCM
async function encryptPayload(plaintext, sessionKey): Promise<{ciphertext, iv, tag}>
async function decryptPayload(ciphertext, iv, tag, sessionKey): Promise<plaintext>

// TOTP
function generateTOTP(secret, timestamp): string
function validateTOTP(token, secret, window): boolean

// Utilities
function base64ToArrayBuffer(base64): ArrayBuffer
function arrayBufferToBase64(buffer): string
```

---

## Criterios de Aceptación

1. Aplicación guest carga en iframe
2. Recibe JWT via postMessage
3. Flujo enrollment completo con WebAuthn
4. Escáner QR funcional con acceso cámara
5. Validación N rondas con desencriptación
6. Visualización resultado PRESENTE/AUSENTE
7. Error handling completo
8. Responsive design mobile-first
9. Probado en Firefox, Chrome, Safari
10. Tests E2E pasando
11. Documentación en `README.md`

---

## Navegadores Soportados

| Navegador | WebAuthn | getUserMedia | jsQR | Estado |
|-----------|----------|--------------|------|--------|
| Chrome 90+ | ✓ | ✓ | ✓ | Soportado |
| Firefox 90+ | ✓ | ✓ | ✓ | Soportado |
| Safari 14+ | ✓ | ✓ | ✓ | Soportado |
| Edge 90+ | ✓ | ✓ | ✓ | Soportado |
| Chrome Android | ✓ | ✓ | ✓ | Soportado |
| Safari iOS | ✓ | ✓ | ✓ | Soportado |

---

## Referencias

- [03-flujo-enrolamiento.md](documents/planificacion/03-flujo-enrolamiento.md) - Flujo cliente
- [04-flujo-asistencia.md](documents/planificacion/04-flujo-asistencia.md) - Flujo N rondas
- [12-propuesta-separacion-roles-anfitrion-invitado.md](documents/planificacion/12-propuesta-separacion-roles-anfitrion-invitado.md) - Arquitectura

---

## Estado de Implementación

Ver [documents/planificacion/13-estado-implementacion.md](documents/planificacion/13-estado-implementacion.md) para el estado actualizado de este plan.

**Última actualización:** 2025-11-06

---

**Próximos pasos:** Sprint Planning PARTE 4
