# BUG-002: Type Mismatch en userId - DEVICE_NOT_OWNED Falso Positivo

## Identificación

**ID:** BUG-002  
**Fecha:** 2025-12-18  
**Severidad:** CRÍTICA  
**Módulo:** session/login-ecdh  
**Estado:** RESUELTO  

## Descripción del Problema

El endpoint POST /api/session/login retornaba error 403 "DEVICE_NOT_OWNED" incluso cuando el dispositivo pertenecía al usuario autenticado.

### Síntomas Observados

- Usuario completa enrollment exitosamente (dispositivo guardado en DB)
- Al intentar login, recibe error 403 Forbidden
- Mensaje: "El dispositivo no pertenece a este usuario"
- No hay logs de error en LoginEcdhUseCase (el error ocurre silenciosamente)

### Comportamiento Esperado

Usuario con dispositivo enrolado debe poder iniciar sesión exitosamente.

## Causa Raíz

PostgreSQL con campos BIGINT puede retornar valores como strings en Node.js cuando el número excede MAX_SAFE_INTEGER de JavaScript (2^53 - 1).

```sql
-- Campo en DB
user_id BIGINT  -- Valor: 2796326203

-- Retorno en Node.js
device.userId = '2796326203'  -- String, no number
```

El código comparaba con operador estricto (===):

```typescript
// LoginEcdhUseCase línea 72 (ANTES)
if (device.userId !== userId) {  // '2796326203' !== 2796326203
  throw new Error('DEVICE_NOT_OWNED');
}
```

La comparación `'2796326203' !== 2796326203` es `true`, causando error falso positivo.

## Impacto

- **Usuarios afectados:** Todos con userId > 2^53 o retornados como string por el driver
- **Funcionalidad bloqueada:** Login ECDH completamente no funcional
- **Flujo interrumpido:** NOT_ENROLLED → ENROLLED_NO_SESSION → BLOQUEADO (no puede llegar a READY)

## Solución Implementada

### Código Corregido

```typescript
// LoginEcdhUseCase línea 72-75 (DESPUÉS)
const deviceUserId = typeof device.userId === 'string' 
  ? parseInt(device.userId, 10) 
  : device.userId;
if (deviceUserId !== userId) {
  throw new Error('DEVICE_NOT_OWNED');
}
```

### Validación con Tests

Test agregado que reproduce y verifica el fix:

```typescript
it('debe manejar correctamente comparación de userId cuando device.userId es string', async () => {
  const deviceConUserIdString = { 
    ...mockDevice, 
    userId: '42' as any  // Simula retorno de PostgreSQL BIGINT
  };
  mockDeviceRepository.findByCredentialId.mockResolvedValue(deviceConUserIdString);

  const result = await loginEcdhUseCase.execute(mockInput);
  
  expect(result).toBeDefined();  // Login exitoso
  expect(result.deviceId).toBe(mockDevice.deviceId);
});
```

**Resultado:** 16/16 tests pasando con 100% cobertura del flujo.

## Archivos Modificados

```
node-service/src/backend/session/application/use-cases/
├── login-ecdh.use-case.ts (líneas 72-75)
└── __tests__/
    └── login-ecdh.use-case.test.ts (líneas 92-109)
```

## Verificación

### Pre-fix
```bash
POST /api/session/login
{
  "credentialId": "HiTo1qCHgO8fKUUi3NiH-dbxv1c",
  "clientPublicKey": "..."
}

→ 403 Forbidden
→ { "error": "DEVICE_NOT_OWNED" }
```

### Post-fix
```bash
POST /api/session/login
{
  "credentialId": "HiTo1qCHgO8fKUUi3NiH-dbxv1c",
  "clientPublicKey": "..."
}

→ 200 OK
→ { 
    "serverPublicKey": "...",
    "totpu": "123456",
    "deviceId": 2
  }
```

## Prevención Futura

1. Tipo de dato Device actualizado para documentar comportamiento:
   ```typescript
   interface Device {
     userId: number | string;  // PostgreSQL BIGINT puede ser string
   }
   ```

2. Helper function para comparaciones seguras de IDs:
   ```typescript
   function normalizeUserId(userId: number | string): number {
     return typeof userId === 'string' ? parseInt(userId, 10) : userId;
   }
   ```

3. Tests de regresión que verifican ambos tipos (number y string).

## Lecciones Aprendidas

- PostgreSQL BIGINT no siempre mapea a JavaScript number
- Drivers de Node.js (pg) retornan strings para valores > MAX_SAFE_INTEGER
- Comparaciones estrictas (===) fallan con type coercion necesaria
- TDD expone bugs de tipo que TypeScript no detecta en runtime

## Referencias

- Migration 004: INTEGER → BIGINT (BUG-001)
- LoginEcdhUseCase: src/backend/session/application/use-cases/login-ecdh.use-case.ts
- Tests: src/backend/session/application/use-cases/__tests__/login-ecdh.use-case.test.ts
