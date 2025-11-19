# Sistema de Asistencia con Autenticación Criptográfica

Sistema de validación de asistencia universitaria con autenticación JWT y WebSocket seguro.

---

## Quick Start

### Requisitos Previos

- Podman + Podman Compose (o Docker + Docker Compose)
- Puertos disponibles: 9500, 9501, 9502, 9503, 9504 (dev)

### Iniciar Servicios

```bash
# Desarrollo (con hot reload y Vite dev server)
podman compose -f compose.yaml -f compose.dev.yaml up --build

# Producción
podman compose -f compose.yaml -f compose.prod.yaml up -d --build

# Detener servicios
podman compose down
```

### Puertos y Acceso

| Servicio | Puerto | URL | Entorno |
|----------|--------|-----|---------|
| **Frontend Principal (HTTP)** | 9500 | <http://localhost:9500> | Todos |
| **Frontend Principal (HTTPS)** | 9505 | <https://localhost:9505> | Todos |
| PostgreSQL | 9501 | localhost:9501 | Dev |
| Valkey (Redis) | 9502 | localhost:9502 | Dev |
| Node.js API (directo) | 9503 | <http://localhost:9503> | **Solo Dev** |
| Vite Dev Server | 9504 | <http://localhost:9504> | **Solo Dev** |

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

| Componente | Tecnología | Versión |
|------------|------------|---------|
| Frontend (PHP) | PHP + Apache | 7.4 / 2.4 |
| Frontend (TS) | TypeScript + Vite | Latest |
| Backend | Node.js + Fastify | 20 LTS |
| Base de Datos | PostgreSQL | 18 |
| Cache | Valkey | 7 |
| Contenedores | Podman/Docker | Latest |

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

---

## Documentación Técnica Completa

Ver carpeta **[documents/](documents/)** para:

- `03-especificaciones-tecnicas/` - Arquitectura, componentes, flujos, esquemas
- `04-planes-implementacion/` - Planes de implementación por módulo
- `02-sistema-base-php/` - Integración PHP-Node y autenticación
- `01-contexto/` - Antecedentes del sistema base

---

## Reglas de Desarrollo

### Principios Arquitectónicos

1. Monolito modular con vertical slicing
2. Separación estricta de responsabilidades (SoC)
3. Domain-Driven Design (DDD)
4. Orden de carga en `app.ts`: infraestructura → módulos → plugin

### Stack y Entorno

1. Stack definido en "Stack Tecnológico" (no modificar sin revisión)
2. Host sin `npm`: toda instalación dentro de contenedores
3. Usar `podman compose` (no `podman-compose`)
4. Reconstruir al cambiar dependencias

### Implementación

1. Analizar flujos existentes antes de cambiar
2. No romper estructura modular ni mezclar responsabilidades
3. Comentarios concisos y pertinentes (sin emojis)
4. No usar emoticones en código ni comentarios

---

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

## Estado del Proyecto

Ver **[documents/03-especificaciones-tecnicas/13-estado-implementacion.md](documents/03-especificaciones-tecnicas/13-estado-implementacion.md)** para:

- Estado de implementación por módulo
- Funcionalidades completadas y pendientes
- Roadmap de desarrollo

---

## Licencia

Este proyecto es parte de un trabajo de titulación universitario.
