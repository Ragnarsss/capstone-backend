# Guía de Integración PHP-Node

## Propósito

Definir cómo el PHP Service se comunica con el Node Service usando el **patrón JWT recomendado** que minimiza la intervención en el monolito existente.

---

## [WIP] IMPORTANTE: Cambio Arquitectónico

Este documento ha sido **actualizado** para reflejar la **arquitectura JWT implementada**, siguiendo la recomendación del documento `recomendacion.md`.

**Patrón anterior (descartado):**

- [FAIL] PHP hacía proxy HTTP de todas las llamadas
- [FAIL] Cliente → PHP → Node → PHP → Cliente
- [FAIL] Alta invasividad en el monolito

**Patrón actual (implementado):**

- [OK] PHP solo emite tokens JWT ("El Portero")
- [OK] Cliente → PHP (obtiene JWT) → Cliente → Node (valida JWT)
- [OK] Mínima invasividad: solo 1 archivo PHP nuevo
- [OK] Desacoplamiento total

---

## Principio: La Analogía del Portero

### Los Actores

- **PHP** = **El Portero del Edificio**
  - Verifica identidad (sesión PHP)
  - Emite "Pase de Visitante" temporal (JWT firmado)
  - NO acompaña al visitante

- **Node.js** = **El Especialista en su Oficina**
  - No conoce a nadie personalmente
  - Confía ciegamente en los pases del portero
  - Valida pase (JWT) antes de atender

- **Cliente** = **El Visitante**
  - Pide pase al portero
  - Visita al especialista con su pase

---

## Arquitectura de Comunicación

### Patrón JWT (Implementado)

```mermaid
sequenceDiagram
    participant C as Cliente (Browser)
    participant P as PHP Service<br/>"El Portero"
    participant A as Apache<br/>Reverse Proxy
    participant N as Node Service<br/>"El Especialista"

    C->>P: GET /api_puente_minodo.php?action=get_token
    Note over P: Valida sesión PHP<br/>(login legacy)
    P->>P: Genera JWT firmado<br/>(5 min validez)
    P-->>C: {"token": "eyJhbGc..."}

    Note over C: Guarda JWT<br/>en memoria

    C->>A: GET /minodo-api/enrollment/status<br/>Authorization: Bearer eyJhbGc...
    A->>N: GET /api/enrollment/status<br/>Authorization: Bearer eyJhbGc...

    Note over N: Valida JWT<br/>(firma, exp, issuer)
    N->>N: Extrae userId del JWT<br/>Ejecuta lógica
    N-->>A: {"success": true, "enrolled": false}
    A-->>C: {"success": true, "enrolled": false}
```

### Flujo Detallado

```mermaid
graph TD
    A[Cliente: Necesita enrolarse] --> B[1. GET /api_puente_minodo.php]
    B --> C{PHP: ¿Sesión válida?}
    C -->|NO| D[401 NOT_AUTHENTICATED]
    C -->|SÍ| E[PHP: Genera JWT]
    E --> F[PHP: Retorna JWT al cliente]
    F --> G[Cliente: Guarda JWT]
    G --> H[2. GET /minodo-api/enrollment/status<br/>Header: Authorization Bearer JWT]
    H --> I[Apache: Reverse Proxy<br/>/minodo-api/* → node:3000/api/*]
    I --> J[Node: Valida JWT]
    J -->|Inválido| K[401 UNAUTHORIZED]
    J -->|Válido| L[Node: Extrae userId del JWT]
    L --> M[Node: Ejecuta lógica de negocio]
    M --> N[Node: Retorna respuesta]
    N --> O[Apache: Proxy response]
    O --> P[Cliente: Recibe respuesta]
```

---

## Responsabilidades

### PHP Service (Puerto 9500)

**SÍ hace:**

- [OK] Renderizar templates HTML
- [OK] Gestionar sesiones web PHP (login legacy)
- [OK] **Emitir tokens JWT** para usuarios autenticados
- [OK] Validar permisos de acceso a páginas
- [OK] Logging de accesos web
- [OK] Servir assets estáticos

**NO hace:**

- [FAIL] ~~Proxy HTTP a Node service~~ (YA NO)
- [FAIL] Criptografía (FIDO2, ECDH, AES, TOTP)
- [FAIL] Validación de dispositivos enrolados
- [FAIL] Generación de payloads QR
- [FAIL] Validación de rondas de asistencia
- [FAIL] Acceso directo a PostgreSQL schemas `enrollment`/`attendance`
- [FAIL] Acceso directo a Valkey

**Archivos nuevos en PHP:**

- `src/api_puente_minodo.php` - **El único archivo nuevo** (El Portero)
- `src/lib/jwt.php` - Biblioteca JWT en PHP puro

### Node Service (Puerto 3000)

