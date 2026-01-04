# Componentes PHP Reutilizables vs Configuración de Desarrollo

**Fecha:** 2025-12-19  
**Propósito:** Identificar qué partes del módulo PHP son **código de producción reutilizable** y qué partes son **solo configuración de desarrollo** que se perderán.

---

## 🎯 Resumen Ejecutivo

Del módulo PHP (`php-service/src/asistencia-node-integration`), aproximadamente **70% es código reutilizable** que debe integrarse al sistema legacy Hawaii, y **30% es configuración de contenedores** que se adaptará al entorno de producción.

---

## ✅ Componentes REUTILIZABLES (Código de Producción)

### 1. **Capa de Dominio** (100% Reutilizable)

```
domain/
├── AuthenticationService.php    ✅ CRÍTICO - Lógica de autenticación y JWT
└── IntegrationGateway.php       ✅ CRÍTICO - Interface para comunicación con Node
```

**Por qué es crítico:**

- `AuthenticationService` contiene la lógica de negocio para generar tokens JWT
- Reemplaza completamente el código manual de `api_get_asistencia_token.php`
- Usa Dependency Injection (testeable, mantenible)
- Coordina `LegacySessionAdapter` + `JWT` library

**Uso:**

```php
$authService = new AuthenticationService($sessionAdapter, $jwtLibrary);
$result = $authService->generateToken();
// Retorna: ['success' => true, 'token' => '...', 'expiresIn' => 300, ...]
```

---

### 2. **Biblioteca JWT** (100% Reutilizable)

```
lib/crypto/
└── JWT.php                      ✅ CRÍTICO - Codificación/decodificación JWT
```

**Por qué es crítico:**

- Implementación limpia de JWT con HMAC-SHA256
- Sin dependencias externas (no requiere composer)
- Compatible con `jsonwebtoken` de Node.js
- Métodos: `encode()`, `decode()`
- Maneja TTL, issuer, audience

**Ventajas sobre código legacy:**
| Legacy | JWT.php |
|--------|---------|
| Manual base64url encode | ✅ Método encapsulado |
| Manual hash_hmac | ✅ Validación de firma |
| No valida expiración | ✅ Valida exp, iat, iss, aud |
| No reutilizable | ✅ Clase reutilizable |

---

### 3. **Adaptadores de Infraestructura** (100% Reutilizable)

```
infrastructure/
├── http/
│   └── NodeServiceClient.php    ✅ Comunicación HTTP con Node.js
└── persistence/
    └── LegacySessionAdapter.php ✅ CRÍTICO - Adaptador sesiones legacy
```

**LegacySessionAdapter** (ACTUALIZADO):

- ✅ Ya corregido para usar `$_SESSION['id']` y `$_SESSION['user']`
- ✅ Distingue profesor vs alumno
- ✅ Genera userId con CRC32 para alumnos
- ✅ Métodos adicionales: `isProfesor()`, `isAlumno()`

**NodeServiceClient:**

- Comunicación HTTP con el servicio Node.js
- Maneja autenticación interna (JWT_SECRET_INTERNAL)
- Útil para llamadas PHP → Node cuando sea necesario

---

### 4. **Configuración Centralizada** (90% Reutilizable)

```
config/
├── Config.php                   ✅ CRÍTICO - Configuración centralizada
└── env.example.php              ⚠️ Template (adaptar)
```

**Config.php:**

- Carga configuración desde variables de entorno
- Single source of truth
- Type-safe getters
- Fallbacks seguros

**Variables críticas:**

```php
Config::getJwtSecret()          // Secret compartido PHP-Node
Config::getJwtSecretInternal()  // Secret interno PHP
Config::getJwtTtl()             // TTL tokens (300 seg)
Config::getNodeServiceUrl()     // URL del servicio Node
Config::isEnabled()             // Feature flag
Config::isDevelopment()         // Modo dev/prod
```

**⚠️ Adaptar según entorno de producción:**

- Servidor de desarrollo: leer de `.env`
- Servidor de producción: leer de variables de entorno del sistema

---

### 5. **Capa de Presentación - Router** (80% Reutilizable)

