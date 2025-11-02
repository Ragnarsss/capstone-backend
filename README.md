# POC003 - Sistema de Asistencia

Sistema de asistencia universitaria con generación dinámica de códigos QR vía WebSocket.

## Stack Tecnológico

- **Frontend**: Apache 2.4 + PHP 7.4 (proxy inverso)
- **Backend**: Node.js 20 + TypeScript + Fastify + WebSocket
- **Base de datos**: PostgreSQL 18
- **Cache**: Valkey 7 (Redis compatible)
- **Contenedores**: Podman/Docker Compose

## Arquitectura

```
Usuario → Apache/PHP (9500) → Node.js/Fastify (3000) → Valkey
                                                     → PostgreSQL
```

- Apache sirve frontend y proxy requests a Node.js
- Node.js genera códigos QR cada 3 segundos vía WebSocket
- Valkey almacena cache de sesiones
- PostgreSQL persiste datos de asistencia

## Configuración Inicial

Copiar archivos de ejemplo:

```bash
cp compose.yaml.example compose.yaml
cp compose.dev.yaml.example compose.dev.yaml
cp compose.prod.yaml.example compose.prod.yaml
```

## Desarrollo

Iniciar servicios con hot reload:

```bash
podman-compose -f compose.yaml -f compose.dev.yaml up
```

Acceso:
- Frontend: http://localhost:9500
- Node.js (directo): http://localhost:9503
- PostgreSQL: localhost:9501
- Valkey: localhost:9502

Detener:

```bash
podman-compose down
```

## Producción

Iniciar servicios optimizados:

```bash
podman-compose -f compose.yaml -f compose.prod.yaml up -d --build
```

Acceso:
- Frontend: http://localhost:9500

Ver logs:

```bash
podman-compose logs -f
```

Detener:

```bash
podman-compose down
```

## Estructura del Proyecto

```
.
├── php-service/           # Frontend Apache + PHP
│   ├── Containerfile
│   ├── apache-config/     # Configuración proxy
│   └── src/               # Código PHP
├── node-service/          # Backend Node.js + TypeScript
│   ├── Containerfile
│   └── src/
│       ├── features/      # Vertical slices
│       │   ├── qr-generator.ts
│       │   ├── websocket-handler.ts
│       │   └── valkey-client.ts
│       └── index.ts       # Entry point
├── compose.yaml           # Configuración base
├── compose.dev.yaml       # Override desarrollo
└── compose.prod.yaml      # Override producción
```
