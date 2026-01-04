# Bug Tracker

Registro de bugs críticos resueltos en el sistema de asistencia.

---

## BUG-001: Integer Overflow en user_id

**Fecha:** 2025-12-18  
**Severidad:** CRÍTICA  
**Estado:** RESUELTO

### Problema

Error 500 en módulos Enrollment y Access State cuando usuarios con IDs superiores a 2,147,483,647 intentan operar.

```
Error: value "2796326203" is out of range for type integer
PostgreSQL Code: 22003
```

### Causa

Campos `user_id` definidos como `INTEGER` en PostgreSQL (máximo: 2,147,483,647). Sistema legacy genera IDs que exceden este límite.

### Tablas Afectadas

| Tabla                         | Campo                 | Impacto            |
| ----------------------------- | --------------------- | ------------------ |
| enrollment.devices            | user_id               | Bloquea enrollment |
| enrollment.enrollment_history | user_id, performed_by | Auditoría          |
| attendance.sessions           | professor_id          | Afecta profesores  |
| attendance.registrations      | user_id               | Bloquea asistencia |

### Solución

Migration: `database/migrations/004-bigint-user-ids.sql`

```sql
ALTER TABLE enrollment.devices ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE enrollment.enrollment_history ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE enrollment.enrollment_history ALTER COLUMN performed_by TYPE BIGINT;
ALTER TABLE attendance.sessions ALTER COLUMN professor_id TYPE BIGINT;
ALTER TABLE attendance.registrations ALTER COLUMN user_id TYPE BIGINT;
```

Cambio de INTEGER (max: 2^31 - 1) a BIGINT (max: 2^63 - 1).

### Aplicación

```bash
# Ejecutar migration
podman exec -i asistencia-postgres psql -U asistencia -d asistencia_db \
  < database/migrations/004-bigint-user-ids.sql

# Verificar
podman exec -i asistencia-postgres psql -U asistencia -d asistencia_db \
  -c "SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE column_name IN ('user_id', 'professor_id', 'performed_by');"

# Reiniciar servicio
podman restart asistencia-node
```

### Validación

Usuario ID 2796326203 puede ahora acceder a endpoints sin error 500.

**Downtime:** 0 segundos

---

## BUG-002: Type Mismatch en userId

**Fecha:** 2025-12-18  
**Severidad:** CRÍTICA  
**Estado:** RESUELTO

### Problema

Endpoint POST /api/session/login retorna error 403 "DEVICE_NOT_OWNED" incluso cuando dispositivo pertenece al usuario autenticado.

```
Error 403 Forbidden: "El dispositivo no pertenece a este usuario"
```

Usuario completa enrollment exitosamente pero no puede hacer login.

### Causa

PostgreSQL con campos BIGINT retorna valores como strings en Node.js cuando número excede MAX_SAFE_INTEGER (2^53 - 1).

```typescript
// Campo en DB
user_id BIGINT  // Valor: 2796326203

// Retorno en Node.js
device.userId = '2796326203'  // String, no number

// Comparación falla
if (device.userId !== userId) {  // '2796326203' !== 2796326203 → true
  throw new Error('DEVICE_NOT_OWNED');  // Falso positivo
}
```

### Impacto

Usuarios con userId > 2^53 o retornados como string:

- Login ECDH completamente bloqueado
- Flujo interrumpido: NOT_ENROLLED → ENROLLED_NO_SESSION → BLOQUEADO

### Solución

Normalizar tipo antes de comparar:

```typescript
// node-service/src/backend/session/application/use-cases/login-ecdh.use-case.ts

const deviceUserId =
  typeof device.userId === "string"
    ? parseInt(device.userId, 10)
    : device.userId;

if (deviceUserId !== userId) {
  throw new Error("DEVICE_NOT_OWNED");
}
```

### Tests

Test agregado que verifica el fix:

```typescript
it("debe manejar userId cuando device.userId es string", async () => {
  const deviceConUserIdString = {
    ...mockDevice,
    userId: "42" as any, // Simula retorno PostgreSQL BIGINT
  };
  mockDeviceRepository.findByCredentialId.mockResolvedValue(
    deviceConUserIdString
  );

  const result = await loginEcdhUseCase.execute(mockInput);

  expect(result).toBeDefined();
  expect(result.deviceId).toBe(mockDevice.deviceId);
});
```

Resultado: 16/16 tests con 100% cobertura.

### Archivos Modificados

```
node-service/src/backend/session/application/use-cases/
├── login-ecdh.use-case.ts (líneas 72-75)
└── __tests__/login-ecdh.use-case.test.ts (líneas 92-109)
```

### Validación

Login funcional para todos los usuarios con dispositivos enrolados.

---

## Resumen

| Bug     | Descripción                  | Causa             | Solución           | Estado   |
| ------- | ---------------------------- | ----------------- | ------------------ | -------- |
| BUG-001 | Integer overflow en user_id  | INTEGER vs BIGINT | Migration a BIGINT | RESUELTO |
| BUG-002 | Type mismatch en comparación | String vs Number  | Normalizar tipo    | RESUELTO |

Ambos bugs resueltos sin downtime. Sistema operativo con soporte completo para IDs hasta 2^63 - 1.
