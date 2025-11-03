# Arquitectura JWT - Patrón Recomendado

Este documento describe la implementación de la arquitectura JWT recomendada por la IA amiga para integrar el módulo Node.js en el servidor PHP "Hawaii".

---

## Principio Fundamental

### La Analogía del Restaurante y el Portero

- **PHP** = **El Portero**: Verifica la identidad (sesión PHP) y emite un "Pase de Visitante" temporal (JWT)
- **Node.js** = **El Especialista**: No conoce a nadie personalmente, solo confía en los pases firmados por el portero
- **Cliente** = **El Visitante**: Obtiene el pase del portero y luego habla directamente con el especialista

---

## Flujo de Comunicación

```
┌─────────┐           ┌─────────┐           ┌─────────┐
│         │    (1)    │         │           │         │
│ Cliente ├──────────>│   PHP   │           │ Node.js │
│         │<──────────┤ "Portero"│           │"Espec." │
│         │    (2)    │         │           │         │
│         │    JWT    └─────────┘           │         │
│         │                                  │         │
│         │           (3) GET /minodo-api/  │         │
│         ├─────────────────────────────────>│         │
│         │      Authorization: Bearer JWT   │         │
│         │                                  │         │
│         │<─────────────────────────────────┤         │
│         │           (4) Respuesta          │         │
└─────────┘                                  └─────────┘
```

### Pasos del Flujo:

1. **Cliente → PHP**: Solicita JWT a `api_puente_minodo.php` (requiere sesión PHP activa)
2. **PHP → Cliente**: Emite JWT firmado con validez de 5 minutos
3. **Cliente → Node**: Llama directamente a Node.js vía `/minodo-api/*` con JWT en header `Authorization`
4. **Node → Cliente**: Valida JWT y responde

---

## Archivos Creados

### Node.js Service

