# Decisiones Arquitectónicas

## Propósito

Documentar las decisiones técnicas clave tomadas en el diseño del sistema, justificando el **por qué** de cada elección.

---

## DA-001: Monolito Modular vs Microservicios

### Decisión

**Elegido:** Monolito Modular con Vertical Slicing

**Alternativas consideradas:**

1. Microservicios independientes (Enrolamiento + Asistencia)
2. Monolito tradicional en capas
3. Monolito modular con módulos de dominio

### Justificación

**Razones para elegir Monolito Modular:**

- **Escala actual:** 50-200 usuarios concurrentes no justifica complejidad operacional de microservicios
- **Simplicidad operacional:** 1 deploy, 1 monitor, 1 proceso de debugging
- **Sin latencia de red interna:** Llamadas entre módulos son in-process
- **Arquitectura de datos independientes:** 3 bases de datos (PHP Legacy, Node Cache, Node Persistente) con comunicacion via HTTP
- **Desarrollo individual:** Menor overhead de coordinacion
- **Migracion futura posible:** Interfaces claras permiten extraer a microservicios si escala

**SoC mantenida mediante:**

- Módulos con interfaces bien definidas
- Vertical Slice Architecture
- Schemas de BD separados en Node Persistente (enrollment, attendance)
- BD Cache (Valkey) para datos temporales
- Acceso a BD PHP Legacy solo vía HTTP endpoints (sin acceso directo)
- Responsabilidades claras por módulo

### Consecuencias

**Positivas:**

- Menor complejidad de deployment
- Debugging más simple
- Menos recursos de infraestructura
- Desarrollo más rápido

**Negativas:**

- Escalado horizontal limitado (toda la app escala junta)
- Acoplamiento potencial si no se mantiene disciplina
- Despliegues impactan ambos módulos

### Revisión

Revisar si usuarios concurrentes > 500 o si módulos requieren escalado independiente.

---

## DA-002: Arquitectura de 3 Bases de Datos Independientes

### Decisión

**Elegido:** 3 bases de datos completamente independientes con comunicación HTTP

1. **BD PHP Legacy (PostgreSQL)** - Servidor producción PHP
2. **BD Node Cache (Valkey/Redis)** - Datos temporales con TTL
3. **BD Node Persistente (PostgreSQL)** - Datos criptográficos persistentes

**Alternativas consideradas:**

1. Base de datos única compartida entre PHP y Node
2. Dos bases de datos (una compartida PHP-Node + una cache)
3. Tres bases de datos independientes (ELEGIDA)

### Justificación

**Por qué 3 bases de datos independientes:**

- **Separación de responsabilidades:**
  - PHP Legacy: Gestión académica existente (usuarios, cursos, inscripciones)
  - Node Cache: Performance temporal (QR metadata, sessions, cache)
  - Node Persistente: Seguridad criptográfica (FIDO2 devices, validaciones)

- **Aislamiento de datos críticos:**
  - BD PHP Legacy contiene datos sensibles estudiantiles (no exponerlos a Node)
  - BD Node Persistente contiene claves criptográficas (no mezclar con legacy)
  - Cache es volátil por diseño (TTL automático, sin persistencia)

- **Minimizar intervención en servidor producción:**
  - PHP Legacy es sistema en producción activo
  - Node es módulo contenido, no debe modificar infraestructura existente
  - Comunicación solo vía endpoints HTTP controlados

- **Principio de mínimo privilegio:**
  - Node NO tiene credenciales de BD PHP Legacy
  - PHP NO tiene credenciales de BD Node
  - Cada servicio accede solo a su propia BD

**Por qué NO base de datos compartida:**

- Requeriría modificar servidor PHP en producción
- Exponería esquemas legacy a Node (riesgo de queries incorrectos)
- Acoplamiento fuerte entre PHP y Node
- Dificulta testing independiente

**Por qué NO dos bases de datos:**

- Mezclar datos académicos legacy con datos criptográficos es antipatrón
- Cache debe ser separado para evitar contaminar datos persistentes
- Backups tendrían estrategias diferentes (cache no se respalda)

### Patrón de Comunicación

**Node necesita datos de PHP:**

