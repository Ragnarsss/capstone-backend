# Análisis Técnico: Sistema de Asistencia con QR Fragmentado Rotativo

**Fecha:** 2025-10-23
**Versión:** 2.1
**Estado:** Diseño Arquitectónico Detallado - Implementación Específica
**Actualización:** Sistema clarificado con:
- Fragmentación de encoded data únicamente
- Sistema dual TOTP con WebAuthn/FIDO2
- Validación por umbral estadístico (no booleana)
- Arquitectura WebAssembly + PHP
- Encriptación con keys derivadas de handshake

---

## 1. Introducción

### 1.1 Concepto General

Sistema de asistencia que utiliza **códigos QR fragmentados y rotativos** proyectados en pantalla para validar la presencia física de múltiples participantes simultáneamente.

**Principio fundamental:**
Cada usuario recibe al inicio de sesión una representación de la **zona de datos codificados (encoded data)** de su QR personal. El servidor genera un QR "truncado" (en la zona de datos se elimina una porcion) que proyecta en rotación. Solo cuando el usuario combina su porción almacenada con el QR proyectado puede decodificar el mensaje completo.

**Características clave:**

- **Fragmentación de encoded data únicamente**: Solo la región de datos del QR se fragmenta, respetando los patrones funcionales (finder, timing, alignment, format, version info)
- **Distribución en login**: Cada usuario recibe su porción de encoded data al iniciar sesión (representación matricial de puntos negros)
- **QR rotativo "truncado"**: La pantalla proyecta QRs que carecen de la porción de datos del usuario correspondiente
- **Reconstrucción local**: El cliente combina su porción + QR proyectado → decodifica payload encriptado
- **Doble TOTP**:
  - **TOTPu** (Usuario): Token único por sesión-dispositivo, con penalización por cambio de dispositivo
  - **TOTPs** (Servidor): Token temporal por cada QR generado, similar a códigos SMS
- **Validación multi-ronda**: Desde X intentos por sesión, con confirmación progresiva del servidor.

### 1.2 Componentes del Sistema QR

El sistema manipula únicamente la región de **encoded data**, preservando:

```
┌─────────────────────────────────────────────────┐
│ ████████  [Format Info]    ████████             │  ← Finder Pattern (esquina sup-izq)
│ ██    ██                   ██    ██             │
│ ██ ██ ██  [Timing]         ██ ██ ██             │
│ ██ ██ ██                   ██ ██ ██             │
│ ████████                   ████████             │
│          ◀━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ [Version] ┃  ENCODED DATA REGION           ┃  │  ← Solo esta zona se fragmenta
│ [Timing]  ┃  (Esta zona se "lisia")        ┃  │
│           ┃  Usuario tiene copia local     ┃  │
│ [Format]  ┃                                ┃  │
│           ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                                 │
│          ████████         [Alignment]           │  ← Finder Pattern (esquina inf-izq)
│          ██    ██                               │
│          ██ ██ ██                               │
└─────────────────────────────────────────────────┘
```

**Zonas NO modificadas (necesarias para detección y lectura):**
- **Finder Patterns** (3 esquinas): Detección y orientación del QR
- **Timing Patterns**: Sincronización de la matriz de bits
- **Alignment Patterns**: Corrección de distorsión (QR grandes)
- **Format Information**: Nivel de ECC y patrón de máscara
- **Version Information**: Tamaño del QR (versiones ≥7)

### 1.3 Objetivos de Seguridad

1. **Anti-screenshot**: Un QR capturado en foto carece de la zona de datos completa, inútil sin la porción del usuario
2. **Anti-retransmisión**: Sistema dual TOTP (TOTPu + TOTPs) previene reutilización de códigos
3. **Presencia física requerida**: Solo quien esté presente ve la rotación de su QR específico
4. **Anti-compartir sesión**: TOTPu con penalización por cambio de dispositivo desalienta compartir credenciales
5. **Resistencia a colusión**: Cada porción de datos es única por usuario y por sesión
6. **Validación progresiva**: Hasta 3 rondas de validación con confirmación incremental

---

## 2. Arquitectura del Sistema

### 2.1 Flujo de Operación Completo

```text
┌────────────────────────────────────────────────────────────────────┐
│                    FASE 1: LOGIN E INICIALIZACIÓN                   │
└────────────────────────────────────────────────────────────────────┘

Usuario inicia sesión:
├─ Cliente envía: {userId, password, deviceId, TOTPu_handshake}
├─ Servidor valida credenciales
│
├─ Servidor genera TOTPu (único por sesión + dispositivo):
│  ├─ Si es nuevo dispositivo: registra + impone delay (anti-compartir)
│  ├─ TOTPu = TOTP(secret_user, timestamp, deviceId)
│  └─ Almacena: session[userId] = {TOTPu, deviceId, loginTime}
│
└─ Servidor prepara encoded data para el usuario:
   ├─ Genera payload base: {sessionId, classId, timestamp}
   ├─ Crea QR completo: QR_full = QRCode(payload_encriptado)
   ├─ Extrae BitMatrix completa del QR
   ├─ Identifica zona de encoded data (excluyendo finder/timing/etc)
   │
   ├─ Fragmenta SOLO la zona de datos en N partes
   │  └─ encoded_data_region = extractDataRegion(QR_full.modules)
   │
   ├─ Asigna al usuario i su porción de datos:
   │  ├─ user_portion_i = encoded_data_region[user_i_segment]
   │  └─ Envía al cliente: {userId, dataMatrix: user_portion_i, TOTPu}
   │
   └─ Almacena para proyección:
      └─ QR_truncado_i = QR_full SIN user_portion_i


┌────────────────────────────────────────────────────────────────────┐
│              FASE 2: REGISTRO EN SESIÓN DE ASISTENCIA              │
└────────────────────────────────────────────────────────────────────┘

Usuario solicita participar en toma de asistencia:
├─ Cliente envía: {userId, sessionId, TOTPu}
├─ Servidor valida TOTPu y estado de sesión
│
├─ Servidor genera QR específico para este usuario:
│  ├─ Genera TOTPs único para este QR:
│  │  └─ TOTPs = TOTP(secret_session, timestamp, userId)
│  │     (válido por tiempo corto, similar a código SMS)
│  │
│  ├─ Crea payload: {userId, sessionId, TOTPs, timestamp}
│  ├─ Genera QR_full con payload encriptado
│  ├─ Extrae encoded data region
│  ├─ Elimina la porción que corresponde al usuario
│  │  └─ QR_truncado_user_i = QR_full - user_portion_i
│  │
│  └─ Añade a cola de proyección:
│     queue.push({
│       userId: i,
│       qr: QR_truncado_user_i,
│       TOTPs: TOTPs,
│       validUntil: timestamp + 30s
│     })
│
└─ Servidor confirma registro:
   └─ Responde: {status: 'registered', queuePosition: N}


┌────────────────────────────────────────────────────────────────────┐
│                    FASE 3: PROYECCIÓN ROTATIVA                      │
└────────────────────────────────────────────────────────────────────┘

Pantalla proyecta QRs en rotación (intervalo en milisegundos):

Intervalo T (ej: 500ms cada QR)

┌─────────────┐  T  ┌─────────────┐  T  ┌─────────────┐
│ QR_User_1   │ ──→ │ QR_User_2   │ ──→ │ QR_User_3   │
│ (sin datos1)│     │ (sin datos2)│     │ (sin datos3)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ↓                   ↓                   ↓
   User1 lee          User2 lee          User3 lee
   con su            con su             con su
   porción           porción            porción

Ciclo continúa hasta que servidor cierre sesión

Cada QR proyectado contiene:
├─ Finder patterns (completos)
├─ Timing patterns (completos)
├─ Format/Version info (completos)
└─ Encoded data region (INCOMPLETA - falta porción del usuario i)


┌────────────────────────────────────────────────────────────────────┐
│                FASE 4: CAPTURA Y RECONSTRUCCIÓN LOCAL               │
└────────────────────────────────────────────────────────────────────┘

Cada usuario (concurrentemente):
├─ Cliente escanea continuamente (10-15 FPS)
│
├─ Cuando detecta QR:
│  ├─ Captura BitMatrix del QR proyectado
│  ├─ Identifica zona de encoded data
│  ├─ Detecta que le falta una porción (intenta decodificar → falla)
│  │
│  └─ Intenta reconstruir:
│     ├─ Combina: QR_capturado + user_portion_local
│     ├─ Reensambla BitMatrix completa
│     └─ Intenta decodificar
│
├─ Si decodificación exitosa:
│  ├─ Extrae payload_encriptado del QR
│  ├─ Lee: {sessionId, TOTPs, timestamp, ...}
│  │
│  └─ Valida localmente:
│     ├─ sessionId coincide con sesión actual
│     └─ timestamp reciente (<5 segundos del QR proyectado)
│
└─ Si validación local OK:
   └─ Procede a enviar al servidor (Fase 5)


┌────────────────────────────────────────────────────────────────────┐
│                   FASE 5: VALIDACIÓN SERVIDOR                       │
└────────────────────────────────────────────────────────────────────┘

Cliente envía (carga liviana):
{
  userId: 123,
  sessionId: "abc-def",
  TOTPs: "456789",        // Extraído del QR decodificado
  TOTPu: "123456",        // Token de sesión del usuario
  timestamp: 1234567890,  // Momento de captura
  roundNumber: 1          // Ronda actual (1-3)
}

Servidor valida:
├─ ✓ TOTPu válido para esta sesión + deviceId
├─ ✓ TOTPs corresponde al QR proyectado para este userId
├─ ✓ TOTPs no ha sido usado previamente (anti-replay)
├─ ✓ timestamp dentro de ventana válida (<10 segundos)
├─ ✓ sessionId corresponde a sesión activa
├─ ✓ roundNumber es consecutivo (no saltar rondas)
│
├─ Servidor marca: attendanceRound[userId][roundNumber] = true
│
└─ Servidor responde según estado:

   ┌─ Si roundNumber < 3:
   │  └─ {
   │       status: 200,
   │       message: "Round N completed",
   │       nextDataPortion: encoded_data_for_next_round,
   │       roundsRemaining: 3 - N
   │     }
   │
   ├─ Si roundNumber === 3:
   │  └─ {
   │       status: 200,
   │       message: "Attendance completed successfully",
   │       finalConfirmation: true
   │     }
   │
   └─ Si error:
      └─ {
           status: 4XX,
           error: "Invalid TOTPs | TOTPu expired | etc"
         }


┌────────────────────────────────────────────────────────────────────┐
│                  FASE 6: CICLO MULTI-RONDA (x3)                     │
└────────────────────────────────────────────────────────────────────┘

El proceso completo se repite 3 veces:

Ronda 1: Payload A → QR_A_truncado → Validación → Confirmación 1
   ↓ (Si exitosa, servidor envía nueva porción de datos)
Ronda 2: Payload B → QR_B_truncado → Validación → Confirmación 2
   ↓ (Si exitosa, servidor envía nueva porción de datos)
Ronda 3: Payload C → QR_C_truncado → Validación → Confirmación 3
   ↓
Asistencia confirmada ✓

Si alguna ronda falla:
├─ Usuario puede reintentar en el siguiente ciclo de proyección
└─ Después de N intentos fallidos → sesión expira
```

