# Módulo de Integración PHP-Node.js para Sistema de Asistencia

**Versión:** 1.0  
**Fecha:** 2025-11-17  
**Estado:** Production-Ready

---

## Descripción

Módulo autocontenido que integra el sistema legacy PHP con el servicio Node.js de asistencia criptográfica. Implementa:

- Autenticación mediante JWT
- Comunicación bidireccional PHP ↔ Node
- Vistas de modal para proyección y captura de QR
- API REST para consultas de datos legacy

## Arquitectura

```bash
asistencia-node-integration/
├── bootstrap.php              # Composition root (DI manual)
├── index.php                  # Entry point HTTP
├── config/
│   ├── Config.php            # Configuración centralizada
│   └── env.example.php       # Template de variables de entorno
├── lib/
│   └── crypto/
│       └── JWT.php           # Biblioteca JWT sin dependencias
├── domain/
│   ├── AuthenticationService.php    # Servicio de autenticación
│   └── IntegrationGateway.php       # Interface comunicación Node
├── infrastructure/
│   ├── http/
│   │   └── NodeServiceClient.php   # HTTP client para Node
│   └── persistence/
│       └── LegacySessionAdapter.php # Adapter para sesiones PHP
├── presentation/
│   ├── Router.php                   # Front controller
│   ├── api/
│   │   ├── UserDataController.php
│   │   ├── CourseDataController.php
│   │   └── EnrollmentDataController.php
│   └── views/
│       ├── modal-host.php           # Vista proyección QR
│       └── modal-reader.php         # Vista captura QR
└── test/
    ├── test-jwt.html
    └── test-modal.html
```

**Principios aplicados:**

- DDD (Domain-Driven Design)
- SoC (Separation of Concerns)
- Dependency Inversion Principle
- Vertical Slicing
- Adapter Pattern

---

## Requisitos

### Software

- PHP 7.4 o superior
- Extensiones PHP:
  - `json`
  - `pdo`
  - `pdo_pgsql` (si usa PostgreSQL)
  - `hash`
- Apache 2.4 con módulos:
  - `mod_rewrite`
  - `mod_proxy`
  - `mod_proxy_http`
- Node.js service en ejecución (puerto 3000)

### Sistema Legacy

- Archivo `db.inc` con funciones de acceso a datos
- Sistema de autenticación PHP con sesiones
- Variables de sesión: `$_SESSION['user_id']`, `$_SESSION['username']`

---

## Instalación

### Paso 1: Copiar Módulo

```bash
# Copiar carpeta completa al servidor PHP
cp -r asistencia-node-integration/ /var/www/html/

# Ajustar permisos
chown -R www-data:www-data /var/www/html/asistencia-node-integration
chmod 755 /var/www/html/asistencia-node-integration
```

### Paso 2: Configurar Variables de Entorno

**Opción A: Usando Podman Compose (Recomendado para Producción)**

Las variables de entorno se configuran automáticamente via `compose.yaml`:

```bash
# 1. Copiar archivo de ejemplo
cp .env.example .env

# 2. Editar con valores reales
vi .env

# 3. Generar secrets fuertes (min 32 caracteres)
openssl rand -base64 32  # Para JWT_SECRET
openssl rand -base64 32  # Para JWT_SECRET_INTERNAL

# 4. Actualizar .env
JWT_SECRET="<secret-generado-1>"
JWT_SECRET_INTERNAL="<secret-generado-2>"
NODE_MODULE_ENABLED=true

# 5. Levantar servicios
podman-compose -f compose.yaml -f compose.prod.yaml up -d
```

El archivo `compose.yaml` ya incluye las variables necesarias en `php-service` y `node-service`.

**Opción B: Variables de entorno del sistema (Manual)**

```bash
# En /etc/environment o perfil del usuario
export NODE_MODULE_ENABLED=true
export NODE_ENV=production
export JWT_SECRET="tu-clave-secreta-min-32-caracteres"
export JWT_SECRET_INTERNAL="tu-clave-interna-min-32-caracteres"
export NODE_SERVICE_URL="http://node-service:3000"
```

**Opción C: Archivo .env local (Desarrollo)**

