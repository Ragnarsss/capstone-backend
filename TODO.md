# TODO - Sistema de Asistencia con QR Dinamico

> Ultima actualizacion: 2025-12-09

---

## Fases Completadas

### Fases 1-5: Fundamentos ✅
Estructura base, contenedores Podman, integracion PHP/Node.js, QR dinamicos AES-256-GCM, validacion basica.

### Fase 6: Arquitectura y Refactorizacion ✅
SessionService, Round-Aware System, Multi-Salon, Validation Pipeline (10 stages), 20 tests unitarios.

### Fase 7: Persistencia PostgreSQL ✅
SessionRepository, ValidationRepository, RegistrationRepository, ResultRepository, integracion con CompleteScanUseCase.

### Fase 8: QRs Falsos y Metricas de Fraude ✅
PoolBalancer con fakes, FraudMetricsRepository, dev endpoints, 15 tests de integracion.

### Fase 9: Enrollment FIDO2 + ECDH ✅
FIDO2Service, ECDHService, HkdfService, UseCases, Frontend UI, session_key, Frontend Guest (SoC), Politica 1:1 Enrollment.

### Fase 10: Refactoring Proyeccion QR (SoC) ✅
PayloadBuilder, PoolFeeder, PoolBalancer, QREmitter, QRProjectionService como orquestador, repos en shared/.

### Fase 11: Desacoplamiento SoC y Patrones de Dominio ✅
QRPayloadV1 en shared/types, validador centralizado, interfaces IQRGenerator/IPoolBalancer/IQRPayloadRepository, constantes centralizadas, entidad StudentSession, Pipeline Factory, eliminacion de codigo deprecado.

### Fase 13: Control de Logs por Entorno ✅
Logger centralizado (`shared/infrastructure/logger.ts`), logs debug/info solo en desarrollo, vite drop console en produccion, migracion de ~25 archivos backend a logger, test-fase13.sh.

---

## Fases Pendientes

> **Arquitectura:** Vertical Slicing + Clean Architecture (Ports & Adapters)
> **Referencia:** `documents/01-contexto/flujo_legacy.md`, `roseta.md`

---

## Fase 12: Simulador de Desarrollo PHP

**Objetivo:** Emular el sistema Hawaii para probar flujos sin servidor real
**Ubicacion:** `php-service/src/dev-simulator/` (NO va a produccion)
**Estimado:** 4.5 horas

---

### Fase 12.0: Estructura Base del Simulador
**Tiempo:** 30 min

- [ ] Crear `php-service/src/dev-simulator/`
- [ ] Crear `dev-simulator/index.php` (landing con links)
- [ ] Crear `dev-simulator/functions.php` (stubs de db.inc: `is_logged_in`, `get_usuario_actual`, etc.)
- [ ] Agregar ruta `/dev-simulator/` en Apache config
- [ ] Script: `test-fase12-0.sh`

### Fase 12.1: Datos Mock
**Tiempo:** 45 min

- [ ] Crear `dev-simulator/mock-data/usuarios.json` (profesores + alumnos con estructura legacy)
- [ ] Crear `dev-simulator/mock-data/cursos.json` (cursos + semestres + bloques)
- [ ] Crear `dev-simulator/mock-data/sesiones.json` (sesiones de asistencia activas)
- [ ] Crear `dev-simulator/MockDataProvider.php` (implementa interface, carga JSONs)
- [ ] Script: `test-fase12-1.sh`

### Fase 12.2: Login Simulado
**Tiempo:** 1 hora

- [ ] Crear `dev-simulator/login.php` con selector de usuario (dropdown)
- [ ] Implementar POST que guarda `$_SESSION['id']`, `['user']`, `['root']`
- [ ] Crear `dev-simulator/logout.php`
- [ ] Implementar stubs completos en `functions.php`
- [ ] Script: `test-fase12-2.sh`

### Fase 12.3: Dashboards por Rol
**Tiempo:** 1 hora

- [ ] Crear `dev-simulator/profesor-dashboard.php` (lista sesiones + crear nueva)
- [ ] Crear `dev-simulator/alumno-dashboard.php` (info alumno + boton escanear)
- [ ] Implementar "Crear Sesion" (mock, genera codigo tipo CVYAFO)
- [ ] Boton "Proyectar QR" abre `modal-host.php` con params
- [ ] Boton "Escanear QR" abre `modal-reader.php` con params
- [ ] Script: `test-fase12-3.sh`

### Fase 12.4: JWT y postMessage desde Modales
**Tiempo:** 1.5 horas

- [ ] Modificar `modal-host.php` para recibir params de sesion (GET/POST)
- [ ] Generar JWT con datos de profesor + sesion + curso
- [ ] Implementar JS: `postMessage({type: 'AUTH_TOKEN', token})` al cargar iframe
- [ ] Agregar `postMessage({type: 'SESSION_CONTEXT', modo, codigo, curso, tipoEncuesta...})`
- [ ] Modificar `modal-reader.php` para recibir datos de alumno
- [ ] Generar JWT con datos de alumno (RUT, nombre)
- [ ] Implementar postMessage con contexto de captura
- [ ] Script: `test-fase12-4.sh`

---

## Fase 14: Integracion Session Key Real

**Objetivo:** Conectar enrollment con attendance, eliminar MOCK_SESSION_KEY
**Estimado:** 4 horas

---

### Fase 14.1: Legacy Bridge en Frontend Node
**Tiempo:** 1.5 horas

- [ ] Crear `frontend/shared/services/legacy-bridge.service.ts`
- [ ] Implementar listener `AUTH_TOKEN` → almacenar JWT via AuthClient
- [ ] Implementar listener `SESSION_CONTEXT` → guardar en store
- [ ] Crear `frontend/shared/stores/legacy-context.store.ts`
- [ ] Integrar bridge en `qr-host/index.html`
- [ ] Integrar bridge en `qr-reader/index.html`
- [ ] Script: `test-fase14-1.sh`

