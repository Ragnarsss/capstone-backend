# Procedimientos de Seguridad del Sistema de Asistencia

## Índice
1. [Enrolamiento y Autenticación](#1-enrolamiento-y-autenticación)
2. [Gestión de Sesiones](#2-gestión-de-sesiones)
3. [Protección de Datos QR](#3-protección-de-datos-qr)
4. [Validación y Verificación](#4-validación-y-verificación)
5. [Anti-Ataques](#5-anti-ataques)
6. [Criptografía](#6-criptografía)
7. [Tabla Resumen](#7-tabla-resumen)

---

## 1. Enrolamiento y Autenticación

### 1.1 WebAuthn/FIDO2 (Passwordless Authentication)

**¿Qué es?**
Estándar W3C para autenticación sin contraseña usando criptografía de clave pública.

**¿Dónde se usa?**
- **Fase:** Enrolamiento (primera vez o nuevo dispositivo)
- **Ubicación:** Servidor + Cliente (navegador)

**¿Para qué?**
- Registrar dispositivos de forma segura
- Generar pares de claves criptográficas
- Eliminar vulnerabilidades de contraseñas (phishing, robo)

**¿Cómo funciona?**

```typescript
// Servidor genera challenge
const challenge = crypto.randomBytes(32);
const publicKeyOptions = {
  challenge: challenge,
  rp: { name: "Sistema Asistencia" },
  user: {
    id: userId,
    name: username,
    displayName: displayName
  },
  pubKeyCredParams: [{ alg: -7, type: "public-key" }],
  authenticatorSelection: {
    userVerification: "required"
  }
};

// Cliente (navegador) genera credenciales
const credential = await navigator.credentials.create({
  publicKey: publicKeyOptions
});

// Resultado:
// - credentialId: ID único del par de claves
// - publicKey: Clave pública (se envía al servidor)
// - privateKey: Clave privada (NUNCA sale del dispositivo)
```

**Datos almacenados:**
```javascript
// Servidor
{
  userId: 123,
  deviceId: "abc-device-fingerprint",
  credentialId: "xyz...",
  publicKey: "-----BEGIN PUBLIC KEY-----...",
  enrolledAt: timestamp
}

// Cliente (localStorage)
{
  credentialId: "xyz...",
  enrollmentTimestamp: timestamp
}
```

**Ventajas:**
- ✅ Clave privada nunca sale del dispositivo
- ✅ Resistente a phishing
- ✅ No hay contraseñas que robar
- ✅ Soporte nativo en navegadores modernos

---

### 1.2 Device Fingerprinting

**¿Qué es?**
Técnica para identificar de forma única un dispositivo basado en sus características.

**¿Dónde se usa?**
- **Fase:** Login / Enrolamiento
- **Ubicación:** Cliente (navegador)

**¿Para qué?**
- Detectar cuando un usuario intenta usar múltiples dispositivos
- Implementar sistema anti-compartir credenciales
- Vincular sesiones a dispositivos específicos

**¿Cómo funciona?**

```typescript
async function generateDeviceId(): Promise<string> {
  // Recolectar características del dispositivo
  const fingerprint = {
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency,
    canvasFingerprint: await getCanvasFingerprint(),
    webglFingerprint: await getWebGLFingerprint(),
    persistentUUID: localStorage.getItem('persistent_device_uuid') || generateUUID()
  };

  // Hash combinado
  const deviceId = sha256(JSON.stringify(fingerprint));

  // Guardar UUID persistente
  localStorage.setItem('persistent_device_uuid', fingerprint.persistentUUID);

  return deviceId;
}

async function getCanvasFingerprint(): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Device Fingerprint', 2, 2);
  return canvas.toDataURL();
}
```

**Uso en el sistema:**
- Detectar nuevos dispositivos
- Aplicar delays anti-compartir
- Vincular TOTPu a dispositivos

**Ventajas:**
- ✅ Dificulta compartir credenciales
- ✅ No requiere instalación de software adicional
- ✅ Funciona en todos los navegadores

**Limitaciones:**
- ⚠️ Puede cambiar si el usuario actualiza el navegador
- ⚠️ No es 100% único (colisiones posibles)

---

### 1.3 Sistema Anti-Compartir con Penalización Exponencial

**¿Qué es?**
Mecanismo que impone delays crecientes cuando se detectan nuevos dispositivos.

**¿Dónde se usa?**
- **Fase:** Enrolamiento de nuevo dispositivo
- **Ubicación:** Servidor

**¿Para qué?**
- Desalentar compartir credenciales entre usuarios
- Dificultar que un usuario registre múltiples dispositivos simultáneamente

**¿Cómo funciona?**

```typescript
interface DeviceEnrollment {
  userId: string;
  deviceId: string;
  enrolledAt: number;
  deviceCount: number;
}

function calculateEnrollmentDelay(userId: string): number {
  const userDevices = getDevicesForUser(userId);
  const deviceCount = userDevices.length;

  if (deviceCount === 0) {
    return 0; // Primer dispositivo: sin espera
  } else if (deviceCount === 1) {
    return 5 * 60 * 1000; // 5 minutos
  } else if (deviceCount === 2) {
    return 10 * 60 * 1000; // 10 minutos
  } else if (deviceCount === 3) {
    return 30 * 60 * 1000; // 30 minutos
  } else {
    // Exponencial: 1h, 2h, 4h, 8h...
    return Math.min(
      Math.pow(2, deviceCount - 3) * 60 * 60 * 1000,
      24 * 60 * 60 * 1000 // Máximo 24 horas
    );
  }
}

async function enrollNewDevice(userId: string, deviceId: string) {
  const existingDevice = await findDevice(userId, deviceId);

  if (existingDevice) {
    return { success: true, message: "Device already enrolled" };
  }

  const delay = calculateEnrollmentDelay(userId);

  if (delay > 0) {
    // Verificar si ya pasó el tiempo desde último enrolamiento
    const lastEnrollment = await getLastEnrollment(userId);
    const timeSinceLastEnrollment = Date.now() - lastEnrollment.enrolledAt;

    if (timeSinceLastEnrollment < delay) {
      const remainingWait = delay - timeSinceLastEnrollment;
      return {
        error: "New device cooldown active",
        waitTime: Math.ceil(remainingWait / 1000), // segundos
        message: `Debes esperar ${formatDuration(remainingWait)} para registrar un nuevo dispositivo`
      };
    }
  }

  // Registrar nuevo dispositivo
  await registerDevice(userId, deviceId);

  return { success: true };
}
```

**Escala de penalización:**
```
Dispositivo 1:  0 minutos   (inmediato)
Dispositivo 2:  5 minutos
Dispositivo 3:  10 minutos
Dispositivo 4:  30 minutos
Dispositivo 5:  1 hora
Dispositivo 6:  2 horas
Dispositivo 7:  4 horas
Dispositivo 8:  8 horas
Dispositivo 9+: 24 horas (tope)
```

**Ventajas:**
- ✅ Dificulta compartir credenciales
- ✅ No bloquea completamente (usuario puede tener múltiples dispositivos legítimos)
- ✅ Escalable y configurable

---

## 2. Gestión de Sesiones

### 2.1 TOTPu (TOTP de Usuario)

**¿Qué es?**
Time-based One-Time Password vinculado al usuario y su dispositivo.

**¿Dónde se usa?**
- **Fase:** Login, todas las validaciones posteriores
- **Ubicación:** Cliente + Servidor

**¿Para qué?**
- Vincular la sesión a un dispositivo específico
- Validar que el usuario sigue autenticado
- Prevenir compartir sesiones

**¿Cómo funciona?**

```typescript
// Generación en LOGIN
function generateTOTPu(userId: string, credentialId: string): string {
  // Recuperar handshake_secret del usuario
  const handshakeSecret = getHandshakeSecret(userId, credentialId);

  // Generar TOTP con ventana de 30 segundos
  const totp = new TOTP({
    secret: handshakeSecret,
    algorithm: 'SHA256',
    digits: 6,
    period: 300 // 5 minutos de validez
  });

  const totpu = totp.generate();

  // Almacenar en sesión del servidor
  sessions.set(userId, {
    TOTPu: totpu,
    deviceId: getDeviceId(credentialId),
    loginTime: Date.now(),
    expiresAt: Date.now() + (30 * 60 * 1000) // 30 min de sesión
  });

  return totpu;
}

// Validación en cada request
function validateTOTPu(userId: string, totpu: string): boolean {
  const session = sessions.get(userId);

  if (!session) {
    return false; // No hay sesión activa
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(userId);
    return false; // Sesión expirada
  }

  return session.TOTPu === totpu;
}
```

**Características:**
- **Duración:** Toda la sesión (hasta 30 minutos)
- **Cambio:** Solo en nuevo login
- **Reutilizable:** Sí, múltiples veces en la misma sesión
- **Vinculado a:** Usuario + Dispositivo

**Uso en el flujo:**
```
Login:
  TOTPu = "485926" (generado y almacenado)

Todas las validaciones posteriores:
  Cliente envía: {userId: 123, TOTPu: "485926", ...}
  Servidor valida: session[123].TOTPu === "485926" ✓
```

---

### 2.2 TOTPs (TOTP de Servidor/Sesión)

**¿Qué es?**
Time-based One-Time Password único para cada QR generado.

**¿Dónde se usa?**
- **Fase:** Generación de QR, validación de asistencia
- **Ubicación:** Servidor (generación), Cliente (extracción del QR)

**¿Para qué?**
- Validar que el QR capturado es reciente
- Prevenir reutilización de capturas (anti-replay)
- Vincular QR específico a usuario y ronda

**¿Cómo funciona?**

```typescript
// Generación para cada QR
function generateTOTPs(
  sessionId: string,
  userId: string,
  roundNumber: number
): string {
  const secret = sha256(
    sessionId + userId + roundNumber + SERVER_MASTER_SECRET
  );

  const totp = new TOTP({
    secret: secret,
    algorithm: 'SHA256',
    digits: 6,
    period: 30 // 30 segundos de validez
  });

  return totp.generate();
}

// Almacenamiento temporal
interface QRInstance {
  userId: string;
  TOTPs: string;
  generatedAt: number;
  validUntil: number;
  roundNumber: number;
  used: boolean;
}

const activeQRs = new Map<string, QRInstance>();

function createQRForUser(userId: string, sessionId: string, roundNumber: number) {
  const totps = generateTOTPs(sessionId, userId, roundNumber);

  activeQRs.set(totps, {
    userId: userId,
    TOTPs: totps,
    generatedAt: Date.now(),
    validUntil: Date.now() + 30000, // 30 segundos
    roundNumber: roundNumber,
    used: false
  });

  // Payload dentro del QR
  const payload = {
    userId: userId,
    sessionId: sessionId,
    TOTPs: totps,
    timestamp: Date.now()
  };

  // Encriptar y generar QR
  const encryptedPayload = encrypt(JSON.stringify(payload));
  const qrCode = generateQR(encryptedPayload);

  return qrCode;
}

// Validación anti-replay
function validateTOTPs(totps: string, userId: string): ValidationResult {
  const qrInstance = activeQRs.get(totps);

  if (!qrInstance) {
    return { error: 'Invalid or expired TOTPs' };
  }

  if (qrInstance.used) {
    return { error: 'TOTPs already used (replay attack?)' };
  }

  if (Date.now() > qrInstance.validUntil) {
    activeQRs.delete(totps);
    return { error: 'TOTPs expired' };
  }

  if (qrInstance.userId !== userId) {
    return { error: 'TOTPs does not match userId' };
  }

  // Marcar como usado
  qrInstance.used = true;

  return { success: true };
}
```

**Características:**
- **Duración:** 30 segundos
- **Cambio:** Cada QR generado
- **Reutilizable:** No (one-time use)
- **Vinculado a:** Sesión + Usuario + Ronda

**Diferencias TOTPu vs TOTPs:**

| Aspecto | TOTPu | TOTPs |
|---------|-------|-------|
| **Generado por** | Servidor en login | Servidor por cada QR |
| **Duración** | Toda la sesión (30 min) | 30 segundos |
| **Propósito** | Vincular usuario-dispositivo | Validar captura reciente |
| **Almacenado** | Cliente (memoria) | Dentro del QR |
| **Cambio** | Solo en nuevo login | Cada QR rotativo |
| **Reutilizable** | Sí (misma sesión) | No (one-time) |

---

## 3. Protección de Datos QR

### 3.1 QR Fragmentado (Data Masking)

**¿Qué es?**
Técnica de eliminar porciones específicas del QR para que no pueda ser decodificado sin esa porción.

**¿Dónde se usa?**
- **Fase:** Generación de QR, proyección
- **Ubicación:** Servidor (fragmentación), Cliente (reconstrucción)

**¿Para qué?**
- Asegurar que solo el usuario con la porción correcta pueda leer el QR
- Prevenir que alguien fotografíe el QR proyectado y lo use

**¿Cómo funciona?**

```typescript
interface QRFragmentation {
  qrTruncated: BitMatrix;    // QR sin la porción del usuario
  userPortion: Uint8Array;   // Bytes eliminados
  positions: number[];       // Índices donde van los bytes
  checksum: string;          // Validación de integridad
}

function fragmentQR(qrFull: BitMatrix, userId: string): QRFragmentation {
  // Extraer encoded data region
  const encodedData = extractEncodedDataRegion(qrFull);

  // Calcular posiciones a eliminar (específicas por usuario)
  const seed = hashUserId(userId);
  const positions = generatePositions(encodedData.length, seed, 0.2); // 20% del QR

  // Extraer bytes en esas posiciones
  const userPortion = new Uint8Array(positions.length);
  for (let i = 0; i < positions.length; i++) {
    userPortion[i] = encodedData[positions[i]];
  }

  // Crear QR truncado (reemplazar con valores nulos)
  const qrTruncated = qrFull.clone();
  for (const pos of positions) {
    setModuleValue(qrTruncated, pos, null);
  }

  // Calcular checksum
  const checksum = sha256(userPortion.toString());

  return {
    qrTruncated: qrTruncated,
    userPortion: userPortion,
    positions: positions,
    checksum: checksum
  };
}

// Reconstrucción en cliente
function reconstructQR(
  qrCaptured: BitMatrix,
  userPortion: Uint8Array,
  positions: number[]
): BitMatrix {
  const qrReconstructed = qrCaptured.clone();

  // Insertar bytes de la porción del usuario
  for (let i = 0; i < positions.length; i++) {
    setModuleValue(qrReconstructed, positions[i], userPortion[i]);
  }

  // Intentar decodificar
  try {
    const payload = decodeQR(qrReconstructed);
    return qrReconstructed; // Éxito
  } catch (error) {
    throw new Error('QR reconstruction failed - wrong portion');
  }
}
```

**Formato de datos enviados al usuario:**
```javascript
{
  portion: Uint8Array([0x4a, 0x7f, 0x32, ...]), // Bytes eliminados
  positions: [12, 45, 78, 134, ...],            // Índices
  checksum: "a1b2c3d4..."                       // SHA256
}
```

**Ventajas:**
- ✅ Simple de implementar
- ✅ Bajo overhead computacional
- ✅ Debugging fácil (inspección visual)

**Desventajas:**
- ❌ Si alguien captura QR + porción, puede reconstruir
- ❌ Requiere coordinación precisa de posiciones

---

### 3.2 Shamir Secret Sharing (Opción Alternativa)

**¿Qué es?**
Esquema criptográfico que divide un secreto en N fragmentos, requiriendo K fragmentos para reconstruir.

**¿Dónde se usa?**
- **Fase:** Generación de QR (opción B en evaluación)
- **Ubicación:** Servidor (split), Cliente (reconstrucción)

**¿Para qué?**
- Seguridad matemática robusta
- Imposible reconstruir con solo 1 fragmento
- Resistente a inspección visual

**¿Cómo funciona?**

```typescript
import { split, combine } from 'secrets.js-grempe';

interface ShamirFragmentation {
  fragmentBase: Uint8Array;    // Fragmento 0 (proyectado)
  fragmentUser: Uint8Array;    // Fragmento i (enviado al usuario)
  fragmentIndex: number;       // Índice del fragmento (1-N)
  threshold: number;           // K=2 (fragmentos necesarios)
  checksum: string;
}

function fragmentQRWithShamir(
  qrFull: BitMatrix,
  userId: string,
  totalUsers: number
): ShamirFragmentation {
  // Extraer encoded data region
  const encodedData = extractEncodedDataRegion(qrFull);

  // Convertir a hex
  const secretHex = Buffer.from(encodedData).toString('hex');

  // Split en N fragmentos con umbral K=2
  const shares = split(secretHex, {
    shares: totalUsers + 1,  // +1 para el fragmento base
    threshold: 2             // Requiere 2 fragmentos
  });

  // shares = ['801abc...', '802def...', '803fed...', ...]
  //           ^fragmento 0  ^fragmento 1  ^fragmento 2

  const fragmentBase = Buffer.from(shares[0], 'hex');
  const userIndex = getUserIndex(userId);
  const fragmentUser = Buffer.from(shares[userIndex + 1], 'hex');

  // Crear QR truncado con solo el fragmento base
  const qrTruncated = createQRWithFragment(qrFull, fragmentBase);

  return {
    fragmentBase: fragmentBase,
    fragmentUser: fragmentUser,
    fragmentIndex: userIndex + 1,
    threshold: 2,
    checksum: sha256(fragmentUser.toString())
  };
}

// Reconstrucción en cliente
function reconstructQRWithShamir(
  qrCaptured: BitMatrix,
  fragmentUser: Uint8Array,
  fragmentIndex: number
): BitMatrix {
  // Extraer fragmento base del QR capturado
  const fragmentBase = extractFragmentFromQR(qrCaptured);

  // Convertir fragmentos a formato Shamir
  const share0 = fragmentBase.toString('hex');
  const shareUser = fragmentUser.toString('hex');

  // Combinar fragmentos
  const reconstructedHex = combine([share0, shareUser]);
  const reconstructedData = Buffer.from(reconstructedHex, 'hex');

  // Crear QR completo
  const qrReconstructed = createQRWithEncodedData(reconstructedData);

  // Intentar decodificar
  try {
    const payload = decodeQR(qrReconstructed);
    return qrReconstructed; // Éxito
  } catch (error) {
    throw new Error('Shamir reconstruction failed - wrong fragment');
  }
}
```

**Matemática detrás:**
```
Polinomio de grado K-1 en GF(256):

f(x) = a₀ + a₁x + a₂x² + ... + aₖ₋₁x^(k-1)

Donde:
- a₀ = secreto original
- a₁, a₂, ... = coeficientes aleatorios

Fragmentos:
- share[0] = f(0) = a₀ (el secreto)
- share[1] = f(1)
- share[2] = f(2)
- ...

Reconstrucción (requiere K puntos):
- Con 2 puntos: interpolación lineal
- Recupera a₀ (el secreto original)
```

**Ventajas:**
- ✅ Seguridad matemática probada
- ✅ Imposible reconstruir con 1 solo fragmento
- ✅ Resistente a análisis visual
- ✅ Escalable a más fragmentos si se requiere

**Desventajas:**
- ❌ Mayor complejidad de implementación
- ❌ Overhead computacional (operaciones en GF(256))
- ❌ Requiere librería externa
- ❌ Expansión de tamaño (fragmentos pueden ser mayores que el original)

---

### 3.3 Encriptación de Payload

**¿Qué es?**
Cifrado del payload JSON antes de codificarlo en el QR.

**¿Dónde se usa?**
- **Fase:** Generación de QR
- **Ubicación:** Servidor (encriptación), Cliente (desencriptación)

**¿Para qué?**
- Proteger el contenido del QR de inspección
- Asegurar que solo clientes autorizados puedan leer el payload
- Prevenir manipulación del contenido

**¿Cómo funciona?**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Clave de encriptación (derivada del SERVER_MASTER_SECRET)
const ENCRYPTION_KEY = sha256(SERVER_MASTER_SECRET + 'qr-encryption-key');

function encryptPayload(payload: object): string {
  // Serializar payload
  const plaintext = JSON.stringify(payload);

  // Generar IV aleatorio
  const iv = randomBytes(16);

  // Crear cipher AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  // Encriptar
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Obtener auth tag
  const authTag = cipher.getAuthTag();

  // Combinar IV + encrypted + authTag
  const combined = {
    iv: iv.toString('hex'),
    data: encrypted,
    tag: authTag.toString('hex')
  };

  return Buffer.from(JSON.stringify(combined)).toString('base64');
}

function decryptPayload(encryptedData: string): object {
  // Decodificar
  const combined = JSON.parse(
    Buffer.from(encryptedData, 'base64').toString('utf8')
  );

  const iv = Buffer.from(combined.iv, 'hex');
  const encrypted = combined.data;
  const authTag = Buffer.from(combined.tag, 'hex');

  // Crear decipher
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  // Desencriptar
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// Uso en generación de QR
function createQRWithEncryptedPayload(
  userId: string,
  sessionId: string,
  totps: string
): string {
  const payload = {
    userId: userId,
    sessionId: sessionId,
    TOTPs: totps,
    timestamp: Date.now()
  };

  const encryptedPayload = encryptPayload(payload);
  const qrCode = generateQR(encryptedPayload);

  return qrCode;
}
```

**Algoritmo usado:**
- **AES-256-GCM** (Galois/Counter Mode)
  - Clave: 256 bits
  - IV: 128 bits (aleatorio por QR)
  - Auth Tag: 128 bits (integridad autenticada)

**Ventajas:**
- ✅ Confidencialidad (solo quien tiene la clave puede leer)
- ✅ Integridad (auth tag detecta modificaciones)
- ✅ Estándar de la industria (NIST aprobado)

---

## 4. Validación y Verificación

### 4.1 Validación Multi-Capa en Servidor

**¿Qué es?**
Sistema de validaciones en cascada que debe pasar cada solicitud de asistencia.

**¿Dónde se usa?**
- **Fase:** Validación de asistencia (Fase 5)
- **Ubicación:** Servidor

**¿Para qué?**
- Asegurar que el usuario está autenticado
- Verificar que el QR es válido y reciente
- Prevenir ataques de replay
- Validar la progresión secuencial de rondas

**¿Cómo funciona?**

```typescript
interface AttendanceRequest {
  userId: string;
  sessionId: string;
  TOTPu: string;
  TOTPs: string;
  timestamp: number;
  roundNumber: number;
}

interface ValidationResult {
  success?: boolean;
  error?: string;
  code?: string;
}

async function validateAttendance(
  request: AttendanceRequest
): Promise<ValidationResult> {

  // ═══════════════════════════════════════════════════════
  // CAPA 1: Validación de Sesión (TOTPu)
  // ═══════════════════════════════════════════════════════
  const userSession = sessions.get(request.userId);

  if (!userSession) {
    return {
      error: 'No active session',
      code: 'SESSION_NOT_FOUND'
    };
  }

  if (userSession.TOTPu !== request.TOTPu) {
    return {
      error: 'Invalid session token (TOTPu)',
      code: 'INVALID_TOTPU'
    };
  }

  if (Date.now() > userSession.expiresAt) {
    sessions.delete(request.userId);
    return {
      error: 'Session expired',
      code: 'SESSION_EXPIRED'
    };
  }

  // ═══════════════════════════════════════════════════════
  // CAPA 2: Validación de QR (TOTPs)
  // ═══════════════════════════════════════════════════════
  const expectedTOTPs = generateTOTPs(
    request.sessionId,
    request.userId,
    request.roundNumber
  );

  if (request.TOTPs !== expectedTOTPs) {
    return {
      error: 'Invalid QR token (TOTPs)',
      code: 'INVALID_TOTPS'
    };
  }

  // ═══════════════════════════════════════════════════════
  // CAPA 3: Anti-Replay (TOTPs usado previamente)
  // ═══════════════════════════════════════════════════════
  if (usedTOTPs.has(request.TOTPs)) {
    logSecurityEvent({
      type: 'REPLAY_ATTACK_DETECTED',
      userId: request.userId,
      TOTPs: request.TOTPs,
      timestamp: Date.now()
    });

    return {
      error: 'Token already used (replay attack?)',
      code: 'REPLAY_DETECTED'
    };
  }

  // ═══════════════════════════════════════════════════════
  // CAPA 4: Validación de Ventana Temporal
  // ═══════════════════════════════════════════════════════
  const timeWindow = 10000; // 10 segundos
  const timeDiff = Date.now() - request.timestamp;

  if (timeDiff > timeWindow) {
    return {
      error: 'Capture too old',
      code: 'TIMESTAMP_EXPIRED'
    };
  }

  if (timeDiff < -1000) { // Timestamp en el futuro (tolerancia 1 seg)
    return {
      error: 'Invalid timestamp (future)',
      code: 'TIMESTAMP_FUTURE'
    };
  }

  // ═══════════════════════════════════════════════════════
  // CAPA 5: Validación de SessionId
  // ═══════════════════════════════════════════════════════
  const attendanceSession = getAttendanceSession(request.sessionId);

  if (!attendanceSession) {
    return {
      error: 'Attendance session not found',
      code: 'SESSION_NOT_FOUND'
    };
  }

  if (!attendanceSession.active) {
    return {
      error: 'Attendance session is closed',
      code: 'SESSION_CLOSED'
    };
  }

  // ═══════════════════════════════════════════════════════
  // CAPA 6: Validación de Progresión de Rondas
  // ═══════════════════════════════════════════════════════
  const userRounds = getUserRounds(request.userId, request.sessionId);

  // Verificar que no se salten rondas
  if (request.roundNumber > 1) {
    const previousRound = userRounds[request.roundNumber - 2];
    if (!previousRound || !previousRound.completed) {
      return {
        error: 'Previous round not completed',
        code: 'ROUND_SEQUENCE_ERROR'
      };
    }
  }

  // Verificar que no se repita ronda ya completada
  const currentRound = userRounds[request.roundNumber - 1];
  if (currentRound && currentRound.completed) {
    return {
      error: 'Round already completed',
      code: 'ROUND_ALREADY_DONE'
    };
  }

  // ═══════════════════════════════════════════════════════
  // TODAS LAS VALIDACIONES PASARON ✓
  // ═══════════════════════════════════════════════════════

  // Marcar TOTPs como usado
  usedTOTPs.add(request.TOTPs);

  // Registrar ronda completada
  await markAttendanceRound(
    request.userId,
    request.sessionId,
    request.roundNumber
  );

  return { success: true };
}
```

**Diagrama de flujo:**
```
Request
  ↓
┌─────────────────────────────────────┐
│ CAPA 1: ¿TOTPu válido?              │ → ❌ SESSION_EXPIRED
└─────────────────────────────────────┘
  ↓ ✓
┌─────────────────────────────────────┐
│ CAPA 2: ¿TOTPs correcto?            │ → ❌ INVALID_TOTPS
└─────────────────────────────────────┘
  ↓ ✓
┌─────────────────────────────────────┐
│ CAPA 3: ¿TOTPs ya usado?            │ → ❌ REPLAY_DETECTED
└─────────────────────────────────────┘
  ↓ ✓
┌─────────────────────────────────────┐
│ CAPA 4: ¿Timestamp válido?          │ → ❌ TIMESTAMP_EXPIRED
└─────────────────────────────────────┘
  ↓ ✓
┌─────────────────────────────────────┐
│ CAPA 5: ¿SessionId activo?          │ → ❌ SESSION_CLOSED
└─────────────────────────────────────┘
  ↓ ✓
┌─────────────────────────────────────┐
│ CAPA 6: ¿Ronda secuencial?          │ → ❌ ROUND_SEQUENCE_ERROR
└─────────────────────────────────────┘
  ↓ ✓
┌─────────────────────────────────────┐
│ ✅ VALIDACIÓN EXITOSA                │
└─────────────────────────────────────┘
```

---

### 4.2 Validación Multi-Ronda (Progresiva)

**¿Qué es?**
Sistema que requiere 3 rondas exitosas de validación para confirmar asistencia.

**¿Dónde se usa?**
- **Fase:** Todo el proceso de asistencia (Fases 3-6)
- **Ubicación:** Servidor

**¿Para qué?**
- Aumentar la certeza de presencia física
- Dificultar suplantación (requiere estar presente en 3 momentos diferentes)
- Validación estadística (umbral de certeza 70% → 90% → 99%)

**¿Cómo funciona?**

```typescript
interface RoundData {
  roundNumber: number;
  TOTPs: string;
  captureTimestamp: number;
  validatedAt: number;
  completed: boolean;
}

interface AttendanceRecord {
  userId: string;
  sessionId: string;
  rounds: RoundData[];
  certitude: number;      // 0-100%
  confirmed: boolean;
  startedAt: number;
  completedAt?: number;
}

const CERTITUDE_THRESHOLDS = {
  round1: 70,   // 70% certeza después de ronda 1
  round2: 90,   // 90% certeza después de ronda 2
  round3: 99    // 99% certeza después de ronda 3 (confirmado)
};

async function markAttendanceRound(
  userId: string,
  sessionId: string,
  roundNumber: number
): Promise<void> {
  let record = getAttendanceRecord(userId, sessionId);

  if (!record) {
    // Crear nuevo registro
    record = {
      userId: userId,
      sessionId: sessionId,
      rounds: [],
      certitude: 0,
      confirmed: false,
      startedAt: Date.now()
    };
  }

  // Agregar datos de la ronda
  record.rounds[roundNumber - 1] = {
    roundNumber: roundNumber,
    TOTPs: getCurrentTOTPs(userId, roundNumber),
    captureTimestamp: Date.now(),
    validatedAt: Date.now(),
    completed: true
  };

  // Actualizar certeza
  if (roundNumber === 1) {
    record.certitude = CERTITUDE_THRESHOLDS.round1;
  } else if (roundNumber === 2) {
    record.certitude = CERTITUDE_THRESHOLDS.round2;
  } else if (roundNumber === 3) {
    record.certitude = CERTITUDE_THRESHOLDS.round3;
    record.confirmed = true;
    record.completedAt = Date.now();
  }

  await saveAttendanceRecord(record);

  // Log de auditoría
  logAuditEvent({
    type: 'ATTENDANCE_ROUND_COMPLETED',
    userId: userId,
    sessionId: sessionId,
    roundNumber: roundNumber,
    certitude: record.certitude,
    timestamp: Date.now()
  });
}

// Generar siguiente porción de QR para próxima ronda
async function getNextRoundData(
  userId: string,
  sessionId: string,
  completedRound: number
): Promise<object | null> {
  if (completedRound >= 3) {
    return null; // No hay más rondas
  }

  const nextRound = completedRound + 1;

  // Generar nuevo TOTPs para siguiente ronda
  const nextTOTPs = generateTOTPs(sessionId, userId, nextRound);

  // Crear nuevo QR con nuevo payload
  const payload = {
    userId: userId,
    sessionId: sessionId,
    TOTPs: nextTOTPs,
    timestamp: Date.now(),
    roundNumber: nextRound
  };

  const encryptedPayload = encryptPayload(payload);
  const qrFull = generateQR(encryptedPayload);

  // Fragmentar con NUEVA fragmentación
  const fragmentation = fragmentQR(qrFull, userId, nextRound);

  return {
    dataMatrix: {
      portion: fragmentation.userPortion,
      positions: fragmentation.positions,
      checksum: fragmentation.checksum
    },
    roundNumber: nextRound,
    roundsRemaining: 3 - nextRound
  };
}
```

**Progresión de certeza:**
```
Inicio:     0% certeza  (sin validación)
            ↓
Ronda 1:   70% certeza  (primera captura exitosa)
            ↓
Ronda 2:   90% certeza  (segunda captura exitosa)
            ↓
Ronda 3:   99% certeza  (tercera captura exitosa)
            ↓
Confirmado: Asistencia registrada ✓
```

**Tiempo entre rondas:**
- No hay límite mínimo (el usuario puede completar rápidamente)
- Límite máximo: timeout global de sesión (ej: 10 minutos)

**Ventajas:**
- ✅ Mayor certeza de presencia física
- ✅ Dificulta suplantación por foto/video
- ✅ Validación estadística robusta
- ✅ Flexibilidad (el usuario avanza a su ritmo)

---

## 5. Anti-Ataques

### 5.1 Anti-Replay (Prevención de Reutilización)

**¿Qué es?**
Mecanismo que previene que un atacante reutilice datos de una captura anterior.

**¿Dónde se usa?**
- **Fase:** Validación de asistencia
- **Ubicación:** Servidor

**¿Para qué?**
- Prevenir que alguien intercepte un request válido y lo reenvíe
- Asegurar que cada TOTPs solo se use una vez
- Detectar intentos de ataque

**¿Cómo funciona?**

```typescript
// Set de TOTPs usados (con expiración automática)
class AntiReplayStore {
  private usedTokens: Map<string, number>; // TOTPs → timestamp
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.usedTokens = new Map();

    // Limpiar tokens expirados cada 1 minuto
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  isUsed(totps: string): boolean {
    return this.usedTokens.has(totps);
  }

  markAsUsed(totps: string): void {
    this.usedTokens.set(totps, Date.now());
  }

  cleanup(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minuto

    for (const [totps, timestamp] of this.usedTokens.entries()) {
      if (now - timestamp > maxAge) {
        this.usedTokens.delete(totps);
      }
    }
  }

  size(): number {
    return this.usedTokens.size;
  }
}

const antiReplay = new AntiReplayStore();

// Uso en validación
function validateTOTPs(totps: string): ValidationResult {
  // Verificar si ya fue usado
  if (antiReplay.isUsed(totps)) {
    // Log de seguridad
    logSecurityEvent({
      type: 'REPLAY_ATTACK_DETECTED',
      TOTPs: totps,
      timestamp: Date.now(),
      severity: 'HIGH'
    });

    return {
      error: 'Token already used (replay attack?)',
      code: 'REPLAY_DETECTED'
    };
  }

  // Otras validaciones...

  // Marcar como usado
  antiReplay.markAsUsed(totps);

  return { success: true };
}
```

**Escenario de ataque bloqueado:**
```
Usuario legítimo captura QR:
  → Envía: {userId: 123, TOTPs: "456789"}
  → Servidor valida ✓
  → Marca "456789" como usado
  → Registra asistencia

Atacante intercepta el request:
  → Reenvía: {userId: 123, TOTPs: "456789"}
  → Servidor detecta: "456789" ya fue usado
  → Rechaza con error: REPLAY_DETECTED
  → Log de seguridad generado
```

**Ventajas:**
- ✅ Previene ataques de replay
- ✅ Bajo overhead (solo un Map lookup)
- ✅ Auto-limpieza (memoria no crece indefinidamente)
- ✅ Logs de seguridad para análisis

---

### 5.2 Timestamp Validation (Ventana Temporal)

**¿Qué es?**
Validación que asegura que la captura es reciente (dentro de una ventana de tiempo).

**¿Dónde se usa?**
- **Fase:** Validación de asistencia
- **Ubicación:** Servidor

**¿Para qué?**
- Prevenir uso de capturas antiguas
- Asegurar que el usuario está presente ahora (no grabó pantalla antes)
- Complementar anti-replay con validación temporal

**¿Cómo funciona?**

```typescript
interface TimestampValidation {
  maxAge: number;        // Edad máxima permitida (ms)
  clockSkewTolerance: number; // Tolerancia de reloj (ms)
}

const TIMESTAMP_RULES: TimestampValidation = {
  maxAge: 10000,          // 10 segundos
  clockSkewTolerance: 1000 // 1 segundo
};

function validateTimestamp(
  requestTimestamp: number,
  currentTime: number = Date.now()
): ValidationResult {
  const timeDiff = currentTime - requestTimestamp;

  // ═════════════════════════════════════════════════════
  // Validación 1: Timestamp en el futuro (clock skew)
  // ═════════════════════════════════════════════════════
  if (timeDiff < -TIMESTAMP_RULES.clockSkewTolerance) {
    return {
      error: 'Invalid timestamp (future)',
      code: 'TIMESTAMP_FUTURE',
      details: {
        requestTimestamp: requestTimestamp,
        serverTimestamp: currentTime,
        diff: timeDiff
      }
    };
  }

  // ═════════════════════════════════════════════════════
  // Validación 2: Timestamp muy antiguo
  // ═════════════════════════════════════════════════════
  if (timeDiff > TIMESTAMP_RULES.maxAge) {
    return {
      error: 'Capture too old',
      code: 'TIMESTAMP_EXPIRED',
      details: {
        age: timeDiff,
        maxAge: TIMESTAMP_RULES.maxAge
      }
    };
  }

  // ═════════════════════════════════════════════════════
  // Timestamp válido ✓
  // ═════════════════════════════════════════════════════
  return {
    success: true,
    age: timeDiff
  };
}

// Uso integrado con otras validaciones
async function validateAttendanceWithTimestamp(
  request: AttendanceRequest
): Promise<ValidationResult> {
  // ... otras validaciones ...

  // Validar timestamp
  const timestampResult = validateTimestamp(request.timestamp);
  if (!timestampResult.success) {
    return timestampResult;
  }

  // Continuar validación...
}
```

**Ventana temporal:**
```
Tiempo del servidor (now)
          ↓
◄─────────┼─────────►
  -1s     0      +10s
   ↑             ↑
   │             └─ Máximo aceptado (10 segundos atrás)
   └─ Tolerancia de reloj (1 segundo adelante)

Ejemplo:
  Servidor: 12:00:10.000

  Request con timestamp 12:00:09.500:
    timeDiff = 500ms → ✓ Válido

  Request con timestamp 12:00:00.000:
    timeDiff = 10000ms → ✓ Válido (límite)

  Request con timestamp 11:59:59.000:
    timeDiff = 11000ms → ❌ Muy antiguo

  Request con timestamp 12:00:11.500:
    timeDiff = -1500ms → ❌ En el futuro
```

**Ventajas:**
- ✅ Previene uso de capturas antiguas
- ✅ Detecta problemas de sincronización de reloj
- ✅ Complementa anti-replay
- ✅ Configurable según necesidades

---

### 5.3 Rate Limiting (Limitación de Tasa)

**¿Qué es?**
Mecanismo que limita la cantidad de requests que un usuario puede hacer en un período de tiempo.

**¿Dónde se usa?**
- **Fase:** Todas las fases (login, validación, etc.)
- **Ubicación:** Servidor (middleware)

**¿Para qué?**
- Prevenir ataques de fuerza bruta
- Proteger contra DDoS
- Detectar comportamiento anómalo

**¿Cómo funciona?**

```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Configuraciones por endpoint
const rateLimiters = {
  login: new RateLimiterMemory({
    points: 5,          // 5 intentos
    duration: 60,       // por 1 minuto
    blockDuration: 300  // bloquear 5 minutos si se excede
  }),

  validation: new RateLimiterMemory({
    points: 20,         // 20 validaciones
    duration: 60,       // por 1 minuto
    blockDuration: 60   // bloquear 1 minuto si se excede
  }),

  enrollment: new RateLimiterMemory({
    points: 3,          // 3 intentos
    duration: 3600,     // por 1 hora
    blockDuration: 3600 // bloquear 1 hora si se excede
  })
};

// Middleware
async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
  limiterType: 'login' | 'validation' | 'enrollment'
): Promise<void> {
  const limiter = rateLimiters[limiterType];
  const key = req.ip + ':' + req.userId; // IP + userId

  try {
    await limiter.consume(key, 1);
    next(); // Permitir request
  } catch (error) {
    // Rate limit excedido
    logSecurityEvent({
      type: 'RATE_LIMIT_EXCEEDED',
      userId: req.userId,
      ip: req.ip,
      endpoint: limiterType,
      timestamp: Date.now()
    });

    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: error.msBeforeNext / 1000 // segundos
    });
  }
}

// Uso
app.post('/api/login',
  (req, res, next) => rateLimitMiddleware(req, res, next, 'login'),
  loginHandler
);

app.post('/api/validate',
  (req, res, next) => rateLimitMiddleware(req, res, next, 'validation'),
  validateHandler
);
```

**Configuración por endpoint:**

| Endpoint | Límite | Ventana | Bloqueo | Razón |
|----------|--------|---------|---------|-------|
| `/login` | 5 | 1 min | 5 min | Prevenir fuerza bruta de credenciales |
| `/validate` | 20 | 1 min | 1 min | Permitir uso normal, bloquear spam |
| `/enrollment` | 3 | 1 hora | 1 hora | Limitar enrolamiento de dispositivos |
| `/register` | 10 | 1 min | 5 min | Permitir múltiples registros de clase |

**Ventajas:**
- ✅ Previene ataques de fuerza bruta
- ✅ Protege recursos del servidor
- ✅ Detecta comportamiento anómalo
- ✅ Configurable por endpoint

---

## 6. Criptografía

### 6.1 HKDF (HMAC-based Key Derivation Function)

**¿Qué es?**
Función criptográfica para derivar claves a partir de material de entrada.

**¿Dónde se usa?**
- **Fase:** Enrolamiento (generación de handshake_secret)
- **Ubicación:** Servidor

**¿Para qué?**
- Generar secreto compartido sin transmitirlo
- Derivar clave única por usuario+dispositivo
- Proteger SERVER_MASTER_SECRET

**¿Cómo funciona?**

```typescript
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

function deriveHandshakeSecret(
  credentialId: string,
  userId: string
): string {
  // Input Keying Material
  const ikm = Buffer.from(
    credentialId + userId + SERVER_MASTER_SECRET
  );

  // Application context
  const info = Buffer.from('attendance-handshake-v1');

  // Derive 32 bytes (256 bits)
  const derivedKey = hkdf(
    sha256,      // Hash function
    ikm,         // Input keying material
    undefined,   // Salt (not needed, SERVER_MASTER_SECRET provides entropy)
    info,        // Application context
    32           // Output length
  );

  return Buffer.from(derivedKey).toString('hex');
}
```

**Ya explicado en detalle anteriormente.**

---

### 6.2 SHA-256 (Secure Hash Algorithm)

**¿Qué es?**
Función hash criptográfica que produce un digest de 256 bits.

**¿Dónde se usa?**
- Device fingerprinting
- Checksums
- Derivación de secretos
- Hashing de datos sensibles

**¿Para qué?**
- Crear identificadores únicos
- Verificar integridad de datos
- One-way hashing (no reversible)

**¿Cómo funciona?**

```typescript
import { sha256 } from '@noble/hashes/sha256';

// Uso básico
function hashData(data: string): string {
  const hash = sha256(data);
  return Buffer.from(hash).toString('hex');
}

// Ejemplos de uso en el sistema
const examples = {
  // Device ID
  deviceId: hashData(
    navigator.userAgent +
    screen.width +
    screen.height +
    canvasFingerprint
  ),

  // Checksum de dataMatrix
  checksum: hashData(userPortion.toString()),

  // Secret derivation
  secret: hashData(sessionId + userId + roundNumber + SERVER_SECRET)
};
```

**Propiedades:**
- ✅ Determinista (mismo input → mismo output)
- ✅ One-way (no se puede revertir)
- ✅ Resistente a colisiones
- ✅ Rápido de calcular

---

### 6.3 AES-256-GCM (Advanced Encryption Standard)

**¿Qué es?**
Algoritmo de cifrado simétrico con autenticación integrada.

**¿Dónde se usa?**
- **Fase:** Generación de QR (encriptación de payload)
- **Ubicación:** Servidor (encriptación), Cliente (desencriptación)

**¿Para qué?**
- Proteger contenido del QR
- Autenticar integridad del payload
- Prevenir manipulación

**Ya explicado en sección 3.3.**

---

## 7. Tabla Resumen

### 7.1 Por Fase del Sistema

| Fase | Procedimiento | Propósito | Ubicación |
|------|---------------|-----------|-----------|
| **Enrolamiento** | WebAuthn/FIDO2 | Autenticación sin contraseña | Servidor + Cliente |
| | HKDF | Derivar handshake_secret | Servidor |
| | Device Fingerprinting | Identificar dispositivo | Cliente |
| | Anti-Compartir | Prevenir múltiples dispositivos | Servidor |
| **Login** | TOTPu | Vincular sesión a dispositivo | Cliente + Servidor |
| | Rate Limiting | Prevenir fuerza bruta | Servidor |
| **Registro Asistencia** | QR Fragmentado | Proteger QR proyectado | Servidor + Cliente |
| | TOTPs | Validar captura reciente | Servidor |
| | Encriptación AES | Proteger payload QR | Servidor + Cliente |
| **Proyección** | Rotación de QRs | Prevenir captura prolongada | Servidor |
| **Captura** | Reconstrucción Local | Validar porción correcta | Cliente |
| **Validación** | Multi-Capa | Validar múltiples aspectos | Servidor |
| | Anti-Replay | Prevenir reutilización | Servidor |
| | Timestamp Validation | Validar temporalidad | Servidor |
| **Multi-Ronda** | Validación Progresiva | Aumentar certeza | Servidor |

---

### 7.2 Por Tipo de Seguridad

#### Autenticación y Autorización
- ✅ WebAuthn/FIDO2
- ✅ TOTPu (sesión)
- ✅ TOTPs (QR)
- ✅ HKDF (derivación de claves)

#### Protección de Datos
- ✅ QR Fragmentado (Data Masking o Shamir)
- ✅ AES-256-GCM (encriptación)
- ✅ SHA-256 (hashing)

#### Anti-Ataques
- ✅ Anti-Replay
- ✅ Anti-Compartir (penalización exponencial)
- ✅ Rate Limiting
- ✅ Timestamp Validation
- ✅ Multi-Capa Validation

#### Validación y Verificación
- ✅ Validación Multi-Capa (6 capas)
- ✅ Validación Multi-Ronda (3 rondas)
- ✅ Device Fingerprinting
- ✅ Checksums (integridad)

---

### 7.3 Por Nivel de Seguridad

#### Nivel 1: Crítico (Falla = Sistema Comprometido)
1. WebAuthn/FIDO2 - Autenticación base
2. HKDF - Derivación de secretos
3. AES-256-GCM - Encriptación de payload
4. Anti-Replay - Prevención de reutilización
5. SERVER_MASTER_SECRET - Secreto maestro

#### Nivel 2: Alto (Falla = Vulnerabilidad Seria)
6. TOTPu - Validación de sesión
7. TOTPs - Validación de QR
8. QR Fragmentado - Protección de proyección
9. Multi-Capa Validation - Validación exhaustiva
10. Timestamp Validation - Validación temporal

#### Nivel 3: Medio (Falla = Inconveniente)
11. Anti-Compartir - Penalización de dispositivos
12. Device Fingerprinting - Identificación de dispositivo
13. Rate Limiting - Limitación de tasa
14. Checksums - Verificación de integridad
15. Multi-Ronda - Validación progresiva

---

## Conclusión

El sistema implementa **15+ procedimientos de seguridad** organizados en **6 categorías principales**:

1. **Enrolamiento y Autenticación** (4 procedimientos)
2. **Gestión de Sesiones** (2 procedimientos)
3. **Protección de Datos QR** (3 procedimientos)
4. **Validación y Verificación** (2 procedimientos)
5. **Anti-Ataques** (3 procedimientos)
6. **Criptografía** (3 procedimientos)

Cada procedimiento cumple un rol específico en la defensa en profundidad del sistema, asegurando que:

- ✅ Solo usuarios autenticados pueden acceder
- ✅ Solo dispositivos enrolados pueden validar asistencia
- ✅ Solo capturas recientes y únicas son aceptadas
- ✅ Solo usuarios físicamente presentes pueden completar el proceso
- ✅ El sistema es resistente a múltiples vectores de ataque

---

**Documento generado:** 2025-01-24
**Versión del sistema:** 1.0
**Estado:** Documentación completa