### 2.2 Diagrama de Secuencia Detallado

```
Cliente          Servidor          Pantalla        OtrosClientes
  │                 │                 │                 │
  │─────login──────→│                 │                 │
  │ {userId,pass,   │                 │                 │
  │  deviceId}      │                 │                 │
  │                 │                 │                 │
  │                 ├─ Valida credenciales             │
  │                 ├─ Genera TOTPu(user,device)       │
  │                 ├─ Prepara encoded_data_portion    │
  │                 │                 │                 │
  │←────response────┤                 │                 │
  │ {TOTPu,         │                 │                 │
  │  dataMatrix,    │                 │                 │
  │  sessionId}     │                 │                 │
  │                 │                 │                 │
  │──register───────→│                │                 │
  │ {userId,        │                 │                 │
  │  sessionId,     │                 │                 │
  │  TOTPu}         │                 │                 │
  │                 │                 │                 │
  │                 ├─ Genera TOTPs(session,user)      │
  │                 ├─ Crea QR_truncado_user            │
  │                 ├─ Añade a cola_proyección         │
  │                 │                 │                 │
  │←────queued──────┤                 │                 │
  │ {position: N}   │                 │                 │
  │                 │                 │                 │
  │                 │──start_cycle──→ │                 │
  │                 │                 │                 │
  │                 │         ┌───────┴───────┐         │
  │                 │         │  QR_User_1    │         │
  │                 │         │  (500ms)      │────────→│ scan...
  │                 │         └───────┬───────┘         │ (no match)
  │                 │                 │                 │
  │                 │         ┌───────┴───────┐         │
  │ scan... ←───────────────  │  QR_User_2    │         │
  │ captura! │                │  (MI QR!)     │         │
  │          │                └───────┬───────┘         │
  │          │                        │                 │
  ├─ Combina: dataMatrix + QR_capturado               │
  ├─ Reconstruye BitMatrix completa                    │
  ├─ Decodifica → {sessionId, TOTPs, timestamp}        │
  │                 │                 │                 │
  │──validate──────→│                 │                 │
  │ {userId,        │                 │                 │
  │  sessionId,     │                 │                 │
  │  TOTPs,         │                 │                 │
  │  TOTPu,         │                 │                 │
  │  roundNumber:1} │                 │                 │
  │                 │                 │                 │
  │                 ├─ ✓ TOTPu válido                   │
  │                 ├─ ✓ TOTPs match                    │
  │                 ├─ ✓ No replay                      │
  │                 ├─ ✓ Timestamp OK                   │
  │                 │                 │                 │
  │←────response────┤                 │                 │
  │ {status: 200,   │                 │                 │
  │  message: "R1", │                 │                 │
  │  nextPortion,   │                 │                 │
  │  remaining: 2}  │                 │                 │
  │                 │                 │                 │
  │    [RONDA 2: Repite con nuevo payload]             │
  │                 │                 │                 │
  │    [RONDA 3: Repite con nuevo payload]             │
  │                 │                 │                 │
  │←────final───────┤                 │                 │
  │ {status: 200,   │                 │                 │
  │  message: "OK", │                 │                 │
  │  confirmed}     │                 │                 │
```

### 2.3 Sistema Dual TOTP

El sistema utiliza **dos tipos de TOTP** con propósitos diferentes:

#### 2.3.1 TOTPu (TOTP de Usuario)

**Propósito:** Vincular la sesión al dispositivo del usuario y prevenir compartir credenciales.

**Características:**
```typescript
TOTPu = TOTP(
  secret: hash(userId + password_hash + server_secret),
  timestamp: current_time,
  deviceId: unique_device_fingerprint
)
```

**Propiedades:**
- ✅ **Único por sesión + dispositivo**: Cambiar de dispositivo genera un nuevo TOTPu
- ✅ **Handshake en login**: Cliente y servidor sincronizan el TOTPu al iniciar sesión
- ✅ **Penalización por cambio**: Si se detecta nuevo `deviceId`, se impone delay antes de permitir login
  - Primer cambio: 5 minutos de espera
  - Cambios frecuentes: Incremento exponencial (10min, 30min, 1h, ...)
- ✅ **Válido durante toda la sesión**: No cambia hasta nuevo login
- ✅ **Enviado en cada validación**: Cliente incluye TOTPu en cada request de validación

**Generación de deviceId:**
```typescript
// Cliente (browser/app)
const deviceId = hash(
  navigator.userAgent +
  screen.width + screen.height +
  navigator.hardwareConcurrency +
  Intl.DateTimeFormat().resolvedOptions().timeZone +
  (await getCanvasFingerprint()) +
  localStorage.getItem('persistent_device_uuid') // Si existe
);
```

**Flujo anti-compartir:**
```
Usuario A → Login desde Device1
   ↓
Servidor: Registra (userA, device1, TOTPu_A1)
   ↓
Usuario A → Comparte credenciales con Usuario B
   ↓
Usuario B → Intenta login desde Device2
   ↓
Servidor: Detecta nuevo deviceId
   ↓
Responde: {
  error: "New device detected",
  waitTime: 300, // segundos
  message: "Debes esperar 5 minutos para usar este dispositivo"
}
```

#### 2.3.2 TOTPs (TOTP de Servidor/Sesión)

**Propósito:** Validar que el QR capturado es reciente y no ha sido reusado (anti-replay).

**Características:**
```typescript
TOTPs = TOTP(
  secret: hash(sessionId + userId + roundNumber + server_secret),
  timestamp: qr_generation_time,
  window: 30  // segundos de validez
)
```

**Propiedades:**
- ✅ **Único por QR generado**: Cada QR proyectado tiene su propio TOTPs
- ✅ **Vida corta**: Válido solo por 30 segundos (similar a códigos SMS)
- ✅ **Incluido en payload del QR**: El cliente lo extrae al decodificar
- ✅ **Validación de unicidad**: Servidor marca como usado tras primera validación
- ✅ **Vinculado a ronda**: TOTPs diferente para cada ronda (1, 2, 3)

**Diferencias clave:**

| Aspecto | TOTPu (Usuario) | TOTPs (Servidor) |
|---------|-----------------|------------------|
| **Generado por** | Servidor en login | Servidor por cada QR |
| **Duración** | Toda la sesión | 30 segundos |
| **Propósito** | Vincular usuario-dispositivo | Validar captura reciente |
| **Almacenado** | Cliente (localStorage) | En payload del QR |
| **Cambio** | Solo en nuevo login | Cada QR rotativo |
| **Reutilizable** | Sí (en misma sesión) | No (one-time use) |

**Validación conjunta en servidor:**
```typescript
async function validateAttendance(request: AttendanceRequest): Promise<ValidationResult> {
  const { userId, sessionId, TOTPu, TOTPs, roundNumber, timestamp } = request;

  // 1. Validar TOTPu (sesión del usuario)
  const userSession = sessions.get(userId);
  if (!userSession || userSession.TOTPu !== TOTPu) {
    return { error: 'Invalid session token (TOTPu)' };
  }

  // 2. Validar TOTPs (QR específico)
  const expectedTOTPs = generateTOTPs(sessionId, userId, roundNumber);
  if (TOTPs !== expectedTOTPs) {
    return { error: 'Invalid QR token (TOTPs)' };
  }

  // 3. Verificar que TOTPs no ha sido usado
  if (usedTOTPs.has(TOTPs)) {
    return { error: 'Token already used (replay attack?)' };
  }

  // 4. Verificar ventana de tiempo
  if (Date.now() - timestamp > 10000) { // 10 segundos
    return { error: 'Capture too old' };
  }

  // 5. Marcar como usado
  usedTOTPs.add(TOTPs);

  // 6. Registrar asistencia para esta ronda
  await markAttendanceRound(userId, sessionId, roundNumber);

  return { success: true };
}
```

**Ejemplo de tokens en uso:**
```
Login:
  Usuario 123 desde dispositivo ABC
  → Servidor genera: TOTPu = "485926" (válido toda la sesión)

Ronda 1:
  Servidor genera QR para user 123
  → TOTPs_R1 = "192837" (válido 30 seg)
  → Usuario captura, envía: {userId:123, TOTPu:"485926", TOTPs:"192837"}
  → Servidor valida ambos ✓

Ronda 2 (después de 45 segundos):
  Servidor genera nuevo QR
  → TOTPs_R2 = "847362" (nuevo token, TOTPs_R1 ya expiró)
  → Usuario captura, envía: {userId:123, TOTPu:"485926", TOTPs:"847362"}
  → Servidor valida: TOTPu sigue siendo el mismo ✓, TOTPs es nuevo ✓

Si alguien intenta replay:
  Atacante intercepta: {TOTPu:"485926", TOTPs:"847362"}
  → Intenta reenviar 10 segundos después
  → Servidor rechaza: TOTPs ya fue usado (en usedTOTPs set) ✗
```

---

### 2.4 Precisiones Arquitectónicas de Implementación

#### 2.4.1 Enrolamiento vs Login (Separación Clara)

**Enrolamiento (Primera vez o nuevo dispositivo):**
```
Usuario → Entra credenciales + solicita nuevo dispositivo
   ↓
Servidor:
├─ Valida credenciales
├─ Genera challenge WebAuthn/FIDO2
│  └─ Challenge = crypto.randomBytes(32)
│
└─ Cliente responde con WebAuthn:
   ├─ navigator.credentials.create({ publicKey: options })
   ├─ Genera par de claves (privada en dispositivo, pública al servidor)
   └─ Devuelve credentialId + publicKey + signature

Servidor:
├─ Almacena: {userId, deviceId, credentialId, publicKey, enrolledAt}
├─ Impone delay si ya tiene dispositivos registrados (anti-compartir)
│  └─ Primer dispositivo: 0 min
│  └─ Segundo dispositivo: 5 min
│  └─ Tercer+ dispositivo: 10 min, 30 min, exponencial...
│
└─ Genera handshake_secret:
   └─ handshake = HKDF(credentialId + userId + server_master_secret)

Cliente almacena:
└─ localStorage: {credentialId, enrollmentTimestamp}

❌ NO se envía porción de QR en enrolamiento
```

**Login con Sesión Activa:**
```
Usuario → Ingresa credenciales
   ↓
Cliente:
├─ Recupera credentialId de localStorage
├─ Genera TOTPu = TOTP(handshake, timestamp, credentialId)
│  (usando handshake derivado en enrolamiento)
│
└─ Envía: {userId, credentialId, TOTPu}

Servidor:
├─ Busca handshake_secret asociado a (userId + credentialId)
├─ Regenera TOTPu esperado = TOTP(handshake_server, timestamp)
├─ Compara TOTPu enviado vs esperado
│
├─ Si coincide ✓:
│  └─ Sesión válida, usuario ya identificado
│     └─ Responde: {status: 'authenticated', sessionId}
│
└─ Si NO coincide ✗:
   └─ Forzar re-enrolamiento
      └─ Responde: {error: 'Re-enrollment required', reason: 'TOTP mismatch'}
```

