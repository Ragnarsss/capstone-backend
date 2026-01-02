# JWT Bridge Service

Servicio PHP minimalista para generación segura de tokens JWT.

## Propósito

Actúa como puente seguro entre el sistema legacy Hawaii (Apache + PHP) y el backend moderno (Node.js + Fastify). Aísla la lógica de JWT y validaciones en un contenedor separado con configuración por variables de entorno.

## Características

- ✅ Generación JWT con secret en variable de entorno
- ✅ Validación de sesiones PHP legacy
- ✅ Rate limiting con Redis/Valkey
- ✅ CORS restrictivo configurable
- ✅ Logging centralizado
- ✅ Imagen Alpine ultra-ligera (~50MB)
- ✅ Health checks integrados

## Estructura

```
php-service/
├── src/
│   ├── index.php              # Endpoint principal
│   ├── config.php             # Configuración desde env
│   └── middleware/
│       ├── Logger.php         # Logging centralizado
│       ├── CorsHandler.php    # CORS restrictivo
│       ├── RateLimiter.php    # Rate limiting con Redis
│       └── LegacySessionValidator.php  # Validación sesiones
├── Containerfile              # Imagen PHP 8.1 Alpine
└── composer.json              # Dependencias mínimas
```

## Variables de Entorno

### Requeridas

- `JWT_SECRET`: Secret para firmar tokens (REQUERIDO)

### Opcionales

- `JWT_TTL`: Tiempo de vida del token en segundos (default: 300)
- `JWT_ISSUER`: Emisor del token (default: jwt-bridge-service)
- `JWT_AUDIENCE`: Audiencia del token (default: asistencia-backend)

### CORS

- `CORS_ALLOWED_ORIGINS`: Orígenes permitidos separados por coma (ej: `https://mantochrisal.cl,http://localhost:9506`)

### Rate Limiting

- `RATE_LIMIT_ENABLED`: Habilitar rate limiting (default: true)
- `RATE_LIMIT_MAX_REQUESTS`: Máximo de solicitudes (default: 10)
- `RATE_LIMIT_WINDOW`: Ventana en segundos (default: 60)
- `REDIS_HOST`: Host de Redis/Valkey (default: valkey)
- `REDIS_PORT`: Puerto de Redis (default: 6379)

### Legacy Integration

- `LEGACY_SESSION_NAME`: Nombre de cookie de sesión (default: PHPSESSID)
- `LEGACY_SESSION_PATH`: Path de archivos de sesión PHP

### Security

- `ALLOWED_ROLES`: Roles permitidos separados por coma (default: profesor,admin)
- `REQUIRE_ROLE_VALIDATION`: Validar roles (default: false)

### Logging

- `LOGGING_ENABLED`: Habilitar logging (default: true)
- `LOG_LEVEL`: Nivel de log: debug, info, warning, error (default: info)

## Uso

### Desarrollo

```bash
docker build -t jwt-bridge:dev -f Containerfile .
docker run -p 9001:9001 \
  -e JWT_SECRET="mi-secret-seguro" \
  -e CORS_ALLOWED_ORIGINS="http://localhost:9506" \
  jwt-bridge:dev
```

### Producción

Ver `compose.yaml` para configuración completa con Docker Compose.

## Endpoint

### POST /index.php

Genera un token JWT válido si el usuario tiene sesión activa en el sistema legacy.

**Headers:**

- `Cookie: PHPSESSID=...` (sesión legacy)

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 300,
  "userId": 1234567890,
  "username": "profesor@ucn.cl"
}
```

**Errores:**

- `401 NOT_AUTHENTICATED`: Sin sesión legacy válida
- `403 INSUFFICIENT_PERMISSIONS`: Rol no autorizado
- `403 ORIGIN_NOT_ALLOWED`: Origen CORS no permitido
- `429 RATE_LIMIT_EXCEEDED`: Demasiadas solicitudes
- `500 INTERNAL_ERROR`: Error interno

## Seguridad

- Secret JWT nunca toca el código legacy
- Rate limiting previene ataques de fuerza bruta
- CORS restrictivo evita accesos no autorizados
- Logs de auditoría de todos los tokens generados
- Tokens únicos (JTI) previenen replay attacks
- Validación de roles opcional

## Mantenimiento

- Logs: `docker logs jwt-bridge-service`
- Health: `wget http://localhost:9001/`
- Redis stats: `docker exec valkey redis-cli INFO stats`
