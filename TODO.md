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

### Fase 12: Simulador de Desarrollo PHP ✅
Dev Simulator completo (`php-service/src/dev-simulator/`), login mock, dashboards profesor/alumno, JWT real via `asistencia-node-integration`, postMessage para iframes, 106 tests. Accesible desde raiz (9500/9505) con `<base href>`.

### Fase 14: Integracion Session Key Real ✅
Legacy Bridge (postMessage PHP-Node), verificacion enrollment en qr-reader, eliminacion MOCK_SESSION_KEY en produccion (frontend), integracion SessionKeyRepository en PoolFeeder (generacion QR) y DecryptStage (validacion).

---

## Fases Pendientes

> **Arquitectura:** Vertical Slicing + Clean Architecture (Ports & Adapters)
> **Referencia:** `documents/01-contexto/flujo_legacy.md`, `roseta.md`

---

## Fase 14: Integracion Session Key Real

**Objetivo:** Conectar enrollment con attendance, eliminar MOCK_SESSION_KEY
**Estimado:** 5 horas

---

### Fase 14.1: Legacy Bridge en Frontend Node ✅
**Tiempo:** 1.5 horas

- [x] Crear `frontend/shared/services/legacy-bridge.service.ts`
- [x] Implementar listener `AUTH_TOKEN` → almacenar JWT via AuthClient
- [x] Implementar listener `SESSION_CONTEXT` → guardar en store
- [x] Crear `frontend/shared/stores/legacy-context.store.ts`
- [x] Integrar bridge en `qr-host/main.ts`
- [x] Integrar bridge en `qr-reader/main.ts`
- [x] Script: `test-fase14-1.sh`

### Fase 14.2: Verificacion Enrollment en qr-reader ✅
**Tiempo:** 1 hora

- [x] En `qr-reader/main.ts`, verificar enrollment antes de escaneo
- [x] Si no enrolado → mostrar UI de enrollment inline
- [x] Si enrolado pero sin session_key → trigger login ECDH
- [x] Obtener session_key de SessionKeyStore
- [x] Script: `test-fase14-2.sh`

### Fase 14.3: Eliminar MOCK_SESSION_KEY del Frontend
**Tiempo:** 45 min
**Estado:** EN PROGRESO

- [x] Modificar `aes-gcm.ts` para usar mock SOLO en desarrollo (import.meta.env.DEV)
- [x] Error claro si no hay session_key en produccion
- [x] Script: `test-fase14-3.sh`
- [x] Commit y merge

### Fase 14.4: Session Key Real en Backend (Generacion QR) ✅
**Tiempo:** 1.5 horas

- [x] Login ECDH debe almacenar session_key en Valkey: `session:{userId}:key`
- [x] PoolFeeder: obtener session_key del alumno desde Valkey al generar QR
- [x] Cifrar QR con session_key real del alumno (no MOCK)
- [x] Mantener fallback mock SOLO si no hay session_key (desarrollo)
- [x] Script: `test-fase14-4.sh`

### Fase 14.5: Session Key Real en Backend (Validacion) ✅
**Tiempo:** 1 hora

- [x] Modificar `decrypt.stage.ts` para obtener session_key de Valkey
- [x] Lookup: `session:{studentId}:key`
- [x] Mantener fallback mock SOLO si no hay session_key (desarrollo)
- [x] Overloads para retrocompatibilidad
- [x] Script: `test-fase14-5.sh`

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
