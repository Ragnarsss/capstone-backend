# Caracterización del Ecosistema de Asistencia

## 1. Definición Arquitectónica Global

El sistema opera bajo una arquitectura de **Vertical Slices** con modularidad estricta. Se privilegia el desacoplamiento (SoC), la cohesión interna y la idempotencia de las transacciones.

- **Relación con el Sistema Base:** El módulo de asistencia funciona como una "Caja Negra" funcional. No gestiona usuarios ni roles; estos son inyectados desde el Sistema Base (PHP) como una verdad inmutable.
- **Restricción Invariante:** Se impone una regla física y lógica de **1:1** (Una Cuenta $\leftrightarrow$ Un Dispositivo).

## 2. Concepto: Inyección de Identidad (Source of Truth)

Este módulo establece el contexto de seguridad pero no autentica credenciales primarias.

- **Entrada:** El Sistema Base emite un **JWT** firmado que contiene el `userId` (RUT), `rol` y contexto académico.
- **Transporte:** El JWT se inyecta en el entorno del cliente (`iframe /asistencia/reader/`) mediante `postMessage`.
- **Principio de SoC:** El frontend del módulo actúa como un contenedor agnóstico; limpia tokens previos y almacena el nuevo JWT como única fuente de identidad válida para las solicitudes subsiguientes.

## 3. Concepto: Control de Acceso y Orquestación (Access Gateway)

Actúa como la barrera de entrada lógica, determinando la capacidad operativa del usuario sin revelar lógica de negocio al cliente.

- **Entrada:** `JWT` (Identidad) + `Device Fingerprint` (Firma de Hardware).
- **Mecanismo:** El cliente consulta su estado (`GET /state`). El Gateway valida la política 1:1 contrastando la identidad con el hardware en la base de datos.
- **Estados Deterministas:**
  - `NOT_ENROLLED`: Disparidad detectada (Usuario nuevo o dispositivo no reconocido).
  - `ENROLLED_NO_SESSION`: Vinculación correcta, requiere handshake criptográfico.
  - `READY`: Sesión activa y lista para operar.
  - `BLOCKED`: Restricción activa (ej. sanción temporal).

## 3.5 Concepto: Registro en Sesión de Clase (Participation Service)

Antes de escanear QRs, el estudiante debe registrarse en la sesión de clase activa. Este paso conecta al estudiante autenticado con la proyección en curso.

### Flujo de Registro

1. **Verificación previa:** El cliente verifica estado `READY` mediante Access Gateway (`GET /api/access/state`).
2. **Solicitud de registro:** `POST /api/attendance/register {sessionId, studentId}`.
3. **Validaciones del servidor:**
   - Sesión de clase existe y está activa.
   - Usuario no está ya registrado en esta sesión.
   - Usuario cumple requisitos académicos (curso, horario).
4. **Inicialización de estado:**
   - Crea `StudentState` en Valkey con metadatos de progreso.
   - Genera QR inicial para `round: 1` cifrado con la `session_key` del estudiante.
   - Agrega QR encriptado al pool de proyección.
5. **Respuesta:** `{success: true, expectedRound: 1, qrPayload: <encrypted>}`.

### Post-Registro

- El QR del estudiante entra en rotación con el proyector.
- Cliente abre lector de cámara y busca su QR con `round: 1`.
- Pool Balancer mantiene mínimo 10 QRs (rellenando con señuelos si es necesario).

**Invariante:** Sin registro exitoso, el estudiante NO tiene QRs en el pool de proyección.

---

## 4. Concepto: Subsistema de Enrolamiento (Autómata Finito)

Este slice gestiona la vinculación física mediante FIDO2 y asegura la invariante 1:1.

