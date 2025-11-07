# PLAN PARTE 2: Módulo Attendance Backend

**Fecha:** 2025-11-04
**Versión:** 2.0
**Estado:** Planificación consolidada
**Duración estimada:** 3-4 días

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

### Objetivo Principal

Implementar la lógica completa de validación de asistencia mediante N rondas de captura QR, incluyendo validación criptográfica (TOTP dual), cálculo de tiempos de respuesta y determinación de certeza probabilística.

### Estado Actual

- Sistema: 57% completo
- Base de datos: Schemas creados (PARTE 1)
- Módulo Attendance: NO implementado (0%)
- Endpoints REST: NO creados (0%)

### Independencia

**Depende de PARTE 1 (Base datos).** NO depende de PARTE 3 ni 4.

---

## Dependencias

### Pre-requisitos

- **PARTE 1 completada:** Schemas `attendance.*` creados
- PostgreSQL funcionando con datos de prueba
- Valkey/Redis disponible para cache
- Variables de entorno configuradas

### Outputs para Otras Partes

Esta parte provee:
- **PARTE 4 (Frontend Guest):** Endpoints REST para validación
- APIs:
  - `POST /attendance/register`
  - `POST /attendance/validate`
  - `GET /attendance/result/:sessionId/:userId`

---

## Alcance

### Incluye

**Domain Layer:**
- Entities: `Validation`, `AttendanceSession`, `Round`
- Value Objects: `ResponseTime`, `CertaintyScore`, `QRPayload`
- Domain Services: `CertaintyCalculator`, `TOTPValidator`

**Application Layer:**
- Use Cases: Register, Validate Round, Calculate Result
- DTOs con validación

**Infrastructure Layer:**
- Repositories: Session, Validation, QRMetadata
- Services: TOTP, Encryption (AES-256-GCM)

**Presentation Layer:**
- HTTP REST Controllers
- Error handling middleware

**Testing:**
- Unit tests (CertaintyCalculator)
- Integration tests (Use Cases)
- E2E tests (flujo completo N rondas)

### NO Incluye

- Frontend (PARTE 4)
- Enrollment (PARTE 3)
- WebSocket (solo HTTP REST)

---

## Sprint Detallado

### SPRINT 2: Módulo Attendance Backend

**Duración:** 3-4 días
**Tareas totales:** 39
**Prioridad:** P0 (Crítica para MVP)

---

#### User Story 2.1: Domain Layer Attendance

**Como** desarrollador
**Quiero** las entidades de dominio definidas
**Para** tener un modelo rico del negocio

##### Tareas

**PART2-T2.1.1:** Crear estructura de carpetas `attendance/domain`

- **Estimación:** XS (15min)
- **Prioridad:** P0
- **Descripción:** `entities/`, `value-objects/`, `services/`
- **Tipo:** Estructura de directorios

**PART2-T2.1.2:** Implementar `Validation.entity.ts`

- **Estimación:** S (3h)
- **Prioridad:** P0
- **Descripción:** Entity con id, round_number, qr_scanned_at, response_time_ms
- **Criterio:** Constructor + getters + validation methods
- **Tipo:** Clase TypeScript

**PART2-T2.1.3:** Implementar `AttendanceSession.entity.ts`

- **Estimación:** S (3h)
- **Prioridad:** P0
- **Descripción:** Entity con session info + lista de validations
- **Criterio:** Métodos `addValidation()`, `isComplete()`
- **Tipo:** Clase TypeScript (Aggregate Root)

**PART2-T2.1.4:** Implementar `Round.entity.ts`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Entity para una ronda individual
- **Criterio:** `round_number`, `status`, `timestamp`
- **Tipo:** Clase TypeScript

**PART2-T2.1.5:** Implementar `ResponseTime.vo.ts`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Value Object con validación de rango (500ms-15s)
- **Criterio:** Throw error si fuera de rango
- **Tipo:** Value Object inmutable

