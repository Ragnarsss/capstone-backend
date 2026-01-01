# Matriz de Eisenhower - Sistema de Asistencia Hawaii

**Fecha de Creación:** 31 de diciembre de 2025  
**Período:** 1-12 de enero de 2025  
**Leyenda:** 🔴 Crítico | 🟡 Importante | 🟢 Completado

---

## Cuadrante 1: URGENTE + IMPORTANTE (Hacer YA)

**Prioridad máxima - Bloquean el proyecto**

### 🔴 Día 1: Separación Arquitectónica Backend/Frontend (7 horas)

- **Urgente:** Proyecto backend en Vite es arquitecturalmente incorrecto
- **Importante:** Bloquea despliegue independiente y escalabilidad
- **Impacto:** CRÍTICO - Debe completarse antes de cualquier otra tarea
- **Riesgos:** Fallos de build, confusion en CI/CD, deployments complejos
- **Entregables:**
  - [ ] Crear estructura `backend/` y `frontend/` separadas
  - [ ] Migrar código backend (módulos, shared, middleware)
  - [ ] Migrar código frontend (features, shared, types)
  - [ ] Actualizar Containerfiles independientes
  - [ ] Actualizar compose.yaml con 3 servicios
  - [ ] Validar funcionamiento post-refactor

### 🔴 Día 1-2: Testing PHP - 115+ Tests (>80% cobertura)

- **Urgente:** 0 tests implementados en módulo PHP crítico
- **Importante:** Sin tests, imposible validar integración JWT
- **Impacto:** ALTO - Requisito de calidad para producción
- **Componentes:**
  - [ ] JWT.php: 15 tests (encode, decode, expiry, signature)
  - [ ] AuthenticationService: 20 tests (generación JWT profesor/alumno)
  - [ ] LegacySessionAdapter: 10 tests (sesiones PHP, distinción roles)
  - [ ] NodeServiceClient: 15 tests (mocks HTTP, headers, errores)
  - [ ] Controladores API: 30 tests (UserData, CourseData, Enrollment)
  - [ ] Router: 10 tests (mapeo rutas, CORS, 404)
  - [ ] Tests integración: 15 tests

### 🔴 Día 3: Migración Endpoint `api_get_asistencia_token.php`

- **Urgente:** Endpoint legacy duplica lógica y crea inconsistencias
- **Importante:** Centralizar generación JWT en un solo lugar
- **Impacto:** ALTO - Simplifica mantenimiento, evita bugs
- **Tareas:**
  - [ ] Actualizar horario.php líneas ~890-910
  - [ ] Cambiar URL a `/asistencia-node-integration/api/token`
  - [ ] Verificar propiedades respuesta (success, token, expiresIn, userId, username)
  - [ ] Deprecar archivo legacy con comentario
  - [ ] Testing manual en ambos flujos (profesor/alumno)

### 🔴 Día 6-7: Validación 7 Requisitos Funcionales

- **Urgente:** Son los objetivos contractuales del proyecto
- **Importante:** Sin validación formal, no se puede desplegar
- **Impacto:** CRÍTICO - Condición de aceptación
- **Checklist:**
  - [ ] Req 1: Sistema aislado (health checks, logs sin errores 500)
  - [ ] Req 2: Opción estudiante (botón visible, modal funcional)
  - [ ] Req 3: Opción profesor (botón visible, QR dinámico)
  - [ ] Req 4: Registro exitoso (TOTP válido, inserción BD)
  - [ ] Req 5: Encuestas (redirect, guardado en comentarios_clase)
  - [ ] Req 6: Pantalla general (asist_lista.php muestra registros)
  - [ ] Req 7: Duración QR (TTL configurable, expiracion validada)

---

## Cuadrante 2: NO URGENTE + IMPORTANTE (Planificar)

**Inversión a futuro - Previenen problemas**

### 🟡 Día 3: CI/CD - GitHub Actions Workflow

- **No urgente:** Tests se pueden correr manualmente temporalmente
- **Importante:** Automatización evita errores humanos y acelera desarrollo
- **Impacto:** MEDIO - Mejora velocidad y confianza
- **Tareas:**
  - [ ] Crear `.github/workflows/test.yml`
  - [ ] Job test-php: PHP 7.4, composer, phpunit
  - [ ] Job test-node: Node 20, npm, vitest
  - [ ] Configurar linting: PHP CS Fixer + ESLint
  - [ ] Badge de estado en README

### 🟡 Día 5: Tests E2E Automatizados (Playwright)

- **No urgente:** Tests manuales cubren funcionalidad inicialmente
- **Importante:** Previenen regresiones en flujos críticos
- **Impacto:** MEDIO-ALTO - Seguridad a largo plazo
- **Tests:**
  - [ ] Test JWT: Profesor obtiene token válido
  - [ ] Test QR Host: Proyección dinámica cada 10s
  - [ ] Test QR Reader: Escaneo y registro completo

### 🟡 Día 8: Documentación de Despliegue

- **No urgente:** Despliegue es día 9, hay tiempo para preparar
- **Importante:** Documentación previene errores críticos en producción
- **Impacto:** ALTO - Reduce riesgo de despliegue
- **Documentos:**
  - [ ] DEPLOYMENT.md: Procedimiento paso a paso
  - [ ] PRE_DEPLOY_CHECKLIST.md: Validaciones previas
  - [ ] Scripts: deploy.sh, rollback.sh, backup.sh
  - [ ] Validación de secrets (JWT_SECRET sincronizado)

