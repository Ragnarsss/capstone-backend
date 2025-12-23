# Bug Report 001: Integer Overflow en Campos user_id

**Fecha:** 2025-12-18  
**Severidad:** CRÍTICA  
**Estado:** Identificado  
**Entorno:** Producción (mantochrisal.cl)

## Resumen

El sistema falla con error 500 en módulos de Enrollment y Access State cuando usuarios con IDs superiores a 2,147,483,647 intentan operar.

Causa: Campos `user_id` definidos como `INTEGER` en PostgreSQL (máximo: 2,147,483,647). El sistema legacy genera IDs que exceden este límite.

## Impacto

Usuario afectado: ID 2796326203 (username: 200255739)

Endpoints bloqueados:

- `GET /api/access/state` - Error 500
- `POST /api/enrollment/start` - Error 500
- Potencialmente: registro de asistencia y consultas de dispositivos

Error observado:

```
Error: value "2796326203" is out of range for type integer
PostgreSQL Code: 22003
```

## Análisis Técnico

Stack trace:

```
at DeviceRepository.findByUserId (device.repository.js:100)
at EnrollmentFlowOrchestrator.attemptAccess (enrollment-flow.orchestrator.js:68)
at AccessGatewayService.getState (access-gateway.service.js:54)
at AccessStateController.handle (access-state.controller.js:38)
```

Origen: `DeviceRepository.findByUserId()`
Query SQL: `SELECT * FROM enrollment.devices WHERE user_id = $1`
Parámetro: `$1 = 2796326203` (excede rango INTEGER)

### Tablas Afectadas

Archivo: `database/migrations/001-schema.sql`

Campos con `INTEGER` que deben ser `BIGINT`:

1. `enrollment.devices.user_id` (línea 47) - CRÍTICO: bloquea enrollment
2. `enrollment.enrollment_history.user_id` (línea 110) - auditoría
3. `enrollment.enrollment_history.performed_by` (línea 115) - auditoría
4. `attendance.sessions.professor_id` (línea 172) - ALTO: afecta profesores
5. `attendance.registrations.user_id` (línea 227) - CRÍTICO: bloquea asistencia

## Solución

Cambiar tipo de dato INTEGER a BIGINT:

| Tipo    | Rango Máximo              | Suficiente |
| ------- | ------------------------- | ---------- |
| INTEGER | 2,147,483,647             | No         |
| BIGINT  | 9,223,372,036,854,775,807 | Sí         |

Costo: +4 bytes por registro

### Migration Script

**Archivo nuevo:** `database/migrations/004-bigint-user-ids.sql`

````sql
-- ============================================================================
-- MIGRATION: 004-bigint-user-ids.sql
Archivo: `database/migrations/004-bigint-user-ids.sql`

```sql
-- Migration: 004-bigint-user-ids.sql
-- Date: 2025-12-18
-- Description: Cambiar user_id INTEGER a BIGINT
-- ----------------------------------------------------------------------------

ALTER TABLE enrollment.devices
  ALTER COLUMN user_id TYPE BIGINT;

ALTER TABLE enrollment.devices ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE enrollment.enrollment_history ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE enrollment.enrollment_history ALTER COLUMN performed_by TYPE BIGINT;
ALTER TABLE attendance.sessions ALTER COLUMN professor_id TYPE BIGINT;
ALTER TABLE attendance.registrations ALTER COLUMN user_id TYPE BIGINT;

**NO SE REQUIEREN CAMBIOS** en el código TypeScript porque:

1. TypeScript usa `number` para enteros, que internamente es un `float64` (puede representar enteros hasta 2^53-1 ≈ 9 cuatrillones)
2. PostgreSQL driver (node-postgres) maneja automáticamente BIGINT como `string` o `number` según el valor
3. Las interfaces actuales ya usan `number`:

```typescript
// ✅ COMPATIBLE - No requiere cambios
interface Device {
  user_id: number;  // Soporta BIGINT en PostgreSQL
}
````

---

## 📝 Plan de Acción

### Fase 1: Testing en Desarrollo ⏱️ 1 hora

1. ✅ Crear migration `004-bigint-user-ids.sql`
2. ✅ Aplicar migration en entorno de desarrollo
3. ✅ Ejecutar tests unitarios y de integración
4. ✅ Verificar que queries funcionan correctamente

### Fase 2: Aplicación en Producción ⏱️ 30 minutos

**Ventana de mantenimiento:** NO REQUERIDA  
**Impacto:** Cero downtime (ALTER COLUMN en PostgreSQL es rápido para tablas pequeñas)

```bash
# 1. Conectar a PostgreSQL en producción
podman exec -it asistencia-postgres psql -U asistencia -d asistencia_db

# 2. Ejecutar migration
\i /docker-entrypoint-initdb.d/migrations/004-bigint-user-ids.sql

# 3. Verificar cambios
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema IN ('enrollment', 'attendance')
  AND column_name IN ('user_id', 'professor_id', 'performed_by');

# 4. Reiniciar servicio Node.js para limpiar pool de conexiones
podman restart asistencia-node
```

### Fase 3: Validación ⏱️ 15 minutos

1. ✅ Probar endpoint `GET /api/access/state` con userId 2796326203
2. ✅ Probar endpoint `POST /api/enrollment/start` con userId 2796326203
3. ✅ Verificar que no hay errores en logs
4. ✅ Confirmar con usuario de prueba que puede enrolar dispositivo

Nota: No se requieren cambios en código TypeScript. El tipo `number` es compatible con BIGINT de PostgreSQL.

## Implementación

````

---

## 📈 Métricas de Éxito

- ✅ **Error rate = 0%** para usuarios con userId > 2.14B
- ✅ **Response time < 200ms** (sin degradación)
- ✅ **Enrollment success rate = 100%** para todos los usuarios
- ✅ **Zero downtime** durante aplicación de migration

---

## 🚨 Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Migration falla | Baja | Alto | Ejecutar en transacción (BEGIN/COMMIT) |
| Downtime prolongado | Muy baja | Medio | ALTER COLUMN es rápido en PostgreSQL |
| Datos corruptos | Muy baja | Crítico | Backup de DB antes de migration |
| Inconsistencia de tipos | Muy baja | Medio | Verificar schema después de migration |

---

## 📎 Referencias

### Documentación PostgreSQL
- [Numeric Types](https://www.postgresql.org/docs/18/datatype-numeric.html)
- [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)

Pasos en producción:

```bash
# Aplicar migration
podman exec -it asistencia-postgres psql -U asistencia -d asistencia_db \
  -f /docker-entrypoint-initdb.d/migrations/004-bigint-user-ids.sql

# Reiniciar servicio
podman restart asistencia-node
````

## Validación

Probar con usuario ID 2796326203:

- `GET /api/access/state?deviceFingerprint=xxx`
- `POST /api/enrollment/start`

Ambos deben retornar 200 OK.
