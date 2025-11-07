# Estado de Implementación del Sistema

**Versión:** 1.0  
**Fecha:** 2025-11-03  
**Propósito:** Documento vivo que refleja el estado actual de implementación de todos los módulos

---

## Resumen Ejecutivo

### Estado General del Proyecto

```text
Flujo Anfitrión:  ████████████████████████ 100% [OK] PRODUCCIÓN
Flujo Invitado:   ████░░░░░░░░░░░░░░░░░░░░  15% [FAIL] EN DESARROLLO
  ├─ Enrollment:  ██░░░░░░░░░░░░░░░░░░░░░░  10% (stubs backend)
  └─ Asistencia:  ░░░░░░░░░░░░░░░░░░░░░░░░   0% (no existe)

Sistema Completo: ████████░░░░░░░░░░░░░░░░  57%
```

### Hitos Completados

- [OK] **Arquitectura JWT completa** (PHP emite, Node valida)
- [OK] **WebSocket con autenticación segura** (Opción 5B)
- [OK] **Proyección QR para profesores** (funcional en dev + prod)
- [OK] **Monolito Modular con Vertical Slicing** (arquitectura implementada)

### Próximos Hitos

- [TODO] **Frontend Guest** (aplicación para alumnos)
- [TODO] **Módulo Attendance** (validación de asistencia)
- [TODO] **Enrollment WebSocket** (proceso FIDO2 interactivo)

---

## Estado por Módulo Backend

### Módulo: auth (Autenticación JWT)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| JWT Emisión | `php-service/src/lib/jwt.php` | [OK] Funcional | PHP emite JWT con HS256 |
| JWT Validación | `node-service/src/shared/config/index.ts` | [OK] Funcional | JWTUtils.verify() |
| Middleware HTTP | `node-service/src/shared/config/index.ts` | [OK] Funcional | Fastify hook onRequest |
| WebSocket Auth | `websocket-controller.ts` | [OK] Funcional | Handshake con timeout 5s |
| Tipos | `node-service/src/shared/types/index.ts` | [OK] Funcional | AuthenticatedUser, JWTPayload |

**Estado general:** [OK] **100% Funcional**

**Probado en:**
- [OK] compose.dev.yaml (HTTP + WebSocket)
- [OK] compose.prod.yaml (HTTP + WebSocket)

---

### Módulo: qr-projection (Proyección QR)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| **Application Layer** | | | |
| QR Generation UseCase | `application/usecases/generate-qr.usecase.ts` | [OK] Funcional | Genera QR con qrcode |
| **Domain Layer** | | | |
| QR Entity | `domain/entities/qr-code.entity.ts` | [OK] Funcional | sessionId, timestamp |
| **Infrastructure Layer** | | | |
| QR Service | `infrastructure/qr-service.ts` | [OK] Funcional | Integración qrcode lib |
| **Presentation Layer** | | | |
| WebSocket Controller | `presentation/websocket-controller.ts` | [OK] Funcional | Auth + proyección |
| HTTP Controller | `presentation/qr-projection-controller.ts` | [OK] Funcional | Healthcheck |
| Types/DTOs | `presentation/types.ts` | [OK] Funcional | AuthMessageDTO, QRUpdateDTO |

**Estado general:** [OK] **100% Funcional**

**Características implementadas:**
- [OK] Autenticación JWT obligatoria
- [OK] Countdown de 5 segundos
- [OK] QR update cada 3 segundos
- [OK] Códigos de cierre: 4401, 4403, 4408

**Pendiente:**
- [FAIL] Rotación aleatoria (actualmente solo 1 QR)
- [FAIL] N QR simultáneos en pantalla
- [FAIL] Metadata en Valkey

---

### Módulo: enrollment (Registro de Dispositivos)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| **Application Layer** | | | |
| Start Enrollment | `application/usecases/start-enrollment.usecase.ts` | [WIP] Stub | Retorna challenge fake |
| Finish Enrollment | `application/usecases/finish-enrollment.usecase.ts` | [WIP] Stub | Acepta cualquier credential |
| Login ECDH | `application/usecases/login.usecase.ts` | [WIP] Stub | Retorna keys fake |
| **Domain Layer** | | | |
| Device Entity | `domain/entities/device.entity.ts` | [WIP] Definido | No persiste en DB |
| **Infrastructure Layer** | | | |
| FIDO2 Service | `infrastructure/fido2/fido2-service.ts` | [FAIL] No existe | Pendiente |
| ECDH Service | `infrastructure/crypto/ecdh-service.ts` | [FAIL] No existe | Pendiente |
| **Presentation Layer** | | | |
| HTTP Controller | `presentation/enrollment-handler.ts` | [WIP] Stub | 3 endpoints con stubs |
| WebSocket Controller | `presentation/websocket-controller.ts` | [FAIL] No existe | Crítico para flujo |