- **Lógica de Negocio (FSM):** Se implementa como un Autómata Finito que transiciona entre estados de conformidad y conflicto.
- **Resolución de Conflictos (Saneamiento DRY):**
    Si se solicita un enrolamiento (cambio de dispositivo o nuevo usuario en dispositivo usado):

   1. **Revocación Universal:** Se eliminan *todos* los vínculos previos del `userId` actual y *todos* los vínculos del `fingerprint` del dispositivo (desvinculando a terceros si existen).
   1. **Vinculación:** Se crea el nuevo nexo exclusivo `userId` $\leftrightarrow$ `credentialId` (FIDO2).
   1. **Persistencia:** La operación es atómica; el sistema nunca queda en un estado intermedio (relaciones N:M).

## 5. Concepto: Gestión de Sesión Criptográfica (Session Slice)

Este módulo transforma la validación de identidad en capacidad operativa segura mediante criptografía efímera (ECDH) y vinculación de dispositivo (FIDO2).

### Responsabilidad

Negociación de llaves efímeras y derivación de `session_key` compartida **sin transmitirla** por la red.

### Mecanismo (FIDO2 + ECDH + HKDF)

#### Flujo de Login:

1. **Autenticación de Dispositivo (FIDO2/WebAuthn):**
   - Cliente prueba posesión de `privateKey` mediante WebAuthn assertion.
   - Servidor valida assertion con `publicKey` almacenada en la base de datos.
   - *Crucial:* La `privateKey` NUNCA sale del Secure Enclave del dispositivo.

2. **Handshake ECDH (Elliptic Curve Diffie-Hellman):**
   - Cliente y servidor generan pares **efímeros** (válidos solo para esta sesión).
   - Intercambian llaves públicas: `pubKey_cliente` ↔ `pubKey_servidor`.

3. **Derivación de Clave Compartida:**
   - Ambos calculan: `shared_secret = ECDH(privKey_local, pubKey_remoto)`.
   - Ambos derivan: `session_key = HKDF-SHA256(shared_secret)`.
   - **Crucial:** `session_key` NUNCA se transmite; ambos la calculan independientemente mediante las mismas operaciones matemáticas.

4. **Destrucción de Efímeros:**
   - Claves privadas ECDH se destruyen inmediatamente tras derivar `session_key`.
   - Garantiza **Perfect Forward Secrecy (PFS)**: compromiso de claves futuras no afecta sesiones pasadas.

### Persistencia en Valkey

La `session_key` se almacena con la siguiente estructura:

```
key: session:userId:{userId}
value: {
  sessionKey: Buffer,
  userId: number,
  deviceId: number,  // Vinculación 1:1
  createdAt: timestamp
}
TTL: 2 horas (auto-expiración)
```

- **Indexación primaria:** `userId` (del JWT).
- **Vinculación adicional:** `deviceId` (garantiza política 1:1).
- **Invariante:** Un usuario solo puede tener UNA `session_key` activa por dispositivo.

### TOTPu (Time-based OTP del Usuario)

- **Derivación:** `TOTPu = TOTP(session_key)` usando algoritmo RFC 6238.
- **Propósito:** Validación temporal anti-replay (ventana de tolerancia ±30 segundos).
- **Cálculo:** Ambos lados (cliente/servidor) lo generan independientemente usando la misma `session_key`.
- **Ventaja:** Cambia por sesión (mayor seguridad que TOTP estático). Cada nueva sesión ECDH genera nueva `session_key`, por lo tanto nuevo `TOTPu`.

### SoC (Separation of Concerns)

Este módulo ignora el propósito de la llave (asistencia); solo garantiza existencia de un canal cifrado exclusivo durante la ventana temporal. No gestiona lógica de negocio de asistencia.

## 6. Concepto: Subsistema de Proyección de Desafíos (Host Slice)

Este módulo se encarga de la generación y emisión de credenciales ópticas (QR). Opera en proyección continua sin sincronización con los lectores, manteniendo confidencialidad mediante cifrado dedicado.

### Lógica de Cifrado (Dedicated Payload)