```typescript
// Node NO consulta directamente BD PHP Legacy
// PROHIBIDO: await db_php.query('SELECT * FROM usuarios')

// CORRECTO: HTTP request con JWT interno
const userData = await PHPLegacyClient.getUserById(userId);
// Internamente:
// 1. Genera JWT_INTERNAL (JWT_SECRET_INTERNAL, TTL 1hr)
// 2. POST https://php-service/api/get_usuario.php
// 3. PHP ejecuta: get_usuario_actual() via db.inc
// 4. PHP retorna JSON
// 5. Node cachea en Valkey (TTL 300s)
```

**PHP necesita datos de Node:**

```php
// PHP NO consulta directamente BD Node
// PROHIBIDO: pg_query($conn_node, 'SELECT * FROM enrollment.devices')

// CORRECTO: HTTP request con JWT interno
$deviceData = NodeIntegration::getDeviceByUserId($userId);
// Internamente:
// 1. Genera JWT_INTERNAL (JWT_SECRET_INTERNAL, TTL 1hr)
// 2. POST https://node-service:3000/api/internal/device
// 3. Node ejecuta query a su propia BD
// 4. Node retorna JSON
// 5. PHP procesa respuesta
```

### Consecuencias

**Positivas:**

- Aislamiento completo de datos críticos
- Minimiza riesgo de corrupción de BD Legacy
- Facilita testing (cada BD puede tener fixtures independientes)
- Backups independientes (cache sin backup, persistente diario, legacy propio)
- Cumple principio de mínimo privilegio
- Permite evolución independiente de schemas

**Negativas:**

- Latencia adicional por HTTP requests (mitigado con cache Valkey)
- Complejidad de sincronización (mitigado con TTL apropiados)
- Requiere endpoints HTTP adicionales para comunicación interna
- Debugging más complejo (3 fuentes de verdad)

### Estrategia de Cache

Para minimizar latencia de consultas cross-database:

```typescript
// Datos de usuario se cachean 5 minutos
await valkey.setex(`cache:php:user:${userId}`, 300, JSON.stringify(userData));

// Datos de curso se cachean 10 minutos (cambian menos)
await valkey.setex(`cache:php:course:${courseId}`, 600, JSON.stringify(courseData));

// Metadatos QR temporales (2 minutos)
await valkey.setex(`qr:session:${sessionId}:${userId}:${round}`, 120, JSON.stringify(metadata));
```

### Seguridad

**JWT_SECRET vs JWT_SECRET_INTERNAL:**

- **JWT_SECRET:** Usuario final (TTL 5 min) - Para autenticación cliente-servidor
- **JWT_SECRET_INTERNAL:** Comunicación interna (TTL 1 hr) - Para comunicación PHP↔Node

**Separación de secrets previene:**

- Compromiso de JWT de usuario no compromete comunicación interna
- Rate limiting diferenciado
- Auditoría separada de requests externos vs internos

### Documentación Completa

Ver detalles técnicos en: [08-arquitectura-datos.md](08-arquitectura-datos.md)

---

## DA-003: ECDH vs Derivación Directa de session_key

### Decisión

**Elegido:** ECDH (Elliptic Curve Diffie-Hellman) para key exchange

**Alternativas consideradas:**

1. Derivar session_key directamente de firma FIDO2
2. Pre-shared key derivada en enrolamiento
3. ECDH

### Justificación

**Por qué ECDH:**

- **Perfect Forward Secrecy (PFS):** Compromiso futuro de claves no afecta sesiones pasadas
- **Estándar probado:** TLS 1.3, Signal Protocol usan ECDH
- **Claves efímeras:** Generadas por sesión, destruidas después
- **Sin transmisión de clave simétrica:** `session_key` nunca viaja por red
- **Librerías maduras:** Web Crypto API (browser), Node.js crypto

**Por qué NO derivación directa:**

- Firmas FIDO2 incluyen challenge aleatorio (no determinístico)
- Difícil extraer material key consistente

**Por qué NO pre-shared key:**

- Compromiso de `handshake_secret` compromete todas las sesiones futuras
- Sin forward secrecy

### Consecuencias

**Positivas:**

- PFS garantizado
- Arquitectura auditada por comunidad
- Fácil de implementar con librerías estándar

**Negativas:**

- Overhead de generación de pares efímeros
- Requiere transmitir claves públicas (overhead de red)

### Complejidad de Implementación

**Complejidad:** Media (3/5)

- APIs disponibles en browser y Node.js
- Documentación abundante
- Ejemplos en TLS 1.3

---

## DA-003: N Rondas de Validación