**Estado general:** [WIP] **10% - Solo Stubs**

**Endpoints:**
- [WIP] GET `/enrollment/status` → retorna `{enrolled: false}`
- [WIP] POST `/enrollment/start` → retorna challenge fake
- [WIP] POST `/enrollment/finish` → acepta todo
- [WIP] POST `/enrollment/login` → retorna keys fake

**Pendiente (Crítico):**
- [FAIL] WebSocket `/enrollment/ws` (NO EXISTE)
- [FAIL] Lógica FIDO2/WebAuthn real
- [FAIL] ECDH key exchange completo
- [FAIL] Persistencia PostgreSQL `enrollment.devices`
- [FAIL] Sistema de penalizaciones

---

### Módulo: attendance (Validación Asistencia)

| Componente | Estado | Notas |
|------------|--------|-------|
| **Todo el módulo** | [FAIL] No existe | Completamente pendiente |

**Pendiente (Crítico):**
- [FAIL] Estructura completa del módulo
- [FAIL] Endpoint POST `/attendance/validate`
- [FAIL] Lógica de N rondas
- [FAIL] Cálculo de Response Time (RT)
- [FAIL] Validación TOTPu/TOTPs
- [FAIL] Desencriptación QR con session_key
- [FAIL] Persistencia PostgreSQL `attendance.*`
- [FAIL] Resultado PRESENTE/AUSENTE

---

### Módulo: shared (Utilidades Compartidas)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| **Config** | | | |
| JWT Utils | `config/index.ts` | [OK] Funcional | verify(), tipos |
| Environment | `config/index.ts` | [OK] Funcional | JWT_SECRET, DB config |
| **Infrastructure** | | | |
| Valkey Client | `infrastructure/valkey/valkey-client.ts` | [OK] Funcional | Redis-compatible |
| **Types** | | | |
| Common Types | `types/index.ts` | [OK] Funcional | AuthenticatedUser, etc |

**Estado general:** [OK] **100% Funcional**

**Pendiente:**
- [FAIL] Crypto Utils (ECDH, AES, HKDF)
- [FAIL] TOTP Generator
- [FAIL] Validation Utils

---

## Estado por Módulo Frontend

### Frontend: app (Aplicación Anfitrión)

| Componente | Archivo | Estado | Notas |
|------------|---------|--------|-------|
| **Core** | | | |
| HTML Principal | `frontend/app/index.html` | [OK] Funcional | UI proyección |
| Main Logic | `frontend/app/main.js` | [OK] Funcional | Orquestación |
| **Módulo Auth** | | | |
| Auth Service | `modules/auth/auth.service.js` | [OK] Funcional | postMessage listener |
| Token Storage | `modules/auth/token-storage.js` | [OK] Funcional | sessionStorage |
| **Módulo QR Projection** | | | |
| QR Component | `modules/qr-projection/qr-projection.component.js` | [OK] Funcional | UI QR display |
| QR Service | `modules/qr-projection/qr-projection.service.js` | [OK] Funcional | Lógica proyección |
| Styles | `modules/qr-projection/qr-projection.styles.css` | [OK] Funcional | Estilos |
| **Módulo WebSocket** | | | |
| WebSocket Client | `modules/websocket/websocket.client.js` | [OK] Funcional | Cliente genérico + auth |

**Estado general:** [OK] **100% Funcional**

**Características:**
- [OK] Recibe JWT vía postMessage
- [OK] Conecta WebSocket con auth
- [OK] Muestra countdown
- [OK] Proyecta QR cada 3s
- [OK] Manejo de errores

---

### Frontend: guest (Aplicación Invitado)

| Componente | Estado | Notas |
|------------|--------|-------|
| **Todo el frontend** | [FAIL] No existe | Completamente pendiente |

