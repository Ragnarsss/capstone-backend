# Sistema de Asistencia con Autenticación Criptográfica

[![CI/CD Pipeline](https://github.com/Ragnarsss/capstone-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Ragnarsss/capstone-backend/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Ragnarsss/capstone-backend/branch/main/graph/badge.svg)](https://codecov.io/gh/Ragnarsss/capstone-backend)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![PHP Version](https://img.shields.io/badge/php-7.4%20%7C%208.0%20%7C%208.1-blue)](https://www.php.net/)

Sistema de validación de asistencia universitaria con autenticación JWT y WebSocket seguro.

**Gobernanza:** Ver [PROJECT-CONSTITUTION.md](PROJECT-CONSTITUTION.md) (principios y límites) y [daRulez.md](daRulez.md) (reglas de desarrollo).

---

## Quick Start

### Requisitos Previos

- Podman + Podman Compose
- Puertos disponibles: 9500, 9501, 9502, 9503, 9504 (desarrollo)

### Iniciar Servicios (Podman)

```bash
# Desarrollo (con hot reload y Vite dev server)
podman compose -f compose.yaml -f compose.dev.yaml up --build

# Producción
podman compose -f compose.yaml -f compose.prod.yaml up -d --build

# Detener servicios
podman compose down
```

**Nota importante:** npm se ejecuta **dentro del contenedor Node**. No instalar npm en el host. Ver [PROJECT-CONSTITUTION.md](PROJECT-CONSTITUTION.md) Artículo 3.2.

### Puertos y Acceso

| Servicio                       | Puerto | URL                    | Entorno      |
| ------------------------------ | ------ | ---------------------- | ------------ |
| **Frontend Principal (HTTP)**  | 9500   | http://localhost:9500  | Todos        |
| **Frontend Principal (HTTPS)** | 9505   | https://localhost:9505 | Todos        |
| PostgreSQL                     | 9501   | localhost:9501         | Dev          |
| Valkey (Redis)                 | 9502   | localhost:9502         | Dev          |
| Node.js API (directo)          | 9503   | http://localhost:9503  | **Solo Dev** |
| Vite Dev Server                | 9504   | http://localhost:9504  | **Solo Dev** |

**Nota:** En producción, Node.js NO está expuesto. Todo pasa por Apache (puerto 9500 HTTP / 9505 HTTPS).

---

## Arquitectura

```text
Cliente → Apache (PHP Service - Puerto 9500)
       ↓
    Emite JWT + Reverse Proxy
       ↓
Cliente → Node.js Backend (Puerto 3000 interno)
       ↓
    Middlewares → Módulos (QR Projection, Enrollment, Attendance)
       ↓
    PostgreSQL + Valkey
```

**Características:**

- JWT con TTL 5 minutos (PHP emite, Node valida)
- WebSocket autenticado con códigos de cierre personalizados (4401, 4403, 4408)
- Node.js no expuesto en producción
- Monolito modular con vertical slicing y DDD

---

## Stack Tecnológico

| Componente     | Tecnología        | Versión   |
| -------------- | ----------------- | --------- |
| Frontend (PHP) | PHP + Apache      | 7.4 / 2.4 |
| Frontend (TS)  | TypeScript + Vite | Latest    |
| Backend        | Node.js + Fastify | 20 LTS    |
| Base de Datos  | PostgreSQL        | 18        |
| Cache          | Valkey            | 7         |
| Contenedores   | Podman            | Latest    |

---

## Comandos Útiles

### Logs de servicios

```bash
# Todos los servicios
podman compose logs -f

# Servicio específico
podman compose logs -f node-service
podman compose logs -f php-service
```

### Reconstruir desde cero

```bash
# Limpiar todo y reconstruir
podman compose down -v
podman compose -f compose.yaml -f compose.dev.yaml up --build --force-recreate
```

### Verificar puertos en uso

```bash
sudo lsof -i :9500
sudo lsof -i :9501
sudo lsof -i :9502
sudo lsof -i :9503  # Solo en desarrollo
sudo lsof -i :9504  # Solo en desarrollo
sudo lsof -i :9505  # HTTPS
```

### Ejecutar npm dentro del contenedor

```bash
# Builds, tests, etc.
podman exec asistencia-node npm run build
podman exec asistencia-node npm run test

# Ver scripts disponibles
podman exec asistencia-node npm run
```

Ver [PROJECT-CONSTITUTION.md](PROJECT-CONSTITUTION.md) Artículo 3.2 para comandos npm en contenedores.

---

## Documentación Técnica

### Gobernanza y Reglas

- [PROJECT-CONSTITUTION.md](PROJECT-CONSTITUTION.md) - Principios arquitectónicos, límites y governance
- [daRulez.md](daRulez.md) - Reglas de desarrollo y workflow
- [ROADMAP.md](ROADMAP.md) - Plan de implementación por fases

### Arquitectura y Especificaciones

- [spec-architecture.md](spec-architecture.md) - Arquitectura de dominios y Access Gateway (fuente de verdad)
- [spec-qr-validation.md](spec-qr-validation.md) - Flujo de validación QR con rounds e intentos
- [db-schema.md](db-schema.md) - Esquemas PostgreSQL y Valkey

### Documentación Adicional

Ver carpeta **[documents/](documents/)** para:

- `01-contexto/` - Antecedentes y guías de integración (ej: [roseta-integracion-php-legacy.md](documents/01-contexto/roseta-integracion-php-legacy.md))
- `03-especificaciones-tecnicas/` - Especificaciones técnicas adicionales
- `04-planes-implementacion/` - Planes de implementación por módulo
- `02-sistema-base-php/` - Integración PHP-Node y autenticación

---

## Reglas de Desarrollo

### Principios Clave

Gobernanza completa: Ver [PROJECT-CONSTITUTION.md](PROJECT-CONSTITUTION.md) y [daRulez.md](daRulez.md)

1. **Monolito modular** con vertical slicing
2. **Separación estricta** de responsabilidades entre dominios
3. **Domain-Driven Design** - cada módulo tiene dominio, aplicación, infraestructura
4. **Orden de bootstrap:** infraestructura → módulos → plugins

### Stack y Entorno

1. Stack definido en tabla anterior - no modificar sin revisión
2. Host sin `npm`: toda instalación dentro de contenedores
3. Usar `podman compose` (no `podman-compose`)
4. Reconstruir contenedores al cambiar dependencias

### Implementación

1. Analizar flujos existentes antes de cambiar
2. No romper estructura modular ni mezclar responsabilidades
3. Comentarios concisos y pertinentes (sin emojis)
4. Crear ramas por tarea
5. Commits atómicos con mensajes descriptivos en español

---

## Troubleshooting

### Puertos ocupados

```bash
# Verificar puertos
sudo lsof -i :9500
sudo lsof -i :9501
sudo lsof -i :9502
sudo lsof -i :9503  # Solo en desarrollo
sudo lsof -i :9504  # Solo en desarrollo
sudo lsof -i :9505  # HTTPS

# Detener servicios anteriores
podman compose down
```

### Problemas de permisos

```bash
# Recrear volúmenes
podman compose down -v
podman compose -f compose.yaml -f compose.dev.yaml up --build
```

---

## Histórico

Documentación histórica movida a [.ignore/historico/](.ignore/historico/) para mantener la raíz limpia.

---

## Licencia

Este proyecto es parte de un trabajo de titulación universitario.