### Decisión

**Elegido:** N rondas de validación (N=3 por defecto, configurable 3-5)

**Alternativas consideradas:**

1. 1 ronda (QR único)
2. 2 rondas
3. N rondas (3-5)

### Justificación

**Por qué N >= 3:**

- **Seguridad probabilística:** Atacante debe acertar N payloads consecutivos
- **Validación estadística:** Permite calcular std_dev, detectar anomalías
- **Resistencia a captura de pantalla:** Dificulta transmisión diferida
- **Detección de bots:** Scripts tienen tiempos inconsistentes

**Cálculo de probabilidad:**

```
P(ataque exitoso) = (1 / 2^32)^N

N=1: 1 / 4,294,967,296 (0.00000002%)
N=3: 1 / 7.9 x 10^28 (prácticamente 0)
```

**Por qué NO 1 ronda:**

- Vulnerable a captura de pantalla + reenvío
- Sin datos estadísticos para validación

**Por qué NO >5 rondas:**

- Experiencia de usuario degradada (tiempo excesivo)
- Datos adicionales no mejoran significativamente certeza

### Consecuencias

**Positivas:**

- Alta resistencia a fraude
- Validación estadística robusta
- Balance seguridad-UX

**Negativas:**

- Tiempo de proceso ~30-90 segundos (según rotación)
- Mayor complejidad en backend

---

## DA-004: TOTP Dual (TOTPu + TOTPs)

### Decisión

**Elegido:** Sistema dual TOTP

- **TOTPu:** Vinculado a sesión/dispositivo (basado en `handshake_secret`)
- **TOTPs:** Vinculado a QR específico (anti-replay)

**Alternativas consideradas:**

1. TOTP único (solo TOTPs)
2. Nonce aleatorio (sin TOTP)
3. TOTP dual

### Justificación

**TOTPu (Usuario/Sesión):**

- **Propósito:** Verificar que dispositivo es el mismo que se enroló
- **Basado en:** `handshake_secret` único por dispositivo
- **Duración:** Toda la sesión
- **Transmitido:** En cada validación

**TOTPs (Servidor/QR):**

- **Propósito:** Anti-replay, validar QR legítimo
- **Basado en:** `sessionId + userId + ronda + SERVER_SECRET`
- **Duración:** 30 segundos
- **Transmitido:** Dentro de payload encriptado

**Por qué dual:**

- Dos capas de validación temporal
- TOTPu vincula a dispositivo físico
- TOTPs previene replay attacks
- Complementarios (no redundantes)

### Consecuencias

**Positivas:**

- Alta resistencia a replay
- Device binding robusto
- Validación temporal multi-capa

**Negativas:**

- Mayor complejidad en generación/validación
- Drift de reloj puede causar fallos (mitigado con ventana de 3 períodos)

---

## DA-005: AES-256-GCM para Payloads

### Decisión

**Elegido:** AES-256-GCM para encriptación de payloads

**Alternativas consideradas:**

1. AES-128-GCM
2. AES-256-CBC + HMAC
3. AES-256-GCM
4. ChaCha20-Poly1305

### Justificación

**Por qué AES-256-GCM:**

- **AEAD:** Authenticated Encryption with Associated Data
- **Confidencialidad + Integridad:** Un solo algoritmo
- **Hardware acceleration:** AES-NI en CPUs modernos
- **Estándar:** NIST aprobado, ampliamente usado
- **Soporte nativo:** Web Crypto API, Node.js crypto

**Por qué NO AES-128:**

- 256 bits ofrece margen de seguridad futuro
- Overhead mínimo vs beneficio de seguridad

**Por qué NO AES-CBC + HMAC:**

- Dos operaciones (encrypt + MAC)
- Vulnerable a padding oracle si mal implementado

**Por qué NO ChaCha20-Poly1305:**

- Menor soporte en hardware
- AES-NI lo hace más rápido en x86

### Consecuencias

**Positivas:**

- Rendimiento excelente (hardware accel)
- Seguridad probada
- APIs maduras

**Negativas:**

- IV management crítico (nunca reutilizar)

---

## DA-006: Validación Estadística (Umbral de Certeza)

### Decisión

**Elegido:** Algoritmo de umbral basado en std_dev y avg_RT