**Login CON inicio de proceso de asistencia:**
```
Usuario → Solicita participar en toma de asistencia
   ↓
Cliente envía: {userId, sessionId, TOTPu}
   ↓
Servidor:
├─ ✓ Valida TOTPu (sesión activa)
├─ ✓ Verifica que sessionId corresponde a clase activa
│
├─ Genera QR específico para este usuario:
│  ├─ Crea payload con TOTPs único
│  ├─ Genera QR completo
│  ├─ Extrae encoded data region
│  └─ Fragmenta y elimina porción del usuario
│
└─ Responde:
   ├─ dataPortionFragment: [...] ← ✅ AQUÍ se envía por primera vez
   ├─ queuePosition: N
   └─ attendanceSessionId: "abc-123"
```

**Key Derivation (HKDF):**
```typescript
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

function deriveHandshakeSecret(credentialId: string, userId: string): string {
  const ikm = Buffer.from(credentialId + userId + SERVER_MASTER_SECRET);
  const info = Buffer.from('attendance-handshake-v1');

  // Derive 32 bytes
  const derivedKey = hkdf(sha256, ikm, undefined, info, 32);

  return Buffer.from(derivedKey).toString('hex');
}
```

#### 2.4.2 Arquitectura de Stack Tecnológico

**Proyección de QRs (Frontend - WebAssembly):**
```
┌─────────────────────────────────────────┐
│   Pantalla de Proyección (Browser)      │
│                                         │
│   ┌───────────────────────────────┐    │
│   │  WebAssembly Module (Rust/C++)│    │
│   │                               │    │
│   │  ├─ Cola de QRs en memoria    │    │
│   │  ├─ Render optimizado         │    │
│   │  ├─ Timing preciso (RAF)      │    │
│   │  └─ Canvas 2D rendering       │    │
│   └───────────────────────────────┘    │
│            ↑                            │
│   WebSocket con servidor PHP            │
│   (recibe QRs pre-renderizados)         │
└─────────────────────────────────────────┘
```

**Backend (PHP):**
```
┌─────────────────────────────────────────┐
│   Servidor PHP (Swoole/ReactPHP)        │
│                                         │
│   ├─ Gestión de usuarios (auth)        │
│   ├─ Enrolamiento WebAuthn             │
│   ├─ Generación de QRs                 │
│   │  └─ lib: bacon/bacon-qr-code       │
│   │                                    │
│   ├─ Fragmentación de encoded data     │
│   ├─ Sistema TOTP dual                 │
│   │  └─ lib: spomky-labs/otphp        │
│   │                                    │
│   ├─ Validación estadística            │
│   └─ Registro de asistencia            │
└─────────────────────────────────────────┘
```

**Biblioteca recomendada para QR en PHP:**
```php
// composer require bacon/bacon-qr-code

use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

$renderer = new ImageRenderer(
    new RendererStyle(400),
    new SvgImageBackEnd()
);
$writer = new Writer($renderer);

// Acceso a BitMatrix
$qrCode = \BaconQrCode\Encoder\Encoder::encode(
    $payload,
    \BaconQrCode\Common\ErrorCorrectionLevel::H(),
    null
);

$matrix = $qrCode->getMatrix(); // BitMatrix
$size = $matrix->getWidth();

// Extraer módulo individual
for ($y = 0; $y < $size; $y++) {
    for ($x = 0; $x < $size; $x++) {
        $bit = $matrix->get($x, $y); // 0 o 1
    }
}
```

#### 2.4.3 Flujo de Captura y Decodificación Inmediata

**Estrategia: Interceptar antes de decodificación fallida**

```typescript
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';

class AttendanceScanner {
  private myDataFragment: Uint8Array;
  private handshakeKey: CryptoKey;
  private TOTPu: string;

  async startScanning() {
    const scanner = new Html5Qrcode('reader');

    await scanner.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: 250 },

      // ❌ NO usar este callback (ya está decodificado)
      (decodedText) => { /* Too late */ },

      // ❌ Error callback tampoco sirve
      (error) => { /* Already failed */ }
    );

    // ✅ SOLUCIÓN: Interceptar a nivel de ImageData antes de jsQR
    this.interceptVideoFrame(scanner);
  }

  private interceptVideoFrame(scanner: Html5Qrcode) {
    // Acceder al canvas interno (hack, depende de implementación)
    const canvas = document.querySelector('#reader canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const processFrame = () => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 1. Intentar decodificar sin modificar (puede ser QR de otro usuario completo)
      let decoded = jsQR(imageData.data, canvas.width, canvas.height);

      if (!decoded) {
        // 2. No se pudo decodificar → probablemente es MI QR (incompleto)
        // Insertar mi fragmento antes de re-intentar
        const reconstructed = this.injectFragment(imageData);
        decoded = jsQR(reconstructed.data, canvas.width, canvas.height);

        if (decoded) {
          // ✅ Éxito! Es mi QR reconstruido
          this.handleMyQR(decoded.data);
        }
      }

      requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  private injectFragment(imageData: ImageData): ImageData {
    // 1. Detectar QR y extraer BitMatrix
    const qrLocation = this.detectQRLocation(imageData);
    if (!qrLocation) return imageData;

    // 2. Extraer módulos actuales
    const currentModules = this.extractModules(imageData, qrLocation);

    // 3. Identificar región faltante (módulos en 0 contiguos)
    const missingRegion = this.findMissingRegion(currentModules);

    // 4. Insertar mi fragmento
    const reconstructed = this.insertMyFragment(
      imageData,
      missingRegion,
      this.myDataFragment
    );

    return reconstructed;
  }

  private async handleMyQR(payload: string) {
    try {
      // Parsear payload del QR
      const qrData = JSON.parse(payload);
      const { sessionId, TOTPs, timestamp } = qrData;

      // Construir mensaje para servidor
      const message = {
        userId: this.userId,
        sessionId,
        TOTPs,
        clientTimestamp: Date.now(),
        qrTimestamp: timestamp
      };

      // Encriptar con key derivada del handshake
      const encrypted = await this.encryptWithHandshake(message);

      // Enviar a servidor (incluye TOTPu en header)
      await fetch('/api/attendance/validate', {
        method: 'POST',
        headers: {
          'X-TOTP-User': this.TOTPu,
          'Content-Type': 'application/octet-stream'
        },
        body: encrypted
      });

    } catch (err) {
      console.error('QR processing failed', err);
    }
  }

  private async encryptWithHandshake(data: any): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));

    // AES-GCM con key derivada del handshake
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.handshakeKey,  // Derivada en enrolamiento/login
      plaintext
    );

    // Retornar: iv + ciphertext
    const result = new Uint8Array(iv.length + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), iv.length);

    return result.buffer;
  }
}
```

#### 2.4.4 Validación por Umbral Estadístico

**Problema:** Tiempos varían según condiciones (servidor lento, red saturada, etc.)

**Solución:** Validación basada en **grado de certeza** en lugar de booleano.

```php
<?php

class AttendanceValidator {
    private const THRESHOLDS = [
        'CONFIRMED' => 0.85,      // 85% certeza → Asistencia confirmada
        'LIKELY' => 0.70,          // 70% certeza → Probablemente presente
        'UNCERTAIN' => 0.50,       // 50% certeza → Incierto
        'UNLIKELY' => 0.30,        // 30% certeza → Probablemente ausente
        'REJECTED' => 0.10         // <10% certeza → Rechazado
    ];

    private const MAX_SCAN_ATTEMPTS = 10; // Máximo de escaneos esperados por usuario
    private const IDEAL_TIME_WINDOW = 30; // Ventana ideal en segundos

    public function calculateAttendanceCertainty(array $events): float {
        $certainty = 0.0;
        $weights = [];

        // Factor 1: Número de escaneos (más escaneos = mayor certeza)
        $scanCount = count($events);
        $scanFactor = min($scanCount / self::MAX_SCAN_ATTEMPTS, 1.0);
        $weights['scan_count'] = $scanFactor * 0.25; // 25% del peso

        // Factor 2: Distribución temporal (escaneos distribuidos = mayor certeza)
        $temporalDistribution = $this->calculateTemporalDistribution($events);
        $weights['temporal'] = $temporalDistribution * 0.20; // 20% del peso

        // Factor 3: Latencia promedio (menor latencia = mayor certeza)
        $avgLatency = $this->calculateAverageLatency($events);
        $latencyFactor = $this->normalizeLatency($avgLatency);
        $weights['latency'] = $latencyFactor * 0.15; // 15% del peso

        // Factor 4: Validación de TOTPs (tokens válidos = mayor certeza)
        $totpsValidationRate = $this->calculateTOTPsValidationRate($events);
        $weights['totps'] = $totpsValidationRate * 0.30; // 30% del peso

        // Factor 5: Consistencia de deviceId (mismo dispositivo = mayor certeza)
        $deviceConsistency = $this->calculateDeviceConsistency($events);
        $weights['device'] = $deviceConsistency * 0.10; // 10% del peso

        // Certeza total
        $certainty = array_sum($weights);

        return min($certainty, 1.0);
    }

    private function calculateTemporalDistribution(array $events): float {
        if (count($events) < 2) return 0.5;

        $timestamps = array_column($events, 'timestamp');
        sort($timestamps);

        $intervals = [];
        for ($i = 1; $i < count($timestamps); $i++) {
            $intervals[] = $timestamps[$i] - $timestamps[$i - 1];
        }

        // Calcular desviación estándar de intervalos
        $mean = array_sum($intervals) / count($intervals);
        $variance = 0;
        foreach ($intervals as $interval) {
            $variance += pow($interval - $mean, 2);
        }
        $stdDev = sqrt($variance / count($intervals));

        // Distribución uniforme → stdDev bajo → mayor certeza
        // Normalizar: stdDev ideal ~1-2 segundos
        $score = 1.0 - min($stdDev / 5.0, 1.0);

        return $score;
    }

    private function calculateAverageLatency(array $events): float {
        $latencies = [];
        foreach ($events as $event) {
            // Latencia = tiempo entre QR mostrado y recepción en servidor
            $latency = $event['serverReceiveTime'] - $event['qrDisplayTime'];
            $latencies[] = $latency;
        }

        return array_sum($latencies) / count($latencies);
    }

    private function normalizeLatency(float $avgLatencyMs): float {
        // Latencia ideal: 100-500ms
        // Latencia aceptable: hasta 2000ms
        // Latencia sospechosa: >5000ms

        if ($avgLatencyMs < 500) {
            return 1.0; // Excelente
        } elseif ($avgLatencyMs < 2000) {
            return 0.8; // Bueno
        } elseif ($avgLatencyMs < 5000) {
            return 0.5; // Aceptable
        } else {
            return 0.2; // Sospechoso (puede ser replay)
        }
    }

    private function calculateTOTPsValidationRate(array $events): float {
        $validCount = 0;
        foreach ($events as $event) {
            if ($event['totpsValid'] === true) {
                $validCount++;
            }
        }

        return $validCount / count($events);
    }

    private function calculateDeviceConsistency(array $events): float {
        $devices = array_unique(array_column($events, 'credentialId'));

        // Un solo dispositivo = consistencia perfecta
        if (count($devices) === 1) {
            return 1.0;
        }

        // Múltiples dispositivos = sospechoso
        return 1.0 / count($devices);
    }

    public function determineAttendanceStatus(float $certainty): string {
        if ($certainty >= self::THRESHOLDS['CONFIRMED']) {
            return 'CONFIRMED';
        } elseif ($certainty >= self::THRESHOLDS['LIKELY']) {
            return 'LIKELY';
        } elseif ($certainty >= self::THRESHOLDS['UNCERTAIN']) {
            return 'UNCERTAIN';
        } elseif ($certainty >= self::THRESHOLDS['UNLIKELY']) {
            return 'UNLIKELY';
        } else {
            return 'REJECTED';
        }
    }

    public function shouldMarkAttendance(float $certainty): bool {
        // Marcar asistencia solo si certeza >= 70%
        return $certainty >= self::THRESHOLDS['LIKELY'];
    }
}

// Uso
$validator = new AttendanceValidator();

$userEvents = [
    ['timestamp' => 1000, 'totpsValid' => true, 'serverReceiveTime' => 1200, 'qrDisplayTime' => 1000, 'credentialId' => 'abc123'],
    ['timestamp' => 3000, 'totpsValid' => true, 'serverReceiveTime' => 3300, 'qrDisplayTime' => 3000, 'credentialId' => 'abc123'],
    ['timestamp' => 5500, 'totpsValid' => true, 'serverReceiveTime' => 5700, 'qrDisplayTime' => 5500, 'credentialId' => 'abc123'],
    // ... más eventos
];

$certainty = $validator->calculateAttendanceCertainty($userEvents);
$status = $validator->determineAttendanceStatus($certainty);

if ($validator->shouldMarkAttendance($certainty)) {
    markAttendance($userId, $sessionId, $certainty, $status);
}
```