```php
# Copiar template
cp config/env.example.php config/.env.php

# Editar valores
vi config/.env.php

# Cargar en bootstrap.php
require_once __DIR__ . '/config/.env.php';
```

### Paso 3: Configurar Apache

Editar `/etc/httpd/conf.d/asistencia.conf` o equivalente:

```apache
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/html

    # Alias para el módulo
    Alias /asistencia-node-integration /var/www/html/asistencia-node-integration

    <Directory /var/www/html/asistencia-node-integration>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted

        # Rewrite para API endpoints
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^api/(.*)$ index.php [L,QSA]
    </Directory>

    # Proxy para Node service (ya configurado en asistencia.conf)
    ProxyPass /asistencia http://node-service:3000/asistencia
    ProxyPassReverse /asistencia http://node-service:3000/asistencia
</VirtualHost>
```

Reiniciar Apache:

```bash
systemctl restart httpd
# o
systemctl restart apache2
```

### Paso 4: Verificar Instalación

```bash
# Test 1: Verificar que módulo responde
curl http://localhost/asistencia-node-integration/api/validate-session

# Test 2: Verificar conexión con Node
curl http://localhost/asistencia

# Test 3: Abrir en navegador
# http://localhost/asistencia-node-integration/test/test-jwt.html
```

---

## Configuración

### Variables de Entorno

| Variable | Descripción | Default | Requerido |
|----------|-------------|---------|-----------|
| `NODE_MODULE_ENABLED` | Habilitar/deshabilitar módulo | `true` | No |
| `NODE_ENV` | Entorno (development/production) | `production` | No |
| `JWT_SECRET` | Secret para JWT de usuario | - | **Sí** |
| `JWT_SECRET_INTERNAL` | Secret para JWT interno | - | **Sí** |
| `JWT_TTL` | TTL del token en segundos | `300` | No |
| `NODE_SERVICE_URL` | URL del servicio Node | `http://node-service:3000` | No |
| `NODE_TIMEOUT` | Timeout requests a Node (seg) | `5` | No |
| `ENABLE_LOGGING` | Habilitar logs | `false` | No |

### Secrets JWT

**IMPORTANTE:** Generar secrets fuertes en producción

```bash
# Generar secrets de 32 caracteres
openssl rand -base64 32

# Ejemplo resultado:
# abc123xyz456def789ghi012jkl345mno==
```

**Diferencia entre secrets:**

- `JWT_SECRET`: Para autenticación usuario → Node (TTL 5 min)
- `JWT_SECRET_INTERNAL`: Para comunicación PHP ↔ Node (TTL 1 hora)

**Nunca usar el mismo secret para ambos.**

---

## Hot-Swap / Rollback

### Activar Módulo

```bash
# Si carpeta está deshabilitada
mv asistencia-node-integration.disabled asistencia-node-integration
```

### Desactivar Módulo (Rollback)

```bash
# Renombrar carpeta
mv asistencia-node-integration asistencia-node-integration.disabled

# Sistema vuelve automáticamente al módulo legacy
```

**Ventaja:** Rollback instantáneo sin downtime.

---

## Integración con Sistema Legacy

### Agregar Botón en Páginas PHP

**Para Profesores (Proyección QR):**

```php
<?php if (file_exists(__DIR__ . '/asistencia-node-integration/config/Config.php')): ?>
    <!-- Módulo Node activo -->
    <a href="/asistencia-node-integration/presentation/views/modal-host.php">
        <button>PROYECTAR QR</button>
    </a>
<?php else: ?>
    <!-- Fallback a módulo legacy -->
    <a href="/asistencia-legacy/proyectar.php">
        <button>PROYECTAR QR (LEGACY)</button>
    </a>
<?php endif; ?>
```

**Para Alumnos (Captura QR):**

```php
<?php if (file_exists(__DIR__ . '/asistencia-node-integration/config/Config.php')): ?>
    <!-- Módulo Node activo -->
    <a href="/asistencia-node-integration/presentation/views/modal-reader.php">
        <button>REGISTRAR ASISTENCIA</button>
    </a>
<?php else: ?>
    <!-- Fallback a módulo legacy -->
    <a href="/asistencia-legacy/marcar.php">
        <button>REGISTRAR ASISTENCIA (LEGACY)</button>
    </a>
<?php endif; ?>
```