### 🟡 Día 10: Optimizaciones de Performance

- **No urgente:** Performance actual es aceptable
- **Importante:** Mejora experiencia de usuario y escalabilidad
- **Impacto:** MEDIO - Mejora percepción de calidad
- **Optimizaciones:**
  - [ ] Índices en `alumno_asistencia(rut, fecha, bloque)`
  - [ ] Pool de conexiones PostgreSQL optimizado
  - [ ] Compresión gzip en Apache
  - [ ] Cache de consultas frecuentes en Valkey
  - [ ] Lazy loading de módulos frontend

### 🟡 Día 11: Logging y Monitoreo

- **No urgente:** Sistema funciona sin observabilidad avanzada
- **Importante:** Facilita debugging y detección de problemas
- **Impacto:** MEDIO - Mejora operabilidad
- **Implementaciones:**
  - [ ] Winston logger en backend (levels: error, warn, info, debug)
  - [ ] Structured logging con JSON
  - [ ] Métricas básicas: response time, error rate
  - [ ] Dashboard simple con logs en tiempo real

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

### ❌ Refactoring "Perfeccionista"

- **Riesgo:** Reescribir código funcional "porque podría ser mejor"
- **Impacto:** Introduce bugs, consume tiempo sin valor
- **Acción:** ELIMINAR - Solo refactorizar si bloquea funcionalidad

### ❌ Soporte de Navegadores Antiguos

- **Contexto:** IE11, Chrome <90
- **Justificación:** Universidad tiene equipos actualizados, no es requisito
- **Acción:** ELIMINAR - No agregar polyfills innecesarios

### ❌ Testing de Cobertura 100%

- **Riesgo:** Crear tests triviales para alcanzar 100%
- **Impacto:** Tests de bajo valor, mantenimiento costoso
- **Acción:** ELIMINAR - Meta es >80% PHP, >85% Node en código crítico

### ❌ Múltiples Estrategias de Autenticación

- **Idea:** OAuth, SAML, etc.
- **Justificación:** Sistema legacy usa sesiones PHP, es suficiente
- **Acción:** ELIMINAR - JWT actual cubre necesidades

### ❌ Internacionalización (i18n)

- **Contexto:** Sistema solo se usa en UCN Chile (español)
- **Justificación:** No hay requisito de múltiples idiomas
- **Acción:** ELIMINAR - No implementar i18n ahora

### ❌ Generación Automática de Reportes PDF Avanzados

- **Idea:** Gráficos, estadísticas detalladas
- **Justificación:** asist_lista.php ya proporciona datos suficientes
- **Acción:** ELIMINAR - Diferir a fase 2 si se solicita

---

## Resumen Ejecutivo por Día

| Día       | Cuadrante 1 (Hacer YA)                                 | Cuadrante 2 (Planificar)      | Tiempo Crítico | Tiempo Estratégico |
| --------- | ------------------------------------------------------ | ----------------------------- | -------------- | ------------------ |
| **1**     | Separación arquitectónica (7h) + Testing PHP base (1h) | -                             | 8h             | 0h                 |
| **2**     | Testing PHP avanzado (8h)                              | -                             | 8h             | 0h                 |
| **3**     | Migración endpoint (4.5h)                              | CI/CD setup (3.5h)            | 4.5h           | 3.5h               |
| **4**     | -                                                      | Tests manuales reducidos (2h) | 0h             | 2h                 |
| **5**     | -                                                      | Tests E2E Playwright (8h)     | 0h             | 8h                 |
| **6**     | Validación requisitos 1-4 (8h)                         | -                             | 8h             | 0h                 |
| **7**     | Validación requisitos 5-7 (5.5h)                       | Ajustes (2.5h)                | 5.5h           | 2.5h               |
| **8**     | -                                                      | Documentación despliegue (8h) | 0h             | 8h                 |
| **9**     | Despliegue staging (8h)                                | -                             | 8h             | 0h                 |
| **10**    | Tests staging (4h)                                     | Optimizaciones (4h)           | 4h             | 4h                 |
| **11**    | -                                                      | Logging + monitoreo (8h)      | 0h             | 8h                 |
| **12**    | Despliegue producción (8h)                             | -                             | 8h             | 0h                 |
| **Total** | **54h (67.5%)**                                        | **26h (32.5%)**               | **54h**        | **26h**            |

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

- [ ] 7/7 requisitos validados con evidencia
- [ ] 115+ tests PHP implementados (>80% cobertura)
- [ ] Endpoint legacy migrado y deprecado
- [ ] 0 errores 500 en logs de staging
- [ ] Sistema funcionando en mantochrisal.cl

### Cuadrante 2 (Estratégico)

- [ ] CI/CD pipeline ejecutándose (verde)
- [ ] 3+ tests E2E automatizados con Playwright
- [ ] DEPLOYMENT.md completo y validado
- [ ] Performance: Response time <200ms (p95)
- [ ] Logging estructurado implementado

### Cuadrantes 3 y 4 (Evitados)

- [ ] 0 horas gastadas en refactoring no esencial
- [ ] 0 horas en features no solicitadas
- [ ] 0 tests triviales para alcanzar cobertura artificial
- [ ] Scope creep contenido a 0%

---

**Última Actualización:** 31 de diciembre de 2025  
**Próxima Revisión:** 1 de enero de 2025 (inicio Sprint 1)