**Ejemplo de scoring:**
```
Usuario A (presente, buena conexión):
├─ 8 escaneos / 10 posibles = 0.80 × 0.25 = 0.20
├─ Distribución temporal uniforme = 0.90 × 0.20 = 0.18
├─ Latencia promedio 250ms = 1.00 × 0.15 = 0.15
├─ 100% TOTPs válidos = 1.00 × 0.30 = 0.30
├─ Mismo dispositivo = 1.00 × 0.10 = 0.10
└─ Certeza total = 0.93 → CONFIRMED ✅

Usuario B (presente, conexión lenta):
├─ 5 escaneos / 10 posibles = 0.50 × 0.25 = 0.125
├─ Distribución irregular = 0.60 × 0.20 = 0.12
├─ Latencia promedio 3500ms = 0.50 × 0.15 = 0.075
├─ 100% TOTPs válidos = 1.00 × 0.30 = 0.30
├─ Mismo dispositivo = 1.00 × 0.10 = 0.10
└─ Certeza total = 0.72 → LIKELY ✅

Usuario C (ausente, intento de replay):
├─ 2 escaneos = 0.20 × 0.25 = 0.05
├─ Distribución: N/A = 0.30 × 0.20 = 0.06
├─ Latencia promedio 8000ms = 0.20 × 0.15 = 0.03
├─ 50% TOTPs válidos (mitad replay) = 0.50 × 0.30 = 0.15
├─ Dispositivo inconsistente = 0.50 × 0.10 = 0.05
└─ Certeza total = 0.34 → UNLIKELY ❌
```

#### 2.4.5 Timestamps del Servidor para Anti-Replay

**Problema:** Necesitamos saber cuándo fue exhibido cada QR para validar latencias.

```php
<?php

class QRProjectionManager {
    private $projectionLog = []; // En producción: Redis o base de datos

    public function queueQRForProjection(string $userId, string $qrData, string $totps): void {
        $qrId = uniqid('qr_', true);

        $this->projectionLog[$qrId] = [
            'userId' => $userId,
            'totps' => $totps,
            'qrData' => $qrData,
            'queuedAt' => microtime(true),
            'displayedAt' => null,
            'expiresAt' => time() + 60 // Expira en 60 segundos
        ];

        // Añadir a cola de proyección
        $this->sendToProjectionQueue($qrId, $qrData);
    }

    public function markQRAsDisplayed(string $qrId): void {
        if (isset($this->projectionLog[$qrId])) {
            $this->projectionLog[$qrId]['displayedAt'] = microtime(true);
        }
    }

    public function validateScanTiming(string $totps, float $clientTimestamp): array {
        // Buscar QR por TOTPs
        $qrLog = null;
        foreach ($this->projectionLog as $log) {
            if ($log['totps'] === $totps) {
                $qrLog = $log;
                break;
            }
        }

        if (!$qrLog) {
            return ['valid' => false, 'reason' => 'QR not found or expired'];
        }

        $displayedAt = $qrLog['displayedAt'];
        if (!$displayedAt) {
            return ['valid' => false, 'reason' => 'QR not yet displayed'];
        }

        $serverReceiveTime = microtime(true);
        $latency = ($serverReceiveTime - $displayedAt) * 1000; // ms

        // Validar ventana temporal
        if ($latency < 100) {
            // Demasiado rápido, sospechoso
            return ['valid' => false, 'reason' => 'Suspiciously fast', 'latency' => $latency];
        }

        if ($latency > 10000) {
            // Más de 10 segundos, probablemente replay
            return ['valid' => false, 'reason' => 'Too slow (replay?)', 'latency' => $latency];
        }

        return [
            'valid' => true,
            'latency' => $latency,
            'displayedAt' => $displayedAt,
            'receivedAt' => $serverReceiveTime
        ];
    }
}
```

#### 2.4.6 Criterios de Finalización del Ciclo

El ciclo de proyección continúa hasta que se cumpla **cualquiera** de estas condiciones (XOR lógico):

```php
<?php

class AttendanceSessionManager {
    public function shouldStopProjection(string $sessionId): bool {
        $session = $this->getSession($sessionId);

        // Condición 1: Todos los usuarios registrados completaron validación
        if ($this->allUsersCompleted($session)) {
            return true;
        }

        // Condición 2: Timeout absoluto alcanzado
        $elapsed = time() - $session['startedAt'];
        $maxDuration = $this->calculateMaxDuration($session);

        if ($elapsed > $maxDuration) {
            return true;
        }

        return false;
    }

    private function allUsersCompleted(array $session): bool {
        foreach ($session['participants'] as $userId => $data) {
            if ($data['certainty'] < 0.70) { // Umbral mínimo
                return false; // Al menos uno no completó
            }
        }
        return true;
    }

    private function calculateMaxDuration(array $session): int {
        $numParticipants = count($session['participants']);
        $intervalMs = 500; // ms por QR
        $cyclesNeeded = 3; // 3 rondas de validación

        // Tiempo ideal
        $idealTime = ($numParticipants * $intervalMs / 1000) * $cyclesNeeded;

        // Agregar buffer del 50% para condiciones adversas
        $maxTime = $idealTime * 1.5;

        // Límite absoluto: no más de 2 minutos
        return min($maxTime, 120);
    }
}

// Ejemplos:
// 10 usuarios: (10 * 0.5seg * 3 rondas) * 1.5 = 22.5 seg
// 30 usuarios: (30 * 0.5seg * 3 rondas) * 1.5 = 67.5 seg
// 100 usuarios: (100 * 0.3seg * 3 rondas) * 1.5 = 135 seg → limitado a 120 seg
```

**Re: "100 participantes en menos de 30 segundos"**

Con intervalo de 300ms por QR:
```
100 QRs × 0.3 seg = 30 segundos por ciclo ✅
3 rondas = 90 segundos total

Viable SI:
├─ ✅ Red estable para todos
├─ ✅ Proyector de alta frecuencia (120Hz+)
├─ ✅ QRs pequeños (versión 5-7, ~40x40 módulos)
└─ ⚠️ Cada usuario tiene solo 3 oportunidades de captura

Alternativa para 100+ usuarios:
├─ Dividir en 4 grupos de 25
├─ Proyectar en paralelo en 4 pantallas
└─ Tiempo total = 25 × 0.5seg × 3 = 37.5 seg
```

---

## 3. Análisis de Viabilidad Técnica

### 3.1 Fragmentación de Encoded Data Region

#### 3.1.1 Estrategia: Fragmentar SOLO la región de datos

**✅ SOLUCIÓN:** A diferencia del enfoque problemático de fragmentar toda la matriz, el sistema actual fragmenta **únicamente la región de encoded data**, preservando todos los patrones funcionales.

**Ventajas de este enfoque:**

1. **Patrones de detección intactos**: El QR sigue siendo detectable por escáneres
2. **Timing patterns preservados**: Sincronización correcta de la matriz
3. **Format/Version info completa**: El decoder sabe cómo interpretar el QR
4. **Solo falta el payload**: La estructura es válida, pero los datos están incompletos

#### 3.1.2 Capacidad de Corrección QR (ECC)

Los códigos QR incluyen Reed-Solomon error correction con 4 niveles:

| Nivel ECC | Capacidad de recuperación | Uso típico | Viable para fragmentación |
|-----------|---------------------------|------------|--------------------------|
| L (Low)   | ~7% de datos dañados     | Ambientes limpios | ❌ Muy limitado |
| M (Medium)| ~15% de datos dañados    | Uso general | ⚠️ Solo fragmentos pequeños |
| Q (Quartile)| ~25% de datos dañados  | Ambientes sucios | ✅ Fragmentos medianos (10-15%) |
| **H (High)** | **~30% de datos dañados** | **Crítico** | **✅ Ideal (hasta 20-25%)** |

**Nota crítica:** ECC está diseñado para daño aleatorio, no para eliminación estructurada. Sin embargo, al **preservar los patrones funcionales** y solo fragmentar la data region, el QR proyectado sigue siendo:
- ✅ Detectable por el escáner
- ✅ Interpretable en estructura
- ❌ Indecodificable sin la porción faltante (el objetivo)

#### 3.1.3 Implementación: Extracción de Encoded Data Region