---

## API Endpoints

### Autenticación (Usuario → Node)

**GET /asistencia-node-integration/api/token:**

Genera JWT para usuario autenticado.

Request:

```http
GET /asistencia-node-integration/api/token HTTP/1.1
Cookie: PHPSESSID=abc123...
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGc...",
  "expiresIn": 300,
  "userId": 123,
  "username": "juan.perez"
}
```

**GET /asistencia-node-integration/api/validate-session:**

Valida sesión sin generar token.

Response:

```json
{
  "success": true,
  "authenticated": true,
  "userId": 123,
  "username": "juan.perez"
}
```

### Comunicación Interna (Node → PHP)

Requieren JWT interno en header `Authorization: Bearer <token>`.

**GET /asistencia-node-integration/api/user-data?userId=123**

Retorna datos de usuario.

**GET /asistencia-node-integration/api/course-data?courseId=5&semesterId=2**

Retorna datos de curso y sesiones.

**GET /asistencia-node-integration/api/enrollment-data?courseId=5&semesterId=2**

Retorna inscripciones de curso.

**POST /asistencia-node-integration/api/log-event**

Registra evento de log.

---

## Testing

### Test JWT Flow

Abrir en navegador:

```web
http://localhost/asistencia-node-integration/test/test-jwt.html
```

### Test Modal

Abrir en navegador:

```web
http://localhost/asistencia-node-integration/test/test-modal.html
```

### Test API Endpoints

```bash
# Con sesión PHP activa
curl -b cookies.txt http://localhost/asistencia-node-integration/api/token

# Endpoint interno (requiere JWT interno)
curl -H "Authorization: Bearer <jwt_interno>" \
     http://localhost/asistencia-node-integration/api/user-data?userId=123
```

---

## Troubleshooting

### Error: "Module disabled"

**Causa:** `NODE_MODULE_ENABLED=false` o módulo renombrado a `.disabled`

**Solución:**

```bash
export NODE_MODULE_ENABLED=true
# o renombrar carpeta
```

### Error: "Not authenticated"

**Causa:** Sin sesión PHP activa

**Solución:** Login en sistema legacy primero

### Error: "Connection error to Node service"

**Causa:** Node service no está ejecutándose o URL incorrecta

**Solución:**

```bash
# Verificar Node service
curl http://node-service:3000/health

# Ajustar URL
export NODE_SERVICE_URL="http://localhost:3000"
```

### Error: "Invalid JWT signature"

**Causa:** `JWT_SECRET` diferente entre PHP y Node

**Solución:** Sincronizar secrets en ambos servicios

---

## Logging

### Habilitar Logs

```bash
export ENABLE_LOGGING=true
```

### Ubicación Logs

```bash
asistencia-node-integration/logs/
├── events-2025-11-17.log
├── events-2025-11-18.log
└── ...
```

### Formato

```bash
[2025-11-17 10:30:45] TOKEN_REQUESTED | IP: 192.168.1.100 | Data: {"success":true,"userId":123}
[2025-11-17 10:31:02] USER_DATA_QUERY | IP: 172.17.0.1 | Data: {"userId":123}
```

---

## Seguridad

### Recomendaciones Producción

1. **Secrets fuertes:** Mínimo 32 caracteres aleatorios
2. **HTTPS obligatorio:** No usar HTTP en producción
3. **Logs deshabilitados:** `ENABLE_LOGGING=false` en producción
4. **Permisos restrictivos:**

   ```bash
   chmod 750 asistencia-node-integration/
   chmod 640 asistencia-node-integration/config/*
   ```

5. **No commitear secrets:** Agregar `.env.php` a `.gitignore`
6. **Rate limiting:** Configurar en Apache/Nginx
7. **Firewall:** Node service NO debe ser accesible desde internet

---

## Soporte

### Documentación Técnica

- Arquitectura: `/documents/03-especificaciones-tecnicas/`
- Decisiones: `/documents/03-especificaciones-tecnicas/07-decisiones-arquitectonicas.md`
- Integración: `/documents/02-sistema-base-php/00-INTEGRACION-PHP-NODE-CONSOLIDADO.md`

### Contacto

Repositorio: https://github.com/CMCFL/Asistencia