```
if (std_dev < 500 AND 800 < avg_RT < 3000):
  certeza = 95% -> PRESENTE
elif (std_dev < 1000 AND 500 < avg_RT < 5000):
  certeza = 70% -> PRESENTE
elif (std_dev < 2000 AND 300 < avg_RT < 8000):
  certeza = 50% -> DUDOSO
else:
  certeza = 20% -> AUSENTE
```

**Alternativas consideradas:**

1. Umbral fijo (RT < 5s = presente)
2. Machine Learning
3. Algoritmo estadístico simple

### Justificación

**Por qué algoritmo estadístico:**

- **std_dev detecta consistencia:** Humanos tienen tiempos consistentes, bots no
- **avg_RT detecta rango realista:** 800-3000ms es tiempo humano típico
- **No requiere entrenamiento:** Funciona desde día 1
- **Interpretable:** Profesores entienden la lógica
- **Ajustable:** Umbrales pueden calibrarse con datos reales

**Por qué NO umbral fijo:**

- Vulnerable a bots programados con delay fijo

**Por qué NO ML:**

- Requiere datos de entrenamiento
- Black box (difícil explicar decisiones)
- Overhead de infraestructura

### Calibración

Valores iniciales basados en pruebas de concepto:

- Tiempo escaneo humano: 800-3000ms (avg ~1200ms)
- std_dev humano típico: 200-800ms
- Bot tiene std_dev < 50ms (muy consistente) o > 3000ms (muy errático)

**Revisión:** Después de 100 registros reales, calibrar umbrales.

---

## DA-007: Rotación Aleatoria de QR (500ms)

### Decisión

**Elegido:** Rotación aleatoria cada 500ms

**Alternativas consideradas:**

1. Rotación secuencial (round-robin)
2. Rotación aleatoria (cada 250ms, 500ms, 1000ms)
3. QR estático por usuario

### Justificación

**Por qué rotación aleatoria:**

- Previene que atacante prediga cuándo aparecerá QR específico
- Más difícil capturar pantalla en momento preciso
- Usuarios deben estar atentos continuamente

**Por qué 500ms:**

- Balance entre velocidad y capturabilidad
- Usuarios pueden enfocar cámara y capturar
- Suficientemente rápido para dificultar captura manual de pantalla

**Por qué NO secuencial:**

- Predecible (atacante puede calcular cuándo aparecerá QR)

**Por qué NO estático:**

- Trivial de fotografiar y retransmitir

**Por qué NO 250ms:**

- Demasiado rápido, usuarios legítimos fallan capturas

**Por qué NO 1000ms:**

- Demasiado lento, facilita captura de pantalla

### Consecuencias

**Positivas:**

- Alto nivel de seguridad
- Experiencia de usuario razonable

**Negativas:**

- Usuarios deben mantener atención durante ~1-2 minutos
- Puede ser frustrante si QR tarda en aparecer

---

## DA-008: Valkey para Cache vs Redis

### Decisión

**Elegido:** Valkey (fork de Redis)

**Alternativas consideradas:**

1. Redis
2. Valkey
3. Memcached

### Justificación

**Por qué Valkey:**

- Fork open-source de Redis (post-licencia restrictiva)
- API compatible 100% con Redis
- Gobernanza Linux Foundation
- Futuro asegurado (no riesgo de cambio de licencia)
- Mismo rendimiento que Redis

**Por qué NO Redis:**

- Cambio de licencia a SSPL/RSALv2 (restrictiva)
- Incertidumbre legal para uso corporativo

**Por qué NO Memcached:**

- Menos features (sin TTL por key, sin data structures)
- Solo key-value simple

### Uso en Sistema

- QR metadata (TTL 2 minutos)
- Anti-replay (marcar QR como usado)
- Cola de proyección (list)
- Session keys (TTL 2 horas)

---

## DA-009: Frontend Separado de Backend

### Decisión

**Elegido:** Frontend (PHP + browser) completamente separado de Backend (Node.js)

**Alternativas consideradas:**

1. Backend renderiza UI (monolito tradicional)
2. API + SPA separados
3. API + SSR (Server-Side Rendering)

### Justificación

**Por qué separación:**

- **SoC:** Preocupaciones claramente divididas
- **Escalabilidad:** Frontend y backend escalan independientemente
- **Desarrollo paralelo:** Equipos pueden trabajar independientemente
- **Tecnología apropiada:** PHP para UI legacy, Node.js para crypto
- **Testing:** Unit tests backend sin UI