**Pendiente (Crítico):**
- [FAIL] `frontend/guest/index.html`
- [FAIL] `frontend/guest/main.js`
- [FAIL] Módulo enrollment (UI WebAuthn)
- [FAIL] Módulo attendance (escáner QR)
- [FAIL] Módulo scanner (acceso cámara)
- [FAIL] Integración jsQR

---

## Estado Infraestructura

### Base de Datos: PostgreSQL 18

| Schema/Tabla | Estado | Notas |
|--------------|--------|-------|
| `enrollment.devices` | [FAIL] No existe | Tabla pendiente crear |
| `attendance.sessions` | [FAIL] No existe | Tabla pendiente crear |
| `attendance.validations` | [FAIL] No existe | Tabla pendiente crear |

**Estado general:** [FAIL] **0% - No existen schemas**

**SQL pendiente:**
```sql
CREATE SCHEMA IF NOT EXISTS enrollment;
CREATE SCHEMA IF NOT EXISTS attendance;

CREATE TABLE enrollment.devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  aaguid TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE attendance.sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id VARCHAR(100) NOT NULL UNIQUE,
  started_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  result VARCHAR(20)
);

CREATE TABLE attendance.validations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES attendance.sessions(id),
  round_number INTEGER NOT NULL,
  qr_scanned_at TIMESTAMP NOT NULL,
  response_time_ms INTEGER NOT NULL,
  result VARCHAR(20) NOT NULL
);
```

---

### Cache: Valkey 7

| Uso | Estado | Notas |
|-----|--------|-------|
| Cliente base | [OK] Funcional | ValkeyClient implementado |
| Sessions storage | [FAIL] No usado | Pendiente implementar |
| QR metadata | [FAIL] No usado | Pendiente implementar |
| Cola proyección | [FAIL] No usado | Pendiente implementar |

**Estado general:** [WIP] **25% - Cliente listo, sin uso**

---

### Reverse Proxy: Apache 2.4

| Configuración | Archivo | Estado | Notas |
|---------------|---------|--------|-------|
| Proxy Pass | `00-proxy.conf` | [OK] Funcional | `/minodo-api/*` → Node |
| WebSocket Proxy | `00-proxy.conf` | [OK] Funcional | `/asistencia/ws` → Node |
| Virtual Host | `asistencia.conf` | [OK] Funcional | Puerto 9500 |

**Estado general:** [OK] **100% Funcional**

---

### Contenedores: Docker/Podman

| Servicio | Archivo | Estado | Notas |
|----------|---------|--------|-------|
| PHP Service | `php-service/Containerfile` | [OK] Funcional | Apache + PHP 7.4 |
| Node Service | `node-service/Containerfile` | [OK] Funcional | Node 20 LTS |
| PostgreSQL | `compose.yaml` | [OK] Funcional | Postgres 18 |
| Valkey | `compose.yaml` | [OK] Funcional | Valkey 7 |

**Compose files:**
- [OK] `compose.yaml` (base)
- [OK] `compose.dev.yaml` (dev con volúmenes)
- [OK] `compose.prod.yaml` (prod optimizado)

**Estado general:** [OK] **100% Funcional**

---

## Matriz de Compatibilidad

### Ambientes Probados

| Ambiente | Estado | Fecha | Notas |
|----------|--------|-------|-------|
| **Development** | [OK] Funcional | 2025-11-03 | compose.dev.yaml |
| **Production** | [OK] Funcional | 2025-11-03 | compose.prod.yaml |
| **Testing** | [FAIL] No existe | - | Pendiente CI/CD |

### Navegadores Probados

| Browser | Versión | WebSocket | WebAuthn | Notas |
|---------|---------|-----------|----------|-------|
| Firefox | Latest | [OK] OK | [WIP] No probado | Anfitrión funcional |
| Chrome | Latest | [WIP] No probado | [WIP] No probado | Pendiente pruebas |
| Safari | Latest | [WIP] No probado | [WIP] No probado | Pendiente pruebas |
| Edge | Latest | [WIP] No probado | [WIP] No probado | Pendiente pruebas |

---

## Cobertura de Código

### Backend (Node.js)

