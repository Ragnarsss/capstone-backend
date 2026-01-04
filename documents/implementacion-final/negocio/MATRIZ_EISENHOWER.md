# Matriz de Eisenhower - Sistema de Asistencia Hawaii

**Fecha de Creación:** 31 de diciembre de 2025  
**Última Actualización:** 4 de enero de 2026  
**Período:** 1-12 de enero de 2026

---

## Resumen Día 3 (2026-01-03)

**Estado:** DÍA 3 COMPLETADO - Backend staging funcional

**Logros:**

- Apache ProxyPass configurado (/api, /ws)
- Endpoint JWT simplificado (api_get_asistencia_token.php)
- Backend desplegado con tsx runtime (sin build)
- PostgreSQL + Valkey en contenedores
- Flujo E2E validado: PHP → JWT → Backend

**Bloqueadores resueltos:**

- TypeScript ESM module resolution (tsx + export type)
- Disk space (2.6GB liberados)
- Apache configuration (hawaii.conf simplificado)

**Pendiente Día 4:**

- Tests E2E Playwright
- Documentación API
- Healthcheck contenedor

---

## Cuadrante 1: URGENTE + IMPORTANTE (Hacer YA)

**Prioridad máxima - Bloquean el proyecto**

### Día 1: Separación Arquitectónica Backend/Frontend - COMPLETADO

- **Urgente:** Proyecto backend en Vite es arquitecturalmente incorrecto
- **Importante:** Bloquea despliegue independiente y escalabilidad
- **Impacto:** CRÍTICO - Debe completarse antes de cualquier otra tarea
- **Estado:** COMPLETADO (2026-01-01)
- **Entregables:**
  - COMPLETADO Crear estructura `backend/` y `frontend/` separadas
  - COMPLETADO Migrar código backend (módulos, shared, middleware)
  - COMPLETADO Migrar código frontend (features, shared, types)
  - COMPLETADO Actualizar Containerfiles independientes
  - COMPLETADO Actualizar compose.yaml con 3 servicios
  - COMPLETADO Validar funcionamiento post-refactor
  - COMPLETADO **BONUS:** Eliminar node-service/ duplicado (298 archivos)
  - COMPLETADO **BONUS:** CI/CD GitHub Actions implementado (7 jobs)
  - COMPLETADO **BONUS:** JWT Bridge Service con seguridad (rate limiting, CORS, logging)

### Día 3: Migración Endpoint JWT y Despliegue Staging - COMPLETADO