El Host consulta la lista de asistentes registrados y recupera la `session_key` activa de cada uno. Genera un payload cifrado específicamente para cada estudiante usando su `session_key` individual.

- **Consecuencia:** Un QR proyectado para el Estudiante A es matemáticamente ilegible (basura de datos) para el Estudiante B.
- **Aislamiento criptográfico:** Solo el dueño de la `session_key` puede descifrar su QR correspondiente.

### Estrategia de Emisión (Hybrid Pool)

Se construye un pool de proyección dinámico que contiene:

1. **QRs Reales:** Uno por cada alumno registrado en la sesión y pendiente de completar su round actual.
2. **QRs Señuelo (Decoys):** Payloads cifrados con claves aleatorias descartadas (indescif rables por cualquier cliente). Propósito:
   - Ofuscar la cantidad real de asistentes.
   - Rellenar el pool hasta un mínimo de 10 elementos.
   - Dificultar análisis de tráfico.

### Persistencia del Pool (Valkey)

```
pool:{sessionId}              # Lista Redis (RPUSH/LPOP) - cola circular
student:session:{sessionId}:{studentId}  # Estado del estudiante
qr:metadata:{sessionId}:{studentId}:{round}  # Metadatos de QR (con TTL)
```

- **Pool de proyección:** Lista Redis con operaciones round-robin (LPOP → procesar → RPUSH).
- **Orden impredecible:** Estudiantes mezclados con señuelos en orden aleatorio.
- **TTL por QR:** Metadatos individuales expiran para prevenir reuso.

### Ciclo de Rotación (Round-Robin)

- **Visualización:** Se proyecta **un único QR** a la vez en pantalla.
- **Frecuencia:** Rotación rápida e ininterrumpida (configurable, default ~333ms por frame).
- **Persistencia en Cola:** Un alumno permanece en el pool (su QR sigue apareciendo en las rotaciones) hasta que:
  - Completa el round actual → se genera QR para siguiente round.
  - Completa todos los rounds → se retira del pool (ACK final).
  - Timeout o fallo crítico → se retira del pool.

## 7. Concepto: Captura Selectiva y Filtrado Local (Reader Slice)

El lector opera como un **Filtro Criptográfico Activo** en el lado del cliente (Edge), optimizando el ancho de banda y reduciendo la carga del servidor al descartar ruido localmente.

### Prerrequisito

Sesión Local Activa: `session_key` presente en memoria efímera (sessionStorage) tras login ECDH exitoso.

### Mecanismo de Escaneo

El sensor de cámara analiza el flujo de video continuamente buscando patrones QR. Al detectar uno, ejecuta la lógica de discriminación:

1. **Intento de Desencriptación:** Aplica la `session_key` local al payload.
   - *Fallo:* Indica que el QR es un señuelo, está corrupto o pertenece a otro usuario. **Acción:** Silencio absoluto, la cámara sigue escaneando.
2. **Verificación de Metadatos:** Si desencripta exitosamente, valida coherencia interna:
   - `uid` coincide con `userId` del JWT.
   - `ronda` coincide con `expectedRound` (round que el cliente espera actualmente).
   - *Fallo:* Datos incoherentes o round incorrecto. **Acción:** Silencio absoluto.
3. **Transmisión:** Solo si supera ambos filtros locales, se envía al backend:
   - Payload cifrado original.
   - `TOTPu` calculado localmente usando `session_key`.
   - Timestamp del cliente.

### Feedback de Usuario

La interfaz visual permanece en modo "Escaneando" hasta recibir una confirmación explícita de éxito del backend. No se muestra feedback por QRs descartados (para evitar revelar información).

### Comportamiento por Entorno

**Producción (ECDH real):**
- QR ajeno: falla desencriptación → silencio absoluto.
- Solo el dueño de la `session_key` puede descifrar su QR.
- Aislamiento criptográfico garantizado.