| Archivo | Descripción |
|---------|-------------|
| `node-service/src/config/index.ts` | Configuración JWT (secret, expiration, issuer, audience) |
| `node-service/src/features/jwt-utils.ts` | Utilidades para validar y generar JWT |
| `node-service/src/features/auth-middleware.ts` | Middleware de autenticación Fastify |
| `node-service/src/features/enrollment-handler.ts` | Endpoints protegidos con JWT (/api/enrollment/*) |
| `node-service/package.json` | Dependencias: jsonwebtoken, @types/jsonwebtoken |

### PHP Service

| Archivo | Descripción |
|---------|-------------|
| `php-service/src/api_puente_minodo.php` | **El Portero** - Emisor de JWT (único archivo nuevo) |
| `php-service/src/lib/jwt.php` | Biblioteca JWT en PHP puro (sin dependencias) |
| `php-service/src/ejemplo-jwt-client.html` | Ejemplo de cliente JavaScript con patrón JWT |
| `php-service/apache-config/asistencia.conf` | Reverse proxy `/minodo-api` → Node.js |

---

## Endpoints

### PHP (El Portero)

#### GET /api_puente_minodo.php?action=get_token

Emite un JWT para el usuario autenticado en sesión PHP.

**Request:**
```http
GET /api_puente_minodo.php?action=get_token HTTP/1.1
Cookie: PHPSESSID=... (sesión PHP activa)
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 300,
  "userId": 123,
  "username": "juan.perez"
}
```

**Errores:**
- `401 NOT_AUTHENTICATED` - No hay sesión PHP activa

---

### Node.js (El Especialista)

Todos los endpoints bajo `/minodo-api/*` requieren JWT en header `Authorization: Bearer <token>`.

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
  "challenge": "base64_challenge...",
  "options": {
    "rp": { "name": "Sistema de Asistencia UCN", "id": "asistencia.ucn.cl" },
    "user": { ... },
    "pubKeyCredParams": [...],
    "authenticatorSelection": { ... },
    "attestation": "direct"
  }
}
```

#### POST /minodo-api/enrollment/finish

Finaliza el enrolamiento (recibe credencial WebAuthn).

#### POST /minodo-api/enrollment/login

Login con ECDH key exchange.

---

## Reverse Proxy Apache

La ruta `/minodo-api/*` está configurada para hacer proxy directo a Node.js:

```apache
# /minodo-api/* -> http://node-service:3000/api/*
ProxyPass /minodo-api http://node-service:3000/api
ProxyPassReverse /minodo-api http://node-service:3000/api
```

**Ventajas:**
- Cliente habla directamente con Node.js (sin pasar por lógica PHP)
- PHP solo actúa como "portero" (emite JWT)
- Mínima intervención en el monolito existente

---

## Configuración de Seguridad

### Clave Secreta Compartida (JWT_SECRET)

**IMPORTANTE:** La clave secreta debe ser la misma en PHP y Node.js.

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

### En Producción:

1. Generar clave secreta fuerte (min. 256 bits):
   ```bash
   openssl rand -base64 32
   ```

2. Configurar en variables de entorno:
   ```bash
   # compose.prod.yaml
   environment:
     - JWT_SECRET=<clave_generada>
   ```

3. Actualizar `php-service/src/lib/jwt.php` con la misma clave

---

## Ejemplo de Uso (Cliente JavaScript)

```javascript
// Paso 1: Obtener JWT desde PHP
const response = await fetch('/api_puente_minodo.php?action=get_token', {
  credentials: 'include', // Incluir cookies de sesión PHP
});

const { token } = await response.json();

// Paso 2: Llamar a Node.js con JWT
const enrollResponse = await fetch('/minodo-api/enrollment/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    displayName: 'Juan Pérez',
  }),
});

const data = await enrollResponse.json();
console.log(data);
```

**Ver ejemplo completo en:** `php-service/src/ejemplo-jwt-client.html`

---

## Migración al Servidor de Producción

### Archivos que se agregan al monolito PHP "Hawaii":

1. **Un solo archivo PHP:**
   - `api_puente_minodo.php` (el portero)
   - `lib/jwt.php` (biblioteca JWT)

2. **Configuración Apache:**
   - Agregar reverse proxy `/minodo-api` en VirtualHost

3. **Módulo Node.js:**
   - Deploy en contenedor Podman
   - Puerto mapeado solo a localhost (127.0.0.1:3000:3000)

### Ventajas de esta arquitectura:

✅ **Mínima intervención** en el código existente
✅ **Un solo archivo PHP** nuevo (api_puente_minodo.php)
✅ **Desacoplamiento** completo entre PHP y Node.js
✅ **Migración fácil** - solo copiar archivos y configurar proxy
✅ **Seguridad** - JWT firmado, Node.js inaccesible desde exterior

---

## Comandos para Testing

### 1. Rebuild de contenedores (instala jsonwebtoken)

```bash
# Detener contenedores actuales
podman-compose down

# Rebuild completo
podman-compose -f compose.yaml -f compose.dev.yaml up --build

# O en modo detached:
podman-compose -f compose.yaml -f compose.dev.yaml up --build -d
```

### 2. Verificar que Node.js está corriendo

```bash
# Health check
curl http://localhost:9503/health

# Debería responder:
# {"status":"ok","timestamp":1730546789123}
```

### 3. Probar flujo JWT (requiere sesión PHP simulada)

```bash
# Abrir en navegador:
http://localhost:9500/ejemplo-jwt-client.html

# Ejecutar "Flujo Completo" y ver logs en la interfaz
```

### 4. Testing directo (bypass sesión PHP)

```bash
# Generar token de prueba con curl (simulando PHP):
# TODO: Agregar script de testing
```

---

## Próximos Pasos

- [ ] **Rebuild contenedores** para instalar dependencias JWT
- [ ] **Probar flujo completo** con ejemplo-jwt-client.html
- [ ] **Implementar lógica real FIDO2** en enrollment-handler.ts
- [ ] **Implementar lógica real ECDH** para key exchange
- [ ] **Conectar con PostgreSQL** para persistir enrollment
- [ ] **Generar clave secreta producción** y configurar en variables de entorno

---

## Soporte y Preguntas

- **Documentos relacionados:** `documents/recomendacion.md`, `documents/10-guia-integracion-php-node.md`
- **Arquitectura general:** `documents/01-arquitectura-general.md`

---

**Versión:** 1.0
**Fecha:** 2025-11-03
**Estado:** Implementación Base Completada (stubs de FIDO2/ECDH pendientes)
