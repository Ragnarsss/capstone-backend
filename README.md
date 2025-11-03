# Proyecto Asistencia

Sistema de asistencia universitaria con autenticación criptográfica multi-ronda usando FIDO2/WebAuthn y arquitectura JWT.

## Stack Tecnológico

- **Frontend**: Apache 2.4 + PHP 7.4 (UI + Emisor JWT)
- **Backend**: Node.js 20 + TypeScript + Fastify + JWT Auth
- **Base de datos**: PostgreSQL 18 (schemas: enrollment, attendance)
- **Cache**: Valkey 7 (Redis compatible)
- **Contenedores**: Podman/Docker Compose

## Arquitectura (Patrón JWT Implementado)

```text
┌─────────┐  (1) Pide JWT
│ Cliente ├──────────────────┐
└─────────┘                  │
                             ▼
                      ┌──────────┐
                      │   PHP    │ Valida sesión
                      │"PORTERO" │ Genera JWT
                      └────┬─────┘
                           │
              (2) {"token":"eyJ..."}
                           │
┌─────────┐                │
│ Cliente │◄───────────────┘
│         │
│         │ (3) GET /minodo-api/enrollment/status
│         │     Authorization: Bearer eyJ...
│         ├──────────────────┐
└─────────┘                  │
                             ▼
                      ┌────────────┐
                      │   Apache   │ Reverse Proxy
                      │            │ /minodo-api/* → node:3000/api/*
                      └──────┬─────┘
                             │
                             ▼
                      ┌────────────┐
                      │  Node.js   │ Valida JWT
                      │            │ Ejecuta lógica
                      └──────┬─────┘
                             │
              (4) {"success":true,...}
                             │
┌─────────┐                  │
│ Cliente │◄─────────────────┘
└─────────┘
```

**Ventajas:**
- ✅ **Mínima invasividad**: Solo 1 archivo PHP nuevo (`api_puente_minodo.php`)
- ✅ **Desacoplamiento total**: PHP y Node no se comunican entre sí
- ✅ **Escalabilidad**: Cliente → Node directo (sin bottleneck PHP)
- ✅ **Migración fácil**: Copiar archivos + configurar reverse proxy
- ✅ **Seguridad**: JWT firmado, Node inaccesible desde exterior

---

## 🚀 Quick Start

### 1. Iniciar Servicios

```bash
# Iniciar en modo desarrollo con hot reload
podman-compose -f compose.yaml -f compose.dev.yaml up --build
```

### 2. Probar Arquitectura JWT

Abre en navegador: **http://localhost:9500/ejemplo-jwt-client.html**

Click en **"Ejecutar Flujo Completo"** para ver:
- ✅ PHP emite JWT
- ✅ Cliente llama a Node con JWT
- ✅ Node valida JWT y responde

### 3. Acceso a Servicios

- **Frontend PHP**: `http://localhost:9500`
- **Ejemplo JWT**: `http://localhost:9500/ejemplo-jwt-client.html` ⭐
- **Node.js (directo)**: `http://localhost:9503` (solo dev)
- **PostgreSQL**: `localhost:9501`
- **Valkey**: `localhost:9502`

### 4. Detener Servicios

```bash
podman-compose down
```

---

## 📚 Documentación

### Para Empezar (Orden Recomendado)

1. **[INSTRUCCIONES_JWT.md](INSTRUCCIONES_JWT.md)** ⭐ - Guía paso a paso (EMPEZAR AQUÍ)
2. **[ARQUITECTURA_JWT.md](ARQUITECTURA_JWT.md)** - Documentación técnica completa
3. **[recomendacion.md](recomendacion.md)** - Recomendación original de la IA amiga
4. **[documents/10-guia-integracion-php-node.md](documents/10-guia-integracion-php-node.md)** - Integración PHP-Node con JWT

### Documentación Técnica Completa

Ver carpeta **[documents/](documents/)** para:
- `01-arquitectura-general.md` - Arquitectura general del sistema
- `02-componentes-criptograficos.md` - FIDO2, ECDH, TOTP, AES-GCM
- `03-flujo-enrolamiento.md` - Proceso de enrolamiento WebAuthn
- `04-flujo-asistencia.md` - Validación multi-ronda
- `05-esquema-base-datos.md` - PostgreSQL schemas
- `06-diagramas-secuencia.md` - Diagramas Mermaid
- `07-decisiones-arquitectonicas.md` - ADRs (Architecture Decision Records)
- `11-estrategia-testing.md` - Testing completo

**Total:** ~240 KB de documentación técnica

---

## 🔧 Producción

### Configuración Previa

Antes de desplegar en producción, generar clave secreta JWT:

```bash
# Generar clave secreta robusta (256 bits)
openssl rand -base64 32
```

Actualizar **JWT_SECRET** en:
1. `compose.prod.yaml`:
   ```yaml
   services:
     node-service:
       environment:
         - JWT_SECRET=<clave_generada_aquí>
   ```

2. `php-service/src/lib/jwt.php`:
   ```php
   private const SECRET = '<misma_clave_aquí>';
   ```

### Deployment

