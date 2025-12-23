# Flujo de Validacion QR con Rounds e Intentos

**Fecha:** 2025-11-28
**Actualizado:** 2025-12-22
**Estado:** Especificacion Tecnica

---

## Resumen

Este documento describe el flujo completo de validacion de asistencia mediante QR, incluyendo el manejo de rounds (rondas de validacion) e intentos (oportunidades ante fallos).

**Prerequisito:** El usuario debe estar en estado `READY` segun el automata de enrollment.
Ver `spec-enrollment.md` para el flujo de enrollment y login.

---

## Conceptos Clave

| Concepto | Definicion |
|----------|------------|
| **Round** | Ciclo de QR unico que el alumno debe completar exitosamente. Default: 3 rounds |
| **Intento** | Oportunidad de reiniciar si falla un round. Default: 3 intentos |
| **session_key** | Clave simetrica derivada de ECDH durante **login ECDH** (POST `/api/session/login`) |
| **TOTPu** | TOTP del usuario, derivado de **session_key** (ver `14-decision-totp-session-key.md`) |
| **expectedRound** | Round que el cliente debe buscar, indicado por servidor |
| **Pool de Proyeccion** | Lista de QRs de estudiantes registrados + QRs falsos que el proyector cicla |

---

## Flujo Completo

### Fase 0: Verificacion de Estado (PRERREQUISITO)

```text
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE: Verificar Estado de Enrollment                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ANTES de escanear QRs, verificar estado:                       │
│                                                                 │
│ 1. Generar deviceFingerprint (hash de navigator properties)    │
│                                                                 │
│ 2. GET /api/access/state?deviceFingerprint={fingerprint}       │
│                                                                 │
│ 3. Si state !== "READY":                                        │
│    → Redirigir a /features/enrollment/                         │
│    → El usuario debe completar enrollment + login primero      │
│                                                                 │
│ 4. Si state === "READY":                                        │
│    → session_key disponible en sessionStorage                  │
│    → deviceFingerprint validado por Access Gateway             │
│    → Puede proceder a escanear                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 0.5: Registro en Sesion de Clase

```text
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE: Registro en Sesion                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Cliente envia POST /asistencia/api/attendance/register      │
│    {sessionId, studentId}                                       │
│                                                                 │
│ 2. Servidor:                                                    │
│    - Verifica que la sesion existe y esta activa               │
│    - Genera QR inicial para round 1                            │
│    - Almacena en Valkey:                                        │
│      * student:session:{sessionId}:{studentId}                 │
│      * qr:metadata:{sessionId}:{studentId}:{round} (TTL)       │
│    - Agrega QR encriptado al pool de proyeccion                │
│                                                                 │
│ 3. Respuesta: {success: true, expectedRound: 1}                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PROYECTOR: Ciclo de QRs                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ El proyector NO genera QRs propios. En cambio:                 │
│                                                                 │
│ 1. Lee el pool de proyeccion (QRs de estudiantes + falsos)     │
│ 2. Cicla entre ellos en orden aleatorio                        │
│ 3. Cada QR se muestra ~500ms antes de rotar                    │
│ 4. Los QRs falsos tienen formato valido pero clave invalida    │
│                                                                 │
│ IMPORTANTE:                                                     │
│ - En desarrollo (mock key): todos los QRs se descifran OK      │
│ - En produccion (ECDH): solo el duenio descifra SU QR          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 1: Cliente Escanea QRs

```text
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE (Lector QR)                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Abre lector, obtiene session_key de sessionStorage          │
│    (derivada previamente en login ECDH)                        │
│    Cliente inicializa: expectedRound = 1                        │
│                                                                 │
│ 2. Escanea QRs de la pantalla del proyector                    │
│    ┌──────────────────────────────────────────┐                │
│    │ Para cada QR escaneado:                  │                │
│    │   - Intenta descifrar con session_key    │                │
│    │   - Si falla descifrado → NO es mio      │                │
│    │   - Si exito:                            │                │
│    │     - Lee r del payload                  │                │
│    │     - Si r !== expectedRound → ignorar   │                │
│    │     - Si r === expectedRound → procesar  │                │
│    └──────────────────────────────────────────┘                │
│                                                                 │
│ 3. Cuando encuentra SU QR con round correcto:                  │
│    - PAUSA captura (modal abierto pero ignora QRs)             │
│    - Construye respuesta:                                       │
│      {                                                          │
│        ...payload_original,                                     │
│        TOTPu: generateTOTP(),                                   │
│        ts_client: Date.now(),                                   │
│      }                                                          │
│    - Cifra respuesta con session_key                           │
│    - Envia POST /api/attendance/validate                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 2: Servidor Valida

```text
┌─────────────────────────────────────────────────────────────────┐
│ SERVIDOR                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Descifra respuesta con session_key                          │
│ 2. Valida TOTPu, payload, timestamp, etc.                      │
│ 3. Calcula RT (Response Time)                                  │
│                                                                 │
│ 4. Respuestas:                                                  │
│                                                                 │
│    Si VALIDO y round < maxRounds:                              │
│      → {success: true, data: {status: 'partial',               │
│         next_round: round + 1}}                                 │
│                                                                 │
│    Si VALIDO y round >= maxRounds:                             │
│      → {success: true, data: {status: 'completed',             │
│         stats: {roundsCompleted, avgResponseTime, certainty}}} │
│      (Usar >= para robustez en caso de salto de round)         │
│                                                                 │
│    Si INVALIDO:                                                 │
│      → {success: false, error: {code, message}}                │
│      (El cliente recibe el error y puede mostrar feedback)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**DEUDA TECNICA:** Reintento silencioso (consumir intento sin informar al cliente) fue considerado pero no implementado. Requiere investigacion para evaluar:

- Beneficios de seguridad: atacante no sabe cuando falla
- Desventajas UX: usuario sin feedback de error
- Complejidad: requiere estado de intentos en el flujo de respuesta

### Fase 3: Cliente Continua

```text
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE (Continua)                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Recibe respuesta:                                               │
│                                                                 │
│ Si status === 'completed':                                      │
│   → Muestra "Asistencia registrada" + certeza                  │
│   → Cierra lector                                               │
│                                                                 │
│ Si status === 'partial':                                        │
│   → next_round = response.data.next_round                      │
│   → REANUDA captura de QRs                                     │
│   → Busca QR con r === next_round                              │
│                                                                 │
│ Si error:                                                       │
│   → Muestra mensaje de error al usuario                        │
│   → Puede reintentar escaneo                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ejemplos de Escenarios

### Escenario 1: Exito Directo

```text
Configuracion: maxRounds=3

Cliente: next_round = 1
Escanea → encuentra QR con r=1 → envia
Servidor: OK → responde {success: true, data: {status: 'partial', next_round: 2}}
Cliente: next_round = 2, reanuda

Escanea → encuentra QR con r=2 → envia
Servidor: OK → responde {success: true, data: {status: 'partial', next_round: 3}}
Cliente: next_round = 3, reanuda

Escanea → encuentra QR con r=3 → envia
Servidor: OK → responde {success: true, data: {status: 'completed', stats: {...}}}
Cliente: Muestra exito, cierra
```

### Escenario 2: Fallo con Error Visible

```text
Cliente: next_round = 1
Escanea → encuentra QR con r=1 → envia
Servidor: OK → responde {success: true, data: {status: 'partial', next_round: 2}}
Cliente: next_round = 2, reanuda

Escanea → encuentra QR con r=2 → envia
Servidor: FALLA (ej: TOTP invalido)
         → responde {success: false, error: {code: 'TOTP_INVALID', message: '...'}}
Cliente: Muestra error, puede reintentar escaneo
```

### Escenario 3: QR Expirado

```text
Cliente: next_round = 2
QR actual expira (TTL 60s)

Cliente: POST /attendance/refresh-qr {sessionId, studentId}
Servidor: Genera nuevo QR para round 2
         → responde {success: true, data: {next_round: 2, qrTTL: 60}}
Cliente: Continua esperando QR con r=2
```

---

## Generacion y Vigencia de QR

- El QR del alumno se genera al momento de **registrar participacion** (POST `/asistencia/api/attendance/register`)
- El servidor agrega el QR encriptado al **pool de proyeccion** en Valkey
- Cada QR tiene un TTL controlado por backend (default: 60 segundos)
- Si el QR expira antes de usarse, el servidor genera uno nuevo automaticamente y lo agrega al pool
- El **proyector** cicla QRs del pool (QRs de estudiantes + QRs falsos) cada ~500ms
- La vigencia del QR es independiente del estado de la app del cliente

### Manejo de QR Expirado

Si el QR expira antes de ser escaneado:

1. Cliente puede solicitar `POST /attendance/refresh-qr {sessionId, studentId}`
2. Servidor genera nuevo QR para el round actual
3. Se actualiza el pool de proyeccion
4. Respuesta: `{success: true, data: {next_round, qrTTL}}`

---

## Identificacion de QR Propio

El cliente identifica que un QR le pertenece cuando:

1. Puede descifrarlo exitosamente con su session_key
2. El campo `uid` del payload coincide con su userId
3. El campo `r` coincide con su `next_round` esperado

QRs de otros estudiantes o con rounds incorrectos son ignorados silenciosamente.

---

## Calculo de Certeza

Al completar los N rounds, el servidor calcula la certeza basandose en:

- **Response Time (RT)** de cada round
- **Desviacion estandar** de los RTs
- **Promedio** de RTs

Criterios:

- RT consistente (baja desviacion) → mayor certeza
- RT en rango humano realista (800ms - 3000ms) → mayor certeza
- RT muy rapido (<300ms) o muy lento (>15s) → menor certeza (sospechoso)

---

## Notas de Implementacion

### Origen de session_key

La `session_key` se deriva durante el **login ECDH** (POST `/api/session/login`):

1. Usuario completa enrollment FIDO2 (una vez)
2. Usuario hace login ECDH (cada sesion)
3. Cliente y servidor derivan `session_key` via ECDH + HKDF
4. Cliente almacena en sessionStorage (TTL: 2 horas)
5. session_key se usa para cifrar/descifrar QRs

### Mock vs Produccion

| Componente | Mock (Desarrollo) | Produccion |
|------------|-------------------|------------|
| session_key | MOCK_SESSION_KEY hardcodeada | Derivada de ECDH en login |
| TOTPu | Mock fijo o timestamp | TOTP real de **session_key** |
| userId | Parametro en request | Extraido de JWT de PHP |

---

## Referencias

- `spec-enrollment.md` - Prerequisito: enrollment + login
- `documents/03-especificaciones-tecnicas/04-flujo-asistencia.md`
- `documents/03-especificaciones-tecnicas/14-decision-totp-session-key.md`
- `node-service/src/backend/attendance/`