**Desarrollo (Mock Key compartida):**
- Todos los QRs se descifran con la misma clave de desarrollo.
- Filtrado se basa en metadatos (`uid`, `round`) en lugar de criptográfico.
- Permite testing sin implementar FIDO2/ECDH completo.
- Puede haber logging/debugging adicional.

## 8. Concepto: Pipeline de Validación y Confianza (Attendance Core)

El núcleo de procesamiento actúa como la autoridad transaccional. Su diseño garantiza que la identidad no sea repudiable, basándose en la **Identidad Federada (JWT)** y no en el contenido del QR.

### Validación Multi-Round

La asistencia NO se valida con un solo QR. El proceso requiere múltiples ciclos:

- **Rounds:** 3 ciclos de validación (configurable, default = 3).
- **Secuencia:** Cliente debe escanear QRs con `round: 1`, luego `round: 2`, luego `round: 3`.
- **Attempts:** 3 intentos ante fallos en cualquier round (configurable).
- **Estado del cliente:** Mantiene `expectedRound` para saber qué round buscar actualmente.

**Flujo típico:**

```
Round 1: Escanea → Valida → Servidor genera QR para round 2 → expectedRound = 2
Round 2: Escanea → Valida → Servidor genera QR para round 3 → expectedRound = 3
Round 3: Escanea → Valida → ASISTENCIA COMPLETA → Registro en PostgreSQL
```

Solo tras completar todos los rounds requeridos se registra la asistencia en la base de datos permanente.

### Entrada del Pipeline

- **Payload Cifrado:** QR escaneado (formato: `iv.ciphertext.authTag`).
- **TOTPu:** Time-based OTP derivado de `session_key`.
- **JWT:** Token de autenticación en header `Authorization`.

### Stages del Pipeline (10 etapas)

1. **Anclaje de Identidad:** Extrae el `userId` desde el JWT. Este es el único identificador confiable (no se confía en el contenido del QR).
2. **Recuperación de Contexto:** Usa el `userId` para obtener la `session_key` desde Valkey.
3. **Desencriptación Autoritaria:** Intenta descifrar el payload del QR usando la `session_key`. Si falla, se aborta (integridad comprometida o ataque).
4. **Validación de Estructura:** Verifica que el payload desencriptado cumple el schema `QRPayloadV1`.
5. **Validación de Propiedad (Ownership):** Verifica que `uid` del payload coincide con `userId` del JWT.
6. **Carga de Estado del QR:** Obtiene metadatos del QR desde Valkey (`qr:metadata:{sessionId}:{studentId}:{round}`).
7. **Validación de Existencia:** Verifica que el QR existe en el sistema.
8. **Validación de No-Consumo:** Comprueba que este QR no haya sido consumido previamente (Anti-Replay).
9. **Carga de Estado del Estudiante:** Obtiene `StudentState` desde Valkey.
10. **Validación Temporal (TOTPu):** Verifica que el `TOTPu` enviado esté dentro de la ventana de tolerancia (±30s) calculando `TOTP(session_key)` del lado del servidor.
11. **Validación de Round:** Verifica que el `round` del QR coincide con el `expectedRound` del estudiante.

Cualquier fallo en alguna etapa aborta el pipeline y se registra como intento de fraude en las métricas.

## 9. Concepto: Persistencia Idempotente y Cierre de Ciclo

Finaliza la transacción asegurando la consistencia del estado global sin duplicidad de datos.

### Registro (Idempotencia)

Si el pipeline es exitoso:
- **Primer intento:** Se registra el progreso del round en Valkey.
- **Round final completado:** Se persiste la asistencia completa en PostgreSQL.
- **Petición duplicada:** Si llega una segunda petición idéntica válida (race conditions de red), el sistema responde con "Éxito" pero no duplica el registro.

### Efectos Colaterales (Side-Effects)

1. **Progreso de Round:**
   - Si `round < maxRounds`: Generar QR para siguiente round y agregar al pool.
   - Si `round === maxRounds`: Calcular estadísticas finales y persistir en BD.