**PHP Service (Orquestador):**

- UI y templates
- Proxy HTTP a Node service
- Gestión de sesiones web
- NO lógica criptográfica

**Node Service (Backend):**

- Lógica de negocio
- Criptografía
- Validaciones
- Acceso a BD

### Consecuencias

**Positivas:**

- Responsabilidades claras
- Más fácil de mantener
- Permite migrar frontend gradualmente

**Negativas:**

- Hop adicional (PHP -> Node)
- Mayor complejidad de deployment inicial

---

## DA-010: PostgreSQL 18 con Schemas Separados

### Decisión

**Elegido:** PostgreSQL 18 con 2 schemas (`enrollment`, `attendance`)

**Alternativas consideradas:**

1. 2 bases de datos separadas
2. 1 base de datos, 2 schemas
3. 1 base de datos, 1 schema

### Justificación

**Por qué 1 BD + 2 schemas:**

- **Separación lógica:** Dominios claros
- **Transacciones simples:** Mismo BD, sin distributed transactions
- **Backups unificados:** Un solo backup para todo
- **Migración futura fácil:** Schemas pueden moverse a BDs separadas

**Por qué NO 2 BDs:**

- Mayor complejidad operacional
- Transacciones cross-DB complejas
- Overhead de conexiones

**Por qué NO 1 schema:**

- Acoplamiento de dominios
- Nombres de tabla pueden colisionar

### Estructura

```
asistencia_db/
├── enrollment/
│   ├── devices
│   └── enrollment_history
└── attendance/
    ├── sessions
    ├── records
    └── round_details
```

---

## DA-011: Arquitectura JWT vs PHP Proxy

### Decisión

**Elegido:** PHP emite JWT, cliente comunica directamente con Node.js

**Alternativas consideradas:**

1. PHP como proxy HTTP (patrón original planificado)
2. PHP emite JWT, cliente habla directo con Node
3. Node.js maneja autenticación completamente

### Justificación

**Por qué JWT Pattern (implementado):**

- **Mínima invasividad:** Solo 1 archivo PHP nuevo (api_puente_minodo.php)
- **Separación de responsabilidades:** PHP solo autentica, Node solo valida tokens
- **Escalabilidad:** Node puede escalar independiente sin afectar sesiones PHP
- **Latencia reducida:** Cliente habla directo con Node, sin hop extra por PHP
- **Stateless:** JWT permite balanceo de carga sin sesiones compartidas

**Por qué NO PHP Proxy:**

- Alta invasividad (múltiples archivos PHP modificados)
- Acoplamiento fuerte PHP-Node
- Latencia adicional (PHP intermedia todas las requests)
- Dificulta escalado independiente

**Por qué NO Node autentica:**

- Requiere duplicar lógica de autenticación
- Migración compleja del monolito PHP existente
- Usuarios tendrían que re-autenticarse

### Implementación

**PHP Service ("El Portero"):**

- Verifica sesión PHP existente
- Emite JWT firmado (HMAC-SHA256)
- Validez: 5 minutos
- Payload: userId, username, rol, nombreCompleto

**Node Service ("El Especialista"):**

- Valida firma JWT con secret compartido
- Verifica issuer, audience, expiration
- Extrae datos de usuario del payload
- Todos los endpoints protegidos con middleware JWT

### Arquitectura

```
Cliente → PHP (/api_puente_minodo.php)
         ↓
     JWT emitido
         ↓
Cliente → Node.js (/minodo-api/*)
    (Authorization: Bearer JWT)
```

### Consecuencias

**Positivas:**

- Migración no invasiva al monolito PHP
- Fácil rollback si hay problemas
- Node.js completamente stateless
- Permite futura migración a microservicios

**Negativas:**

- Requiere secret compartido entre PHP y Node
- Token puede ser interceptado (mitigado con HTTPS)
- - Expiration de 5 min requiere renovación

### Referencias

- Implementado en: php-service/src/api_puente_minodo.php
- Documentación: ARQUITECTURA_JWT.md
- Recomendación original: documents/planificacion/recomendacion.md

---

## DA-010: Autenticación JWT en WebSocket (Opción 5B)

### Decisión

**Elegido:** JWT enviado como **primer mensaje** WebSocket (Opción 5B)

**Alternativas consideradas:**

