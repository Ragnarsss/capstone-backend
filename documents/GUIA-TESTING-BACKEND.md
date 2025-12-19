# Guía de Testing para Backend Node.js

## Resumen

Esta guía explica la estrategia de testing para el backend del sistema de asistencia, usando **Vitest** como framework de testing.

---

## Stack de Testing

| Tecnología              | Propósito                                         |
| ----------------------- | ------------------------------------------------- |
| **Vitest**              | Framework de testing (alternativa moderna a Jest) |
| **@vitest/coverage-v8** | Cobertura de código                               |
| **vi** (de Vitest)      | Mocking y spies                                   |

---

## Estructura de Tests

Los tests se ubican en carpetas `__tests__/` dentro de cada módulo:

```
src/backend/
├── attendance/
│   ├── __tests__/
│   │   ├── stages.test.ts              ✅ (Implementado)
│   │   ├── totp-validation.stage.test.ts ✅ (Implementado)
│   │   └── complete-scan.usecase.test.ts (Pendiente)
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── auth/
│   ├── __tests__/
│   │   ├── auth.service.test.ts        (Pendiente)
│   │   ├── jwt-utils.test.ts           (Pendiente)
│   │   └── user-id.test.ts             (Pendiente)
│   ├── domain/
│   ├── application/
│   └── presentation/
├── session/
│   ├── __tests__/
│   │   └── session-key.service.test.ts (Pendiente)
│   └── ...
└── shared/
    └── __tests__/
        └── test-helpers.ts             (Helpers comunes)
```

---

## Comandos Disponibles

```bash
# Ejecutar todos los tests una vez
npm run test

# Ejecutar tests en modo watch (auto-rerun al guardar)
npm run test:watch

# Ejecutar con cobertura de código
npm run test:coverage
```

---

## Tipos de Tests

### 1. Tests Unitarios (Pure Domain Logic)

Testean funciones puras sin efectos secundarios. Son rápidos y fáciles de escribir.

**Ejemplos:**

- Stages síncronos del pipeline (validateStructureStage, validateOwnershipStage)
- Value Objects (UserId, SessionKey)
- Calculadoras (stats-calculator)
- Utilidades (jwt-utils)

**Características:**

- No necesitan mocks
- No interactúan con BD/Redis
- Input → Output predecible

**Ejemplo:**

```typescript
import { describe, it, expect } from "vitest";
import { validateStructureStage } from "../domain/validation-pipeline/stages";

describe("validateStructureStage", () => {
  it("debe pasar con estructura válida", () => {
    const ctx = createValidContext();
    const result = validateStructureStage.execute(ctx);
    expect(result).toBe(true);
  });

  it("debe fallar con versión incorrecta", () => {
    const ctx = createValidContext();
    ctx.response.original.v = 2; // Versión inválida
    const result = validateStructureStage.execute(ctx);
    expect(result).toBe(false);
    expect(ctx.error?.code).toBe("INVALID_FORMAT");
  });
});
```

---

### 2. Tests de Integración (con Mocks)

Testean componentes que interactúan con infraestructura (BD, Redis) usando **mocks**.

**Ejemplos:**

- Stages asíncronos (loadQrStateStage, loadStudentStateStage)
- Use cases (CompleteScanUseCase)
- Services que usan repositorios

**Características:**

- Usan `vi.fn()` para mockear repositorios
- Verifican interacciones con mocks
- Simulan respuestas de BD/Redis

**Ejemplo:**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createTOTPValidationStage } from "../domain/validation-pipeline/stages";

describe("TOTPValidationStage", () => {
  it("debe pasar con TOTP válido", async () => {
    // Mock del repositorio
    const mockSessionKeyRepo = {
      findByUserId: vi.fn().mockResolvedValue({
        sessionKey: Buffer.from("..."),
        userId: 42,
      }),
    };

    const stage = createTOTPValidationStage({
      sessionKeyQuery: mockSessionKeyRepo,
    });

    const ctx = createValidContext({ totpu: "123456" });
    const result = await stage.execute(ctx);

    expect(result).toBe(true);
    expect(mockSessionKeyRepo.findByUserId).toHaveBeenCalledWith(42);
  });
});
```

---

### 3. Tests E2E (End-to-End) - Opcional

Testean endpoints HTTP completos con servidor real.

**Nota:** No implementados aún. Requieren levantar Fastify en modo test.

---

## Estrategia de Mocking

### Mockear Repositorios

```typescript
const mockStudentRepo = {
  findById: vi.fn().mockResolvedValue({ id: 42, rut: "18687505-2" }),
  save: vi.fn().mockResolvedValue(undefined),
};
```

### Mockear Redis/Valkey

```typescript
const mockRedis = {
  get: vi.fn().mockResolvedValue('{"round": 1}'),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
};
```

### Mockear PostgreSQL

```typescript
const mockDb = {
  query: vi.fn().mockResolvedValue({
    rows: [{ id: 42, nombre: "Test" }],
    rowCount: 1,
  }),
};
```

---

## Helpers para Tests

Crea un archivo `src/backend/shared/__tests__/test-helpers.ts` con utilidades comunes:

```typescript
/**
 * Helpers comunes para tests
 */

