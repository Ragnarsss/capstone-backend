# Flujo de Validacion QR con Rounds e Intentos

**Fecha:** 2025-11-28  
**Actualizado:** 2025-11-29  
**Estado:** Especificacion Tecnica  
**Rama:** fase-6-1-frontend-crypto

---

## Resumen

Este documento describe el flujo completo de validacion de asistencia mediante QR, incluyendo el manejo de rounds (rondas de validacion) e intentos (oportunidades ante fallos).

---

## Conceptos Clave

| Concepto | Definicion |
|----------|------------|
| **Round** | Ciclo de QR unico que el alumno debe completar exitosamente. Default: 3 rounds |
| **Intento** | Oportunidad de reiniciar si falla un round. Default: 3 intentos |
| **session_key** | Clave simetrica derivada de ECDH durante **login/sesion** (cada vez que participa) |
| **TOTPu** | TOTP del usuario, derivado de **session_key** (ver `14-decision-totp-session-key.md`) |
| **expectedRound** | Round que el cliente debe buscar, indicado por servidor |
| **Pool de Proyeccion** | Lista de QRs de estudiantes registrados + QRs falsos que el proyector cicla |

---

## Flujo Completo

### Fase 0: Registro en Sesion (PRERREQUISITO)

```text
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE: Registro Previo                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ANTES de escanear QRs, el alumno debe registrarse:             │
│                                                                 │
│ 1. Cliente envia POST /participation/register                  │
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
│ 1. Abre lector, obtiene session_key (de enrolamiento previo)   │
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
│    - Envia POST /validate                                       │
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
│ 4. SIEMPRE responde con expectedRound:                         │
│                                                                 │
│    Si VALIDO y round < maxRounds:                              │
│      → {success: true, expectedRound: round + 1}               │
│                                                                 │
│    Si VALIDO y round === maxRounds:                            │
│      → {success: true, complete: true, certainty: X}           │
│                                                                 │
│    Si INVALIDO y quedan intentos:                              │
│      → Consume intento SILENCIOSAMENTE                         │
│      → {success: true, expectedRound: 1}  ← REINICIA           │
│        (Cliente no sabe que fallo)                              │
│                                                                 │
│    Si INVALIDO y NO quedan intentos:                           │
│      → {success: false, noMoreAttempts: true,                  │
│         message: "Acercate al profesor/oficina"}               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 3: Cliente Continua

```text
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE (Continua)                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Recibe respuesta:                                               │
│                                                                 │
│ Si complete:                                                    │
│   → Muestra "Asistencia registrada" + certeza                  │
│   → Cierra lector                                               │
│                                                                 │
│ Si noMoreAttempts:                                              │
│   → Muestra "Acercate al profesor/oficina"                     │
│   → Cierra lector                                               │
│                                                                 │
│ Si success con expectedRound:                                   │
│   → expectedRound = response.expectedRound                     │
│   → REANUDA captura de QRs                                     │
│   → Busca QR con r === expectedRound                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ejemplos de Escenarios

### Escenario 1: Exito Directo

```text
Configuracion: maxRounds=3, maxAttempts=3

Cliente: expectedRound = 1
Escanea → encuentra QR con r=1 → envia
Servidor: OK → responde {success: true, expectedRound: 2}
Cliente: expectedRound = 2, reanuda

Escanea → encuentra QR con r=2 → envia
Servidor: OK → responde {success: true, expectedRound: 3}
Cliente: expectedRound = 3, reanuda

Escanea → encuentra QR con r=3 → envia
Servidor: OK → responde {complete: true, certainty: 85}
Cliente: Muestra exito, cierra
```

### Escenario 2: Fallo Silencioso en Round 2

```text
Cliente: expectedRound = 1
Escanea → encuentra QR con r=1 → envia
Servidor: OK → responde {success: true, expectedRound: 2}
Cliente: expectedRound = 2, reanuda

Escanea → encuentra QR con r=2 → envia
Servidor: FALLA (ej: timeout) 
         → consume intento 1 (quedan 2)
         → responde {success: true, expectedRound: 1}  ← REINICIA
Cliente: expectedRound = 1, reanuda (no sabe que fallo)

Escanea → encuentra QR con r=1 → envia
... continua desde round 1 ...
```

### Escenario 3: Agotar Intentos

```text
(3 fallos consecutivos)
Servidor: FALLA, intento 3 agotado
         → responde {success: false, noMoreAttempts: true}
Cliente: Muestra "Acercate al profesor/oficina", cierra
```

---

## Generacion y Vigencia de QR

- El QR del alumno se genera al momento de **registrar participacion** (POST `/participation/register`)
- El servidor agrega el QR encriptado al **pool de proyeccion** en Valkey
- Cada QR tiene un TTL controlado por backend (default: 30 segundos)
- Si el QR expira antes de usarse, el servidor genera uno nuevo automaticamente y lo agrega al pool
- El **proyector** cicla QRs del pool (QRs de estudiantes + QRs falsos) cada ~500ms
- La vigencia del QR es independiente del estado de la app del cliente

---

## Identificacion de QR Propio

El cliente identifica que un QR le pertenece cuando:

1. Puede descifrarlo exitosamente con su session_key
2. El campo `uid` del payload coincide con su userId
3. El campo `r` coincide con su `expectedRound`

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

### Mock vs Produccion

| Componente | Mock (Actual) | Produccion |
|------------|---------------|------------|
| session_key | MOCK_SESSION_KEY hardcodeada | Derivada de ECDH en login/sesion |
| TOTPu | Mock fijo o timestamp | TOTP real de **session_key** |
| userId | Parametro en request | Extraido de JWT de PHP |

### Fases de Implementacion

1. **Fase 6 (completada):** Backend con rounds e intentos
2. **Fase 6.1 (completada):** Infraestructura crypto frontend (mock keys)
3. **Fase 6.2 (completada):** UI state machine lector QR
4. **Fase 6.3:** Pool de proyeccion (QRs de estudiantes + falsos)
5. **Fase 7:** Persistencia PostgreSQL
6. **Fase 8:** QRs falsos adicionales
7. **Fase 9:** Enrolamiento FIDO2 + ECDH real
8. **Fase 10:** Integracion con login PHP real

---

## Referencias

- `documents/03-especificaciones-tecnicas/04-flujo-asistencia.md`
- `database/migrations/001-initial-schema.sql`
- `node-service/src/backend/attendance/`