- **Urgente:** Endpoint legacy duplica lógica, backend sin desplegar
- **Importante:** Centralizar generación JWT y validar arquitectura staging
- **Impacto:** CRÍTICO - Bloquea validación E2E y requisitos funcionales
- **Estado:** COMPLETADO (2026-01-03, 8 horas)
- **Entregables:**
  - COMPLETADO Endpoint JWT simplificado (api_get_asistencia_token.php, 137 líneas)
  - COMPLETADO Apache ProxyPass configurado (/api → :3000, /ws → ws://3000)
  - COMPLETADO Backend desplegado con tsx runtime (TypeScript directo, sin build)
  - COMPLETADO PostgreSQL 18 + Valkey 7 en contenedores (puertos 15432, 16379)
  - COMPLETADO Flujo E2E validado (JWT generation → backend validation)
  - COMPLETADO Arquitectura documentada (arquitectura-staging.md con Mermaid)
- **Decisiones técnicas:**
  - Opción C: Script PHP simple (137L) vs jwt-bridge complejo (500+ archivos)
  - tsx runtime en producción (no tsc compilation)
  - 3 contenedores en vez de 5 (simplicidad operacional)
  - export type {} para interfaces TypeScript (ESM compatibility)
- **Bloqueadores resueltos:**
  - TypeScript ESM module resolution (tsx + export type)
  - Disk space (97% → 90%, 2.6GB liberados)
  - PostgreSQL credentials mismatch (asistencia_ucn)
  - Apache configuration (hawaii.conf simplificado 3449L → 50L)
- **Tiempo real:** 8h (vs 4.5h plan original)

### Día 1-2: Testing PHP - 115+ Tests (>80% cobertura) - PARCIAL

- **Urgente:** 0 tests implementados en módulo PHP crítico
- **Importante:** Sin tests, imposible validar integración JWT
- **Impacto:** ALTO - Requisito de calidad para producción
- **Estado:** EN PROGRESO - 25/115 tests implementados (21.7%)
- **Componentes:**
  - COMPLETADO JWT Bridge Config: 3 tests (default values, JWT_SECRET, CORS)
  - COMPLETADO JWT Bridge Generation: 11 tests (structure, claims, encoding, signature)
  - COMPLETADO CORS Handler: 4 tests (whitelist, blocking, preflight)
  - COMPLETADO Legacy Session Validator: 3 tests (K_USER, 401, extraction)
  - COMPLETADO Logger: 4 tests (debug, info, warning, error)
  - PENDIENTE JWT.php legacy: 10 tests adicionales (expiry, format, malformed)
  - PENDIENTE AuthenticationService: 20 tests (generación JWT profesor/alumno)
  - PENDIENTE LegacySessionAdapter: 10 tests (sesiones PHP, distinción roles)
  - PENDIENTE NodeServiceClient: 15 tests (mocks HTTP, headers, errores)
  - PENDIENTE Controladores API: 30 tests (UserData, CourseData, Enrollment)
  - PENDIENTE Router: 10 tests (mapeo rutas, CORS, 404)
  - PENDIENTE Tests integración: 15 tests

### Día 3: Migración Endpoint `api_get_asistencia_token.php`

- **Urgente:** Endpoint legacy duplica lógica y crea inconsistencias
- **Importante:** Centralizar generación JWT en un solo lugar
- **Impacto:** ALTO - Simplifica mantenimiento, evita bugs
- **Tareas:**
  - PENDIENTE Actualizar horario.php líneas ~890-910
  - PENDIENTE Cambiar URL a `/asistencia-node-integration/api/token`
  - PENDIENTE Verificar propiedades respuesta (success, token, expiresIn, userId, username)
  - PENDIENTE Deprecar archivo legacy con comentario
  - PENDIENTE Testing manual en ambos flujos (profesor/alumno)

### Día 6-7: Validación 7 Requisitos Funcionales - PENDIENTE

- **Urgente:** Son los objetivos contractuales del proyecto
- **Importante:** Sin validación formal, no se puede desplegar
- **Impacto:** CRÍTICO - Condición de aceptación
- **Estado:** EN ESPERA (bloqueado por tests E2E Día 4)
- **Prerequisito:** Backend staging funcional (completado Día 3)
- **Checklist:**
  - PENDIENTE Req 1: Sistema aislado (health checks, logs sin errores 500)
  - PENDIENTE Req 2: Opción estudiante (botón visible, modal funcional)
  - PENDIENTE Req 3: Opción profesor (botón visible, QR dinámico)
  - PENDIENTE Req 4: Registro exitoso (TOTP válido, inserción BD)
  - PENDIENTE Req 5: Encuestas (redirect, guardado en comentarios_clase)
  - PENDIENTE Req 6: Pantalla general (asist_lista.php muestra registros)
  - PENDIENTE Req 7: Duración QR (TTL configurable, expiracion validada)

---

## Cuadrante 2: NO URGENTE + IMPORTANTE (Planificar)

**Inversión a futuro - Previenen problemas**

### � CI/CD - GitHub Actions Workflow (COMPLETADO ANTICIPADO)

- **No urgente:** Tests se pueden correr manualmente temporalmente
- **Importante:** Automatización evita errores humanos y acelera desarrollo
- **Impacto:** MEDIO - Mejora velocidad y confianza
- **Estado:** COMPLETADO (2026-01-01 - Día 1 en vez de Día 3)
- **Decisión estratégica:** Implementado ANTES de refactor como safety net
- **Tareas:**
  - COMPLETADO Crear `.github/workflows/ci.yml` (270 líneas)
  - COMPLETADO Job test-php: PHP 7.4/8.0/8.1 (matriz de versiones)
  - COMPLETADO Job test-node: Node 20.x, npm, vitest (1333 tests)
  - COMPLETADO Job lint: ESLint + PHP CS Fixer
  - COMPLETADO Job build: Verificación compilación
  - COMPLETADO Job summary: Resumen agregado
  - COMPLETADO Coverage reports: Markdown + HTML artifacts
  - COMPLETADO Badge de estado en README
  - COMPLETADO **BONUS:** Codecov integration
  - COMPLETADO **BONUS:** Fixes emojis incompatibles
  - COMPLETADO **BONUS:** Parser jq para coverage legible

### Día 4: Tests E2E Automatizados con Playwright - EN CURSO (Día 4)

- **No urgente:** Tests manuales validaron funcionalidad básica Día 3
- **Importante:** Previenen regresiones en flujos críticos, documentan comportamiento esperado
- **Impacto:** MEDIO-ALTO - Seguridad a largo plazo
- **Estado:** REPRIORIZIADO a Día 4 (acelerado por progreso Día 3)
- **Prerequisito:** Backend staging funcional (completado Día 3)
- **Decisión framework:** Playwright (browser automation estándar)
- **Tests a implementar:**
  - PENDIENTE Setup Playwright en proyecto backend
  - PENDIENTE Test: Flujo profesor (main_curso.php → JWT → qr-host → WebSocket)
  - PENDIENTE Test: Flujo estudiante (horario.php → JWT → qr-reader → scan)
  - PENDIENTE Test: Validación TOTP y registro en BD
  - PENDIENTE Test: Error handling (JWT expirado, TOTP inválido)
  - PENDIENTE CI integration en GitHub Actions (job test-e2e)
- **Tiempo estimado:** 6-8 horas
- **Valor:** Documenta flujos esperados, detecta regresiones automáticamente

### Día 4-5: Definición Framework Testing E2E e Integración - DECIDIDO

- **No urgente:** Decisión técnica puede tomarse antes de implementación
- **Importante:** Afecta arquitectura de tests y mantenibilidad
- **Impacto:** MEDIO-ALTO - Decisión de largo plazo
- **Estado:** DECIDIDO (Playwright para E2E browser)
- **Opciones evaluadas:**
  - COMPLETADO **E2E Browser:** Playwright (seleccionado por debugging superior)
  - PENDIENTE **Integración HTTP:** Vitest + fetch (ya en uso para tests unitarios)
  - COMPLETADO **Estrategia dual:** Vitest (API) + Playwright (UI)
  - COMPLETADO Criterios: velocidad, debugging, CI/CD integration, curva aprendizaje
- **Justificación Playwright:**
  - Debugging con inspector visual
  - Trace viewer para CI failures
  - Auto-waiting (menos flaky tests)
  - Multi-browser support
- **Tiempo invertido:** Decisión tomada durante Día 3 (research inline)

### Día 5: Tests Integración HTTP - DIFERIDO

- **No urgente:** Decisión técnica puede tomarse antes de implementación
- **Importante:** Afecta arquitectura de tests y mantenibilidad
- **Impacto:** MEDIO-ALTO - Decisión de largo plazo
- **Opciones a evaluar:**
  - PENDIENTE **E2E Browser:** Playwright vs Cypress vs Puppeteer
  - PENDIENTE **Integración HTTP:** Vitest + fetch vs Supertest vs PHPUnit HTTP
  - PENDIENTE **Estrategia dual:** Vitest para HTTP + Playwright para UI
  - PENDIENTE Criterios: velocidad, debugging, CI/CD integration, curva aprendizaje
- **Decisión:** Documentar en ESTRATEGIA_AUTOMATIZACION_TESTS.md
- **Tiempo estimado:** 2-3 horas investigación + decisión

### Día 5: Tests E2E Automatizados (Framework TBD)

- **No urgente:** Tests manuales cubren funcionalidad inicialmente
- **Importante:** Previenen regresiones en flujos críticos
- **Impacto:** MEDIO-ALTO - Seguridad a largo plazo
- **Prerequisito:** Definir framework de testing (tarea anterior)
- **Tests a implementar:**
  - PENDIENTE Test JWT: Profesor obtiene token válido
  - PENDIENTE Test QR Host: Proyección dinámica cada 10s
  - PENDIENTE Test QR Reader: Escaneo y registro completo

### Día 5: Tests Integración HTTP para PHP Service

- **No urgente:** Tests unitarios PHPUnit cubren lógica crítica (58.28% coverage)
- **Importante:** Valida código no testeable con PHPUnit (header(), exit())
- **Impacto:** MEDIO - Aumenta cobertura PHP de 58.28% a ~75%
- **Contexto:** Código con header()/exit() no puede testearse con PHPUnit
- **Solución:** Tests de integración HTTP con Vitest contra servidor PHP real
- **Tests a implementar:**
  - PENDIENTE Test CORS headers con diferentes orígenes (allowed/blocked)
  - PENDIENTE Test OPTIONS preflight request handling
  - PENDIENTE Test rate limiting (429 después de límite)
  - PENDIENTE Test session validation flow completo
  - PENDIENTE Test respuestas 401/403/500 con headers correctos
- **Beneficio:** Valida flujo HTTP completo end-to-end sin mocks

### Día 8: Documentación de Despliegue

- **No urgente:** Despliegue es día 9, hay tiempo para preparar
- **Importante:** Documentación previene errores críticos en producción
- **Impacto:** ALTO - Reduce riesgo de despliegue
- **Documentos:**
  - PENDIENTE DEPLOYMENT.md: Procedimiento paso a paso
  - PENDIENTE PRE_DEPLOY_CHECKLIST.md: Validaciones previas
  - PENDIENTE Scripts: deploy.sh, rollback.sh, backup.sh
  - PENDIENTE Validación de secrets (JWT_SECRET sincronizado)

### Semana 2: Continuous Delivery Staging (Auto-deploy)

- **No urgente:** CI robusto es suficiente para Semana 1
- **Importante:** Automatiza deploys a staging, reduce errores manuales
- **Impacto:** MEDIO - Mejora eficiencia operacional
- **Prerequisitos:**
  - Tests E2E Playwright estables (Day 4)
  - Staging funcional 100% (Day 3 COMPLETADO)
  - Proceso de rollback definido
  - Monitoreo básico implementado
- **Implementación:**
  - PENDIENTE Workflow CD staging (.github/workflows/cd-staging.yml)
  - PENDIENTE Self-hosted runner en VM 104
  - PENDIENTE Health checks automatizados post-deploy
  - PENDIENTE Notificaciones de deploy (success/failure)
  - PENDIENTE Rollback automático si health checks fallan
- **Alcance:** Auto-deploy main → staging (deploy a producción sigue manual)
- **Decisión:** Continuous Delivery (manual approval para producción)
- **Tiempo estimado:** 4-6 horas implementación + validación

### Día 10: Optimizaciones de Performance

- **No urgente:** Performance actual es aceptable
- **Importante:** Mejora experiencia de usuario y escalabilidad
- **Impacto:** MEDIO - Mejora percepción de calidad
- **Optimizaciones:**
  - PENDIENTE Índices en `alumno_asistencia(rut, fecha, bloque)`
  - PENDIENTE Pool de conexiones PostgreSQL optimizado
  - PENDIENTE Compresión gzip en Apache
  - PENDIENTE Cache de consultas frecuentes en Valkey
  - PENDIENTE Lazy loading de módulos frontend

### Día 11: Logging y Monitoreo

- **No urgente:** Sistema funciona sin observabilidad avanzada
- **Importante:** Facilita debugging y detección de problemas
- **Impacto:** MEDIO - Mejora operabilidad
- **Implementaciones:**
  - PENDIENTE Winston logger en backend (levels: error, warn, info, debug)
  - PENDIENTE Structured logging con JSON
  - PENDIENTE Métricas básicas: response time, error rate
  - PENDIENTE Dashboard simple con logs en tiempo real

---

## Cuadrante 3: URGENTE + NO IMPORTANTE (Delegar/Minimizar)

**Aparentan urgencia pero bajo impacto real**

### ⚪ Día 4: Tests Manuales Exhaustivos

- **Urgente:** Se sienten necesarios para "estar seguros"
- **No importante:** Tests automatizados ya cubren casos críticos
- **Estrategia:** Limitar a checklist de 2 horas en lugar de día completo
- **Justificación:** Día 6-7 ya incluyen validación formal

### ⚪ Ajustes Estéticos de UI

- **Urgente:** "Se ve feo" genera presión de usuarios
- **No importante:** Funcionalidad es prioridad sobre estética
- **Estrategia:** Crear backlog para post-lanzamiento
- **Ejemplos:**
  - Animaciones de modal
  - Mensajes de error más "bonitos"
  - Iconos personalizados

### ⚪ Documentación de Código Inline Completa

- **Urgente:** "Buenas prácticas dicen que hay que documentar todo"
- **No importante:** Código TypeScript es auto-documentado en gran medida
- **Estrategia:** Documentar solo interfaces públicas y lógica compleja
- **Diferir:** Documentación exhaustiva a Sprint 3 (post-producción)

---

## Cuadrante 4: NO URGENTE + NO IMPORTANTE (Eliminar)

**Actividades que no aportan valor - EVITAR**

### Refactoring "Perfeccionista"

- **Riesgo:** Reescribir código funcional "porque podría ser mejor"
- **Impacto:** Introduce bugs, consume tiempo sin valor
- **Acción:** ELIMINAR - Solo refactorizar si bloquea funcionalidad

### Soporte de Navegadores Antiguos

- **Contexto:** IE11, Chrome <90
- **Justificación:** Universidad tiene equipos actualizados, no es requisito
- **Acción:** ELIMINAR - No agregar polyfills innecesarios

### Testing de Cobertura 100%

- **Riesgo:** Crear tests triviales para alcanzar 100%
- **Impacto:** Tests de bajo valor, mantenimiento costoso
- **Acción:** ELIMINAR - Meta es >80% PHP, >85% Node en código crítico

### Múltiples Estrategias de Autenticación

- **Idea:** OAuth, SAML, etc.
- **Justificación:** Sistema legacy usa sesiones PHP, es suficiente
- **Acción:** ELIMINAR - JWT actual cubre necesidades

### Internacionalización (i18n)

- **Contexto:** Sistema solo se usa en UCN Chile (español)
- **Justificación:** No hay requisito de múltiples idiomas
- **Acción:** ELIMINAR - No implementar i18n ahora

### Generación Automática de Reportes PDF Avanzados

- **Idea:** Gráficos, estadísticas detalladas
- **Justificación:** asist_lista.php ya proporciona datos suficientes
- **Acción:** ELIMINAR - Diferir a fase 2 si se solicita

---

## Resumen Ejecutivo por Día

| Día       | Cuadrante 1 (Hacer YA)                                 | Cuadrante 2 (Planificar)      | Tiempo Crítico | Tiempo Estratégico | Estado        |
| --------- | ------------------------------------------------------ | ----------------------------- | -------------- | ------------------ | ------------- |
| **1**     | Separación arquitectónica (7h) + Testing PHP base (3h) | CI/CD setup (4h) _anticipado_ | 10h            | 4h                 | 100%          |
| **2**     | Testing PHP avanzado (90 tests restantes) (8h)         | -                             | 8h             | 0h                 | Diferido      |
| **3**     | Migración endpoint (4.5h)                              | -                             | 4.5h           | 0h                 | 100% (8h)     |
| **4**     | -                                                      | Tests E2E Playwright (8h)     | 0h             | 8h                 | En curso      |
| **5**     | -                                                      | Tests integración HTTP (4h)   | 0h             | 4h                 | Diferido      |
| **6**     | Validación requisitos 1-4 (8h)                         | -                             | 8h             | 0h                 | Pendiente     |
| **7**     | Validación requisitos 5-7 (5.5h)                       | Ajustes (2.5h)                | 5.5h           | 2.5h               | Pendiente     |
| **8**     | -                                                      | Documentación despliegue (8h) | 0h             | 8h                 | Pendiente     |
| **9**     | Despliegue staging (8h)                                | -                             | 8h             | 0h                 | Anticipado    |
| **10**    | Tests staging (4h)                                     | Optimizaciones (4h)           | 4h             | 4h                 | Pendiente     |
| **11**    | -                                                      | Logging + monitoreo (8h)      | 0h             | 8h                 | Pendiente     |
| **12**    | Despliegue producción (8h)                             | -                             | 8h             | 0h                 | Pendiente     |
| **Total** | **54h (67.5%)**                                        | **30h (37.5%)**               | **54h**        | **30h**            | 33h/84h (39%) |

**Notas Día 1:**

- Completado: Separación arquitectónica + CI/CD + JWT Bridge Service + 25 tests
- CI/CD anticipado de Día 3 a Día 1 (decisión estratégica acertada)
- Tiempo real Día 1: 11h (vs 8h planeado) - justificado por extras valiosos
- Seguridad implementada: Rate limiting, CORS, session validation, logging

**Notas Día 3:**

- Completado: Endpoint JWT + Apache + Backend staging + Flujo E2E
- Despliegue staging ANTICIPADO de Día 9 a Día 3 (decisión pragmática acertada)
- Tiempo real Día 3: 8h (vs 4.5h planeado) - incluye 3h debugging TypeScript ESM
- Arquitectura simplificada: 3 contenedores (backend, postgres, valkey) vs 5 planeados
- 🔑 Decisiones clave:
  - tsx runtime > tsc compilation (simplicidad)
  - Endpoint PHP simple > jwt-bridge complejo (pragmatismo)
  - `export type {}` para interfaces ESM (corrección técnica)
- Impacto: Staging funcional 6 días antes, desbloquea tests E2E

**Progreso acumulado:** 33h/84h (39% completitud, 25% tiempo transcurrido - ADELANTADOS)

---

## Issues Abiertas (Actualización Post Día 3 - 2026-01-04)

### Issue #1: Testing PHP Incompleto (URGENTE + IMPORTANTE)

**Descripción:** Solo 25/115 tests PHP implementados (21.7% completitud)

**Componentes faltantes:**

- JWT.php legacy: 10 tests adicionales
- AuthenticationService: 20 tests
- LegacySessionAdapter: 10 tests
- NodeServiceClient: 15 tests
- Controladores API: 30 tests
- Router: 10 tests
- Tests integración: 15 tests

**Estado actual:** DIFERIDO (prioridad reducida)

**Justificación diferimiento:**

- Endpoint simplificado (api_get_asistencia_token.php) no usa jwt-bridge
- Tests jwt-bridge menos críticos ahora
- Foco en tests E2E (mayor ROI)

**Nuevo plan:**

- Día 4-5: Tests E2E Playwright (prioridad alta)
- Día 6-7: Revisar necesidad de tests PHP post-E2E
- Target ajustado: 60% cobertura PHP (vs 80% original)

**Impacto:** ALTO → MEDIO  
**Prioridad:** Día 2 → Día 6-7  
**Blocker:** No bloquea despliegue staging

---

### Issue #2: Frontend Tests Ausentes (NO URGENTE + IMPORTANTE)

**Descripción:** 0 tests implementados en componentes frontend críticos

**Componentes sin coverage:**

- enrollment/: Flujo inscripción estudiante
- qr-host/: Proyección QR profesor
- qr-reader/: Escaneo y validación QR
- shared/: Utilidades compartidas

**Estado:** DIFERIDO (post-E2E)

**Plan actualizado:**

- Tests E2E Playwright cubrirán flujos UI completos
- Tests unitarios Vitest solo para lógica compleja
- Target: 40% coverage frontend (vs 60% original)

**Impacto:** MEDIO  
**Prioridad:** Día 4-5 → Post-Sprint 1  
**Justificación:** E2E valida integración, mejor ROI que unit tests UI

---

### � Issue #3: Healthcheck Contenedor Backend - PENDIENTE

**Descripción:** Contenedor backend reporta "unhealthy" porque endpoint /health requiere JWT

**Solución propuesta (Día 4):**

```typescript
// Crear endpoint público /healthz (sin JWT)
app.get("/healthz", async () => {
  return { status: "ok", timestamp: Date.now() };
});
```

```dockerfile
# Containerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/healthz || exit 1
```

**Impacto:** BAJO - Contenedor funciona, solo status visual  
**Prioridad:** Día 4 (1 hora)

---

### Issue #4: Documentación API Formal - PENDIENTE

**Descripción:** Endpoints documentados solo en código, falta spec OpenAPI

**Plan (Día 4-5):**

- PENDIENTE Generar OpenAPI 3.0 spec
- PENDIENTE Documentar endpoints:
  - POST /api/auth/token (JWT generation)
  - GET /api/health (authenticated)
  - WS /ws/qr-projection (WebSocket)
  - POST /api/attendance/validate
- PENDIENTE Ejemplos request/response
- PENDIENTE Error codes (401, 403, 429, 500)
- PENDIENTE Postman collection

**Impacto:** MEDIO - Facilita integración y debugging  
**Prioridad:** Día 4-5 (2 horas)  
**Herramienta:** Swagger UI o Redoc

---

### Issue #5: Disk Space Monitoring - PENDIENTE

**Descripción:** Uso de disco al 90% requiere monitoreo y plan de expansión

**Acciones pendientes:**

1. **Evaluación PostgreSQL (Día 5):**

   - Mover data a volumen separado
   - Comprimir/archivar backups antiguos
   - Analizar uso de disco por tabla

2. **Expansión disco VM (Día 6):**

   - Aumentar de 28GB a 50GB mínimo
   - Particionar /var/lib/pgsql separado

3. **Automatización limpieza:**
   - Script cron semanal: `podman system prune`
   - Alertas si uso > 85%
   - Pre-build check en CI/CD

**Estado actual:**

```bash
$ df -h /
Filesystem  Size  Used Avail Use%
/dev/sda3    28G   25G  2.5G  90%
```

**Impacto:** MEDIO - Operacional pero requiere atención  
**Prioridad:** Día 5-6 (2-3 horas)  
**Blocker:** No bloquea desarrollo, puede bloquear builds futuros

---

## Issues Cerradas (Día 3)

**Nota:** Para detalles completos de resolución, ver [Bitácora Día 3](../bitacora/2026-01-03_dia3-sprint1.md) secciones "Bloqueadores y Resoluciones" e "Issues Resueltas".

1. **Bloqueador Apache/PHP JWT Bridge** - Resuelto con endpoint simplificado (8h)
2. **TypeScript ESM Module Resolution** - Resuelto con tsx + export type (3h)
3. **Disk Space Insufficiency** - Mitigado con cleanup (30min)
4. **PostgreSQL Credentials** - Corregido en .env (15min)
5. **Apache Proxy Configuration** - Simplificado hawaii.conf (30min)

---

**Total Issues:**

- Abiertas: 5 (1 media-alta, 4 media-baja prioridad)
- Cerradas Día 3: 5
- Tasa resolución: 50% issues bloqueantes resueltas en Día 3

**Estado proyecto:** ON TRACK para Sprint 1 (despliegue Día 9, anticipado a Día 3)

---

---

## Criterios de Decisión Rápida

**¿Esta tarea es realmente urgente?**

- ☑️ SÍ: Bloquea validación de requisitos o despliegue
- ☑️ SÍ: Hay 0 tests y el código va a producción
- ☑️ SÍ: Arquitectura actual causa errores o imposibilita deploy
- ☐ NO: "Sería bueno tener", "Algún día lo necesitaremos", "Por si acaso"

**¿Esta tarea es realmente importante?**

- ☑️ SÍ: Afecta alguno de los 7 requisitos funcionales
- ☑️ SÍ: Previene caídas de sistema o pérdida de datos
- ☑️ SÍ: Mejora significativamente la mantenibilidad a largo plazo
- ☐ NO: Solo mejora estética o conveniencia menor

**Regla de Oro:** Si una tarea no es ni urgente ni importante según estos criterios, **NO la hagas en este sprint**.

---

## Indicadores de Éxito

### Cuadrante 1 (Crítico)

- PENDIENTE 7/7 requisitos validados con evidencia (Día 6-7)
- COMPLETADO **25/115 tests PHP implementados** (21.7% - Día 1 completado)
  - COMPLETADO JWT Bridge: 25 tests, 50 assertions, 100% coverage componentes críticos
  - PENDIENTE Pendiente: 90 tests legacy PHP (Día 2)
- PENDIENTE Endpoint legacy migrado y deprecado (Día 3)
- PENDIENTE 0 errores 500 en logs de staging (Día 9-10)
- PENDIENTE Sistema funcionando en mantochrisal.cl (Día 12)

**Progreso Día 1:** 1/5 indicadores completados (20%)

### Cuadrante 2 (Estratégico)

- COMPLETADO **CI/CD pipeline ejecutándose (verde)** 7/7 jobs passing
  - COMPLETADO Test Node.js: 1333 tests passing
  - COMPLETADO Test PHP: 25 tests passing en 7.4/8.0/8.1
  - COMPLETADO Coverage reports: Markdown + HTML artifacts
  - COMPLETADO Lint: ESLint + PHP CS Fixer configured
  - COMPLETADO Build: Containerfiles validados
- PENDIENTE 3+ tests E2E automatizados con Playwright (Día 5)
- PENDIENTE DEPLOYMENT.md completo y validado (Día 8)
- PENDIENTE Performance: Response time <200ms p95 (Día 10)
- PENDIENTE Logging estructurado implementado (Día 11)

**Progreso Día 1:** 1/5 indicadores completados (20%)

### Cuadrantes 3 y 4 (Evitados)

- COMPLETADO **0 horas gastadas en refactoring no esencial** ✅
- COMPLETADO **0 horas en features no solicitadas** ✅
- COMPLETADO **0 tests triviales para alcanzar cobertura artificial** ✅
- COMPLETADO **Scope creep contenido a 0%** ✅

**Nota:** JWT Bridge Service fue agregado como respuesta a necesidad de seguridad identificada (no scope creep)

**Progreso Día 1:** 4/4 indicadores completados (100%)

---

### Progreso Global Sprint 1 (Post Día 1)

| Indicador                | Completado | Total | %     | Estado      |
| ------------------------ | ---------- | ----- | ----- | ----------- |
| **Tests PHP**            | 25         | 115   | 21.7% | En progreso |
| **Tests Node.js**        | 1333       | 1333  | 100%  | Completo    |
| **CI/CD Jobs**           | 7          | 7     | 100%  | Completo    |
| **Arquitectura**         | 4          | 4     | 100%  | Completo    |
| **Seguridad**            | 4          | 4     | 100%  | Completo    |
| **Tests E2E**            | 0          | 8     | 0%    | Pendiente   |
| **Documentación**        | 3          | 8     | 37.5% | En progreso |
| **Requisitos validados** | 0          | 7     | 0%    | Día 6-7     |
| **Deploy staging**       | 0          | 1     | 0%    | Día 9       |
| **Deploy producción**    | 0          | 1     | 0%    | Día 12      |

**Progreso total:** 14/84 horas completadas (16.7%)  
**Días completados:** 1/12 (8.3%)  
**Velocidad:** Adelante del plan (CI/CD anticipado de Día 3 a Día 1)

---

**Última Actualización:** 1 de enero de 2026 - 23:00 (Post Día 1)  
**Próxima Revisión:** 2 de enero de 2026 (Día 2 - Testing PHP avanzado)