import {
  type ValidationContext,
  createContext,
} from "@backend/attendance/domain/validation-pipeline/context";

/**
 * Crea un contexto válido con todos los datos necesarios
 */
export function createValidContext(
  overrides?: Partial<ValidationContext>
): ValidationContext {
  const ctx = createContext("encrypted-test", 42);

  ctx.response = {
    original: {
      v: 1,
      sid: "session-123",
      uid: 1,
      r: 1,
      ts: Date.now() - 1000,
      n: "a".repeat(32),
    },
    studentId: 42,
    receivedAt: Date.now(),
  };

  ctx.qrState = {
    exists: true,
    consumed: false,
  };

  ctx.studentState = {
    registered: true,
    status: "active",
    currentRound: 1,
    activeNonce: "a".repeat(32),
    roundsCompleted: [],
    currentAttempt: 1,
    maxAttempts: 3,
    maxRounds: 3,
  };

  return { ...ctx, ...overrides };
}

/**
 * Crea un JWT válido para tests
 */
export function createTestJWT(payload: any): string {
  // Implementación simple sin firma real
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${header}.${body}.fake-signature`;
}

/**
 * Crea una session key de prueba
 */
export function createTestSessionKey(): Buffer {
  return Buffer.from("0".repeat(64), "hex");
}
```

---

## Cobertura de Código

### Meta: 80% de cobertura

| Módulo                   | Cobertura Actual | Meta |
| ------------------------ | ---------------- | ---- |
| Auth                     | 0%               | 80%  |
| Attendance (Domain)      | 60%              | 90%  |
| Attendance (Application) | 0%               | 70%  |
| Session                  | 0%               | 80%  |
| Enrollment               | 0%               | 70%  |

### Revisar cobertura:

```bash
npm run test:coverage
# Abre: coverage/index.html
```

---

## Prioridades de Testing

### ✅ Implementado

1. Stages síncronos del pipeline (validateStructureStage, validateOwnershipStage, etc.)
2. Stage TOTP validation (con mocks)

### 🚧 Siguiente Fase

3. **Auth Module**

   - `jwt-utils.test.ts` (verificar/generar JWT)
   - `user-id.test.ts` (Value Object)
   - `auth.service.test.ts` (con mocks)

4. **Session Module**

   - `session-key.service.test.ts` (derivación ECDH)
   - `ecdh-key-exchange.test.ts`

5. **Attendance Use Cases**
   - `complete-scan.usecase.test.ts`
   - `validate-scan.usecase.test.ts`

---

## Buenas Prácticas

### 1. Nomenclatura de archivos

- Usa `*.test.ts` para que Vitest los detecte
- Coloca tests en carpeta `__tests__/` del módulo correspondiente

### 2. Estructura de tests

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('debe comportamiento esperado', () => {
      // Arrange
      const input = ...;

      // Act
      const result = component.method(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### 3. Tests descriptivos

- Usa "debe" en lugar de "debería" (más directo)
- Describe el comportamiento esperado claramente
- Agrupa tests relacionados con `describe`

### 4. Aislamiento

- Cada test debe ser independiente
- No compartas estado entre tests
- Usa `beforeEach` para setup común

### 5. Mocks limpios

- Crea factories para mocks reutilizables
- Verifica que los mocks fueron llamados correctamente
- Limpia mocks con `vi.clearAllMocks()` si es necesario

---

## Debugging Tests

### Ver output detallado:

```bash
npm run test -- --reporter=verbose
```

### Ejecutar un solo archivo:

```bash
npm run test -- stages.test.ts
```

### Ejecutar un solo test:

```typescript
it.only("debe pasar este test específico", () => {
  // ...
});
```

---

## Integración con CI/CD

### En pipeline de deployment:

```bash
# Verificar que los tests pasan
npm run test

# Verificar cobertura mínima
npm run test:coverage -- --coverage.thresholds.lines=80
```

---

## Recursos

- [Vitest Docs](https://vitest.dev/)
- [Mocking en Vitest](https://vitest.dev/guide/mocking.html)
- Tests existentes en `src/backend/attendance/__tests__/`

---

## Próximos Pasos

1. ✅ Crear guía de testing (este documento)
2. 🚧 Implementar tests para Auth module
3. 🚧 Implementar tests para Session module
4. 🚧 Implementar tests para Use Cases
5. 🚧 Alcanzar 80% de cobertura en Domain layer
6. 🚧 Alcanzar 70% de cobertura en Application layer