1. JWT en query parameter (`ws://...?token=xyz`)
2. JWT en subprotocol header
3. JWT en custom header (limitado en browsers)
4. Envío posterior al handshake
5. **Opción 5B:** JWT en primer mensaje después de handshake

### Justificación

**Por qué Opción 5B:**

- **No expone token en URL:** Query parameters quedan en logs (Apache, proxies, browser history)
- **Compatible con todos los browsers:** No requiere custom headers
- **Control de timeout:** Servidor puede cerrar conexión si no recibe AUTH en 5 segundos
- **Códigos de cierre personalizados:** 4401 (no auth), 4403 (invalid), 4408 (timeout)
- **Patrón profesional:** Usado por Socket.IO, Discord, Slack

**Por qué NO query parameter:**

```
[FAIL] ws://localhost:3000/asistencia/ws?token=eyJhbG...
   └─ Token queda en logs Apache, DevTools, proxies
```

**Por qué NO custom headers:**

- WebSocket API no permite headers arbitrarios en browsers
- Requiere modificar handshake HTTP (complejo)

**Por qué NO subprotocol:**

- Subprotocols son para negociación de protocolos, no auth
- No semántico usar `Sec-WebSocket-Protocol: jwt, eyJhbG...`

### Implementación

**Cliente (websocket.client.js):**

```javascript
ws.onopen = () => {
  // PRIMER mensaje: AUTH
  ws.send(JSON.stringify({
    type: 'AUTH',
    token: jwtToken
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'auth-ok') {
    console.log('Autenticado correctamente');
    // Continuar con flujo normal
  } else if (msg.type === 'error') {
    console.error('Error de autenticación:', msg.payload);
  }
};
```

**Servidor (websocket-controller.ts):**

```typescript
let isAuthenticated = false;

// Timeout de 5 segundos
const authTimeout = setTimeout(() => {
  if (!isAuthenticated) {
    ws.close(4408, 'Authentication timeout');
  }
}, 5000);

ws.on('message', async (data) => {
  const message = JSON.parse(data.toString());
  
  // Primer mensaje DEBE ser AUTH
  if (!isAuthenticated && message.type !== 'AUTH') {
    ws.close(4401, 'Authentication required');
    return;
  }
  
  if (message.type === 'AUTH') {
    try {
      const user = JWTUtils.verify(message.token);
      isAuthenticated = true;
      clearTimeout(authTimeout);
      
      ws.send(JSON.stringify({
        type: 'auth-ok',
        payload: { userId: user.userId, username: user.username }
      }));
      
      // Iniciar proyección QR
      startProjection();
      
    } catch (error) {
      ws.close(4403, 'Invalid token');
    }
  }
  
  // Resto de mensajes (solo si autenticado)
  // ...
});
```

### Códigos de Cierre Definidos

| Código | Razón | Descripción |
|--------|-------|-------------|
| 4401 | No Authenticated | Cliente no envió mensaje AUTH |
| 4403 | Invalid Token | JWT inválido o expirado |
| 4408 | Auth Timeout | Timeout de 5s esperando AUTH |
| 1000 | Normal | Cierre normal |

### Consecuencias

**Positivas:**

- [OK] Token NO queda en logs
- [OK] Compatible con todos los browsers
- [OK] Control de timeout granular
- [OK] Códigos de cierre semánticos
- [OK] Patrón ampliamente usado en industria

**Negativas:**

- [WIP] Requiere handshake manual (1 roundtrip extra)
- [WIP] Cliente debe manejar estados (no auth → auth)

### Estado

**Implementado:** [OK] Sí (2025-11-03)

**Archivos:**

- `node-service/src/frontend/modules/websocket/websocket.client.js`
- `node-service/src/modules/qr-projection/presentation/websocket-controller.ts`
- `node-service/src/modules/qr-projection/presentation/types.ts`

**Probado:** [OK] Dev + Prod (compose.dev.yaml, compose.prod.yaml)

### Referencias

- Documentado en: documents/planificacion/09-protocolo-websocket.md
- Guía completa: documents/10-guia-integracion-php-node.md
- Arquitectura JWT: ARQUITECTURA_JWT.md

---

## DA-012: Separación de Flujos por Entry Points

### Decisión

**Elegido:** Separación mediante **entry points diferentes** en sistema legacy PHP

**Alternativas consideradas:**

1. Detección de rol en iframe (decodificar JWT)
2. Entry points separados en PHP legacy
3. Redireccionamiento en backend Node

