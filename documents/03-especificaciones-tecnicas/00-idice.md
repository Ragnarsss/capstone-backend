# Documentación Técnica - Sistema de Asistencia Criptográfica

**Última actualización:** 2025-11-03

## Propósito

Esta carpeta contiene la documentación técnica completa del Sistema de Asistencia mediante autenticación criptográfica multi-ronda.

---

## IMPORTANTE: Documentación Actualizada (2025-11-03)

El proyecto ha implementado la **arquitectura JWT recomendada** y la documentación ha sido actualizada para reflejar el estado real de la implementación.

### Documentos ACTUALIZADOS Recientemente

**Implementación Real (2025-11-03):**

- [OK] `10-guia-integracion-php-node.md` - Patrón JWT + WebSocket auth
- [OK] `planificacion/12-propuesta-separacion-roles.md` - Arquitectura real, entry points
- [OK] `planificacion/01-arquitectura-general.md` - Diagrama JWT + Apache
- [OK] `planificacion/07-decisiones-arquitectonicas.md` - DA-010, DA-012
- [OK] `planificacion/09-protocolo-websocket.md` - Seguridad WebSocket
- [OK] `planificacion/13-estado-implementacion.md` - **NUEVO** Estado completo

**Documentos Raíz:**

- [OK] `../ARQUITECTURA_JWT.md` - Documentación de implementación JWT
- [OK] `../INSTRUCCIONES_JWT.md` - Guía testing dev + prod

**Documentos de PLANIFICACIÓN original (`planificacion/`):**

- Describen el diseño conceptual del sistema
- **NOTA:** Algunos documentos están actualizados, otros reflejan diseño original
- Ver `13-estado-implementacion.md` para estado exacto de cada componente

### Resumen del Estado Actual

```text
Flujo Anfitrión:  ████████████████████████ 100% [OK] PRODUCCIÓN
Flujo Invitado:   ████░░░░░░░░░░░░░░░░░░░░  15% [FAIL] EN DESARROLLO

Sistema Completo: ████████░░░░░░░░░░░░░░░░  57%
```

**Arquitectura implementada:**

- [OK] JWT: PHP emite, Node valida (mínima invasividad)
- [OK] WebSocket seguro: Autenticación JWT en primer mensaje (Opción 5B)
- [OK] Proyección QR: Funcional para profesores (dev + prod)
- [WIP] Enrollment: Stubs backend (10%)
- [FAIL] Attendance: No implementado (0%)

---

## 📂 Estructura de Documentación

```bash
documents/
├── README.md                              ← Este archivo
├── 10-guia-integracion-php-node.md        ←  Guía JWT implementada
└── planificacion/                         ← Documentos de planificación
    ├── 01-arquitectura-general.md         ← [OK] ACTUALIZADO (2025-11-03)
    ├── 02-componentes-criptograficos.md
    ├── 03-flujo-enrolamiento.md
    ├── 04-flujo-asistencia.md
    ├── 05-esquema-base-datos.md
    ├── 06-diagramas-secuencia.md
    ├── 07-decisiones-arquitectonicas.md   ← [OK] ACTUALIZADO (2025-11-03)
    ├── 09-protocolo-websocket.md          ← [OK] ACTUALIZADO (2025-11-03)
    ├── 11-estrategia-testing.md
    ├── 12-propuesta-separacion-roles.md   ← [OK] ACTUALIZADO (2025-11-03)
    ├── 13-estado-implementacion.md        ← [OK] NUEVO (2025-11-03)
    └── recomendacion.md                   ← Documento original cambio JWT
```

---

## Documentos Disponibles

### Documentación de Implementación (Código Real)

#### 10. Guía de Integración PHP-Node  ACTUALIZADO (2025-11-03)

**Archivo:** `10-guia-integracion-php-node.md`

**Contenido:**

- [OK] **COMPLETAMENTE REESCRITO** con arquitectura JWT implementada
- Patrón JWT: PHP emite tokens, cliente habla directo con Node
- WebSocket con autenticación segura (Opción 5B)
- Comparación: patrón anterior vs actual
- Endpoints reales con código funcional
- Ejemplos de cliente JavaScript
- Referencias a archivos concretos implementados

**Para quién:** Desarrolladores full-stack, integradores de sistemas

---

### Documentación de Planificación (`planificacion/`)

#### 01. Arquitectura General  ACTUALIZADO (2025-11-03)

**Archivo:** `planificacion/01-arquitectura-general.md`