**SÍ hace:**

- [OK] **Validar tokens JWT** de todas las requests
- [OK] Toda la lógica criptográfica
- [OK] Enrolamiento FIDO2/WebAuthn
- [OK] ECDH key exchange
- [OK] Generación y validación de TOTPs
- [OK] Generación de payloads QR encriptados
- [OK] Validación de rondas de asistencia
- [OK] Cálculo de umbral de certeza
- [OK] Acceso a PostgreSQL y Valkey
- [OK] WebSocket para proyección de QR

**NO hace:**

- [FAIL] Renderizar HTML
- [FAIL] Gestionar sesiones web tradicionales
- [FAIL] Autenticación de usuarios legacy (solo valida JWT)
- [FAIL] Servir páginas web

**Archivos nuevos en Node:**

- `src/features/jwt-utils.ts` - Validación JWT
- `src/features/auth-middleware.ts` - Middleware autenticación
- `src/features/enrollment-handler.ts` - Endpoints protegidos con JWT

---

## Endpoints

### PHP: El Portero

#### GET /api_puente_minodo.php?action=get_token

Emite un JWT para el usuario autenticado en sesión PHP.

**Request:**

```http
GET /api_puente_minodo.php?action=get_token HTTP/1.1
Cookie: PHPSESSID=... (sesión PHP activa requerida)
```