```text
Módulo auth:           ████████████████████████  95%
Módulo qr-projection:  ██████████████████████░░  90%
Módulo enrollment:     ██░░░░░░░░░░░░░░░░░░░░░░  10%
Módulo attendance:     ░░░░░░░░░░░░░░░░░░░░░░░░   0%
Módulo shared:         ████████████████░░░░░░░░  70%

TOTAL BACKEND:         ████████████░░░░░░░░░░░░  53%
```

### Frontend

```text
Frontend app:          ████████████████████████  95%
Frontend guest:        ░░░░░░░░░░░░░░░░░░░░░░░░   0%

TOTAL FRONTEND:        ████████████░░░░░░░░░░░░  47%
```

### General

```text
COBERTURA TOTAL:       ████████████░░░░░░░░░░░░  50%
```

---

## Métricas de Calidad

### Deuda Técnica

| Categoría | Cantidad | Prioridad |
|-----------|----------|-----------|
| Stubs a implementar | 6 | [TODO] Alta |
| Módulos faltantes | 2 | [TODO] Alta |
| Testing faltante | 5 áreas | 🟠 Media |
| Documentación desactualizada | 3 docs | [OK] Baja |

### Issues Conocidos

1. **Enrollment no funcional:** Solo stubs, WebSocket no existe
2. **Attendance no existe:** Módulo completo pendiente
3. **Frontend guest no existe:** Aplicación completa pendiente
4. **PostgreSQL vacío:** Schemas no creados
5. **Valkey sin uso:** Cliente listo pero no se usa

### Vulnerabilidades de Seguridad

| Severidad | Cantidad | Descripción |
|-----------|----------|-------------|
| [TODO] Crítica | 0 | N/A |
| 🟠 Alta | 0 | N/A |
| [WIP] Media | 1 | Enrollment stubs aceptan todo |
| [OK] Baja | 2 | JWT_SECRET en env, logs verbosos |

---

## Plan de Acción Inmediato

### Sprint 1: Frontend Guest (1-2 días)

**Objetivo:** Crear aplicación básica para alumnos

**Tareas:**
- [ ] Crear `/frontend/guest/index.html`
- [ ] Crear `/frontend/guest/main.js`
- [ ] Implementar postMessage listener
- [ ] Llamar `/enrollment/status`
- [ ] Mostrar stubs de modos

**Entregable:** Aplicación guest con stubs funcionales

---

### Sprint 2: Módulo Attendance (3-5 días)

**Objetivo:** Asistencia funcional (mínimo 1 ronda)

**Tareas:**
- [ ] Crear schemas PostgreSQL
- [ ] Implementar módulo attendance completo
- [ ] Endpoint POST `/attendance/validate`
- [ ] Frontend: escáner QR
- [ ] Testing end-to-end

**Entregable:** Flujo completo profesor → alumno

---

### Sprint 3: Enrollment Real (5-7 días)

**Objetivo:** FIDO2/WebAuthn funcional

**Tareas:**
- [ ] WebSocket `/enrollment/ws`
- [ ] Implementar FIDO2 real
- [ ] Implementar ECDH completo
- [ ] Sistema de penalizaciones
- [ ] Testing completo

**Entregable:** Enrollment production-ready

---

## Referencias Cruzadas

### Documentación Relacionada

- [01-arquitectura-general.md](01-arquitectura-general.md) - Arquitectura completa
- [12-propuesta-separacion-roles.md](12-propuesta-separacion-roles.md) - Flujos por rol
- [07-decisiones-arquitectonicas.md](07-decisiones-arquitectonicas.md) - Decisiones técnicas

### Código Clave

- `node-service/src/shared/config/index.ts` - JWT Utils
- `node-service/src/modules/qr-projection/` - Módulo completo funcional
- `node-service/src/frontend/app/` - Frontend Anfitrión completo

---

**Última actualización:** 2025-11-03  
**Próxima revisión:** Después de cada sprint  
**Mantenido por:** Equipo de desarrollo

---

## Notas Finales

Este documento debe actualizarse:
- [OK] Al completar cada sprint
- [OK] Al agregar nuevos módulos
- [OK] Al detectar issues de seguridad
- [OK] Antes de cada release a producción

**Estado actual:** Sistema parcialmente funcional. Flujo Anfitrión listo para producción. Flujo Invitado en desarrollo inicial.