**Contenido:**

- Resumen ejecutivo del sistema
- **NUEVO:** Diagrama mermaid con capa JWT y Apache
- **NUEVO:** Sección completa de autenticación JWT
- Principio de N rondas de validación
- Arquitectura de monolito modular (vertical slicing)
- Stack tecnológico
- Flujo general (8 fases)
- Código de implementación JWT (PHP + Node)

**Para quién:** Arquitectos, líderes técnicos, stakeholders

---

#### 02. Componentes Criptográficos

**Archivo:** `planificacion/02-componentes-criptograficos.md`

**Contenido:**

- FIDO2/WebAuthn
- ECDH (Elliptic Curve Diffie-Hellman)
- HKDF (Key Derivation)
- TOTP Dual (TOTPu + TOTPs)
- AES-256-GCM
- Device-Bound Passkeys
- Attestation Certificates
- Integración de componentes

**Para quién:** Desarrolladores backend, especialistas en seguridad

---

#### 03. Flujo de Enrolamiento

**Archivo:** `planificacion/03-flujo-enrolamiento.md`

**Contenido:**

- Proceso completo de enrolamiento FIDO2
- Diagrama de secuencia detallado
- 7 pasos del proceso
- Validación servidor
- Derivación de secrets
- Manejo de errores
- Re-enrolamiento

**Para quién:** Desarrolladores frontend y backend

---

#### 04. Flujo de Asistencia

**Archivo:** `planificacion/04-flujo-asistencia.md`

**Contenido:**

- Proceso completo de N rondas de validación
- Diagrama de secuencia completo
- Anuncio de participación
- Generación de payloads QR
- Rotación aleatoria
- Captura y desencriptación (cliente)
- Validación (servidor)
- Cálculo de umbral de certeza
- Manejo de errores y reintentos

**Para quién:** Desarrolladores, QA engineers

---

#### 05. Esquema de Base de Datos

**Archivo:** `planificacion/05-esquema-base-datos.md`

**Contenido:**

- Visión general (2 schemas: enrollment, attendance)
- Tablas con definiciones SQL completas
- Índices y optimizaciones
- Vistas
- Funciones almacenadas
- Triggers
- Migraciones
- Queries útiles
- Backup y mantenimiento

**Para quién:** DBAs, desarrolladores backend

---

#### 06. Diagramas de Secuencia

**Archivo:** `planificacion/06-diagramas-secuencia.md`

**Contenido:**

- Enrolamiento completo (Mermaid)
- Login ECDH (Mermaid)
- Registro en sesión (Mermaid)
- Ciclo completo N rondas (Mermaid)
- Validación de ronda (Mermaid)
- Manejo de errores (Mermaid)
- Cálculo de umbral (Mermaid)
- Flujo completo simplificado (Mermaid)

**Para quién:** Todo el equipo técnico, visualización de flujos

---

#### 07. Decisiones Arquitectónicas  ACTUALIZADO (2025-11-03)

**Archivo:** `planificacion/07-decisiones-arquitectonicas.md`

**Contenido:**

- DA-001: Monolito Modular vs Microservicios
- DA-002: ECDH vs Derivación Directa
- DA-003: N Rondas de Validación
- DA-004: TOTP Dual
- DA-005: AES-256-GCM
- DA-006: Validación Estadística
- DA-007: Rotación Aleatoria 500ms
- DA-008: Valkey vs Redis
- DA-009: Frontend Separado
- **NUEVO DA-010:** Autenticación JWT en WebSocket (Opción 5B)
- DA-011: PostgreSQL Schemas
- **NUEVO DA-012:** Separación de Flujos por Entry Points
- Tabla de resumen con estados de implementación

Cada decisión incluye: alternativas, justificación, código, consecuencias, estado

**Para quién:** Arquitectos, líderes técnicos, auditores

---

#### 08. Plan de Implementación (LEGACY)

**Archivo:** `planificacion/08-plan-implementacion-LEGACY-12-16semanas.md`

**Contenido:**

- Roadmap completo (12-16 semanas) - **Planificación original**
- Fase 0: Infraestructura (1 semana)
- Fase 1: Módulo Enrolamiento (3 semanas)
- Fase 2: Módulo Asistencia MVP (4 semanas)
- Fase 3: Validación Estadística (2 semanas)
- Fase 4: Optimización y Producción (2-4 semanas)

**NOTA:** Plan de la versión original. Ver `13-estado-implementacion.md` para plan actual.