### Justificación

**Por qué Entry Points Separados:**

- **Mínima invasión al legacy:** No requiere modificar lógica PHP existente
- **SoC estricto:** Cada rol tiene su propia aplicación frontend
- **No detección necesaria:** Iframe ya sabe qué modo cargar
- **Escalabilidad:** Fácil agregar nuevos roles con nuevos entry points
- **Testing independiente:** Cada aplicación se prueba por separado

**Arquitectura implementada:**

```text
Sistema Legacy PHP:
├── Página profesores
│   └── Botón "Proyectar QR" → iframe /asistencia/app/
│       ├── PHP emite JWT con rol:"profesor"
│       ├── iframe carga websocket.client.js
│       └── Conecta WebSocket /asistencia/ws
│
└── Página alumnos (futuro)
    └── Botón "Mi Asistencia" → iframe /asistencia/guest/
        ├── PHP emite JWT con rol:"alumno"
        ├── iframe carga guest-app.js
        └── Verifica enrollment y redirige
```

**Por qué NO detección de rol:**

```javascript
[FAIL] // Esto NO se implementó (innecesario)
if (rol === 'profesor') {
  cargarModoAnfitrion();
} else {
  cargarModoInvitado();
}
```

- Requiere lógica adicional en iframe
- Acopla ambos flujos en misma aplicación
- Dificulta testing independiente

**Por qué NO redireccionamiento backend:**

- Backend Node no debe decidir UI
- Aumenta latencia (1 roundtrip extra)
- Legacy PHP ya tiene la lógica de routing

### Implementación

**Entry Points PHP:**

```php
// Profesor
<iframe src="/asistencia/app/"></iframe>

// Alumno (futuro)
<iframe src="/asistencia/guest/"></iframe>
```

**Fastify Routes (Node):**

```typescript
// Servir frontend anfitrión
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'frontend/app'),
  prefix: '/asistencia/app/'
});

// Servir frontend invitado (futuro)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'frontend/guest'),
  prefix: '/asistencia/guest/'
});
```

### Consecuencias

**Positivas:**

- [OK] Separación clara de responsabilidades
- [OK] Código más mantenible
- [OK] Testing independiente por rol
- [OK] No rompe flujo Anfitrión existente
- [OK] Fácil agregar nuevos roles

**Negativas:**

- [WIP] Duplicación de código común (mitigado con módulos shared)
- [WIP] Requiere dos aplicaciones frontend

### Estado

**Implementado parcialmente:**

- [OK] Flujo Anfitrión (`/asistencia/app/`) - 100% funcional
- [FAIL] Flujo Invitado (`/asistencia/guest/`) - Pendiente implementar

### Referencias

- Documentado en: documents/planificacion/12-propuesta-separacion-roles.md
- Arquitectura completa: documents/planificacion/01-arquitectura-general.md

---

## Resumen de Decisiones

| ID | Decisión | Razón Principal | Estado |
|----|----------|-----------------|--------|
| DA-001 | Monolito Modular | Escala actual no justifica microservicios | [OK] |
| DA-002 | ECDH | Perfect Forward Secrecy | [WIP] Stub |
| DA-003 | N Rondas (N=3) | Seguridad probabilística + validación estadística | [FAIL] |
| DA-004 | TOTP Dual | Device binding + anti-replay | [WIP] Stub |
| DA-005 | AES-256-GCM | AEAD + hardware accel | [FAIL] |
| DA-006 | Umbral Estadístico | Detecta bots, interpretable | [FAIL] |
| DA-007 | Rotación 500ms | Balance seguridad-UX | [FAIL] |
| DA-008 | Valkey | Open-source sin restricciones | [OK] |
| DA-009 | Frontend Separado | SoC, escalabilidad | [OK] |
| DA-010 | Auth JWT WebSocket (5B) | Token no en logs, control timeout | [OK] |
| DA-011 | PostgreSQL Schemas | Separación lógica, transacciones simples | [OK] |
| DA-012 | Entry Points Separados | Mínima invasión, SoC estricto | [WIP] Parcial |

**Leyenda:**

- [OK] Implementado y probado
- [WIP] Implementado parcialmente o con stubs
- [FAIL] No implementado

---

**Versión:** 3.0  
**Fecha:** 2025-11-03  
**Estado:** Actualizado con decisiones de implementación real