```typescript
import QRCode from 'qrcode';

interface DataRegion {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  modules: boolean[][];
}

function extractEncodedDataRegion(qr: QRCode): DataRegion {
  const size = qr.modules.size;
  const version = qr.version;

  // Calcular áreas ocupadas por patrones funcionales
  const functionalAreas = [
    // Finder patterns (7x7 + quiet zone)
    { x: 0, y: 0, width: 9, height: 9 },           // Top-left
    { x: size - 8, y: 0, width: 8, height: 9 },    // Top-right
    { x: 0, y: size - 8, width: 9, height: 8 },    // Bottom-left

    // Timing patterns
    { x: 6, y: 9, width: 1, height: size - 17 },   // Vertical
    { x: 9, y: 6, width: size - 17, height: 1 },   // Horizontal

    // Alignment patterns (depends on version)
    ...getAlignmentPatterns(version),

    // Format information
    ...getFormatInfoAreas(size),

    // Version information (version >= 7)
    ...(version >= 7 ? getVersionInfoAreas(size) : [])
  ];

  // Extraer solo módulos de la data region
  const dataModules: boolean[][] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Skip si está en área funcional
      if (isInFunctionalArea(x, y, functionalAreas)) {
        continue;
      }

      dataModules.push([x, y, qr.modules.get(x, y)]);
    }
  }

  return {
    startX: 9,  // Después de finder + timing
    startY: 9,
    endX: size - 9,
    endY: size - 9,
    modules: dataModules
  };
}

function fragmentDataRegion(dataRegion: DataRegion, numUsers: number): DataFragment[] {
  const totalModules = dataRegion.modules.length;
  const modulesPerUser = Math.floor(totalModules / numUsers);

  const fragments: DataFragment[] = [];

  for (let i = 0; i < numUsers; i++) {
    const start = i * modulesPerUser;
    const end = i === numUsers - 1 ? totalModules : start + modulesPerUser;

    fragments.push({
      userId: i,
      modules: dataRegion.modules.slice(start, end),
      startIndex: start,
      endIndex: end
    });
  }

  return fragments;
}
```

#### 3.1.4 Reconstrucción en Cliente

```typescript
class QRReconstructor {
  private myDataFragment: boolean[][];

  constructor(fragmentReceived: DataFragment) {
    this.myDataFragment = fragmentReceived.modules;
  }

  attemptReconstruction(capturedQR: BitMatrix): string | null {
    try {
      // 1. Extraer data region del QR capturado
      const capturedDataRegion = extractEncodedDataRegion(capturedQR);

      // 2. Identificar qué porción falta (comparar con matriz llena esperada)
      const missingIndices = this.findMissingIndices(capturedDataRegion);

      // 3. Insertar mi fragmento en los índices faltantes
      const reconstructed = this.insertFragment(
        capturedDataRegion,
        this.myDataFragment,
        missingIndices
      );

      // 4. Generar QR completo con data region reconstruida
      const fullQR = this.rebuildQR(capturedQR, reconstructed);

      // 5. Intentar decodificar
      const decoded = jsQR.decode(fullQR);

      return decoded ? decoded.data : null;

    } catch (err) {
      // No es mi QR o falló la reconstrucción
      return null;
    }
  }

  private findMissingIndices(captured: DataRegion): number[] {
    // Detectar qué módulos están "vacíos" o dañados
    const missing: number[] = [];

    for (let i = 0; i < captured.modules.length; i++) {
      const [x, y, value] = captured.modules[i];

      // Heurística: Si módulo está en 0 y sus vecinos también → probablemente faltante
      if (value === 0 && this.isLikelyClearedRegion(x, y, captured)) {
        missing.push(i);
      }
    }

    return missing;
  }
}
```

**Ventajas de este enfoque:**
- ✅ **QR estructuralmente válido**: Los escáneres lo detectan sin problema
- ✅ **Decodificación imposible sin fragmento**: La data region está incompleta
- ✅ **No depende de ECC**: No intentamos que ECC reconstruya, sino que completamos manualmente
- ✅ **Fragmentos más pequeños**: Solo transmitir data region, no todo el QR

### 3.2 Cálculo de Timing y Sincronización

#### 3.2.1 Escenario: 30 estudiantes en aula

```
Participantes: N = 30
Frames por QR: F = 20 frames
FPS proyección: 30 FPS

Tiempo por QR = F / FPS = 20 / 30 = 0.67 segundos
Tiempo total ciclo = N × (F / FPS) = 30 × 0.67 = 20 segundos

Tiempo de escáner típico:
- html5-qrcode: 10 FPS = 100ms entre capturas
- @zxing/browser: 15 FPS = 67ms entre capturas
- Cámaras móviles: 10-30 FPS variable

Capturas durante ventana de 667ms:
- A 10 FPS: 6-7 intentos de captura
- A 15 FPS: 10 intentos de captura
```

**Conclusión:** Con 20 frames @ 30 FPS, cada estudiante tiene **6-10 oportunidades** de capturar su QR. **Viable** si el QR es legible.

#### 3.2.2 Problema: Sincronización Frame-Escáner

```
Línea de tiempo:

Proyección:  │──QR1──│──QR2──│──QR3──│
               667ms   667ms   667ms

Escáner:     │─scan──│─scan──│─scan──│─scan──│
              100ms   100ms   100ms   100ms

Riesgo:            ↑ Transición ↑
                   Captura corrupta
```

**Mitigación:**
1. **Metadata en QR**: Incluir `{userId: 5, frameId: 123}` para validar captura correcta
2. **Overlap**: Mostrar mismo QR en frames adyacentes (ej: frames 1-25 en lugar de 1-20)
3. **V-Sync**: Sincronizar cambios de QR con refresh rate de proyector

### 3.3 Problemas Identificados

#### Problema 1: ECC insuficiente para fragmentación estructurada

**Severidad:** 🔴 Crítica
**Descripción:** Eliminar 1/N de la matriz probablemente excede la capacidad de ECC, especialmente si afecta zonas funcionales.

**Soluciones propuestas:**
1. **Ofuscación en lugar de eliminación:**
   ```javascript
   // En lugar de destruir:
   matrix[y][x] = 0;  // ❌

   // Ofuscar con XOR reversible:
   matrix[y][x] ^= mask[y][x];  // ✅ Reversible
   ```

2. **Fragmentación de data region únicamente:**
   ```javascript
   // Identificar solo la región de datos (excluyendo patterns)
   const dataRegion = extractDataRegion(qr.modules);
   const fragmented = fragmentDataRegion(dataRegion, N);
   ```

3. **Shamir Secret Sharing en lugar de fragmentación física:**
   ```javascript
   // Dividir el payload (no el QR)
   const shares = shamirSplit(payload, N, threshold=N);
   // Cada QR contiene un share diferente
   ```

#### Problema 2: Complejidad de implementación vs beneficio

**Severidad:** 🟡 Media
**Descripción:** La fragmentación QR añade complejidad técnica significativa. ¿Es necesaria si el payload ya está encriptado?

**Análisis:**
- **Con solo encriptación:** Captura de QR → payload inútil sin clave
- **Con fragmentación:** Captura de QR → payload incompleto + inútil sin clave

**Beneficio marginal:** La fragmentación añade una capa extra, pero la encriptación ya protege el contenido.

#### Problema 3: Escalabilidad con muchos participantes

```
N = 10 participantes  → 6.7 seg/ciclo  ✅ Viable
N = 30 participantes  → 20 seg/ciclo   ✅ Aceptable
N = 50 participantes  → 33 seg/ciclo   ⚠️ Límite
N = 100 participantes → 67 seg/ciclo   ❌ Impráctico
```

---

## 4. Escenarios de Reconstrucción

### 4.1 Escenario A: Fragmentos Pre-distribuidos

**Setup inicial (una vez por sesión):**
```javascript
// Servidor genera QR completo
const qrComplete = QRCode.create(payload_encriptado, { errorCorrectionLevel: 'H' });
const matrix = extractMatrix(qrComplete);

// Fragmentar en N partes
const fragments = [];
for (let i = 0; i < N; i++) {
  const incomplete = matrix.clone();
  const startRow = Math.floor(i * matrix.size / N);
  const endRow = Math.floor((i + 1) * matrix.size / N);

  // Usuario i NO recibe fragmento i
  fragments[i] = {
    userId: i,
    missingFragment: i,
    matrix: incomplete  // Con fragmento i eliminado/ofuscado
  };
}

// Distribuir a cada participante (via WebSocket, email, QR inicial, etc.)
for (let i = 0; i < N; i++) {
  sendToUser(i, fragments[i]);
}
```

**Durante clase (proyección rotativa):**
```javascript
// Proyectar SOLO el fragmento i cada vez
for (let i = 0; i < N; i++) {
  const fragmentQR = generateFragmentQR(matrix, i);
  displayForDuration(fragmentQR, 667); // ms
}
```

**Cliente captura y reconstruye:**
```javascript
// User1 tiene matrix con fragmento_1 faltante
// Captura fragmento_1 de la pantalla
const capturedFragment = scanQR();

// Reconstruir
const complete = myIncompleteMatrix.insertFragment(capturedFragment, 1);
const decoded = jsQR.decode(complete);

// Enviar al servidor
sendAttendance(userId, decoded.data, timestamp);
```

**Ventajas:**
- ✅ QRs proyectados son pequeños (solo un fragmento)
- ✅ Cada participante solo necesita capturar 1 QR
- ✅ Lógica de reconstrucción simple

**Desventajas:**
- ❌ Requiere fase de setup previa
- ❌ Fragmentos deben ser distribuidos de forma segura
- ❌ Si un participante pierde su fragmento, no puede participar

### 4.2 Escenario B: Captura Progresiva

**Sin pre-distribución:**
```javascript
// Cada participante captura N-1 QRs (todos excepto el suyo)
const myFragments = [];

for (let cycle = 0; cycle < N; cycle++) {
  const qr = scanQR();
  const fragmentId = qr.metadata.fragmentId;

  if (fragmentId !== myUserId) {
    myFragments.push(qr);
  }
}

// Cuando llegue MI QR (fragmentId === myUserId)
const myMissingFragment = scanQR();

// Reconstruir con todos los N fragmentos
const complete = reconstructQR([...myFragments, myMissingFragment]);
```

**Ventajas:**
- ✅ No requiere setup previo
- ✅ Todo se captura durante la sesión

**Desventajas:**
- ❌ Cada participante debe estar presente durante TODO el ciclo (N × 667ms)
- ❌ Si se pierde un frame → debe esperar el siguiente ciclo completo
- ❌ Memoria del cliente debe almacenar N-1 fragmentos

---

## 5. Bibliotecas y Herramientas (2024-2025)

### 5.1 Backend (Node.js) - Generación de QR

| Biblioteca | Última actualización | Acceso a matriz | Estrellas GitHub |
|------------|---------------------|-----------------|------------------|
| **qrcode** | 2024-08 | ✅ `.modules.get(x,y)`, `.modules.data` | 7.6k |
| **qr-image** | 2023-05 | ⚠️ Limitado | 1k |
| **node-qrcode** | 2024-08 | ✅ Similar a qrcode | (mismo que qrcode) |

**Recomendación:** `qrcode` (npm: `qrcode`)

```javascript
import QRCode from 'qrcode';

// Generar con acceso a matriz
const qr = await QRCode.create('payload', {
  errorCorrectionLevel: 'H',
  version: 10  // Forzar tamaño específico
});

// Acceder a matriz de bits
const modules = qr.modules;
const size = modules.size;  // ej: 57x57 para versión 10

// Obtener bit individual
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const bit = modules.get(x, y);  // true = oscuro, false = claro
  }
}

// O acceder al array crudo
const rawData = new Uint8Array(modules.data);
```