2. **ACK al Lector:** Envía respuesta `200 OK` al frontend del alumno con:
   - Estado actual (`partial` o `completed`).
   - `expectedRound` para siguiente ciclo (si aplica).
   - Estadísticas (si completó todos los rounds).

3. **Actualización del Pool:**
   - **Round parcial:** Reemplazar QR antiguo con QR del siguiente round.
   - **Completado:** Remover al estudiante del pool de proyección.
   - Disparar rebalanceo del pool (agregar/remover señuelos según sea necesario).

4. **Auditoría:** Persistir intento de validación en `validation_attempts` (PostgreSQL) para análisis de fraude y debugging.

---

## 10. Concepto: Autómatas de Estado (State Machines)

El sistema implementa dos FSMs (Finite State Machines) coordinados que gobiernan las transiciones de estado permitidas.

### Enrollment FSM

```
not_enrolled ──► pending ──► enrolled
                   │            │
                   └────────► revoked
```

**Transiciones:**

- `not_enrolled → pending`: Inicia enrollment (genera challenge FIDO2).
- `pending → enrolled`: Completa enrollment exitosamente (verifica credential + deriva `handshake_secret`).
- `enrolled → revoked`: Violación de política 1:1 o revocación manual/administrativa.
- `pending → revoked`: Timeout de enrollment (> 5 min) o cancelación del usuario.

**Invariante:** Un dispositivo solo puede estar `enrolled` para un único `userId` a la vez (política 1:1).

### Session FSM

```
no_session ──► session_active ──► session_expired ──► no_session
     ▲                                                      │
     └──────────────────────────────────────────────────────┘
```

**Transiciones:**

- `no_session → session_active`: Login ECDH exitoso (deriva `session_key`).
- `session_active → session_expired`: TTL expirado (2 horas desde creación).
- `session_expired → no_session`: Auto-cleanup ejecutado por garbage collector.
- `session_active → no_session`: Logout explícito (DELETE /api/session).

**Invariante:** Una `session_key` activa requiere `enrollment === enrolled`.

### Coordinación de Autómatas

**Restricción:** Session FSM solo permite transiciones si Enrollment FSM está en estado `enrolled`.

**Efecto en Access Gateway:**

El estado agregado del sistema se calcula como:

| Enrollment | Session | Restriction | → Estado Agregado |
|------------|---------|-------------|-------------------|
| `not_enrolled` | * | `false` | `NOT_ENROLLED` |
| `pending` | * | `false` | `NOT_ENROLLED` |
| `revoked` | * | `false` | `NOT_ENROLLED` |
| `enrolled` | `no_session` | `false` | `ENROLLED_NO_SESSION` |
| `enrolled` | `session_expired` | `false` | `ENROLLED_NO_SESSION` |
| `enrolled` | `session_active` | `false` | `READY` |
| * | * | `true` | `BLOCKED` (override) |

**Acción sugerida por estado:**

- `NOT_ENROLLED` → `action: 'enroll'` (iniciar enrollment FIDO2).
- `ENROLLED_NO_SESSION` → `action: 'login'` (iniciar login ECDH).
- `READY` → `action: 'scan'` (puede escanear QRs).
- `BLOCKED` → `action: null` (sin acción disponible).

### Orquestación

El `EnrollmentFlowOrchestrator` es responsable de evaluar el Enrollment FSM y la política 1:1 mediante `attemptAccess(userId, deviceFingerprint)`, retornando:

- `REQUIRES_ENROLLMENT`: Usuario no enrolado o dispositivo revocado.
- `REQUIRES_REENROLLMENT`: Conflicto 1:1 detectado (dispositivo usado por otro usuario).
- `ACCESS_GRANTED`: Usuario enrolado correctamente, cumple política 1:1.

---
**Caracterización Completa Finalizada.**