```bash
podman-compose -f compose.yaml -f compose.prod.yaml up -d --build
```

### Monitoreo

```bash
# Ver logs de todos los servicios
podman-compose logs -f

# Ver logs específicos
podman logs -f asistencia-php
podman logs -f asistencia-node
```

### Detener

```bash
podman-compose down
```

---

## 📁 Estructura del Proyecto

```bash
.
├── documents/                  # Documentación técnica completa
│   ├── README.md              # Índice de documentos
│   ├── 01-arquitectura-general.md
│   ├── 02-componentes-criptograficos.md
│   ├── 10-guia-integracion-php-node.md  ⭐ ACTUALIZADO (JWT)
│   └── ...
├── php-service/                # Frontend Apache + PHP
│   ├── Containerfile          # Configurado para MPM prefork
│   ├── apache-config/
│   │   └── asistencia.conf    # Reverse proxy /minodo-api
│   └── src/
│       ├── api_puente_minodo.php  ⭐ NUEVO (Emisor JWT)
│       ├── lib/jwt.php        ⭐ NUEVO (Biblioteca JWT)
│       ├── ejemplo-jwt-client.html  ⭐ Cliente de prueba
│       └── index.php
├── node-service/               # Backend Node.js + TypeScript
│   ├── Containerfile
│   ├── package.json           # + jsonwebtoken
│   └── src/
│       ├── config/
│       │   └── index.ts       # Config JWT
│       ├── features/
│       │   ├── jwt-utils.ts   ⭐ NUEVO (Validación JWT)
│       │   ├── auth-middleware.ts  ⭐ NUEVO
│       │   ├── enrollment-handler.ts  ⭐ NUEVO (Endpoints protegidos)
│       │   ├── qr-generator.ts
│       │   ├── websocket-handler.ts
│       │   └── valkey-client.ts
│       └── index.ts
├── compose.yaml                # Configuración base
├── compose.dev.yaml            # Override desarrollo
├── compose.prod.yaml           # Override producción
├── ARQUITECTURA_JWT.md         ⭐ NUEVO (Documentación implementación)
├── INSTRUCCIONES_JWT.md        ⭐ NUEVO (Guía paso a paso)
└── recomendacion.md            ⭐ NUEVO (Recomendación IA amiga)
```

---

## 🔑 Componentes Clave

### PHP Service

**Responsabilidades:**
- Renderizar UI (templates HTML)
- Gestionar sesiones PHP legacy
- **Emitir tokens JWT** para usuarios autenticados

**Archivos nuevos:**
- `src/api_puente_minodo.php` - El "Portero" (emisor JWT)
- `src/lib/jwt.php` - Biblioteca JWT en PHP puro (sin dependencias)

### Node Service

**Responsabilidades:**
- **Validar tokens JWT** de todas las requests
- Lógica criptográfica (FIDO2, ECDH, TOTP, AES-GCM)
- Enrolamiento de dispositivos
- Validación de asistencia multi-ronda
- WebSocket para proyección de QR

**Archivos nuevos:**
- `src/features/jwt-utils.ts` - Validación JWT
- `src/features/auth-middleware.ts` - Middleware autenticación Fastify
- `src/features/enrollment-handler.ts` - Endpoints protegidos con JWT

### Apache Reverse Proxy

**Configuración:**
```apache
# /minodo-api/* → http://node-service:3000/api/*
ProxyPass /minodo-api http://node-service:3000/api
ProxyPassReverse /minodo-api http://node-service:3000/api
```

Permite que el cliente hable **directamente** con Node.js usando JWT.

---

## 🧪 Testing

### Testing Manual

```bash
# 1. Obtener JWT desde PHP
curl "http://localhost:9500/api_puente_minodo.php?action=get_token"

# 2. Usar JWT para llamar a Node
curl -H "Authorization: Bearer <TOKEN>" \
     "http://localhost:9500/minodo-api/enrollment/status"
```

### Testing con Interfaz Web

Abrir: `http://localhost:9500/ejemplo-jwt-client.html`

### Ver Logs

```bash
# Node.js
podman logs -f asistencia-node

# Deberías ver:
# {"level":30,"msg":"Usuario autenticado via JWT","userId":123}
```

---

## 📝 Próximos Pasos

- [ ] Implementar lógica real FIDO2 en `enrollment-handler.ts`
- [ ] Implementar ECDH key exchange completo
- [ ] Conectar con PostgreSQL (schemas enrollment/attendance)
- [ ] Implementar módulo de asistencia con N rondas
- [ ] Testing de seguridad (JWT expiration, malformed tokens)
- [ ] Generar clave secreta robusta para producción

---

## 📖 Referencias

- **JWT RFC 7519**: https://datatracker.ietf.org/doc/html/rfc7519
- **FIDO2/WebAuthn**: https://webauthn.guide/
- **Fastify**: https://www.fastify.io/
- **PHP JWT (sin librerías)**: Ver `php-service/src/lib/jwt.php`

---

**Versión:** 2.0 (Arquitectura JWT)
**Fecha:** 2025-11-03
**Estado:** Implementado y Funcionando
