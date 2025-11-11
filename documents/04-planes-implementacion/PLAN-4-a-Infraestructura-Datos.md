# PLAN PARTE 1 - Infraestructura de Datos

**Fecha:** 2025-11-04

**Versión:** 2.0

**Estado:** Planificación consolidada

**Duración estimada:** 1 día

---

## Índice

1. [Contexto y Objetivos](#contexto-y-objetivos)
2. [Dependencias](#dependencias)
3. [Alcance](#alcance)
4. [Sprint Detallado](#sprint-detallado)
5. [Archivos a Crear](#archivos-a-crear)
6. [Criterios de Aceptación](#criterios-de-aceptación)
7. [Metodología y Herramientas](#metodología-y-herramientas)

---

## Contexto y Objetivos

**Objetivo Principal:**

Establecer la capa de persistencia completa del sistema, incluyendo schemas PostgreSQL, tablas normalizadas, índices optimizados, scripts de migración y datos de prueba.

**Estado Actual:**

- Sistema: 57% completo
- Infraestructura Podman: Operativa
- PostgreSQL: Contenedor funcionando
- Schemas: NO creados (0%)
- Migraciones: NO implementadas (0%)

**Independencia:**

**NO depende de otras partes.** Puede ejecutarse en paralelo o primero.

---

## Dependencias

**Pre-requisitos:**

- Podman funcionando
- PostgreSQL 18 contenedor disponible
- Variables de entorno configuradas

**Outputs para Otras Partes:**

Esta parte es requisito para:

- **PARTE 2 (Attendance Backend):** Necesita `attendance.*` schemas
- **PARTE 3 (Enrollment Backend):** Necesita `enrollment.*` schemas
- **PARTE 4 (Frontend Guest):** Indirectamente vía APIs

---

## Alcance

**Incluye:**

- Schema `enrollment` completo
- Schema `attendance` completo
- Índices optimizados
- Constraints e integridad referencial
- Scripts de migración
- Scripts de rollback
- Datos de prueba (seeds)
- Integración con Podman Compose
- Documentación de uso

**NO Incluye:**

- Lógica de aplicación
- Repositorios en código
- APIs REST
- Frontend

---

## Sprint Detallado

### SPRINT 1: Infraestructura de Datos

**Duración:** 1 día
**Tareas totales:** 21
**Prioridad:** P0 (Crítica - Bloqueante)

---

#### User Story 1.1 - Schemas PostgreSQL

**Como** desarrollador
**Quiero** tener los schemas de base de datos creados
**Para** poder persistir datos de enrollment y attendance

##### Tareas - User Story 1.1

**PART1-T1.1.1:** Crear archivo `database/migrations/001-initial-schema.sql`

- **Estimación:** XS (1h)
- **Prioridad:** P0
- **Descripción:** Archivo SQL vacío con comentarios de estructura
- **Criterio:** Archivo existe con header y secciones comentadas

**PART1-T1.1.2:** Escribir DDL para schema enrollment

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** `CREATE SCHEMA enrollment` con comentarios
- **Criterio:** Schema se crea sin errores
- **SQL:**

```sql
CREATE SCHEMA IF NOT EXISTS enrollment;
COMMENT ON SCHEMA enrollment IS 'Gestión de dispositivos FIDO2 enrolados';
```

**PART1-T1.1.3:** Escribir DDL para tabla `enrollment.devices`

- **Estimación:** S (3h)
- **Prioridad:** P0
- **Descripción:** Todos los campos FIDO2 (ver doc 05-esquema-base-datos.md)
- **Criterio:** Tabla tiene 11 columnas + constraints
- **Campos principales:**
  - `device_id` (PK), `user_id`, `credential_id` (UNIQUE)
  - `public_key`, `handshake_secret`, `aaguid`
  - `device_fingerprint`, `attestation_format`
  - `sign_count`, `enrolled_at`, `last_used_at`, `is_active`

**PART1-T1.1.4:** Crear índices para `enrollment.devices`

- **Estimación:** XS (1h)
- **Prioridad:** P0
- **Descripción:** Índices en credential_id, user_id, aaguid, is_active
- **Criterio:** 4 índices creados correctamente
- **Índices:**

```sql
CREATE UNIQUE INDEX idx_devices_credential_id ON enrollment.devices(credential_id);
CREATE INDEX idx_devices_user_id ON enrollment.devices(user_id);
CREATE INDEX idx_devices_aaguid ON enrollment.devices(aaguid);
CREATE INDEX idx_devices_active ON enrollment.devices(is_active) WHERE is_active = TRUE;
```

**PART1-T1.1.5:** Escribir DDL para tabla `enrollment.enrollment_history`

- **Estimación:** S (2h)
- **Prioridad:** P1
- **Descripción:** Tabla de auditoría con action, reason, metadata
- **Criterio:** Tabla con FK a devices + índices
- **Campos principales:**
  - `history_id` (PK), `device_id` (FK nullable), `user_id`
  - `action`, `reason`, `performed_at`, `performed_by`, `metadata`
- **Acciones:** `enrolled`, `revoked`, `re-enrolled`, `updated`

##### Tareas - Parte 2

**PART1-T1.1.6:** Escribir DDL para schema attendance

- **Estimación:** XS (1h)
- **Prioridad:** P0
- **Descripción:** `CREATE SCHEMA attendance` con comentarios
- **Criterio:** Schema se crea sin errores

**PART1-T1.1.7:** Escribir DDL para tabla `attendance.sessions`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Tabla para sesiones del profesor
- **Criterio:** Campos session_id, professor_id, course_code, start_time, etc
- **Campos principales:**
  - `session_id` (PK), `professor_id`, `professor_name`
  - `course_code`, `course_name`, `room`, `semester`
  - `start_time`, `end_time`, `max_rounds` (1-10)
  - `status` (active/closed/cancelled), `created_at`

**PART1-T1.1.8:** Escribir DDL para tabla `attendance.registrations`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Anuncios de participación de estudiantes
- **Criterio:** FK a sessions, user_id, queue_position, UNIQUE(session_id, user_id)
- **Campos principales:**
  - `registration_id` (PK), `session_id` (FK), `user_id`
  - `device_id` (FK nullable), `queue_position`
  - `registered_at`, `status` (active/processing/completed/failed)

**PART1-T1.1.9:** Escribir DDL para tabla `attendance.validations`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Registro de cada ronda individual (FN3)
- **Criterio:** FK a registrations, UNIQUE(registration_id, round_number)
- **Campos principales:**
  - `validation_id` (PK), `registration_id` (FK), `round_number`
  - `qr_generated_at`, `qr_scanned_at`, `response_received_at`
  - `response_time_ms`, `totpu_valid`, `totps_valid`
  - `rt_valid`, `secret_valid`, `validation_status`
  - `failed_attempts`, `created_at`

**PART1-T1.1.10:** Escribir DDL para tabla `attendance.results`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Resultado final consolidado PRESENT/ABSENT/DOUBTFUL/ERROR
- **Criterio:** FK a registrations, UNIQUE(registration_id)
- **Campos principales:**
  - `result_id` (PK), `registration_id` (FK UNIQUE)
  - `total_rounds`, `successful_rounds`, `failed_rounds`
  - `avg_response_time_ms`, `std_dev_response_time`
  - `min_response_time_ms`, `max_response_time_ms`, `median_response_time_ms`
  - `certainty_score` (0-100), `final_status`
  - `calculated_at`

**PART1-T1.1.11:** Crear índices para tablas attendance

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Índices en session_id, user_id, created_at, status
- **Criterio:** Mínimo 8 índices en total

---

#### User Story 1.2: Scripts de Migración

**Como** DevOps
**Quiero** scripts automatizados de migración
**Para** desplegar y revertir cambios de DB fácilmente

##### Tareas - User Story 1.2

**PART1-T1.2.1:** Crear archivo `database/migrations/001-rollback.sql`

- **Estimación:** XS (1h)
- **Prioridad:** P1
- **Descripción:** DROP de todas las tablas y schemas
- **Criterio:** Revierte completamente 001-initial-schema.sql

**PART1-T1.2.2:** Crear archivo `database/init.sh`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Script bash que ejecuta migraciones en orden
- **Criterio:** Ejecuta todos los .sql en orden numérico

**PART1-T1.2.3:** Agregar logging a init.sh

- **Estimación:** XS (1h)
- **Prioridad:** P2
- **Descripción:** Echo de cada paso + manejo de errores
- **Criterio:** Script muestra progreso y errores claros

**PART1-T1.2.4:** Hacer init.sh idempotente

- **Estimación:** S (2h)
- **Prioridad:** P1
- **Descripción:** Verificar si schemas existen antes de crear
- **Criterio:** Script puede ejecutarse múltiples veces sin error

---

#### User Story 1.3: Datos de Prueba

**Como** desarrollador
**Quiero** datos de prueba en la base de datos
**Para** poder probar sin crear datos manualmente

##### Tareas - User Story 1.3

**PART1-T1.3.1:** Crear archivo `database/seeds/test-data.sql`

- **Estimación:** XS (1h)
- **Prioridad:** P1
- **Descripción:** Archivo SQL con comentarios

**PART1-T1.3.2:** Insertar 3 dispositivos de prueba en `enrollment.devices`

- **Estimación:** S (2h)
- **Prioridad:** P1
- **Descripción:** Datos realistas con diferentes AAGUIDs
- **Criterio:** 3 INSERT con todos los campos

**PART1-T1.3.3:** Insertar 2 sesiones de prueba en `attendance.sessions`

- **Estimación:** XS (1h)
- **Prioridad:** P1
- **Descripción:** 1 activa, 1 cerrada
- **Criterio:** 2 INSERT con diferentes estados

**PART1-T1.3.4:** Insertar registrations y validations de prueba

- **Estimación:** S (3h)
- **Prioridad:** P1
- **Descripción:** Datos completos para 1 flujo de N rondas
- **Criterio:** Mínimo 6 validations (2 users x 3 rounds)

---

#### User Story 1.4: Integración Podman

**Como** DevOps
**Quiero** que PostgreSQL se inicialice automáticamente
**Para** no tener que ejecutar scripts manualmente

##### Tareas - User Story 1.4

**PART1-T1.4.1:** Crear volume en compose.yaml para PostgreSQL

- **Estimación:** XS (30min)
- **Prioridad:** P0
- **Descripción:** Volume persistente para /var/lib/postgresql/data
- **Criterio:** Datos persisten entre reinicios

**PART1-T1.4.2:** Montar database/ en contenedor PostgreSQL

- **Estimación:** XS (1h)
- **Prioridad:** P0
- **Descripción:** Volume para /podman-entrypoint-initdb.d (compatible con docker-entrypoint-initdb.d)
- **Criterio:** Scripts se ejecutan al crear contenedor

**PART1-T1.4.3:** Configurar variables de entorno en compose

- **Estimación:** XS (30min)
- **Prioridad:** P0
- **Descripción:** POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
- **Criterio:** Base de datos se crea con credenciales correctas

**PART1-T1.4.4:** Crear .env.example con variables DB

- **Estimación:** XS (30min)
- **Prioridad:** P1
- **Descripción:** Template con valores por defecto
- **Criterio:** Documentación clara de cada variable

**PART1-T1.4.5:** Crear README.md en database/

- **Estimación:** S (2h)
- **Prioridad:** P2
- **Descripción:** Documentación de estructura y uso
- **Criterio:** Instrucciones claras para migraciones

---

#### User Story 1.5: Testing DB

**Como** desarrollador
**Quiero** validar que la base de datos funciona correctamente
**Para** asegurar que no hay errores en el schema

##### Tareas - Parte 6

**PART1-T1.5.1:** Ejecutar podman-compose up y verificar logs

- **Estimación:** XS (30min)
- **Prioridad:** P0
- **Descripción:** Verificar que init.sh se ejecuta sin errores
- **Criterio:** No hay errores en logs de PostgreSQL

**PART1-T1.5.2:** Conectar con psql y verificar schemas

- **Estimación:** XS (30min)
- **Prioridad:** P0
- **Descripción:** `\dn` para ver schemas, `\dt enrollment.* attendance.*`
- **Criterio:** Ambos schemas existen con todas las tablas

**PART1-T1.5.3:** Verificar constraints y FK

- **Estimación:** S (2h)
- **Prioridad:** P1
- **Descripción:** Intentar insertar datos inválidos
- **Criterio:** Constraints rechazan datos incorrectos

**PART1-T1.5.4:** Verificar índices con EXPLAIN

- **Estimación:** S (2h)
- **Prioridad:** P1
- **Descripción:** EXPLAIN queries comunes
- **Criterio:** Índices se usan correctamente

---

## Archivos a Crear

```bash
database/
├── init.sh                           # Script inicialización automática
├── migrations/
│   ├── 001-initial-schema.sql        # Schema completo enrollment + attendance
│   └── 001-rollback.sql              # Rollback de schema inicial
├── seeds/
│   └── test-data.sql                 # Datos de prueba
└── README.md                         # Documentación del directorio
```

---

## Criterios de Aceptación

Una tarea se considera **DONE** cuando:

1. PostgreSQL contiene schemas enrollment y attendance
2. Todas las tablas con índices y constraints funcionando
3. Script init ejecuta automáticamente en podman-compose up
4. Datos de prueba insertados correctamente
5. Tests de validación pasan exitosamente
6. Documentación en `database/README.md` completa
7. Code review aprobado
8. Sin errores de lint/SQL
9. Merged a branch principal

---

## Metodología y Herramientas

### Convenciones de Nomenclatura

**Formato tareas:** `PART{parte}-T{story}.{substory}.{tarea}`

**Ejemplo:** `PART1-T1.1.1` = Parte 1, User Story 1.1, Tarea 1

### Workflow por Tarea

1. Crear branch: `git checkout -b PART1-T1.1.1`
2. Implementar tarea
3. Ejecutar tests: `npm test` (si aplica)
4. Ejecutar lint: `npm run lint`
5. Commit: `git commit -m "PART1-T1.1.1: Crear archivo 001-initial-schema.sql"`
6. Push y crear PR
7. Code review
8. Merge a main
9. Marcar tarea como DONE en backlog

### Herramientas Recomendadas

**Gestión:**

- Jira / Linear / GitHub Projects

**Desarrollo:**

- DBeaver / pgAdmin (gestión PostgreSQL)
- VSCode (editor)
- Podman (contenedores)

**Testing:**

- psql (cliente PostgreSQL)
- Scripts bash de validación

### Estimaciones

- **XS:** 1-2 horas
- **S:** 2-4 horas
- **M:** 4-8 horas (1 día)
- **L:** 8-16 horas (2 días)
- **XL:** 16+ horas (3+ días)

### Prioridades

- **P0:** Crítico - Bloqueante
- **P1:** Alta - Necesario para MVP
- **P2:** Media - Importante pero no bloqueante
- **P3:** Baja - Nice to have

---

## Referencias

- [05-esquema-base-datos.md](documents/planificacion/05-esquema-base-datos.md) - Especificación completa schemas
- [01-arquitectura-general.md](documents/planificacion/01-arquitectura-general.md) - Contexto arquitectónico

---

## Estado de Implementación

Ver [documents/planificacion/13-estado-implementacion.md](documents/planificacion/13-estado-implementacion.md) para el estado actualizado de este plan.

**Última actualización:** 2025-11-06

---

**Próximos pasos:** Ejecutar Sprint Planning PARTE 1