**PART2-T2.1.6:** Implementar `CertaintyScore.vo.ts`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Value Object con score 0-100%
- **Criterio:** Métodos `isPresent()` >= 70%, `isAbsent()` < 70%
- **Tipo:** Value Object inmutable

**PART2-T2.1.7:** Implementar `QRPayload.vo.ts`

- **Estimación:** S (3h)
- **Prioridad:** P0
- **Descripción:** Value Object con estructura QR encriptado
- **Criterio:** Campos userId, sessionId, roundNumber, TOTPs, timestamp
- **Tipo:** Value Object inmutable

---

#### User Story 2.2: Domain Services Attendance

**Como** desarrollador
**Quiero** servicios de dominio para lógica compleja
**Para** mantener entidades limpias

##### Tareas

**PART2-T2.2.1:** Implementar `CertaintyCalculator.service.ts`

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** Calcula certeza basado en array de response_times
- **Criterio:** Algoritmo según doc 02-componentes-criptograficos.md
- **Algoritmo:**
  - std_dev < 500ms y 800 < avg < 3000 → 95% PRESENTE
  - std_dev < 1000ms y 500 < avg < 5000 → 70% PROBABLE_PRESENTE
  - std_dev < 2000ms y 300 < avg < 8000 → 50% DUDOSO
  - Caso contrario → 20% AUSENTE

**PART2-T2.2.2:** Crear tests unitarios para `CertaintyCalculator`

- **Estimación:** S (4h)
- **Prioridad:** P0
- **Descripción:** Casos: todos válidos, algunos inválidos, todos inválidos
- **Criterio:** Coverage > 90%
- **Tipo:** Jest tests

**PART2-T2.2.3:** Implementar `TOTPValidator.service.ts`

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** Valida TOTPu (usuario) y TOTPs (sistema)
- **Criterio:** Window de 30s, tolerancia ±1 período
- **Tipo:** Domain Service

**PART2-T2.2.4:** Crear tests unitarios para `TOTPValidator`

- **Estimación:** S (4h)
- **Prioridad:** P0
- **Descripción:** Casos: válido, expirado, futuro, inválido
- **Criterio:** Coverage > 90%
- **Tipo:** Jest tests

---

#### User Story 2.3: Infrastructure Layer Attendance

**Como** desarrollador
**Quiero** repositorios para persistencia
**Para** guardar datos en PostgreSQL y Valkey

##### Tareas

**PART2-T2.3.1:** Implementar `SessionRepository.ts` (PostgreSQL)

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** CRUD para `attendance.sessions`
- **Criterio:** Métodos `create()`, `findById()`, `update()`, `delete()`
- **Contexto:** `attendance/infrastructure`

**PART2-T2.3.2:** Implementar `RegistrationRepository.ts` (PostgreSQL)

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** CRUD para `attendance.registrations`
- **Criterio:** Métodos `create()`, `findBySession()`, `findByUser()`, `updateStatus()`
- **Contexto:** `attendance/infrastructure`
- **Tabla:** `attendance.registrations` (registration_id, session_id, user_id, device_id, queue_position, status)

**PART2-T2.3.3:** Implementar `ValidationRepository.ts` (PostgreSQL)

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** CRUD para `attendance.validations`
- **Criterio:** Métodos `create()`, `findByRegistration()`, `findByRound()`, `countByRegistration()`
- **Contexto:** `attendance/infrastructure`
- **Tabla:** `attendance.validations` (validation_id, registration_id, round_number, response_time_ms, validation_status)

**PART2-T2.3.4:** Implementar `ResultRepository.ts` (PostgreSQL)

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** CRUD para `attendance.results`
- **Criterio:** Métodos `create()`, `findByRegistration()`, `updateResult()`
- **Contexto:** `attendance/infrastructure`
- **Tabla:** `attendance.results` (result_id, registration_id, certainty_score, final_status, estadísticas)