### 5.2 Frontend - Lectura de QR

| Biblioteca | Última actualización | FPS típico | Tamaño | Estrellas |
|------------|---------------------|------------|--------|-----------|
| **html5-qrcode** | 2024-10 | 10-15 FPS | 150kb | 5k |
| **@zxing/browser** | 2024-11 | 15-20 FPS | 200kb | 1.4k |
| **qr-scanner** | 2024-09 | 10-15 FPS | 35kb | 2.3k |
| **jsQR** | 2023-03 ⚠️ | Manual | 50kb | 3.6k |
| **@undecaf/zbar-wasm** | 2024-06 | 20+ FPS | 100kb | 200 |

**Recomendaciones:**

1. **html5-qrcode** - Mejor para facilidad de uso:
   ```javascript
   import { Html5Qrcode } from "html5-qrcode";

   const scanner = new Html5Qrcode("reader");

   await scanner.start(
     { facingMode: "environment" },
     {
       fps: 15,  // Máximo FPS
       qrbox: { width: 250, height: 250 },
       aspectRatio: 1.0
     },
     (decodedText, decodedResult) => {
       // Se ejecuta en cada detección
       handleQRCode(decodedText);
     }
   );
   ```

2. **@zxing/browser** - Mejor para TypeScript y rendimiento:
   ```typescript
   import { BrowserMultiFormatReader } from '@zxing/browser';

   const reader = new BrowserMultiFormatReader();

   await reader.decodeFromVideoDevice(
     undefined,  // Cámara por defecto
     'video',
     (result, error) => {
       if (result) {
         const text = result.getText();
         handleQRCode(text);
       }
     }
   );
   ```

3. **qr-scanner** - Mejor para ligereza (35kb):
   ```javascript
   import QrScanner from 'qr-scanner';

   const scanner = new QrScanner(
     videoElement,
     result => handleQRCode(result.data),
     {
       returnDetailedScanResult: true,
       highlightScanRegion: true
     }
   );

   await scanner.start();
   ```

### 5.3 Manipulación de Matriz

**Para fragmentación y reconstrucción:**

```typescript
// Usar canvas nativo o librería de procesamiento de imágenes
import { PNG } from 'pngjs';
import { createCanvas } from 'canvas';

class QRFragmenter {
  constructor(private qrModules: BitMatrix) {}

  createFragment(userId: number, totalUsers: number): BitMatrix {
    const fragHeight = Math.floor(this.qrModules.size / totalUsers);
    const startRow = userId * fragHeight;
    const endRow = Math.min(startRow + fragHeight, this.qrModules.size);

    const fragment = this.qrModules.clone();

    // Ofuscar región (XOR en lugar de eliminar)
    for (let y = startRow; y < endRow; y++) {
      for (let x = 0; x < fragment.size; x++) {
        if (this.isDataRegion(x, y)) {  // Evitar zonas funcionales
          fragment.set(x, y, fragment.get(x, y) ^ 1);  // Invertir bit
        }
      }
    }

    return fragment;
  }

  isDataRegion(x: number, y: number): boolean {
    // Implementar lógica para detectar si (x,y) está en data region
    // y no en position/timing/alignment patterns
    // (Requiere conocer especificación QR según versión)
    return true;  // Simplificado
  }
}
```

---

## 6. Arquitectura Alternativa: Híbrida WebSocket + QR

### 6.1 Motivación

Combinar las ventajas de:
- **WebSocket**: Distribución confiable de fragmentos
- **QR rotativo**: Validación de presencia física temporal

### 6.2 Flujo Propuesto

```
┌─────────────────────────────────────────────────────────────┐
│                  FASE 1: SETUP VIA WEBSOCKET                 │
└─────────────────────────────────────────────────────────────┘

Estudiante abre app → Conecta WebSocket al servidor

Servidor envía:
{
  type: 'setup',
  sessionId: 'MATH101_2025-10-23_10:00',
  fragmentsComplete: [...N-1 fragmentos...],  // Todos excepto el suyo
  missingFragmentId: 5,  // El que debe capturar
  metadata: { ... }
}

Cliente almacena en memoria (NO persiste)


┌─────────────────────────────────────────────────────────────┐
│            FASE 2: PROYECCIÓN QR SIMPLE (CHALLENGE)          │
└─────────────────────────────────────────────────────────────┘

Pantalla proyecta QRs rotativos con SOLO metadata:

QR_1: { fragmentId: 1, sessionId: '...', nonce: 'abc123', timestamp: ... }
QR_2: { fragmentId: 2, sessionId: '...', nonce: 'def456', timestamp: ... }
...

NO contienen fragmentos pesados, solo tokens de validación


┌─────────────────────────────────────────────────────────────┐
│              FASE 3: CAPTURA Y VALIDACIÓN                    │
└─────────────────────────────────────────────────────────────┘

Estudiante escanea QR → Detecta que fragmentId === suyo

Cliente envía vía WebSocket:
{
  type: 'attendance',
  userId: 5,
  sessionId: '...',
  nonce: 'abc123',  // Del QR escaneado
  timestamp: Date.now(),
  signature: HMAC(userId + sessionId + nonce, secret)
}

Servidor valida:
- ✓ nonce no reutilizado
- ✓ timestamp reciente (<5 seg)
- ✓ signature correcta
- ✓ sessionId válido
→ Marca asistencia
```

### 6.3 Comparativa: QR Puro vs Híbrida

| Aspecto | QR Fragmentado Puro | Híbrida (WS + QR) |
|---------|---------------------|-------------------|
| **Complejidad técnica** | 🔴 Alta (ECC, sincronización) | 🟢 Media |
| **Dependencia red** | 🟢 Solo para validación final | 🟡 Setup + validación |
| **Tamaño QR proyectado** | 🔴 Grande (fragmentos completos) | 🟢 Pequeño (solo metadata) |
| **Confiabilidad captura** | 🟡 Depende de ECC | 🟢 Alta (QR simple) |
| **Resistencia offline** | 🟢 Funciona sin red durante captura | 🔴 Requiere red para setup |
| **Escalabilidad** | 🟡 Limitada (N×667ms) | 🟢 Mejor (QRs más rápidos) |
| **Seguridad vs screenshot** | 🟢 Alta (fragmentación física) | 🟡 Media (depende de nonce temporal) |

### 6.4 Implementación Híbrida (Código Ejemplo)

**Backend (Fastify + WebSocket):**

```typescript
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import crypto from 'crypto';

const app = Fastify();
app.register(fastifyWebsocket);

interface Session {
  sessionId: string;
  participants: Map<number, WebSocket>;
  usedNonces: Set<string>;
  activeUntil: number;
}

const activeSessions = new Map<string, Session>();

// Iniciar sesión de asistencia
app.post('/api/attendance/start', async (req, reply) => {
  const { classId, expectedParticipants } = req.body;

  const sessionId = `${classId}_${Date.now()}`;
  const session: Session = {
    sessionId,
    participants: new Map(),
    usedNonces: new Set(),
    activeUntil: Date.now() + (5 * 60 * 1000)  // 5 minutos
  };

  activeSessions.set(sessionId, session);

  // Generar sequence de nonces para los QRs rotativos
  const nonces = Array.from({ length: expectedParticipants }, () =>
    crypto.randomBytes(8).toString('hex')
  );

  return { sessionId, nonces };
});

// WebSocket para participantes
app.get('/ws/attendance/:sessionId', { websocket: true }, (socket, req) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    socket.close(4404, 'Session not found');
    return;
  }

  socket.on('message', async (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'register') {
      // Usuario se registra en la sesión
      const { userId } = data;
      session.participants.set(userId, socket);

      // Enviar fragmentos (simulado - en real, enviarías fragmentos reales)
      socket.send(JSON.stringify({
        type: 'setup',
        sessionId,
        missingFragmentId: userId,
        message: 'Setup complete. Scan QR when your fragmentId appears.'
      }));
    }

    if (data.type === 'attendance') {
      // Validar captura de QR
      const { userId, nonce, timestamp, signature } = data;

      // Validaciones
      if (session.usedNonces.has(nonce)) {
        socket.send(JSON.stringify({ error: 'Nonce already used (replay attack?)' }));
        return;
      }

      if (Math.abs(Date.now() - timestamp) > 5000) {
        socket.send(JSON.stringify({ error: 'Timestamp too old' }));
        return;
      }

      // Validar signature (HMAC)
      const expectedSig = crypto
        .createHmac('sha256', process.env.SECRET_KEY!)
        .update(`${userId}${sessionId}${nonce}${timestamp}`)
        .digest('hex');

      if (signature !== expectedSig) {
        socket.send(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      // Marcar asistencia
      session.usedNonces.add(nonce);
      await db.attendance.create({
        userId,
        sessionId,
        timestamp: Date.now()
      });

      socket.send(JSON.stringify({
        success: true,
        message: 'Attendance recorded successfully'
      }));
    }
  });
});
```

**Frontend (Cliente Estudiante):**

```typescript
import { Html5Qrcode } from 'html5-qrcode';
import crypto from 'crypto-js';

class AttendanceClient {
  private ws: WebSocket;
  private scanner: Html5Qrcode;
  private myFragmentId: number;
  private sessionId: string;

  async connect(sessionId: string, userId: number) {
    this.ws = new WebSocket(`ws://server/ws/attendance/${sessionId}`);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        type: 'register',
        userId
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'setup') {
        this.sessionId = data.sessionId;
        this.myFragmentId = data.missingFragmentId;
        this.startScanning();
      }

      if (data.success) {
        this.showSuccess('¡Asistencia registrada!');
        this.stopScanning();
      }

      if (data.error) {
        this.showError(data.error);
      }
    };
  }

  async startScanning() {
    this.scanner = new Html5Qrcode('reader');

    await this.scanner.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: 250 },
      (qrText) => {
        try {
          const qrData = JSON.parse(qrText);

          // Verificar si es MI fragmento
          if (qrData.fragmentId === this.myFragmentId) {
            this.submitAttendance(qrData);
          }
        } catch (err) {
          console.error('Invalid QR data', err);
        }
      }
    );
  }

  submitAttendance(qrData: any) {
    const timestamp = Date.now();
    const signature = CryptoJS.HmacSHA256(
      `${this.userId}${this.sessionId}${qrData.nonce}${timestamp}`,
      SECRET_KEY
    ).toString();

    this.ws.send(JSON.stringify({
      type: 'attendance',
      userId: this.userId,
      nonce: qrData.nonce,
      timestamp,
      signature
    }));
  }

  async stopScanning() {
    await this.scanner.stop();
  }
}
```

**Pantalla de Proyección:**

```typescript
import QRCode from 'qrcode';

class AttendanceProjector {
  private nonces: string[];
  private currentIndex = 0;
  private intervalId: any;

