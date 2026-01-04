# Análisis Ejecutivo - Estado Actual y Plan Día 3

**Fecha:** 2026-01-03  
**Sprint:** Sprint 1 - Día 3 de 7  
**Estado General:** En progreso según plan

---

## Resumen de Situación

### Progreso Sprint 1 (40% completado)

**Día 1 (100%):**

- Separación arquitectónica backend/frontend
- CI/CD básico con GitHub Actions
- Tests: 1344 Node.js, 0 PHP

**Día 2 (100%):**

- Documentación arquitectura completa (575 líneas)
- Middleware JWT Node.js (11 tests)
- Tests PHP: 49 (58.28% coverage)

**Día 3 (0% - HOY):**

- Migración endpoint legacy (pendiente)
- Configuración proxy Apache (pendiente)
- Validación integración completa (pendiente)

---

## Diagnóstico de Brechas Críticas

### GAP #1: Endpoint JWT Duplicado (CRÍTICO)

**Situación actual:**

```
api_get_asistencia_token.php (raíz Hawaii)  ← USADO por horario.php y main_curso.php
         ↓
    Genera JWT
         ↓
    Sin tests unitarios
    Sin validación de expiración robusta
    Lógica duplicada

php-service (puerto 9001) ← JWT Bridge Service CORRECTO
         ↓
    Genera JWT con mismas claims
         ↓
    49 tests unitarios
    Arquitectura correcta
    NO USADO POR FRONTEND
```

**Impacto:**

- Frontend usa endpoint incorrecto
- Duplicación de lógica de seguridad
- Tests no validan código en producción
- Riesgo de divergencia en comportamiento

**Solución Día 3:**
Migrar horario.php y main_curso.php para usar `/asistencia-node-integration/` (proxiado a puerto 9001)

---

### GAP #2: Proxy Apache No Configurado (BLOQUEANTE)

**Problema:**
Frontend necesita acceder a 3 servicios diferentes:

1. JWT Bridge (puerto 9001)
2. Backend API (puerto 3000)
3. WebSocket proyección (puerto 3000)

**Situación actual:**

- Contenedores aislados en red Podman
- Sin proxy inverso configurado
- Frontend no puede alcanzar servicios desde browser

**Configuración requerida:**

```apache
/asistencia-node-integration/ → http://asistencia-php:9001
/asistencia/api/             → http://asistencia-node:3000/api
/asistencia/ws               → ws://asistencia-node:3000/ws
/asistencia/                 → http://asistencia-node:3000/asistencia
```

**Solución Día 3:**
Crear `asistencia-proxy.conf` en legacy-php con configuración mod_proxy

---

### GAP #3: Tests E2E Ausentes (IMPORTANTE, NO BLOQUEANTE)

**Estado:**

- 0 tests E2E implementados
- Plan original: 3 tests Playwright en Día 3
- Decisión usuario: Diferir a final del sprint

**Ajuste de plan:**

- Día 3: Migración endpoint + proxy (liberación)
- Día 4-5: Tests E2E cuando integración esté estable
- Framework: A definir (Playwright vs Cypress vs Vitest+fetch)

---

## Matriz de Priorización Día 3

### Tareas Críticas (Bloquean Requisitos 1-4, 7)

| Tarea                        | Duración | Dependencias | Bloquea Req   |
| ---------------------------- | -------- | ------------ | ------------- |
| Configurar proxy Apache      | 2h       | Ninguna      | 1, 2, 3, 4, 7 |
| Migrar horario.php           | 45min    | Proxy Apache | 2, 4          |
| Migrar main_curso.php        | 45min    | Proxy Apache | 3, 4, 7       |
| Validar integración completa | 2h       | Migraciones  | 1, 2, 3, 4    |

**Total crítico:** 5.5 horas (68% del día)

### Tareas Importantes (Mejoran calidad, no bloquean)

| Tarea                         | Duración | Prioridad |
| ----------------------------- | -------- | --------- |
| Actualizar CI/CD workflow     | 45min    | Media     |
| Deprecar endpoint legacy      | 15min    | Baja      |
| Documentar arquitectura proxy | 30min    | Media     |

**Total importante:** 1.5 horas (19% del día)

### Buffer para Troubleshooting

**Reservado:** 1 hora (13% del día)

---

## Riesgos y Mitigaciones

### Riesgo 1: Resolución DNS en Proxy Apache

**Probabilidad:** Media  
**Impacto:** Alto (bloquea toda la integración)

**Síntoma esperado:**

```
[proxy:error] DNS lookup failure for: asistencia-php
```

**Mitigación proactiva:**
Verificar compose.yaml tiene red compartida:

```yaml
services:
  asistencia-legacy-php:
    networks: [asistencia-network]
  asistencia-php:
    networks: [asistencia-network]
  asistencia-node:
    networks: [asistencia-network]
```

**Plan B:**
Usar IP interna de contenedor en lugar de hostname:

```bash
podman inspect asistencia-php | grep IPAddress
# Usar IP en ProxyPass
```

---

### Riesgo 2: CORS Bloqueando iframe

**Probabilidad:** Alta  
**Impacto:** Medio (afecta solo interfaz moderna)

**Síntoma esperado:**

```
Blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

**Mitigación:**

1. Agregar headers CORS en Apache proxy:

```apache
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
```

2. Configurar @fastify/cors en backend Node.js:

```typescript
fastify.register(cors, {
  origin: ["http://localhost:9500", "https://mantochrisal.cl"],
  credentials: true,
});
```

---

### Riesgo 3: Sesiones PHP No Persistentes

**Probabilidad:** Baja  
**Impacto:** Crítico (invalida autenticación legacy)

**Síntoma esperado:**
Login exitoso pero JWT Bridge retorna 401 (sesión no encontrada)

**Mitigación:**
Verificar volume de sesiones en compose.yaml:

```yaml
asistencia-legacy-php:
  volumes:
    - php-sessions:/var/lib/php/session