**PART2-T2.3.5:** Implementar `QRMetadataRepository.ts` (Valkey)

- **Estimación:** M (5h)
- **Prioridad:** P0
- **Descripción:** Cache de metadata QR con TTL 2min
- **Criterio:** Métodos `set()`, `get()`, `delete()`, TTL automático
- **Contexto:** `attendance/infrastructure`

**PART2-T2.3.6:** Implementar `TOTPService.ts`

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** Generación y validación TOTP con speakeasy/otplib
- **Criterio:** Genera TOTP, valida con window, compatible RFC 6238
- **Contexto:** `attendance/infrastructure`

**PART2-T2.3.7:** Implementar `EncryptionService.ts`

- **Estimación:** M (8h)
- **Prioridad:** P0
- **Descripción:** AES-256-GCM encrypt/decrypt con session_key
- **Criterio:** Encripta QR payload, desencripta con IV correcto
- **Contexto:** `attendance/infrastructure`

**PART2-T2.3.8:** Crear tests integración para repositorios

- **Estimación:** M (6h)
- **Prioridad:** P1
- **Descripción:** Tests contra DB real (testcontainers)
- **Criterio:** Coverage > 80%, todos los métodos probados
- **Contexto:** `attendance/infrastructure`

---

#### User Story 2.4: Application Layer Attendance

**Como** desarrollador
**Quiero** casos de uso bien definidos
**Para** orquestar la lógica de negocio

##### Tareas

**PART2-T2.4.1:** Implementar `RegisterUserUseCase.ts`

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** Registra usuario en sesión + genera payload R1
- **Criterio:** Valida enrollment, crea registration, retorna queue_position
- **Contexto:** `attendance/application`

**PART2-T2.4.2:** Implementar `ValidateRoundUseCase.ts`

- **Estimación:** L (12h)
- **Prioridad:** P0
- **Descripción:** Valida una ronda completa
- **Criterio:** Desencripta QR, valida TOTPs, calcula RT, guarda validation
- **Contexto:** `attendance/application`

**PART2-T2.4.3:** Implementar `CalculateFinalResultUseCase.ts`

- **Estimación:** M (8h)
- **Prioridad:** P0
- **Descripción:** Calcula certeza + determina PRESENTE/AUSENTE
- **Criterio:** Usa `CertaintyCalculator`, guarda en `attendance.results`
- **Contexto:** `attendance/application`

**PART2-T2.4.4:** Crear DTOs (`RegisterDTO`, `ValidateRoundDTO`, `ResultDTO`)

- **Estimación:** S (3h)
- **Prioridad:** P0
- **Descripción:** Clases DTO con validación class-validator
- **Criterio:** Validación de tipos + constraints
- **Contexto:** `attendance/application`

**PART2-T2.4.5:** Crear tests integración para use cases

- **Estimación:** M (8h)
- **Prioridad:** P1
- **Descripción:** Tests con mocks de repositorios
- **Criterio:** Coverage > 80%, flujo completo N rondas
- **Contexto:** `attendance/application`

---

#### User Story 2.5: Presentation Layer Attendance

**Como** API consumer
**Quiero** endpoints REST bien documentados
**Para** integrar con el frontend

##### Tareas

**PART2-T2.5.1:** Crear `AttendanceController.ts` con estructura base

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Clase controller con decoradores Fastify
- **Criterio:** Estructura vacía con 3 endpoints declarados
- **Contexto:** `attendance/presentation`

**PART2-T2.5.2:** Implementar `POST /attendance/register`

- **Estimación:** M (5h)
- **Prioridad:** P0
- **Descripción:** Endpoint que llama `RegisterUserUseCase`
- **Criterio:** Recibe userId+sessionId, retorna queue_position
- **Contexto:** `AttendanceController.ts`

**PART2-T2.5.3:** Implementar `POST /attendance/validate`