**Para quién:** Project managers, desarrolladores, stakeholders

---

#### 09. Protocolo WebSocket  ACTUALIZADO (2025-11-03)

**Archivo:** `planificacion/09-protocolo-websocket.md`

**Contenido:**

- Protocolo de comunicación WebSocket para proyección de QR
- **NUEVO:** Sección de seguridad con autenticación JWT
- **NUEVO:** Códigos de cierre personalizados (4401, 4403, 4408)
- **NUEVO:** Flujo de handshake con timeout
- Mensajes: AUTH, auth-ok, countdown, qr-update, error
- Manejo de conexiones y eventos
- Rotación de códigos QR en tiempo real

**Para quién:** Desarrolladores backend y frontend

---

#### 11. Estrategia de Testing

**Archivo:** `planificacion/11-estrategia-testing.md`

**Contenido:**

- Estrategias de testing para el sistema
- Unit tests, integration tests, E2E tests
- Testing de seguridad y criptografía

**Para quién:** QA engineers, desarrolladores

---

#### 12. Propuesta Separación de Roles  ACTUALIZADO (2025-11-03)

**Archivo:** `planificacion/12-propuesta-separacion-roles-anfitrion-invitado.md`

**Contenido:**

- **COMPLETAMENTE REESCRITO** con arquitectura real
- Separación por entry points (no detección de rol)
- Estado flujo Anfitrión: 100% funcional
- Estado flujo Invitado: 15% (stubs)
- Checklist de implementación completo
- Plan de sprints detallado
- Referencias cruzadas actualizadas

**Para quién:** Arquitectos, desarrolladores full-stack

---

#### 13. Estado de Implementación  NUEVO (2025-11-03)

**Archivo:** `planificacion/13-estado-implementacion.md`

**Contenido:**

- **DOCUMENTO VIVO** con estado actual del proyecto
- Resumen ejecutivo con % de completitud
- Estado detallado por módulo (backend + frontend)
- Estado de infraestructura (PostgreSQL, Valkey, Apache)
- Cobertura de código y métricas de calidad
- Deuda técnica e issues conocidos
- Plan de acción inmediato con sprints
- Matriz de compatibilidad (navegadores, ambientes)

**Para quién:** Todo el equipo, stakeholders, project managers

---

#### Recomendación Original

**Archivo:** `planificacion/recomendacion.md`

**Contenido:**

- Recomendación de la IA amiga sobre arquitectura JWT
- Análisis del problema con el patrón proxy
- Propuesta del patrón "Portero" (PHP emite JWT)
- Justificación técnica del cambio

**Para quién:** Arquitectos, desarrolladores que quieran entender el "por qué" del cambio

---

## Características de la Documentación

### Documentos de Planificación vs Implementación

**Documentos de PLANIFICACIÓN (`planificacion/`):**

- Se enfocan en diseño conceptual (QUÉ, POR QUÉ, CÓMO, DÓNDE)
- Describen arquitectura ideal del sistema
- **IMPORTANTE:** La integración PHP-Node se implementó diferente (ver docs JWT en raíz)

**Documentos de IMPLEMENTACIÓN (10 + raíz del proyecto):**

- Reflejan el código **REAL implementado**
- Incluyen ejemplos funcionales y ejecutables
- Referencias a archivos concretos del código
- Patrón JWT siguiendo recomendación oficial

### Diagramas en Mermaid

Todos los diagramas están en formato Mermaid para:

- Fácil edición
- Versionamiento en Git
- Renderizado automático en GitHub/GitLab

### Separation of Concerns (SoC)

Arquitectura basada en:

- **Monolito modular** con vertical slicing
- **Frontend separado** (PHP) de **Backend** (Node.js)
- **Módulos independientes** (Enrollment, Attendance, Shared)
- **Schemas de BD separados** (enrollment, attendance)

---

## Cómo Usar Esta Documentación

### Para Desarrolladores Nuevos (Orden Recomendado)

1. **Leer `../ARQUITECTURA_JWT.md`**  - **EMPEZAR AQUÍ** (arquitectura implementada)
2. Leer `10-guia-integracion-php-node.md` - Integración real PHP-Node con JWT
3. Leer `planificacion/01-arquitectura-general.md` - Visión completa del sistema
4. Leer `planificacion/02-componentes-criptograficos.md` - Fundamentos (FIDO2, ECDH, TOTP)
5. Revisar `planificacion/06-diagramas-secuencia.md` - Flujos visuales
6. Profundizar en `planificacion/03-flujo-enrolamiento.md` y `04-flujo-asistencia.md`