```

**Plan B:**
Configurar Redis como session handler de PHP

---

## Criterios de Éxito Día 3

### Funcionales

- [ ] Proxy Apache responde en `/asistencia-node-integration/`
- [ ] Proxy Apache responde en `/asistencia/api/health`
- [ ] horario.php genera JWT correctamente via nuevo endpoint
- [ ] main_curso.php abre modal con QR proyectado
- [ ] WebSocket conecta via proxy `/asistencia/ws`
- [ ] Health check pasa 5/5 servicios

### Técnicos

- [ ] Apache configtest exitoso
- [ ] 0 errores CORS en browser console
- [ ] 0 errores 500 en logs Apache
- [ ] Rebuild de contenedores exitoso
- [ ] CI/CD workflow actualizado y passing

### Documentación

- [ ] Bitácora Día 3 completada
- [ ] DEPLOYMENT.md actualizado con config proxy
- [ ] Commit descriptivo con cambios integrados

---

## Plan de Contingencia

### Si Proxy Apache falla completamente (> 3 horas troubleshooting)

**Opción 1: Nginx Gateway Temporal**

```yaml
# Agregar servicio nginx
asistencia-gateway:
  image: nginx:alpine
  volumes:
    - ./nginx-proxy.conf:/etc/nginx/nginx.conf
  ports:
    - "8080:80"
```

**Tiempo estimado:** 1.5 horas  
**Trade-off:** Agregar complejidad, pero desbloquea desarrollo

---

### Si Migraciones Frontend rompen funcionalidad legacy

**Rollback inmediato:**

```bash
git revert HEAD
git push origin testing
```

**Investigación offline:**
Validar localmente con docker-compose standalone antes de push

---

## Métricas de Seguimiento

### Velocidad

**Objetivo:** 5.5 horas tareas críticas  
**Medición:** Tiempo real por fase registrado en bitácora

### Calidad

**Objetivo:** 0 errores críticos en health check  
**Medición:** Script `./scripts/health-check.sh` debe pasar 5/5

### Cobertura

**Objetivo:** Mantener coverage PHP 58%+, Node 85%+  
**Medición:** CI/CD reporta coverage en cada commit

---

## Decisiones Estratégicas Día 3

### Decisión: Priorizar Migración sobre Tests E2E

**Justificación:**

- Endpoint duplicado es deuda técnica crítica
- Proxy Apache es prerequisito para cualquier test E2E
- Usuario prefiere tests al final (más estables)

**Impacto:**

- Tests E2E pospuestos a Día 4-5
- Validación manual suficiente para Día 3

---

### Decisión: Deprecar, No Eliminar Endpoint Legacy

**Justificación:**

- Riesgo bajo con rollback gradual
- Permite validación paralela durante 1 sprint
- Facilita debugging si hay discrepancias

**Implementación:**

```php
// api_get_asistencia_token.php
header('X-Deprecated: true');
header('X-Replacement: /asistencia-node-integration/');
error_log('[DEPRECATED] api_get_asistencia_token.php usado. Migrar a JWT Bridge.');
```

---

### Decisión: Usar Rutas Relativas en Frontend

**Justificación:**

- URLs absolutas (`https://mantochrisal.cl/...`) fallan en localhost
- Rutas relativas (`/asistencia/...`) funcionan en dev y prod
- Apache proxy maneja correctamente

**Implementación:**

```javascript
// ANTES:
var url = "https://mantochrisal.cl/asistencia/api/health";

// DESPUÉS:
var url = "/asistencia/api/health"; // Proxiado por Apache
```

---

## Comunicación con Equipo

### Bloqueadores a Reportar Inmediatamente

1. DNS resolution falla en Apache proxy (> 30 min intentos)
2. CORS persiste tras configurar headers (> 30 min intentos)
3. Sesiones PHP no persisten entre requests (> 15 min intentos)

### Actualizaciones de Progreso

**Horarios de sync:**

- 11:00: Fin Fase 2 (Proxy Apache configurado)
- 13:00: Fin Fase 3 (Migraciones frontend completas)
- 16:00: Fin Fase 4 (Validación integración)

**Medio:** Actualizar bitácora con estado de cada fase

---

## Referencias Técnicas

### Documentación Relevante

- [ARQUITECTURA.md](../tecnica/ARQUITECTURA.md) - Arquitectura de contenedores
- [DEPLOYMENT.md](../tecnica/deployment/DEPLOYMENT.md) - Guía de despliegue (actualizar hoy)
- [PLAN_IMPLEMENTACION_ENERO_2025.md](./PLAN_IMPLEMENTACION_ENERO_2025.md) - Plan maestro

### Recursos Externos

- [Apache mod_proxy](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html)
- [mod_proxy_wstunnel](https://httpd.apache.org/docs/2.4/mod/mod_proxy_wstunnel.html)
- [Podman Compose networking](https://docs.podman.io/en/latest/markdown/podman-compose.1.html)

---

## Conclusión

**Estado:** Preparados para Día 3  
**Confianza:** Alta (tareas bien definidas, riesgos identificados)  
**Bloqueadores previstos:** 2-3 (mitigaciones claras)

**Prioridad máxima:** Configurar proxy Apache y validar conectividad entre servicios.

Todo el equipo debe enfocarse en liberar la integración completa. Tests E2E son secundarios para hoy.