  constructor(private sessionId: string) {}

  async start(nonces: string[]) {
    this.nonces = nonces;
    this.projectNext();

    // Rotar cada 500ms
    this.intervalId = setInterval(() => {
      this.projectNext();
    }, 500);
  }

  async projectNext() {
    const fragmentId = this.currentIndex;
    const nonce = this.nonces[this.currentIndex];

    const qrData = JSON.stringify({
      fragmentId,
      sessionId: this.sessionId,
      nonce,
      timestamp: Date.now()
    });

    // Generar y mostrar QR
    const canvas = await QRCode.toCanvas(qrData, {
      errorCorrectionLevel: 'H',
      width: 400
    });

    document.getElementById('projector').innerHTML = '';
    document.getElementById('projector').appendChild(canvas);

    // Mostrar info para debug
    document.getElementById('info').textContent =
      `Fragment ${fragmentId + 1}/${this.nonces.length}`;

    this.currentIndex = (this.currentIndex + 1) % this.nonces.length;
  }

  stop() {
    clearInterval(this.intervalId);
  }
}

// Uso
const projector = new AttendanceProjector(sessionId);
await projector.start(noncesFromServer);
```

---

## 7. Preguntas Críticas Pendientes de Diseño

Antes de implementar, se deben responder:

### 7.1 Distribución de Fragmentos

**¿Cómo reciben los estudiantes sus fragmentos iniciales?**

**Opciones:**

A. **Registro previo offline** (más seguro)
   - Distribuir en sesión anterior o vía email encriptado
   - Estudiante carga fragmento al inicio de clase
   - ✅ No requiere red durante setup
   - ❌ Complejidad logística

B. **Al inicio de cada clase via WebSocket** (más práctico)
   - Estudiante conecta → recibe fragmentos
   - ✅ Simple, automático
   - ❌ Requiere red confiable

C. **QR inicial de setup** (híbrido)
   - Primer QR proyectado contiene fragmentos para todos
   - Cada uno extrae el suyo
   - ✅ No requiere red
   - ❌ QR muy grande (mucha información)

**Recomendación:** Opción B (WebSocket) para MVP, migrar a A si se requiere mayor seguridad.

### 7.2 Naturaleza de los Fragmentos

**¿Los fragmentos son estáticos o dinámicos por sesión?**

**Opciones:**

A. **Estáticos** (mismo fragmento faltante siempre)
   - User1 siempre le falta fragmento_1
   - ✅ Más simple
   - ❌ Menos seguro (colusión a largo plazo)

B. **Dinámicos** (fragmento aleatorio por sesión)
   - En sesión 1: User1 le falta fragmento_3
   - En sesión 2: User1 le falta fragmento_7
   - ✅ Más seguro
   - ❌ Más complejo

**Recomendación:** Dinámicos para mayor seguridad.

### 7.3 Payload Encriptado

**¿El payload es el mismo para todos los QRs?**

**Opciones:**

A. **Payload único** (todos reconstruyen el mismo dato)
   - Ejemplo: `AES("MATH101_2025-10-23_10:00", key_servidor)`
   - ✅ Simple
   - ⚠️ Si un usuario reconstruye, puede compartir

B. **Payload personalizado** (cada usuario reconstruye dato diferente)
   - User1: `AES("MATH101_session123_user1", key_1)`
   - User2: `AES("MATH101_session123_user2", key_2)`
   - ✅ Máxima seguridad
   - ❌ Cada QR proyectado debe ser diferente (inviable)

**Recomendación:** Payload único + validación servidor con userId.

### 7.4 Manejo de Fallos

**¿Qué pasa si un estudiante NO captura su QR en el ciclo?**

**Opciones:**

A. **Ciclo infinito** hasta que servidor cierre sesión
   - ✅ Todos eventualmente lo logran
   - ❌ Puede tomar mucho tiempo

B. **N ciclos máximos** (ej: 3 repeticiones)
   - Después de 3 ciclos → sesión termina
   - ✅ Tiempo acotado
   - ❌ Algunos pueden quedar sin marcar

C. **Modo catch-up** via WebSocket
   - Si fallan QR visual → opción de validación alternativa
   - ✅ No deja a nadie afuera
   - ❌ Abre vector de ataque (bypass del QR)

**Recomendación:** Opción A con timeout absoluto (ej: 5 minutos).

### 7.5 Escalabilidad

**¿Cuántos estudiantes simultáneos se esperan?**

**Análisis:**

| Estudiantes | Tiempo/ciclo @ 500ms/QR | Viabilidad |
|-------------|-------------------------|------------|
| 10          | 5 segundos              | ✅ Óptimo |
| 30          | 15 segundos             | ✅ Bueno |
| 50          | 25 segundos             | ⚠️ Aceptable |
| 100         | 50 segundos             | ❌ Problemático |
| 200+        | >100 segundos           | ❌ Inviable |

**Mitigación para clases grandes:**

1. **Dividir en grupos**: Proyectar 2-4 QRs simultáneos en diferentes zonas del aula
2. **Reducir duración**: 200ms/QR en lugar de 500ms (riesgo: menos capturas)
3. **Proyección paralela**: Múltiples proyectores/pantallas

---

## 8. Consideraciones de Seguridad

### 8.1 Vectores de Ataque y Mitigaciones

#### Ataque 1: Screenshot y retransmisión

**Vector:**
- Estudiante A toma foto del QR
- Envía a Estudiante B (remoto)
- B intenta marcar asistencia

**Mitigación:**
- ✅ **Nonce de un solo uso**: Servidor marca nonce como usado
- ✅ **Timestamp corto**: Ventana de 5 segundos
- ✅ **Fragmentación**: B no tiene el fragmento correcto (si usa QR puro)

**Nivel de protección:** 🟢 Alto (con fragmentación) / 🟡 Medio (solo temporal)

#### Ataque 2: Colusión entre estudiantes

**Vector:**
- Estudiantes comparten sus fragmentos
- Uno de ellos reconstruye todos los QRs

**Mitigación:**
- ⚠️ **Difícil de prevenir** si los fragmentos son estáticos
- ✅ **Fragmentos dinámicos por sesión** complica la colusión
- ✅ **Validación servidor de userId único por nonce**

**Nivel de protección:** 🟡 Medio

#### Ataque 3: Grabación de video de la proyección

**Vector:**
- Grabar video completo del ciclo de QRs
- Reproducir offline para extraer todos los fragmentos

**Mitigación:**
- ⚠️ **No prevenible con QR puro**
- ✅ **Requiere setup de fragmentos inicial** (Escenario A)
  - Sin los fragmentos pre-distribuidos, el video es inútil
- ✅ **Challenge-response adicional** via WebSocket

**Nivel de protección:** 🟡 Medio (depende del modelo de distribución)

#### Ataque 4: Bypass con geolocalización falsa

**Vector:**
- Spoofing de GPS con app/root
- Marcar asistencia desde lejos

**Mitigación:**
- ❌ **Geolocalización NO es confiable**
  - GPS indoor es impreciso (error de 10-50m)
  - Fácil de falsificar con mock location
- ✅ **QR visual es mejor indicador de presencia física**
  - Requiere ver la pantalla con sus propios ojos

**Conclusión:** QR visual > Geolocalización para presencia física

### 8.2 Encriptación Adicional del Payload

**Esquema recomendado:**

```typescript
// Servidor genera payload
const sessionData = {
  classId: 'MATH101',
  sessionId: crypto.randomUUID(),
  timestamp: Date.now(),
  validUntil: Date.now() + (5 * 60 * 1000)
};

// Encriptar con AES-256-GCM
const encrypted = encryptAES256(
  JSON.stringify(sessionData),
  SERVER_SECRET_KEY,
  nonce  // IV único por sesión
);

// Generar QR con payload encriptado
const qrPayload = {
  data: encrypted,
  iv: nonce
};

// Cliente decodifica QR → obtiene payload encriptado
// PERO: ¿Cómo obtiene la clave para desencriptar?
```

**Problema:** Si el cliente necesita desencriptar, debe tener la clave. Opciones:

A. **Cliente NO desencripta, envía payload crudo al servidor**
   ```typescript
   // Cliente solo envía lo que leyó
   sendToServer({
     userId,
     encryptedPayload: qrData.data,
     iv: qrData.iv
   });

   // Servidor desencripta y valida
   const decrypted = decryptAES256(encryptedPayload, SERVER_SECRET_KEY, iv);
   if (decrypted.sessionId === currentSession) {
     markAttendance(userId);
   }
   ```
   ✅ **Más seguro**: Cliente nunca ve el payload real

B. **Clave distribuida via WebSocket en setup**
   ```typescript
   // En fase de setup
   ws.send({
     type: 'setup',
     sessionKey: derivedKey  // Derivada de USER_SECRET + SESSION_ID
   });

   // Cliente desencripta localmente
   const decrypted = decryptAES256(qrData.data, sessionKey, qrData.iv);
   ```
   ⚠️ **Menos seguro**: Cliente puede leer el payload

**Recomendación:** Opción A (cliente envía payload crudo, servidor valida).

---

## 9. Proof of Concept (POC) Sugerido

### 9.1 Objetivos del POC

1. **Validar fragmentación con ECC**
   - ¿Un QR con 20% de datos eliminados es legible con ECC H?
   - ¿Cuál es el máximo de fragmentación viable?

2. **Medir timing real**
   - ¿Cuántos FPS logra un escáner típico?
   - ¿500ms es suficiente para captura confiable?

3. **Probar reconstrucción**
   - ¿jsQR puede decodificar un QR reconstruido desde fragmentos?

### 9.2 Plan de POC (Fase 1: Validación Técnica)

```typescript
// POC 1: Fragmentación y ECC
import QRCode from 'qrcode';
import jsQR from 'jsqr';

async function testFragmentation() {
  const payload = 'MATH101_SESSION_2025-10-23_SECRET_DATA_12345';

  // Generar QR con ECC H
  const qr = await QRCode.create(payload, {
    errorCorrectionLevel: 'H',
    version: 10
  });

  console.log(`QR size: ${qr.modules.size}x${qr.modules.size}`);

  // Test 1: Eliminar 10% (zona de datos)
  const damaged10 = damageDataRegion(qr.modules, 0.10);
  const decoded10 = await decodeQR(damaged10);
  console.log(`10% damage: ${decoded10 ? 'SUCCESS' : 'FAILED'}`);

  // Test 2: Eliminar 20%
  const damaged20 = damageDataRegion(qr.modules, 0.20);
  const decoded20 = await decodeQR(damaged20);
  console.log(`20% damage: ${decoded20 ? 'SUCCESS' : 'FAILED'}`);

  // Test 3: Eliminar 30%
  const damaged30 = damageDataRegion(qr.modules, 0.30);
  const decoded30 = await decodeQR(damaged30);
  console.log(`30% damage: ${decoded30 ? 'SUCCESS' : 'FAILED'}`);
}

