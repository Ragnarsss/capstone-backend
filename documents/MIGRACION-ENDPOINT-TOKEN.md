# Guía de Migración: api_get_asistencia_token.php → Módulo PHP

**Fecha:** 2025-12-19  
**Estado:** Pendiente implementación  
**Prioridad:** Alta

---

## 📋 Resumen Ejecutivo

El endpoint legacy `/hawaii/api_get_asistencia_token.php` debe **migrarse** al módulo PHP de integración profesional ubicado en `/asistencia/php-service/src/asistencia-node-integration`.

### ¿Por qué migrar?

| Legacy (api_get_asistencia_token.php) | Módulo PHP (asistencia-node-integration) |
| ------------------------------------- | ---------------------------------------- |
| ❌ Secret hardcodeado en código       | ✅ Secret desde variables de entorno     |
| ❌ Lógica duplicada JWT manual        | ✅ Biblioteca JWT reutilizable           |
| ❌ Sin arquitectura clara             | ✅ DDD + Layered Architecture            |
| ❌ Sin tests                          | ✅ Testeable por diseño                  |
| ❌ Acoplamiento directo               | ✅ Dependency Injection                  |
| ❌ Difícil mantenimiento              | ✅ SOLID principles                      |

---

## ✅ Cambios Implementados

### 1. LegacySessionAdapter Actualizado

**Archivo:** [php-service/src/asistencia-node-integration/infrastructure/persistence/LegacySessionAdapter.php](../php-service/src/asistencia-node-integration/infrastructure/persistence/LegacySessionAdapter.php)

**Cambios realizados:**

- ✅ Ahora usa `$_SESSION['id']` (K_ID) en lugar de `$_SESSION['user_id']`
- ✅ Ahora usa `$_SESSION['user']` (K_USER) en lugar de `$_SESSION['username']`
- ✅ Compatible con sistema legacy Hawaii
- ✅ Distingue entre profesor (id > 0) y alumno (id = -1)
- ✅ Genera userId con CRC32 para alumnos (igual que legacy)
- ✅ Métodos adicionales: `isProfesor()`, `isAlumno()`

**Comportamiento:**

```php
// PROFESOR
$_SESSION['id'] = 123;              // ID del profesor
$_SESSION['user'] = 'prof@ucn.cl';  // Email

→ getUserId() = 123
→ getUsername() = 'prof@ucn.cl'
→ getRole() = 'profesor'
→ isProfesor() = true

// ALUMNO
$_SESSION['id'] = -1;               // Indica alumno
$_SESSION['user'] = '186875052';    // RUT sin formato

→ getUserId() = abs(crc32('186875052'))  // ID numérico único
→ getUsername() = '186875052'
→ getRole() = 'alumno'
→ isAlumno() = true
```

---

## 📝 Tareas Pendientes

### Paso 1: Verificar Variables de Entorno

**Archivo:** `/var/www/html/hawaii/asistencia/.env`

Asegurarse que estén configuradas:

```bash
# Secrets JWT (deben coincidir entre PHP y Node.js)
JWT_SECRET="GYw+eD2ykl2k2UDu/ttZPZ+tWaIraic27OYcU2iAxEKHnpbRYKnqC9d2agkfbDBrNm8mr"
JWT_SECRET_INTERNAL="<generar-nuevo-secret>"

# Configuración del módulo
NODE_MODULE_ENABLED=true
NODE_ENV=production
NODE_SERVICE_URL="http://node-service:3000"
JWT_TTL=300  # 5 minutos
```

**⚠️ IMPORTANTE:** El `JWT_SECRET` debe ser el **mismo** en:

- `.env` (para PHP y Node.js)
- `api_get_asistencia_token.php` (legacy - hasta deprecar)

### Paso 2: Configurar Apache Reverse Proxy

**Archivo:** `/var/www/html/hawaii/asistencia/php-service/apache-config/00-proxy.conf`

Ya debería estar configurado, verificar:

```apache
# Módulo de integración PHP-Node
ProxyPass /asistencia-node http://php-service:80/asistencia-node-integration
ProxyPassReverse /asistencia-node http://php-service:80/asistencia-node-integration

# Servicio Node.js (interno, no expuesto directamente en producción)
ProxyPass /asistencia/api http://node-service:3000/asistencia/api
ProxyPassReverse /asistencia/api http://node-service:3000/asistencia/api
```

### Paso 3: Actualizar Rutas en Sistema Legacy

Buscar todos los archivos que llaman a `api_get_asistencia_token.php` y actualizar la URL:

**Antes:**

```javascript
fetch("/hawaii/api_get_asistencia_token.php");
```

**Después:**

```javascript
fetch("/asistencia-node/api/token");
```

**Archivos a revisar:**

```bash
cd /var/www/html/hawaii
grep -r "api_get_asistencia_token" . --include="*.php" --include="*.html" --include="*.js"
```

Posibles archivos:

- `main_curso.php`
- Cualquier archivo que abra el módulo de asistencia
- JavaScript embebido en páginas de control de asistencia

### Paso 4: Testing

#### Test 1: Verificar sesión legacy