- **Estimación:** M (6h)
- **Prioridad:** P0
- **Descripción:** Endpoint que llama `ValidateRoundUseCase`
- **Criterio:** Recibe encrypted_response, retorna validation result
- **Contexto:** `AttendanceController.ts`

**PART2-T2.5.4:** Implementar `GET /attendance/result/:sessionId/:userId`

- **Estimación:** S (3h)
- **Prioridad:** P0
- **Descripción:** Endpoint que retorna resultado final
- **Criterio:** Retorna PRESENTE/AUSENTE + certainty_score
- **Contexto:** `AttendanceController.ts`

**PART2-T2.5.5:** Crear `attendance.routes.ts`

- **Estimación:** S (2h)
- **Prioridad:** P0
- **Descripción:** Registro de rutas en Fastify
- **Criterio:** Todas las rutas con middleware JWT
- **Contexto:** `attendance/presentation`

**PART2-T2.5.6:** Crear `types.ts` con Request/Response types

- **Estimación:** S (2h)
- **Prioridad:** P1
- **Descripción:** Tipos TypeScript para todos los endpoints
- **Criterio:** Tipos exportados y documentados
- **Contexto:** `attendance/presentation`

**PART2-T2.5.7:** Agregar error handling middleware

- **Estimación:** S (3h)
- **Prioridad:** P1
- **Descripción:** Captura errores y retorna JSON consistente
- **Criterio:** Errores HTTP 400, 401, 404, 500 manejados
- **Contexto:** `app.ts` (nivel raíz)

---

#### User Story 2.6: Testing E2E Attendance

**Como** QA
**Quiero** tests end-to-end automatizados
**Para** validar el flujo completo

##### Tareas

**PART2-T2.6.1:** Setup entorno testing E2E

- **Estimación:** S (4h)
- **Prioridad:** P1
- **Descripción:** Configurar Jest + supertest + testcontainers
- **Criterio:** Script `npm test:e2e` funciona
- **Contexto:** Raíz del node-service

**PART2-T2.6.2:** Test E2E: Flujo completo 3 rondas exitosas

- **Estimación:** M (6h)
- **Prioridad:** P1
- **Descripción:** Register → Validate R1 → R2 → R3 → Result PRESENTE
- **Criterio:** Test pasa, resultado es PRESENTE con >70% certeza
- **Contexto:** `__tests__/e2e`

**PART2-T2.6.3:** Test E2E: Flujo con rondas fallidas

- **Estimación:** S (4h)
- **Prioridad:** P1
- **Descripción:** Algunas rondas fallan → Result AUSENTE
- **Criterio:** Test pasa, resultado es AUSENTE
- **Contexto:** `__tests__/e2e`

**PART2-T2.6.4:** Test E2E: Usuario no enrolado

- **Estimación:** S (3h)
- **Prioridad:** P2
- **Descripción:** Intenta registrar sin enrollment → Error 403
- **Criterio:** Test pasa, retorna error apropiado
- **Contexto:** `__tests__/e2e`

---

#### User Story 2.7: Documentación Attendance

**Como** desarrollador nuevo
**Quiero** documentación clara del módulo
**Para** entender cómo funciona

##### Tareas

**PART2-T2.7.1:** Crear `README.md` en módulo attendance

- **Estimación:** S (3h)
- **Prioridad:** P2
- **Descripción:** Arquitectura, flujo, endpoints, ejemplos
- **Criterio:** Documentación completa con ejemplos curl
- **Contexto:** `node-service/src/modules/attendance`

**PART2-T2.7.2:** Documentar algoritmo `CertaintyCalculator`

- **Estimación:** S (2h)
- **Prioridad:** P2
- **Descripción:** Explicación matemática del cálculo
- **Criterio:** Fórmula + ejemplos numéricos
- **Contexto:** `README.md` del módulo attendance

**PART2-T2.7.3:** Crear diagrama de arquitectura del módulo