### Fase 14.2: Verificacion Enrollment en qr-reader
**Tiempo:** 1 hora

- [ ] En `qr-reader/main.ts`, verificar enrollment antes de escaneo
- [ ] Si no enrolado → mostrar UI de enrollment inline
- [ ] Si enrolado pero sin session_key → trigger login ECDH
- [ ] Obtener session_key de SessionKeyStore
- [ ] Script: `test-fase14-2.sh`

### Fase 14.3: Eliminar MOCK_SESSION_KEY del Frontend
**Tiempo:** 45 min

- [ ] Modificar `qr-reader/main.ts` para NO usar MOCK_KEY por defecto
- [ ] Mantener fallback SOLO si `ENROLLMENT_STUB_MODE=true`
- [ ] Error claro si no hay session_key y no es stub mode
- [ ] Script: `test-fase14-3.sh`

### Fase 14.4: Session Key Real en Backend
**Tiempo:** 1 hora

- [ ] Modificar `decrypt.stage.ts` para obtener session_key de Valkey
- [ ] Lookup: `session:{userId}:key`
- [ ] Mantener fallback mock SOLO si `ENROLLMENT_STUB_MODE=true`
- [ ] Test flujo completo con session_key real
- [ ] Script: `test-fase14-4.sh`

---

## Fase 15: Puente PHP - Node (Produccion)

**Objetivo:** Comunicacion bidireccional para flujo completo
**Ubicacion:** `asistencia-node-integration/` (VA a produccion)
**Estimado:** 6 horas

---

### Fase 15.1: Endpoint Node para Notificar Asistencia
**Tiempo:** 1 hora

- [ ] Crear `backend/attendance/presentation/routes/internal.routes.ts`
- [ ] Implementar `POST /api/internal/mark-attendance`
- [ ] Schema: `{codigo, rut, ip, certainty, encuesta?}`
- [ ] Validar header `X-Node-Signature` con secret compartido
- [ ] Responder `{success, codigo, rut, timestamp}`
- [ ] Script: `test-fase15-1.sh`

### Fase 15.2: Controller PHP para Recibir Asistencia
**Tiempo:** 1.5 horas

- [ ] Crear `presentation/api/MarkAttendanceController.php`
- [ ] Agregar ruta `/api/mark-attendance` en Router.php
- [ ] Validar firma `X-Node-Signature`
- [ ] Preparar SQL template para `alumno_asistencia`
- [ ] Preparar SQL template para `comentarios_clase` segun tipo
- [ ] En dev-simulator: log + mock response
- [ ] Script: `test-fase15-2.sh`

### Fase 15.3: Encuesta Post-Validacion
**Tiempo:** 2 horas

- [ ] Recibir `tipo_encuesta` en SESSION_CONTEXT desde PHP
- [ ] Crear componente `SurveyForm.ts` con plantillas tipo 2-8
- [ ] Mostrar encuesta tras validacion exitosa de rounds
- [ ] Al enviar, incluir respuestas en mark-attendance
- [ ] Script: `test-fase15-3.sh`

### Fase 15.4: Notificacion al Parent (iframe)
**Tiempo:** 45 min

- [ ] Implementar `postMessage({type: 'ATTENDANCE_COMPLETE', ...})`
- [ ] Implementar `postMessage({type: 'CLOSE_IFRAME'})`
- [ ] En modales PHP, escuchar mensajes y cerrar
- [ ] Limpiar estado frontend tras completar
- [ ] Script: `test-fase15-4.sh`

### Fase 15.5: Limpieza y Documentacion
**Tiempo:** 30 min

- [ ] Eliminar `MOCK_SESSION_KEY` cuando no es stub mode
- [ ] Actualizar README de asistencia-node-integration
- [ ] Actualizar `13-estado-implementacion.md`
- [ ] Script: `test-fase15-5.sh` (integracion completa)

---

## Diagrama de Dependencias

```
Fase 12 (Simulador PHP - solo dev)
    │
    12.0 ─► 12.1 ─► 12.2 ─► 12.3 ─► 12.4
                                      │
                                      ▼
                              Fase 14 (Session Key Real)
                                      │
                              14.1 ─► 14.2 ─► 14.3 ─► 14.4
                                                        │
                                                        ▼
                                                Fase 15 (Puente Produccion)
                                                        │
                                                15.1 ─► 15.2 ─► 15.3 ─► 15.4 ─► 15.5
```

---

## Resumen de Tiempos

| Fase | Descripcion | Sub-fases | Tiempo |
|------|-------------|-----------|--------|
| 12 | Simulador PHP (dev) | 5 | ~4.5 h |
| 14 | Session Key Real | 4 | ~4 h |
| 15 | Puente Produccion | 5 | ~6 h |
| **Total** | | **14** | **~14.5 h** |

---

## Comandos de Desarrollo

```bash
# Verificar TypeScript
podman compose -f compose.yaml -f compose.dev.yaml exec node-service npx tsc --noEmit

# Ejecutar script de fase
bash scripts/test-faseN.sh

# Reconstruir contenedores
podman compose -f compose.yaml -f compose.dev.yaml up --build
```

---

## Referencias

- `daRulez.md` - Reglas del proyecto
- `PROJECT-CONSTITUTION.md` - Principios arquitectonicos
- `documents/01-contexto/flujo_legacy.md` - Flujo sistema Hawaii
- `roseta.md` - Roseta de integracion PHP-Node
- `documents/03-especificaciones-tecnicas/13-estado-implementacion.md` - Estado detallado