function damageDataRegion(modules: BitMatrix, percentage: number): BitMatrix {
  // Implementar lógica para dañar solo data region
  // Evitando position/timing/alignment patterns
  const damaged = modules.clone();
  const startRow = Math.floor(modules.size * 0.2);  // Evitar top
  const endRow = startRow + Math.floor(modules.size * percentage);

  for (let y = startRow; y < endRow; y++) {
    for (let x = 0; x < modules.size; x++) {
      damaged.set(x, y, 0);  // Eliminar
    }
  }

  return damaged;
}
```

**Resultados esperados:**
- 10% damage: ✅ Debería funcionar
- 20% damage: ⚠️ Puede funcionar (depende de la zona)
- 30% damage: ❌ Probablemente falle

**Si falla:** Considerar arquitectura híbrida en lugar de fragmentación QR pura.

### 9.3 Plan de POC (Fase 2: Sistema Completo Simplificado)

**Arquitectura simplificada para testing:**

```
3 estudiantes
Fragmentación: 33% cada uno (borde de ECC H)
Proyección: 1 segundo por QR
Validación: WebSocket simple
```

**Componentes:**

1. **Server (Node.js)**
   - Genera 1 QR completo
   - Fragmenta en 3 partes
   - Proyecta vía HTML cada 1 segundo
   - Valida recepción via WebSocket

2. **Client (HTML + JavaScript)**
   - Escanea con html5-qrcode
   - Detecta su fragmentId
   - Reconstruye (simplificado)
   - Envía a servidor

3. **Projector (HTML fullscreen)**
   - Rota QRs cada 1 segundo
   - Muestra QR grande (500x500px)

**Métricas a recolectar:**
- Tasa de éxito de captura (%)
- Tiempo promedio hasta captura exitosa
- Tasa de decodificación tras reconstrucción (%)
- Latencia total (proyección → validación)

---

## 10. Conclusiones y Recomendaciones

### 10.1 Viabilidad del Sistema QR Fragmentado Puro

**Valoración general:** 🟡 **Viable con limitaciones**

**Factores críticos:**

1. ✅ **Fragmentación es técnicamente posible** con QR ECC H
2. ⚠️ **Requiere cuidado en implementación** (evitar zonas funcionales)
3. ⚠️ **Escalabilidad limitada** a ~30-50 participantes
4. 🔴 **Complejidad alta** vs beneficio marginal sobre encriptación simple

### 10.2 Recomendación: Arquitectura Híbrida

**Para un sistema robusto y escalable:**

1. **Setup via WebSocket**: Distribución de fragmentos (o claves)
2. **QR temporal simple**: Solo metadata + nonce (no fragmentos pesados)
3. **Validación servidor**: Con timestamp + nonce único
4. **Encriptación payload**: Como capa adicional

**Ventajas:**
- ✅ QRs más simples → mayor tasa de lectura
- ✅ Escalable a 100+ participantes (QRs más rápidos)
- ✅ Menor dependencia de ECC crítico
- ✅ Más fácil de implementar y mantener

**Compromiso:**
- ⚠️ Requiere conexión de red para setup
- ⚠️ Menor "pureza" del concepto de fragmentación física

### 10.3 Próximos Pasos

1. **Implementar POC de fragmentación** (Fase 1)
   - Validar viabilidad técnica de ECC con daño estructurado
   - Determinar porcentaje máximo de fragmentación viable

2. **Si POC exitoso:**
   - Diseñar esquema de fragmentación que respete zonas funcionales QR
   - Implementar sistema completo con 5-10 usuarios de prueba

3. **Si POC falla o resulta impracticable:**
   - Implementar arquitectura híbrida (WebSocket + QR temporal)
   - Mantener concepto de "fragmentación lógica" sin depender de ECC físico

4. **Testing en condiciones reales:**
   - Diferentes proyectores (60Hz, 120Hz)
   - Diferentes dispositivos móviles (gama baja, alta)
   - Diferentes condiciones de iluminación

---

## 11. Referencias y Recursos

### 11.1 Especificaciones QR

- **ISO/IEC 18004:2015** - QR Code bar code symbology specification
- **Reed-Solomon Error Correction** - Tutorial: https://en.wikiversity.org/wiki/Reed%E2%80%93Solomon_codes_for_coders

### 11.2 Bibliotecas (npm)

```json
{
  "dependencies": {
    "qrcode": "^1.5.4",
    "jsqr": "^1.4.0",
    "html5-qrcode": "^2.3.8",
    "@zxing/browser": "^0.1.5",
    "qr-scanner": "^1.4.2",
    "fastify": "^4.28.0",
    "@fastify/websocket": "^10.0.1"
  }
}
```

### 11.3 Artículos y Papers

- **"QR Code Security: Attacks and Countermeasures"** - IEEE 2023
- **"Shamir Secret Sharing for Multi-factor Authentication"** - Cryptology ePrint Archive

### 11.4 Repositorios de Referencia

- https://github.com/cozmo/jsQR - Decodificador QR puro JS
- https://github.com/soldair/node-qrcode - Generador QR Node.js
- https://github.com/mebjas/html5-qrcode - Escáner QR HTML5

---

## Anexo A: Resumen Ejecutivo del Sistema

### Arquitectura Final Clarificada

**Componentes del QR:**
- ✅ **Finder patterns** - Preservados (necesarios para detección)
- ✅ **Version info** - Preservada (identifica tamaño del QR)
- ✅ **Format info** - Preservada (indica nivel ECC y máscara)
- ✅ **Timing patterns** - Preservados (sincronización de lectura)
- ✅ **Alignment patterns** - Preservados (corrección de distorsión)
- 🔴 **Encoded data** - **FRAGMENTADA** (única zona modificada)

**Flujo de Operación:**

1. **Login**: Usuario recibe su porción de encoded data (matriz de puntos negros)
2. **Solicitud**: Usuario pide participar → servidor genera QR "truncado" con TOTPs
3. **Proyección**: Pantalla rota QRs cada ~500ms (intervalo configurable)
4. **Captura**: Usuario detecta su QR → combina con su porción → decodifica
5. **Validación**: Usuario envía {TOTPu, TOTPs, payload} → servidor valida
6. **Confirmación**: Servidor responde con estado:
   - Si ronda < 3: Envía nueva porción de datos para siguiente ronda
   - Si ronda = 3: Asistencia confirmada ✅
   - Si error: Código de error específico

**Sistema Dual TOTP:**

| Token | Propósito | Duración | Generado | Reutilizable |
|-------|-----------|----------|----------|--------------|
| **TOTPu** | Vincular sesión-dispositivo | Toda la sesión | En login | Sí (misma sesión) |
| **TOTPs** | Validar QR específico | 30 segundos | Por cada QR | No (one-time) |

**Seguridad Multi-capa:**

1. **Capa 1 - Fragmentación física**: QR incompleto sin la porción del usuario
2. **Capa 2 - TOTPu**: Vincula usuario a dispositivo, penaliza cambios
3. **Capa 3 - TOTPs**: Token temporal por QR, previene replay
4. **Capa 4 - Encriptación**: Payload encriptado adicional
5. **Capa 5 - Multi-ronda**: 3 validaciones progresivas
6. **Capa 6 - Timestamp**: Ventana temporal estricta (<10 seg)

**Ventajas sobre Alternativas:**

vs **QR Simple**:
- ✅ Screenshot inútil (falta porción de datos)
- ✅ Requiere presencia física para ver rotación

vs **Geolocalización**:
- ✅ GPS indoor es impreciso (10-50m error)
- ✅ Fácil de spoofear
- ✅ QR visual = mejor prueba de presencia

vs **WebSocket Puro**:
- ✅ Funciona sin red durante captura
- ✅ Validación visual de presencia
- ✅ Más difícil de falsificar

vs **QR con Fragmentación Total**:
- ✅ Preserva patrones funcionales
- ✅ QR sigue siendo detectable
- ✅ No depende de ECC para reconstrucción

**Escalabilidad:**

| Estudiantes | Intervalo/QR | Tiempo/Ciclo | Viabilidad |
|-------------|--------------|--------------|------------|
| 10          | 500ms        | 5 seg        | ✅ Óptimo |
| 30          | 500ms        | 15 seg       | ✅ Bueno |
| 50          | 500ms        | 25 seg       | ⚠️ Aceptable |
| 100         | 300ms        | 30 seg       | ⚠️ Límite |
| 200+        | Variable     | >60 seg      | ❌ Requiere división en grupos |

**Próximos Pasos:**

1. **POC Técnico** (2-3 días):
   - Implementar extracción de encoded data region
   - Probar fragmentación con N=5 usuarios
   - Medir tasa de decodificación exitosa
   - Validar timing real con escáneres

2. **Prototipo Backend** (1 semana):
   - Implementar sistema dual TOTP
   - Crear endpoints de login y registro
   - Cola de proyección de QRs
   - Sistema de validación multi-ronda

3. **Prototipo Frontend** (1 semana):
   - Cliente de escaneo con html5-qrcode
   - Reconstrucción local de QR
   - UI de confirmación progresiva
   - Manejo de estados y errores

4. **Testing** (1 semana):
   - Pruebas con 10 usuarios reales
   - Diferentes dispositivos (gama baja/alta)
   - Diferentes condiciones de iluminación
   - Métricas de tasa de éxito

5. **Optimización** (según resultados):
   - Ajustar intervalos de proyección
   - Optimizar tamaño de fragmentos
   - Mejorar UX de captura
   - Implementar fallbacks

---

## Anexo B: Glosario

- **BitMatrix**: Matriz 2D de bits (0/1) que representa un QR code
- **ECC (Error Correction Code)**: Códigos Reed-Solomon para recuperación de datos dañados
- **Encoded Data Region**: Área del QR que contiene los datos codificados (excluyendo patrones funcionales)
- **Finder Pattern**: Cuadrados característicos en 3 esquinas del QR para detección
- **Timing Pattern**: Líneas alternas de módulos oscuros/claros para sincronización
- **Alignment Pattern**: Patrones adicionales en QR grandes para corrección de distorsión
- **Format Information**: Bits que indican nivel de ECC y patrón de máscara aplicado
- **Version Information**: Bits que indican la versión (tamaño) del QR (solo versiones ≥7)
- **TOTP (Time-based One-Time Password)**: Token temporal generado algorítmicamente
- **TOTPu**: TOTP de usuario, vinculado a sesión y dispositivo
- **TOTPs**: TOTP de servidor, vinculado a QR específico
- **QR truncado**: QR con encoded data region incompleta (falta porción de un usuario)
- **Device Fingerprint**: Identificador único del dispositivo basado en características del navegador/sistema
- **Nonce**: "Number used once" - valor aleatorio de un solo uso para prevenir replay attacks
- **HMAC**: Hash-based Message Authentication Code - firma criptográfica

---

**Documento preparado por:** Claude Code Agent
**Última actualización:** 2025-10-23 (v2.0 - Sistema clarificado)
**Próxima revisión:** Después de resultados del POC Técnico
**Contacto:** Para consultas sobre implementación, ver repositorio del proyecto