```
presentation/
├── Router.php                   ✅ Front Controller Pattern
├── api/
│   ├── UserDataController.php   ✅ Endpoint para datos de usuario
│   ├── CourseDataController.php ✅ Endpoint para datos de curso
│   └── EnrollmentDataController.php ✅ Endpoint para inscripciones
└── views/
    ├── modal-host.php           ⚠️ Adaptar UI
    └── modal-reader.php         ⚠️ Adaptar UI
```

**Router.php:**

- Mapea rutas a handlers
- Front Controller Pattern
- Maneja CORS
- Centraliza manejo de errores

**Endpoints API:**

- `/api/token` → Genera JWT (reemplaza `api_get_asistencia_token.php`)
- `/api/validate-session` → Valida sesión sin generar token
- `/api/user-data` → Datos de usuario para Node.js
- `/api/course-data` → Datos de curso para Node.js
- `/api/enrollment-data` → Datos de inscripciones

**Views (modales):**

- Probablemente necesiten **adaptación visual** para coincidir con el diseño de Hawaii
- La **lógica JavaScript** es reutilizable (postMessage, JWT, WebSocket)

---

### 6. **Bootstrap (DI Container)** (100% Reutilizable)

```
bootstrap.php                    ✅ CRÍTICO - Composition Root
```

**Por qué es crítico:**

- Crea instancias y conecta dependencias (DI manual)
- Configura todo el módulo
- Verifica que el módulo esté habilitado (`Config::isEnabled()`)
- Inicia sesión si es necesario
- Carga `db.inc` (funciones legacy)

**Flujo:**

```
bootstrap.php
  → Carga Config
  → Verifica NODE_MODULE_ENABLED
  → Inicia sesión PHP
  → Carga db.inc (funciones legacy Hawaii)
  → Crea instancias:
      - LegacySessionAdapter
      - JWT libraries (público e interno)
      - NodeServiceClient
      - AuthenticationService
      - Router
  → Retorna Router configurado
```

---

### 7. **Entry Point** (100% Reutilizable)

```
index.php                        ✅ Entry point HTTP
```

**Simplicidad extrema:**

```php
<?php
$router = require_once __DIR__ . '/bootstrap.php';
$router->handle();
```

**Responsabilidad única:** Cargar bootstrap y delegar al router.

---

## ❌ Componentes NO REUTILIZABLES (Solo Configuración)

### 1. **Containerfile (Docker/Podman)**

```
Containerfile                    ❌ Solo desarrollo local
```

- Configuración específica para contenedores Podman
- En producción, el código PHP corre en Apache existente
- **No necesario** en servidor de producción Hawaii

---

### 2. **Apache Config (Parcialmente)**

```
apache-config/
├── 00-proxy.conf                ⚠️ Adaptar a producción
├── asistencia.conf              ⚠️ Adaptar a producción
└── asistencia-ssl.conf          ⚠️ Adaptar a producción
```

**Qué conservar:**

- **Reglas de ProxyPass** para Node.js
- **Rewrite rules** para el módulo

**Qué adaptar:**

- Rutas absolutas
- Nombres de virtual hosts
- Certificados SSL
- Puertos

**Ejemplo adaptación:**

**Desarrollo:**

```apache
ProxyPass /asistencia http://node-service:3000/asistencia
```

**Producción:**

```apache
ProxyPass /asistencia http://localhost:3000/asistencia
```

---

### 3. **Compose Files**

```
compose.yaml                     ❌ Solo desarrollo local
compose.dev.yaml                 ❌ Solo desarrollo local
compose.prod.yaml                ❌ Solo desarrollo local
```

- Configuración de Podman Compose
- Define contenedores (php-service, node-service, db, valkey)
- Útil para **desarrollo y testing**, no para producción

---

### 4. **Simulador de Desarrollo**

```
src/dev-simulator/               ❌ Solo testing local
├── index.php
├── login.php
├── alumno-dashboard.php
├── profesor-dashboard.php
├── MockDataProvider.php
└── ...
```

**Propósito:** Simular sistema legacy Hawaii en desarrollo local
**En producción:** Usar el sistema legacy Hawaii real
**Estado:** Eliminar o ignorar

---

### 5. **Módulo de Encuesta (Probablemente Legacy)**

```
src/encuesta/
└── index.php                    ⚠️ Verificar si se usa
```

**Acción:** Revisar si este módulo es necesario o si es código legacy que quedó ahí.

---

## 📊 Matriz de Reutilización