### Para Implementación (Desarrollo Activo)

1. **Seguir `../INSTRUCCIONES_JWT.md`**  - Guía paso a paso para comenzar
2. Consultar `10-guia-integracion-php-node.md` - Endpoints y ejemplos reales
3. Consultar `planificacion/05-esquema-base-datos.md` - Estructura BD
4. Revisar `planificacion/02-componentes-criptograficos.md` - Implementar FIDO2/ECDH
5. Ver código real en `php-service/src/` y `node-service/src/features/`

### Para Revisión Técnica / Arquitectos

1. Leer `planificacion/recomendacion.md` - Recomendación que guió la implementación
2. Leer `../ARQUITECTURA_JWT.md` - Arquitectura implementada vs planificada
3. Revisar `10-guia-integracion-php-node.md` - Integración real
4. Leer `planificacion/07-decisiones-arquitectonicas.md` - Justificaciones de diseño
5. Revisar `planificacion/01-arquitectura-general.md` - Diseño de alto nivel

---

## Estado de la Documentación

**Versión:** 3.0 (Reorganización + Arquitectura JWT Implementada)
**Fecha Actualización:** 2025-11-03
**Estado:** Especificación + Implementación Funcional

### Documentos Completados (Planificación Original)

- planificacion/01-arquitectura-general.md (27 KB) - Diseño conceptual
- planificacion/02-componentes-criptograficos.md (12 KB) - Fundamentos criptográficos
- planificacion/03-flujo-enrolamiento.md (11 KB) - Flujo FIDO2
- planificacion/04-flujo-asistencia.md (15 KB) - Flujo N rondas
- planificacion/05-esquema-base-datos.md (12 KB) - Estructura BD
- planificacion/06-diagramas-secuencia.md (13 KB) - Diagramas Mermaid
- planificacion/07-decisiones-arquitectonicas.md (13 KB) - ADRs
- planificacion/08-plan-implementacion-LEGACY.md (12 KB) - Plan original
- planificacion/09-protocolo-websocket.md (13 KB) - WebSocket spec
- planificacion/11-estrategia-testing.md (23 KB) - Testing
- planificacion/recomendacion.md (7 KB) - Recomendación original

**Total:** ~145 KB documentación planificación

### Documentos de Implementación (Código Real)

- [OK] 10-guia-integracion-php-node.md (50 KB) - **ACTUALIZADO** Patrón JWT
- [OK] ../ARQUITECTURA_JWT.md (25 KB) - Implementación completa
- [OK] ../INSTRUCCIONES_JWT.md (15 KB) - Guía paso a paso

**Total:** ~90 KB documentación implementación

**Gran Total:** ~235 KB documentación técnica completa

---

## Próximos Pasos

### Implementación

1. [OK] ~~Arquitectura JWT implementada y funcionando~~
2. [OK] ~~Integración postMessage JWT en modal~~
3. [ ] Implementar detección de rol (Anfitrión vs Invitado)
4. [ ] Implementar lógica real FIDO2 en enrollment-handler.ts
5. [ ] Implementar ECDH key exchange completo
6. [ ] Implementar WebSocket de enrollment interactivo
7. [ ] Conectar con PostgreSQL (schemas enrollment/attendance)
8. [ ] Implementar módulo de asistencia con N rondas
9. [ ] Testing de seguridad (JWT expiration, malformed tokens)
10. [ ] Generar clave secreta robusta para producción

### Documentación

1. [OK] ~~Actualizar guía integración PHP-Node~~
2. [OK] ~~Crear documentos de arquitectura JWT~~
3. [OK] ~~Reorganizar documentación en planificacion/~~
4. [ ] Crear documento de propuesta: Separación de flujos Anfitrión/Invitado
5. [ ] Actualizar diagramas de secuencia con flujo JWT y roles
6. [ ] Documentar decisión arquitectónica DA-011: Patrón JWT

---

## Mantenimiento de la Documentación

Esta documentación debe actualizarse cuando:

- Se tomen nuevas decisiones arquitectónicas
- Se modifique el esquema de base de datos
- Se agreguen nuevos módulos o features
- Se cambien flujos o procesos
- Se identifiquen errores o ambigüedades

**Responsable:** Equipo de desarrollo + Arquitecto técnico

---

## Contacto

Para preguntas sobre esta documentación, contactar al equipo técnico del proyecto.