- **Estimación:** S (2h)
- **Prioridad:** P3
- **Descripción:** Diagrama Mermaid de capas
- **Criterio:** Diagrama claro de dependencias
- **Contexto:** `README.md` del módulo attendance

---

## Archivos a Crear

```bash
node-service/src/modules/attendance/
├── domain/
│   ├── entities/
│   │   ├── validation.entity.ts
│   │   ├── attendance-session.entity.ts
│   │   └── round.entity.ts
│   ├── value-objects/
│   │   ├── response-time.vo.ts
│   │   ├── certainty-score.vo.ts
│   │   └── qr-payload.vo.ts
│   └── services/
│       ├── certainty-calculator.service.ts
│       └── totp-validator.service.ts
├── application/
│   ├── usecases/
│   │   ├── register-user.usecase.ts
│   │   ├── validate-round.usecase.ts
│   │   └── calculate-final-result.usecase.ts
│   └── dtos/
│       ├── register.dto.ts
│       ├── validate-round.dto.ts
│       └── result.dto.ts
├── infrastructure/
│   ├── repositories/
│   │   ├── session.repository.ts
│   │   ├── registration.repository.ts
│   │   ├── validation.repository.ts
│   │   ├── result.repository.ts
│   │   └── qr-metadata.repository.ts
│   └── services/
│       ├── totp.service.ts
│       └── encryption.service.ts
├── presentation/
│   ├── attendance.controller.ts
│   ├── attendance.routes.ts
│   └── types.ts
└── __tests__/
    ├── unit/
    │   └── certainty-calculator.test.ts
    ├── integration/
    │   └── validate-round.test.ts
    └── e2e/
        └── full-flow.test.ts
```

---

## Criterios de Aceptación

Una tarea se considera **DONE** cuando:

1. Endpoint `POST /attendance/register` funcional
2. Endpoint `POST /attendance/validate` funcional con N rondas
3. Cálculo de certeza implementado (umbral 70%)
4. TOTP validación implementada (TOTPu y TOTPs)
5. Desencriptación QR con session_key funciona
6. Persistencia en PostgreSQL `attendance.*` operativa
7. Tests unitarios y E2E pasando (coverage >80%)
8. Documentación en `README.md` completa
9. Code review aprobado
10. Sin errores TypeScript/ESLint
11. Merged a branch principal

---

## Metodología y Herramientas

### Convenciones de Nomenclatura

**Formato tareas:** `PART{parte}-T{story}.{substory}.{tarea}`

**Ejemplo:** `PART2-T2.1.1` = Parte 2, User Story 2.1, Tarea 1

### Workflow por Tarea

1. Crear branch: `git checkout -b PART2-T2.1.1`
2. Implementar tarea
3. Ejecutar tests: `npm test`
4. Ejecutar lint: `npm run lint`
5. Commit: `git commit -m "PART2-T2.1.1: Crear estructura attendance/domain"`
6. Push y crear PR
7. Code review
8. Merge a main
9. Marcar tarea como DONE

### Herramientas Recomendadas

**Gestión:**
- Jira / Linear / GitHub Projects

**Desarrollo:**
- VSCode con extensiones TypeScript
- Postman / Insomnia (testing APIs)
- Jest (unit/integration testing)

**Testing:**
- Supertest (HTTP testing)
- Testcontainers (DB integration)

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

- [04-flujo-asistencia.md](documents/planificacion/04-flujo-asistencia.md) - Flujo completo N rondas
- [02-componentes-criptograficos.md](documents/planificacion/02-componentes-criptograficos.md) - TOTP, AES
- [05-esquema-base-datos.md](documents/planificacion/05-esquema-base-datos.md) - Schemas PostgreSQL

---

## Estado de Implementación

Ver [documents/planificacion/13-estado-implementacion.md](documents/planificacion/13-estado-implementacion.md) para el estado actualizado de este plan.

**Última actualización:** 2025-11-06

---

**Próximos pasos:** Ejecutar Sprint Planning PARTE 2