| Componente                                            | Reutilizable | Criticidad | Acción                         |
| ----------------------------------------------------- | ------------ | ---------- | ------------------------------ |
| `domain/AuthenticationService.php`                    | ✅ 100%      | CRÍTICO    | **Integrar inmediatamente**    |
| `domain/IntegrationGateway.php`                       | ✅ 100%      | CRÍTICO    | **Integrar inmediatamente**    |
| `lib/crypto/JWT.php`                                  | ✅ 100%      | CRÍTICO    | **Integrar inmediatamente**    |
| `infrastructure/persistence/LegacySessionAdapter.php` | ✅ 100%      | CRÍTICO    | **Ya corregido**               |
| `infrastructure/http/NodeServiceClient.php`           | ✅ 100%      | Media      | Integrar si necesitas PHP→Node |
| `config/Config.php`                                   | ✅ 90%       | CRÍTICO    | **Integrar + adaptar entorno** |
| `presentation/Router.php`                             | ✅ 80%       | ALTA       | **Integrar + adaptar rutas**   |
| `presentation/api/*.php`                              | ✅ 80%       | ALTA       | **Integrar controllers**       |
| `presentation/views/*.php`                            | ⚠️ 60%       | Media      | Adaptar UI a diseño Hawaii     |
| `bootstrap.php`                                       | ✅ 100%      | CRÍTICO    | **Integrar sin cambios**       |
| `index.php`                                           | ✅ 100%      | CRÍTICO    | **Integrar sin cambios**       |
| `apache-config/*`                                     | ⚠️ 50%       | ALTA       | **Adaptar a producción**       |
| `Containerfile`                                       | ❌ 0%        | -          | Ignorar                        |
| `compose.*.yaml`                                      | ❌ 0%        | -          | Solo dev/testing               |
| `dev-simulator/`                                      | ❌ 0%        | -          | Eliminar                       |

---

## 🛠️ Plan de Integración

### Fase 1: Componentes Críticos (Inmediato)

1. **Copiar carpeta completa** a servidor de producción:

```bash
scp -r php-service/src/asistencia-node-integration/ \
  usuario@servidor:/var/www/html/hawaii/
```

2. **Configurar variables de entorno** (ver [MIGRACION-ENDPOINT-TOKEN.md](./MIGRACION-ENDPOINT-TOKEN.md))

3. **Configurar Apache** (adaptar rutas y proxy)

4. **Testing funcional**

### Fase 2: Deprecar Legacy (Después de validación)

1. Buscar llamadas a `api_get_asistencia_token.php`
2. Actualizar a `/asistencia-node-integration/api/token`
3. Renombrar `api_get_asistencia_token.php.deprecated`

### Fase 3: Optimización (Largo plazo)

1. Adaptar vistas (modales) al diseño Hawaii
2. Implementar sistema de IDs únicos persistentes (tabla BD)
3. Agregar logs y monitoreo
4. Tests unitarios para componentes críticos

---

## 🎓 Conclusión

**Componentes críticos que DEBEN conservarse:**

1. ✅ **AuthenticationService** - Lógica de autenticación
2. ✅ **JWT.php** - Biblioteca JWT
3. ✅ **LegacySessionAdapter** - Adaptador sesiones (ya corregido)
4. ✅ **Config.php** - Configuración centralizada
5. ✅ **Router.php** - Front controller
6. ✅ **Controllers (api/)** - Endpoints de datos
7. ✅ **bootstrap.php** - DI Container
8. ✅ **index.php** - Entry point

**Componentes que se pierden (solo config de desarrollo):**

1. ❌ Containerfile, compose files
2. ❌ dev-simulator/
3. ⚠️ Apache config (requiere adaptación)

**Resultado:** El **núcleo del módulo PHP es producción-ready** y puede integrarse directamente al sistema legacy Hawaii con mínimas adaptaciones (principalmente configuración de entorno).

---

## 📚 Referencias

- [MIGRACION-ENDPOINT-TOKEN.md](./MIGRACION-ENDPOINT-TOKEN.md) - Guía de migración paso a paso
- [Roseta de Integración](./01-contexto/roseta-integracion-php-legacy.md) - Especificación de integración
- [README del módulo PHP](../php-service/src/asistencia-node-integration/README.md) - Documentación completa