```bash
# Probar endpoint de validación de sesión
curl -b "PHPSESSID=<session-id>" \
  http://localhost:9500/asistencia-node/api/validate-session
```

Respuesta esperada:

```json
{
  "success": true,
  "authenticated": true,
  "userId": 123,
  "username": "profesor@ucn.cl"
}
```

#### Test 2: Generar token JWT

```bash
# Probar generación de token
curl -b "PHPSESSID=<session-id>" \
  http://localhost:9500/asistencia-node/api/token
```

Respuesta esperada:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 300,
  "userId": 123,
  "username": "profesor@ucn.cl"
}
```

#### Test 3: Validar token en Node.js

```bash
# Verificar que Node.js puede validar el token generado por PHP
TOKEN="<token-del-paso-anterior>"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9500/asistencia/api/qr-projection/health
```

### Paso 5: Deprecar Endpoint Legacy

Una vez verificado que todo funciona:

1. **Renombrar archivo legacy:**

```bash
mv /var/www/html/hawaii/api_get_asistencia_token.php \
   /var/www/html/hawaii/api_get_asistencia_token.php.deprecated
```

2. **Crear endpoint de redirección (opcional):**

```php
<?php
// api_get_asistencia_token.php
// DEPRECATED: Este endpoint está deprecado
// Use: /asistencia-node/api/token

header('X-Deprecated: true');
header('Location: /asistencia-node/api/token', true, 301);
exit;
```

---

## 🏗️ Arquitectura del Módulo PHP

```
php-service/src/asistencia-node-integration/
│
├── index.php                    # Entry point HTTP
├── bootstrap.php                # DI Container
│
├── config/
│   ├── Config.php              # Configuración centralizada
│   └── env.example.php         # Template de variables de entorno
│
├── lib/crypto/
│   └── JWT.php                 # Biblioteca JWT (sin dependencias)
│
├── domain/                      # Capa de Dominio (Lógica de Negocio)
│   ├── AuthenticationService.php   # ✅ Genera tokens JWT
│   └── IntegrationGateway.php      # Interface comunicación Node
│
├── infrastructure/              # Capa de Infraestructura
│   ├── http/
│   │   └── NodeServiceClient.php   # HTTP client para Node.js
│   └── persistence/
│       └── LegacySessionAdapter.php # ✅ Adaptador sesiones legacy
│
└── presentation/                # Capa de Presentación
    ├── Router.php              # ✅ Front controller (rutas API)
    ├── api/
    │   ├── UserDataController.php
    │   ├── CourseDataController.php
    │   └── EnrollmentDataController.php
    └── views/
        ├── modal-host.php      # Vista proyección QR
        └── modal-reader.php    # Vista captura QR
```

---

## 🔗 Endpoints Disponibles

| Endpoint                                | Método | Descripción            | Equivalente Legacy             |
| --------------------------------------- | ------ | ---------------------- | ------------------------------ |
| `/asistencia-node/api/token`            | GET    | Genera JWT             | `api_get_asistencia_token.php` |
| `/asistencia-node/api/validate-session` | GET    | Valida sesión          | -                              |
| `/asistencia-node/api/user-data`        | GET    | Datos de usuario       | -                              |
| `/asistencia-node/api/course-data`      | GET    | Datos de curso         | -                              |
| `/asistencia-node/api/enrollment-data`  | GET    | Datos de inscripciones | -                              |

---

## 📚 Referencias

- [README.md del módulo](../php-service/src/asistencia-node-integration/README.md)
- [Roseta de Integración PHP-Legacy](./01-contexto/roseta-integracion-php-legacy.md)
- [Flujo Legacy](./01-contexto/flujo_legacy.md)
- [Config.php](../php-service/src/asistencia-node-integration/config/Config.php)
- [AuthenticationService.php](../php-service/src/asistencia-node-integration/domain/AuthenticationService.php)

---

## 🎯 Checklist de Migración

- [x] **LegacySessionAdapter actualizado** para usar variables de sesión correctas
- [ ] Verificar variables de entorno (JWT_SECRET coincide)
- [ ] Verificar configuración Apache (reverse proxy)
- [ ] Buscar y actualizar llamadas a `api_get_asistencia_token.php`
- [ ] Testing funcional (sesión, token, validación Node.js)
- [ ] Deprecar endpoint legacy
- [ ] Actualizar documentación de usuario
- [ ] Monitorear logs en producción

---

## 🚨 Problemas Conocidos

### Problema: Secret hardcodeado en legacy

**Descripción:** El archivo legacy `api_get_asistencia_token.php` tiene el secret JWT hardcodeado.

**Solución:**

1. Extraer a variable de entorno
2. Usar mismo secret en `.env`
3. Después de migración, rotar el secret

### Problema: CRC32 para generar userId

**Descripción:** Usar CRC32 puede generar colisiones (dos usuarios con mismo hash)

**Solución a largo plazo:**

- Crear tabla `usuario_id_mapping` en BD
- Asignar IDs únicos persistentes
- Mantener CRC32 como fallback temporal

---

## 📞 Contacto

Para dudas sobre esta migración, consultar:

- Documentación técnica en `/documents`
- Código fuente en `/php-service`
- Issues en repositorio del proyecto
