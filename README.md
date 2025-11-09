# Sistema de Asistencia con Autenticación Criptográfica

Sistema de validación de asistencia universitaria con autenticación JWT y WebSocket seguro.

---

## Quick Start

### Requisitos Previos

- Podman + Podman Compose (o Docker + Docker Compose)
- Puertos disponibles: 9500, 9501, 9502, 9503

### Iniciar Servicios

```bash
# Desarrollo (con hot reload)
podman-compose -f compose.yaml -f compose.dev.yaml up --build

# Producción
podman-compose -f compose.yaml -f compose.prod.yaml up -d --build
```

### Acceso

| Servicio | Puerto | URL/Host | Descripción | Entorno |
|----------|--------|----------|-------------|---------|
| **Frontend** | 9500 | <http://localhost:9500> | Aplicación principal | Todos |
| **Ejemplo JWT** | 9500 | <http://localhost:9500/ejemplo-jwt-client.html> | Demo autenticación | Todos |
| PostgreSQL | 9501 | localhost:9501 | Base de datos | Dev + Prod |
| Valkey | 9502 | localhost:9502 | Cache (Redis) | Dev + Prod |
| Node.js API | 9503 | <http://localhost:9503> | API directa (bypass proxy) | **Solo Dev** |

**Nota:** En producción, Node.js NO está expuesto directamente. Todo el tráfico pasa por el proxy Apache en el puerto 9500.

### Detener Servicios

```bash
podman-compose down
```

---

## Estructura del Proyecto

```
Asistencia/
├── php-service/           # Frontend + Emisor JWT
│   ├── src/               # Código PHP
│   └── apache-config/     # Configuración Apache
├── node-service/          # Backend + WebSocket
│   ├── src/               # Código TypeScript
│   └── frontend/          # Apps frontend
├── documents/             # Documentación técnica completa
│   ├── ARQUITECTURA_JWT.md
│   ├── INSTRUCCIONES_JWT.md
│   ├── 10-guia-integracion-php-node.md
│   └── planificacion/     # Docs de arquitectura
└── compose*.yaml          # Configuraciones Docker/Podman
```

---

## Arquitectura Segura

```text
Cliente → PHP (Valida sesión + Emite JWT) 
       ↓
Cliente → Apache (Reverse Proxy)
       ↓
Cliente → Node.js (Valida JWT + Lógica)
```

**Características de seguridad:**
- JWT con TTL 5 minutos
- WebSocket con autenticación obligatoria
- Node.js NO expuesto directamente
- Códigos de cierre personalizados (4401, 4403, 4408)

---

## Documentación

### Para Desarrolladores

- **[documents/INSTRUCCIONES_JWT.md](documents/INSTRUCCIONES_JWT.md)** - Guía paso a paso
- **[documents/ARQUITECTURA_JWT.md](documents/ARQUITECTURA_JWT.md)** - Arquitectura completa
- **[documents/10-guia-integracion-php-node.md](documents/10-guia-integracion-php-node.md)** - Integración PHP-Node

### Documentación Técnica Completa

Ver carpeta **[documents/](documents/)** para:
- Arquitectura general del sistema
- Componentes criptográficos (FIDO2, ECDH, TOTP)
- Flujos de enrollment y asistencia
- Decisiones arquitectónicas
- Estado de implementación
- Protocolos WebSocket
- Diagramas de secuencia

---

## Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|------------|---------|
| Frontend | PHP + Apache | 7.4 / 2.4 |
| Backend | Node.js + TypeScript | 20 LTS |
| Framework | Fastify | Latest |
| Base de Datos | PostgreSQL | 18 |
| Cache | Valkey | 7 |
| Contenedores | Podman/Docker | Latest |

---

## Troubleshooting

### Puertos en uso

```bash
# Verificar puertos
sudo lsof -i :9500
sudo lsof -i :9501
sudo lsof -i :9502
sudo lsof -i :9503

# Detener servicios anteriores
podman-compose down
```

### Rebuild completo

```bash
# Limpiar todo y reconstruir
podman-compose down -v
podman-compose -f compose.yaml -f compose.dev.yaml up --build --force-recreate
```

### Ver logs

```bash
# Todos los servicios
podman-compose logs -f

# Servicio específico
podman-compose logs -f node-service
podman-compose logs -f php-service
```

---

## Estado del Proyecto

```text
Flujo Anfitrión (Profesor):  ████████████████████████ 100%
Flujo Invitado (Alumno):     ████░░░░░░░░░░░░░░░░░░░░  15% (en desarrollo)

Sistema Completo:            ████████░░░░░░░░░░░░░░░░  57%
```

**Funcionalidades:**
- [OK] Autenticación JWT completa
- [OK] WebSocket seguro con proyección QR
- [OK] Infraestructura de desarrollo y producción
- [WIP] Enrollment FIDO2 (en desarrollo)
- [WIP] Validación de asistencia (en desarrollo)

Ver **[documents/planificacion/13-estado-implementacion.md](documents/planificacion/13-estado-implementacion.md)** para detalles completos.

---

## Contribuir

1. Fork el proyecto
2. Crear branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

---

## Licencia

Este proyecto es parte de un trabajo de titulación universitario.

---

**Última actualización:** 2025-11-06