**Response (exitosa):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 300,
  "userId": 123,
  "username": "juan.perez"
}
```

**Response (sin sesión):**

```json
{
  "success": false,
  "error": "NOT_AUTHENTICATED",
  "message": "Debes iniciar sesión primero"
}
```

**Implementación:** Ver archivo `php-service/src/api_puente_minodo.php`

---

### Node.js: El Especialista

Todos los endpoints bajo `/minodo-api/*` (mapeados a `/api/*` internamente) requieren JWT válido.

#### GET /minodo-api/enrollment/status

Verifica si el usuario está enrolado.

**Request:**

```http
GET /minodo-api/enrollment/status HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```json
{
  "success": true,
  "enrolled": false,
  "deviceCount": 0,
  "message": "Usuario no enrolado"
}
```

**Errores:**

- `401 UNAUTHORIZED` - JWT inválido, expirado o ausente

#### POST /minodo-api/enrollment/start

Inicia el proceso de enrolamiento FIDO2.

**Request:**

```http
POST /minodo-api/enrollment/start HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "displayName": "Juan Pérez"
}
```

**Response:**

```json
{
  "success": true,
  "challenge": "base64_challenge_here...",
  "options": {
    "rp": {
      "name": "Sistema de Asistencia UCN",
      "id": "asistencia.ucn.cl"
    },
    "user": {
      "id": "base64_user_id",
      "name": "juan.perez",
      "displayName": "Juan Pérez"
    },
    "pubKeyCredParams": [
      { "type": "public-key", "alg": -7 },
      { "type": "public-key", "alg": -257 }
    ],
    "authenticatorSelection": {
      "authenticatorAttachment": "platform",
      "userVerification": "required",
      "residentKey": "required"
    },
    "attestation": "direct",
    "timeout": 60000
  }
}
```

#### POST /minodo-api/enrollment/finish

Finaliza el enrolamiento (recibe credencial WebAuthn).

#### POST /minodo-api/enrollment/login

Login con ECDH key exchange.

**Implementación:** Ver archivo `node-service/src/features/enrollment-handler.ts`

---

## Configuración Reverse Proxy Apache

La ruta `/minodo-api/*` está configurada para hacer proxy directo a Node.js:

```apache
# php-service/apache-config/asistencia.conf

# Arquitectura JWT Recomendada
# Cliente habla DIRECTAMENTE con Node.js usando JWT
ProxyPass /minodo-api http://node-service:3000/api
ProxyPassReverse /minodo-api http://node-service:3000/api
```

**Mapeo de rutas:**

- `/minodo-api/enrollment/start` → `http://node-service:3000/api/enrollment/start`
- `/minodo-api/enrollment/status` → `http://node-service:3000/api/enrollment/status`

---

## Ejemplo de Uso: Cliente JavaScript

### Paso 1: Obtener JWT desde PHP

```javascript
// Cliente obtiene JWT del portero
const response = await fetch('/api_puente_minodo.php?action=get_token', {
  credentials: 'include', // Incluir cookies de sesión PHP
});

const data = await response.json();

if (!data.success) {
  console.error('No autenticado:', data.message);
  // Redirigir a login
  return;
}

// Guardar JWT en memoria (NO en localStorage por seguridad)
const jwtToken = data.token;
```

### Paso 2: Llamar a Node.js con JWT

```javascript
// Cliente habla directamente con Node usando el JWT
const enrollResponse = await fetch('/minodo-api/enrollment/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    displayName: 'Juan Pérez',
  }),
});

const enrollData = await enrollResponse.json();

if (!enrollData.success) {
  console.error('Error:', enrollData.message);
  return;
}

// Continuar con ceremony FIDO2
console.log('Challenge:', enrollData.challenge);
```

**Ejemplo completo:** Ver archivo `php-service/src/ejemplo-jwt-client.html`

---

## Configuración de Seguridad

### Clave Secreta Compartida (JWT_SECRET)

**CRÍTICO:** La clave secreta debe ser **idéntica** en PHP y Node.js.

**Node.js** (`node-service/src/config/index.ts`):

```typescript
jwt: {
  secret: process.env.JWT_SECRET || 'CAMBIAR_EN_PRODUCCION_SECRET_KEY_COMPARTIDO_PHP_NODE',
  expiresIn: '5m',
  issuer: 'php-service',
  audience: 'node-service',
}
```

**PHP** (`php-service/src/lib/jwt.php`):

```php
private const SECRET = 'CAMBIAR_EN_PRODUCCION_SECRET_KEY_COMPARTIDO_PHP_NODE';
private const ISSUER = 'php-service';
private const AUDIENCE = 'node-service';
```

### En Producción

1. **Generar clave secreta robusta** (mín. 256 bits):

   ```bash
   openssl rand -base64 32
   ```

2. **Configurar en variables de entorno:**

   ```yaml
   # compose.prod.yaml
   services:
     node-service:
       environment:
         - JWT_SECRET=<clave_generada_aqui>
   ```

3. **Actualizar PHP** con la misma clave en `lib/jwt.php`

4. **Nunca commitear** la clave real a git

---

## Validación JWT en Node.js

### Middleware de Autenticación HTTP

Todos los endpoints HTTP protegidos usan el middleware `authenticateJWT`:

```typescript
// node-service/src/modules/auth/presentation/auth-middleware.ts
export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = extractTokenFromHeader(request.headers.authorization);
    const payload = verifyJWT(token);

    // Adjuntar datos del usuario al request
    request.user = payload;

  } catch (error) {
    return reply.status(401).send({
      success: false,
      error: 'UNAUTHORIZED',
      message: error.message,
    });
  }
}
```

### Autenticación en WebSocket

Los WebSocket también requieren autenticación JWT, pero usan un handshake diferente:

**Flujo:**

1. Cliente obtiene JWT de PHP via `postMessage`
2. Cliente conecta WebSocket
3. Cliente envía mensaje `AUTH` con token como **primer mensaje**
4. Servidor valida JWT
5. Si válido: servidor responde `auth-ok` e inicia operación
6. Si inválido: servidor cierra conexión con código 4403

**Ejemplo cliente:**

```javascript
// frontend/modules/websocket/websocket.client.js
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  const token = sessionStorage.getItem('jwt_token');
  ws.send(JSON.stringify({
    type: 'AUTH',
    token: token
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'auth-ok') {
    console.log('Autenticado:', msg.username);
    // Ya puede recibir mensajes normales
  }
  
  if (msg.type === 'error') {
    console.error('Error:', msg.message);
  }
};
```

**Ejemplo servidor:**

```typescript
// node-service/src/modules/qr-projection/presentation/websocket-controller.ts
socket.on('message', async (data) => {
  const msg = JSON.parse(data.toString());
  
  if (!isAuthenticated) {
    if (msg.type !== 'AUTH') {
      socket.close(4401, 'Debe autenticar primero');
      return;
    }
    
    try {
      const user = jwtUtils.verify(msg.token);
      isAuthenticated = true;
      
      socket.send(JSON.stringify({
        type: 'auth-ok',
        username: user.username
      }));
      
      // Iniciar operación (proyección QR, enrollment, etc.)
      
    } catch (error) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Token inválido o expirado'
      }));
      socket.close(4403, 'Token inválido');
    }
  }
});
```

**Códigos de cierre WebSocket:**

- `4401` - No autenticado (no envió AUTH como primer mensaje)
- `4403` - Token inválido o expirado
- `4408` - Timeout de autenticación (no autenticó en 5 segundos)

**WebSockets que requieren autenticación:**

- `/asistencia/ws` - Proyección de QR (anfitrión/profesor)
- `/enrollment/ws` - Proceso FIDO2 (invitado/alumno no enrolado)

### Uso en Endpoints HTTP

```typescript
// node-service/src/features/enrollment-handler.ts
async register(fastify: FastifyInstance): Promise<void> {
  await fastify.register(async (enrollmentRoutes) => {
    // Aplicar middleware a TODAS las rutas
    enrollmentRoutes.addHook('preHandler', authenticateJWT);

    // Todos estos endpoints están protegidos con JWT
    enrollmentRoutes.post('/api/enrollment/start', this.startEnrollment.bind(this));
    enrollmentRoutes.post('/api/enrollment/finish', this.finishEnrollment.bind(this));
    enrollmentRoutes.get('/api/enrollment/status', this.checkEnrollmentStatus.bind(this));
  });
}
```

---

## Migración al Servidor de Producción

### Archivos que se agregan al monolito PHP "Hawaii"

1. **Un solo archivo PHP:**
   - `api_puente_minodo.php` - El portero (emisor de JWT)
   - `lib/jwt.php` - Biblioteca JWT

2. **Configuración Apache:**

   ```apache
   # En el VirtualHost existente, agregar:
   ProxyPass /minodo-api http://127.0.0.1:3000/api
   ProxyPassReverse /minodo-api http://127.0.0.1:3000/api
   ```

3. **Módulo Node.js:**
   - Deploy en contenedor Podman
   - Puerto mapeado SOLO a localhost: `127.0.0.1:3000:3000`
   - Inaccesible desde el exterior

### Ventajas de esta Arquitectura

[OK] **Mínima intervención** - Solo 1 archivo PHP nuevo
[OK] **Desacoplamiento total** - PHP y Node no se comunican entre sí
[OK] **Migración fácil** - Copiar archivos + configurar proxy
[OK] **Seguridad** - JWT firmado, Node inaccesible externamente
[OK] **Escalabilidad** - Cliente → Node directo (sin bottleneck PHP)
[OK] **Reversible** - Eliminar es igual de fácil que agregar

---

## Comparación: Antes vs Ahora

| Aspecto | Patrón Anterior (Descartado) | Patrón JWT (Implementado) |
|---------|------------------------------|---------------------------|
| **Comunicación** | Cliente → PHP → Node → PHP → Cliente | Cliente → PHP (JWT) → Cliente → Node |
| **PHP hace** | Proxy HTTP de todas las llamadas | Solo emite JWT |
| **Archivos PHP nuevos** | Múltiples con `http_post()` | **Solo 1:** `api_puente_minodo.php` |
| **Invasividad** | Alta (múltiples cambios) | **Mínima** (1 archivo) |
| **Desacoplamiento** | Bajo | **Alto** |
| **Migrabilidad** | Difícil | **Fácil** |
| **Bottleneck** | PHP proxy todas las requests | **Ninguno** (directo) |

---

## Testing

### Testing Manual

Ver documentación completa en: `INSTRUCCIONES_JWT.md`

```bash
# 1. Obtener JWT
curl "http://localhost:9500/api_puente_minodo.php?action=get_token"

# 2. Usar JWT para llamar a Node
curl -H "Authorization: Bearer <TOKEN>" \
     "http://localhost:9500/minodo-api/enrollment/status"
```

### Testing con Interfaz Web

Abrir en navegador: `http://localhost:9500/ejemplo-jwt-client.html`

---

## Logging y Debugging

### Verificar que JWT está siendo validado

```bash
# Ver logs de Node.js
podman logs -f asistencia-node

# Deberías ver:
# {"level":30,"msg":"Usuario autenticado via JWT","userId":123,"username":"test.user"}
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `401 UNAUTHORIZED` | JWT inválido/expirado | Obtener nuevo JWT |
| `Header Authorization no proporcionado` | Falta header | Agregar `Authorization: Bearer <token>` |
| `Token expirado` | JWT expiró (>5 min) | Obtener nuevo JWT |
| `Token inválido` | Clave secreta no coincide | Verificar JWT_SECRET en PHP y Node |

---

## Próximos Pasos

- [ ] Implementar lógica real FIDO2 en `enrollment-handler.ts`
- [ ] Implementar lógica real ECDH para key exchange
- [ ] Conectar con PostgreSQL para persistir enrollment
- [ ] Implementar módulo de asistencia con N rondas
- [ ] Generar clave secreta robusta para producción
- [ ] Testing de seguridad (tokens expirados, malformados, etc.)

---

## Referencias

- **Implementación completa:** Ver `ARQUITECTURA_JWT.md`
- **Guía de uso:** Ver `INSTRUCCIONES_JWT.md`
- **Recomendación original:** Ver `recomendacion.md`
- **Código PHP:** `php-service/src/api_puente_minodo.php`
- **Código Node:** `node-service/src/features/enrollment-handler.ts`

---

**Versión:** 2.0 (Arquitectura JWT)
**Fecha:** 2025-11-03
**Estado:** Implementado y Funcionando

**Cambios desde v1.0:**

- [FAIL] Removido patrón HTTP Proxy
- [OK] Implementado patrón JWT (recomendación oficial)
- [OK] Actualizado con código real implementado
- [OK] Agregadas referencias a archivos concretos
