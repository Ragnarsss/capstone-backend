# Estrategia de Testing - Objetivo 60% Coverage

**Estado Actual:** 49.43% coverage  
**Objetivo:** 60.00% coverage  
**Gap:** +10.57 puntos porcentuales  
**Tests Actuales:** 769 passing, 2 skipped, 0 failing  
**Test Files:** 50  
**Fecha:** Diciembre 2025

---

## 📊 Executive Summary

Para alcanzar el objetivo de 60% de coverage, necesitamos:

- **Incremento requerido:** +10.57 puntos porcentuales
- **Tests estimados:** 170-200 tests adicionales
- **Tiempo estimado:** 7-10 días de trabajo
- **Estrategia:** Priorizar archivos por ROI (Return On Investment)

---

## 🎯 Estrategia por Tiers (ROI)

### **Tier 1: Quick Wins** 🟢

**ROI: ★★★★★** - Alto impacto, bajo esfuerzo  
**Tiempo:** 1-2 días  
**Coverage esperado:** +2-3pp  
**Tests:** 40-50

#### Archivos Objetivo

##### Domain Services

```
└─ src/backend/attendance/domain/services/
   ├─ penalty.calculator.ts         # Lógica de cálculo de penalties
   ├─ window.service.ts             # Validaciones de ventana temporal
   └─ round.manager.ts              # Gestión de rondas de QR
```

##### Value Objects

```
└─ src/backend/attendance/domain/value-objects/
   ├─ qr-payload.value-object.ts          # Serialización/validación
   ├─ attendance-window.value-object.ts   # Ventanas temporales
   └─ penalty-config.value-object.ts      # Configuración penalties
```

##### Entities

```
└─ src/backend/session/domain/entities/
   └─ session-config.entity.ts      # Configuración de sesión
```

#### Patrón de Testing

```typescript
// ✅ Tests puros sin mocks
describe("PenaltyCalculator", () => {
  describe("calculate()", () => {
    it("debe calcular penalty base correctamente", () => {
      const calculator = new PenaltyCalculator({ basePoints: 10 });
      const result = calculator.calculate(5); // 5 minutos tarde
      expect(result.points).toBe(10);
    });

    it("debe escalar penalty según delay", () => {
      const calculator = new PenaltyCalculator({
        basePoints: 10,
        scaleFactor: 2,
      });
      const result = calculator.calculate(10);
      expect(result.points).toBe(20);
    });

    it("debe tener penalty máximo", () => {
      const calculator = new PenaltyCalculator({
        basePoints: 10,
        maxPoints: 50,
      });
      const result = calculator.calculate(1000);
      expect(result.points).toBe(50);
    });
  });
});
```

#### Ventajas

- ✅ No requieren mocks complejos
- ✅ Tests rápidos de escribir
- ✅ Alta cobertura por test (funciones puras)
- ✅ Build confidence rápido

---

### **Tier 2: Repositorios Valkey** 🟡

**ROI: ★★★★☆** - Muy alto impacto, esfuerzo medio  
**Tiempo:** 2-3 días  
**Coverage esperado:** +4-5pp  
**Tests:** 60-80

#### Archivos Objetivo (Por Prioridad)

##### 1. qr-payload.repository.ts ⭐ **MÁXIMA PRIORIDAD**

```
📁 src/backend/shared/infrastructure/valkey/qr-payload.repository.ts
📏 206 líneas
💪 Impacto: ~1-1.5pp
🧪 Tests: 15-20
```

**Métodos a testear:**

- `save(payload: QRPayloadV1): Promise<void>`
- `get(sessionId: string, round: number): Promise<QRPayloadV1 | null>`
- `delete(sessionId: string, round: number): Promise<void>`
- `getAllForSession(sessionId: string): Promise<QRPayloadV1[]>`
- `setExpiration(sessionId: string, round: number, ttl: number)`

##### 2. session.valkey-repository.ts

```
📁 src/backend/session/infrastructure/valkey/
📏 ~150 líneas
💪 Impacto: ~0.8-1pp
🧪 Tests: 12-15
```

##### 3. validation-cache.repository.ts

```
📁 src/backend/attendance/infrastructure/valkey/
📏 ~120 líneas
💪 Impacto: ~0.5-0.8pp
🧪 Tests: 10-12
```

#### Patrón Establecido (Ya Probado)

```typescript
// ✅ Basado en fraud-metrics.repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ValkeyClient } from "@/shared/infrastructure/valkey/valkey-client";

describe("QRPayloadRepository", () => {
  let repository: QRPayloadRepository;
  let mockValkeyClient: ValkeyClient;

  beforeEach(() => {
    mockValkeyClient = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      expire: vi.fn(),
      keys: vi.fn(),
      mget: vi.fn(),
    } as unknown as ValkeyClient;

    repository = new QRPayloadRepository(mockValkeyClient);
  });

  describe("save()", () => {
    it("debe guardar payload con key correcta", async () => {
      const payload = { s: "session-1", r: 1, n: "a".repeat(32) };

      await repository.save(payload);

      expect(mockValkeyClient.set).toHaveBeenCalledWith(
        "qr:session-1:1",
        JSON.stringify(payload),
        expect.any(Number) // TTL
      );
    });

    it("debe manejar error de Valkey", async () => {
      mockValkeyClient.set = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      await expect(repository.save(payload)).rejects.toThrow(
        "Connection failed"
      );
    });
  });

  describe("get()", () => {
    it("debe retornar payload parseado", async () => {
      const payload = { s: "session-1", r: 1, n: "a".repeat(32) };
      mockValkeyClient.get = vi.fn().mockResolvedValue(JSON.stringify(payload));

      const result = await repository.get("session-1", 1);

      expect(result).toEqual(payload);
      expect(mockValkeyClient.get).toHaveBeenCalledWith("qr:session-1:1");
    });

    it("debe retornar null si no existe", async () => {
      mockValkeyClient.get = vi.fn().mockResolvedValue(null);

      const result = await repository.get("session-1", 1);

      expect(result).toBeNull();
    });

    it("debe manejar JSON inválido", async () => {
      mockValkeyClient.get = vi.fn().mockResolvedValue("invalid-json");

      await expect(repository.get("session-1", 1)).rejects.toThrow();
    });
  });
});
```

#### Escenarios Clave a Testear

1. **CRUD Básico**

   - Create/Save con diferentes payloads
   - Read con key existente/inexistente
   - Update de payloads existentes
   - Delete con verificación

2. **TTL y Expiración**

   - Set con TTL correcto
   - Get después de expiración (mock)
   - Renovación de TTL

3. **Manejo de JSON**

   - Serialización correcta
   - Parsing de JSON válido
   - Error en JSON inválido

4. **Keys Patterns**

   - Formato de keys correcto
   - getAllForSession con múltiples rounds
   - Cleanup por patrón

5. **Errores de Valkey**
   - Connection timeout
   - Network error
   - Memory full

#### Ventajas

- ✅ Patrón ya establecido y probado
- ✅ Alto impacto por línea testeada
- ✅ No requiere mocks complejos (solo ValkeyClient)
- ✅ Tests independientes (no state compartido)

---

### **Tier 3: Repositorios PostgreSQL** 🟠

**ROI: ★★★☆☆** - Alto impacto, alto esfuerzo  
**Tiempo:** 4-5 días  
**Coverage esperado:** +4-5pp  
**Tests:** 80-100

#### Archivos Objetivo (Por Prioridad)

##### 1. session.repository.ts ⭐

```
📁 src/backend/session/infrastructure/postgres/session.repository.ts
📏 261 líneas - ARCHIVO MÁS GRANDE SIN TESTS
💪 Impacto: ~1.5-2pp
🧪 Tests: 25-30
```

##### 2. validation.repository.ts

```
📁 src/backend/attendance/infrastructure/postgres/validation.repository.ts
📏 258 líneas
💪 Impacto: ~1.5pp
🧪 Tests: 20-25
```

##### 3. registration.repository.ts

```
📁 src/backend/attendance/infrastructure/postgres/registration.repository.ts
📏 230 líneas
💪 Impacto: ~1.2pp
🧪 Tests: 18-22
```

##### 4. result.repository.ts

```
📁 src/backend/attendance/infrastructure/postgres/result.repository.ts
📏 229 líneas
💪 Impacto: ~1.2pp
🧪 Tests: 18-22
```

#### Patrón de Testing

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool, PoolClient } from "pg";

describe("SessionRepository", () => {
  let repository: SessionRepository;
  let mockPool: Pool;
  let mockClient: PoolClient;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    } as unknown as PoolClient;

    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    repository = new SessionRepository(mockPool);
  });

  describe("findById()", () => {
    it("debe retornar session cuando existe", async () => {
      const mockRow = {
        id: "123",
        course_id: "COURSE-1",
        start_date: new Date(),
        status: "active",
      };

      mockPool.query = vi.fn().mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      const result = await repository.findById("123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("123");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        ["123"]
      );
    });

    it("debe retornar null cuando no existe", async () => {
      mockPool.query = vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.findById("999");

      expect(result).toBeNull();
    });
  });

  describe("create()", () => {
    it("debe crear session con transacción", async () => {
      const sessionData = {
        courseId: "COURSE-1",
        startDate: new Date(),
        config: { duration: 90 },
      };

      mockClient.query = vi
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: "new-id" }] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await repository.create(sessionData);

      expect(result).toBe("new-id");
      expect(mockClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT"),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenNthCalledWith(3, "COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("debe hacer rollback en caso de error", async () => {
      mockClient.query = vi
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error("Constraint violation")); // INSERT

      await expect(repository.create(data)).rejects.toThrow(
        "Constraint violation"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("update()", () => {
    it("debe actualizar campos específicos", async () => {
      mockPool.query = vi.fn().mockResolvedValue({
        rows: [{ id: "123" }],
        rowCount: 1,
      });

      await repository.update("123", { status: "completed" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        expect.arrayContaining(["completed", "123"])
      );
    });
  });
});
```

#### Escenarios Clave a Testear

1. **CRUD Básico**

   - Create con datos válidos
   - Read (findById, findAll, findBy...)
   - Update de campos individuales
   - Delete (soft/hard)

2. **Transacciones**

   - BEGIN → COMMIT exitoso
   - BEGIN → Error → ROLLBACK
   - Client.release() siempre llamado
   - Transacciones anidadas

3. **Queries Complejos**

   - JOINs múltiples
   - Subconsultas
   - GROUP BY y agregaciones
   - Paginación (LIMIT/OFFSET)

4. **Constraints y Validaciones**

   - Foreign key violations
   - Unique constraints
   - NOT NULL violations
   - Check constraints

5. **Errores de Conexión**
   - Connection timeout
   - Pool exhausted
   - Query syntax error
   - Deadlock detection

#### Desafíos y Soluciones

**Desafío 1:** Setup inicial complejo

```typescript
// Solución: Helper para mock de Pool
function createMockPool(): Pool {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  return {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockClient),
  } as unknown as Pool;
}
```

**Desafío 2:** Mapeo de rows a entities

```typescript
// Solución: Testear mapper por separado
describe('SessionMapper', () => {
  it('debe mapear row a entity correctamente', () => {
    const row = { id: '1', course_id: 'C1', ... };
    const entity = SessionMapper.toDomain(row);
    expect(entity.id).toBe('1');
    expect(entity.courseId).toBe('C1');
  });
});
```

**Desafío 3:** Queries SQL complejos

```typescript
// Solución: Verificar estructura, no SQL exacto
expect(mockPool.query).toHaveBeenCalledWith(
  expect.stringContaining("SELECT"),
  expect.stringContaining("FROM sessions"),
  expect.arrayContaining(["123"])
);
```

#### Ventajas

- ✅ Mayor impacto absoluto en coverage
- ✅ Patrón replicable para todos los repos PostgreSQL
- ✅ Tests revelan bugs en queries SQL

#### Bloqueadores

- ⚠️ Setup inicial toma tiempo (1-2 horas primera vez)
- ⚠️ Queries complejos difíciles de mockear
- ⚠️ Transacciones requieren secuencia exacta de mocks

---

### **Tier 4: Servicios Complejos** 🔴

**ROI: ★★☆☆☆** - Medio impacto, muy alto esfuerzo  
**Tiempo:** 3-4 días  
**Coverage esperado:** +2-3pp  
**Tests:** 40-60

#### Archivos Objetivo

##### 1. qr-emitter.service.ts

```
📁 src/backend/qr-projection/application/services/qr-emitter.service.ts
📏 239 líneas
💪 Impacto: ~1-1.2pp
🧪 Tests: 15-20
⚠️ Complejidad: Timers + WebSocket
```

**Desafíos:**

- `setInterval()` para emisión periódica
- WebSocket broadcast
- State management de QR activo
- Cleanup de resources

##### 2. qr-projection.service.ts

```
📁 src/backend/qr-projection/application/services/qr-projection.service.ts
📏 217 líneas - ORCHESTRATOR PRINCIPAL
💪 Impacto: ~0.8-1pp
🧪 Tests: 12-15
⚠️ Complejidad: Múltiples dependencies
```

**Desafíos:**

- Orquestación de 5+ dependencies
- Side effects encadenados
- Error recovery complejo

##### 3. penalty.service.ts

```
📁 src/backend/attendance/application/services/penalty.service.ts
📏 198 líneas
💪 Impacto: ~0.7-0.9pp
🧪 Tests: 12-15
⚠️ Complejidad: Lógica de negocio compleja
```

#### Patrón para Timers

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("QREmitterService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("debe emitir QR cada 30 segundos", async () => {
    const mockEmit = vi.fn();
    const emitter = new QREmitterService({ interval: 30000 });
    emitter.on("qr-emitted", mockEmit);

    emitter.start();

    // Avanzar 30 segundos
    await vi.advanceTimersByTimeAsync(30000);
    expect(mockEmit).toHaveBeenCalledTimes(1);

    // Avanzar otros 30 segundos
    await vi.advanceTimersByTimeAsync(30000);
    expect(mockEmit).toHaveBeenCalledTimes(2);

    emitter.stop();
  });

  it("debe limpiar interval al detener", () => {
    const emitter = new QREmitterService();
    const intervalId = emitter.start();

    emitter.stop();

    // Avanzar tiempo no debería emitir
    vi.advanceTimersByTime(60000);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
```

#### Patrón para Orchestrators

```typescript
describe("QRProjectionService", () => {
  let service: QRProjectionService;
  let mockPayloadBuilder: PayloadBuilderService;
  let mockBalancer: PoolBalancerService;
  let mockPayloadRepo: QRPayloadRepository;
  let mockEmitter: QREmitterService;

  beforeEach(() => {
    // Mock de todas las dependencies
    mockPayloadBuilder = {
      buildStudentPayload: vi.fn(),
      buildFakePayload: vi.fn(),
    } as any;

    mockBalancer = {
      balance: vi.fn().mockResolvedValue({ added: [], removed: [] }),
    } as any;

    // ... más mocks

    service = new QRProjectionService(
      mockPayloadBuilder,
      mockBalancer,
      mockPayloadRepo,
      mockEmitter
    );
  });

  describe("generateAndProject()", () => {
    it("debe ejecutar flujo completo en orden", async () => {
      // Arrange
      const callOrder: string[] = [];

      mockPayloadBuilder.buildStudentPayload = vi
        .fn()
        .mockImplementation(() => {
          callOrder.push("build");
          return payload;
        });

      mockBalancer.balance = vi.fn().mockImplementation(() => {
        callOrder.push("balance");
        return { added: [], removed: [] };
      });

      mockPayloadRepo.save = vi.fn().mockImplementation(() => {
        callOrder.push("save");
        return Promise.resolve();
      });

      mockEmitter.emit = vi.fn().mockImplementation(() => {
        callOrder.push("emit");
      });

      // Act
      await service.generateAndProject("session-1", 1);

      // Assert
      expect(callOrder).toEqual(["build", "balance", "save", "emit"]);
    });

    it("debe revertir cambios si save falla", async () => {
      mockPayloadRepo.save = vi
        .fn()
        .mockRejectedValue(new Error("Save failed"));

      await expect(service.generateAndProject("session-1", 1)).rejects.toThrow(
        "Save failed"
      );

      // Verificar rollback
      expect(mockBalancer.revert).toHaveBeenCalled();
      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
```

#### Ventajas

- ✅ Cobertura de servicios críticos
- ✅ Tests revelan bugs en lógica de negocio

#### Bloqueadores

- ⚠️ Muy alto esfuerzo por línea de coverage
- ⚠️ Requiere expertise en mocking avanzado
- ⚠️ Tests frágiles (muchas dependencies)
- ⚠️ Difícil mantener en el tiempo

**Recomendación:** Solo hacer Tier 4 si NO alcanzas 60% con Tiers 1-3

---

## 📅 Plan de Implementación por Fases

### **Fase 1: Foundation** (Días 1-2)

**Objetivo:** 49.43% → 51.5% (+2pp)

**Tareas:**

- [ ] Day 1 Morning: Domain Services (penalty.calculator, window.service)
- [ ] Day 1 Afternoon: Value Objects (qr-payload, attendance-window)
- [ ] Day 2 Morning: Entities (session-config) + cleanup
- [ ] Day 2 Afternoon: Review y fix de tests fallidos

**Entregable:** +40 tests, 0 failing

**Checkpoint:** Si coverage < 51%, agregar más domain services

---

### **Fase 2: High Impact Valkey** (Días 3-5)

**Objetivo:** 51.5% → 56% (+4.5pp)

**Tareas:**

- [ ] Day 3: qr-payload.repository (15-20 tests) ⭐ **PRIORIDAD**

  - CRUD básico (save, get, delete, getAll)
  - TTL y expiración
  - Manejo de errores Valkey
  - Keys patterns

- [ ] Day 4: session.valkey-repository (12-15 tests)

  - Cache de sessions activas
  - Invalidación de cache
  - Sincronización con PostgreSQL

- [ ] Day 5: validation-cache.repository (10-12 tests)
  - Cache de validaciones recientes
  - Cleanup de cache expirado

**Entregable:** +60 tests, coverage ~56%

**Checkpoint:** Si coverage < 55%, revisar tests de Tier 1 que quedaron

---

### **Fase 3: Heavy Lifting PostgreSQL** (Días 6-9)

**Objetivo:** 56% → 60.5% (+4.5pp) 🎉

**Tareas:**

- [ ] Day 6: session.repository - Parte 1 (CRUD básico)

  - findById, findAll, findActive
  - create con transacción
  - update de status

- [ ] Day 7: session.repository - Parte 2 (Queries complejos)

  - findByDateRange con joins
  - Paginación
  - Agregaciones

- [ ] Day 8: validation.repository (20-25 tests)

  - Registro de validaciones
  - Queries por período
  - Estadísticas de asistencia

- [ ] Day 9: registration.repository (18-22 tests)
  - CRUD de registraciones
  - Bulk operations
  - Constraint violations

**Entregable:** +80 tests, coverage ~60-61%

**Checkpoint:** Si coverage >= 60%, ÉXITO 🎉  
Si coverage < 59%, agregar result.repository

---

### **Fase 4: Contingencia** (Días 10+)

**Solo ejecutar si coverage < 60% después de Fase 3**

**Opción A:** Más repositorios PostgreSQL

- [ ] result.repository (18-22 tests) → +1.2pp

**Opción B:** Servicios complejos selectivos

- [ ] penalty.service (lógica de negocio) → +0.8pp
- [ ] Evitar qr-emitter y qr-projection (muy complejo)

**Opción C:** Refinamiento

- [ ] Mejorar cobertura de archivos en 80-95%
- [ ] Agregar edge cases faltantes

---

## 📈 Métricas y Seguimiento

### KPIs por Fase

| Fase     | Coverage Objetivo | Tests Acumulados | Días    | Status          |
| -------- | ----------------- | ---------------- | ------- | --------------- |
| Inicial  | 49.43%            | 769              | -       | ✅ Completado   |
| Fase 1   | 51.50%            | ~810             | 2       | 🔜 Pendiente    |
| Fase 2   | 56.00%            | ~870             | 5       | 🔜 Pendiente    |
| Fase 3   | 60.50%            | ~950             | 9       | 🔜 Pendiente    |
| **Meta** | **60.00%**        | **~940**         | **7-9** | 🎯 **Objetivo** |

### Tracking Diario

**Template de reporte:**

```markdown
## Día X - [Fase]

### Completado

- ✅ Archivo: [nombre] (+X tests, +Xpp coverage)
- ✅ Archivo: [nombre] (+X tests, +Xpp coverage)

### Métricas

- Coverage: XX.XX% (+X.XXpp)
- Tests: XXX passing, X failing
- Tiempo invertido: X horas

### Bloqueadores

- ⚠️ [Descripción del bloqueador]

### Siguiente Acción

- 🔜 [Próximo archivo a testear]
```

### Comando de Verificación

```bash
# Coverage actual
npm run test:coverage 2>&1 | grep "All files"

# Tests por módulo
npm run test:coverage 2>&1 | grep "src/backend" | head -20

# Archivos con bajo coverage
npm run test:coverage 2>&1 | grep "src/backend" | awk -F'|' '$2 < 60'
```

---

## 🛠️ Patrones y Best Practices Establecidos

### ✅ Patrones que FUNCIONAN

#### 1. Mock de Use Cases Completos

```typescript
// ✅ CORRECTO - Mock del use case completo
vi.mock("../application/validate-scan.usecase", () => ({
  ValidateScanUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

// ❌ INCORRECTO - Mock de dependencies internas
const mockRepo = { save: vi.fn() };
new ValidateScanUseCase(mockRepo); // No funciona, se instancia internamente
```

#### 2. Validación de QRPayloadV1

```typescript
// ✅ CORRECTO - Cumple validación estricta
const payload = {
  s: "session-123",
  r: 1, // r >= 1
  n: "a".repeat(32), // exactamente 32 chars hex
};

// ❌ INCORRECTO
const payload = {
  r: 0, // ❌ Falla: r debe ser >= 1
  n: "short-nonce", // ❌ Falla: debe ser 32 chars
};
```

#### 3. Mock de ValkeyClient

```typescript
// ✅ CORRECTO - Mock completo
const mockValkeyClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  mget: vi.fn(),
} as unknown as ValkeyClient;

// Configurar respuestas
mockValkeyClient.get = vi.fn().mockResolvedValue(JSON.stringify(data));
```

#### 4. Tests de Validación de Round

```typescript
// ✅ CORRECTO - Usar nonce correcto para pasar primera validación
const state = {
  sessionId: "session-123",
  currentRound: 5,
  currentNonce: "nonce-current", // <-- Importante
};

await repository.validateRound(state, {
  s: "session-123",
  r: 6,
  n: "nonce-current", // <-- Mismo nonce
});
// Ahora llega a validación de round
```

### ⚠️ Antipatrones EVITAR

#### 1. No Hacer Assertions Débiles

```typescript
// ❌ MAL - No verifica nada útil
expect(result).toBeDefined();

// ✅ BIEN - Verifica valores concretos
expect(result.error).toEqual({
  code: "QR_EXPIRED",
  message: expect.stringContaining("expirado"),
});
```

#### 2. No Mockear Dependencies Individuales de Use Cases

```typescript
// ❌ MAL - Use case se instancia internamente
const mockRepo = { save: vi.fn() };
const useCase = new CompleteScanUseCase(mockRepo);

// ✅ BIEN - Mock del use case completo
vi.mock("./validate-scan.usecase");
```

#### 3. No Usar Datos Hardcoded

```typescript
// ❌ MAL - Datos mágicos
expect(result).toBe(42);

// ✅ BIEN - Datos calculados o constantes
const EXPECTED_PENALTY = calculatePenalty(delayMinutes);
expect(result).toBe(EXPECTED_PENALTY);
```

---

## 🎯 Recomendaciones Finales

### Orden de Ejecución Recomendado

**Ruta Óptima para 60%:**

```
1. Fase 1: Domain Services (Quick wins) → 51.5%
2. qr-payload.repository (Tier 2) → 53%
3. Resto de Tier 2 (Valkey) → 56%
4. session.repository (Tier 3) → 57.5%
5. validation.repository (Tier 3) → 59%
6. registration.repository (Tier 3) → 60.5% ✅
```

### Criterios de Decisión

**¿Cuándo hacer Tier 4?**

- Solo si coverage < 59% después de Tier 3
- Priorizar penalty.service (lógica de negocio)
- Evitar qr-emitter hasta que sea crítico

**¿Cuándo parar?**

- Al alcanzar 60% de coverage ✅
- No sobre-optimizar: 60-65% es excelente
- Mejor coverage != Mejor tests

### Métricas de Calidad

**Un buen test tiene:**

- ✅ Nombre descriptivo (should/debe + comportamiento esperado)
- ✅ Arrange-Act-Assert bien definido
- ✅ Assertions específicas (no solo .toBeDefined())
- ✅ Edge cases cubiertos
- ✅ Mocks mínimos necesarios

**Señales de alerta:**

- ⚠️ Tests que pasan sin assertions
- ⚠️ Mocks más largos que el test
- ⚠️ Tests que testean implementación, no comportamiento
- ⚠️ Tests que fallan intermitentemente

---

## 📚 Referencias

### Archivos de Test Ejemplares

**Para aprender patrones:**

1. `fraud-metrics.repository.test.ts` - Mock de ValkeyClient perfecto
2. `payload-builder.service.test.ts` - Tests de domain service puro
3. `pool-balancer.service.test.ts` - Tests de service con lógica compleja
4. `complete-scan.usecase.test.ts` - Mock de use cases
5. `student-session.repository.test.ts` - Validaciones complejas

### Comandos Útiles

```bash
# Coverage completo
npm run test:coverage

# Coverage de un archivo específico
npm test src/backend/attendance/infrastructure/qr-payload.repository.test.ts -- --coverage

# Watch mode para desarrollo
npm test -- --watch

# Tests de un módulo específico
npm test src/backend/attendance

# Ver solo tests failing
npm test 2>&1 | grep "FAIL"
```

### Documentación

- **Vitest:** https://vitest.dev/
- **Vi Mock:** https://vitest.dev/api/vi.html
- **Coverage:** https://vitest.dev/guide/coverage.html

---

## ✅ Checklist de Inicio

Antes de comenzar Fase 1:

- [ ] Leer este documento completo
- [ ] Verificar coverage actual: `npm run test:coverage`
- [ ] Confirmar 0 tests failing
- [ ] Tener claridad en orden de archivos Tier 1
- [ ] Preparar template de commit messages
- [ ] Configurar branch de trabajo (opcional)

**Commit message template:**

```
test: add tests for [ModuleName]

- Add [X] tests for [feature/method]
- Coverage: [antes]% → [después]%
- Tests: [total] passing

Refs: TESTING_STRATEGY_60_PERCENT.md - Fase [N]
```

---

## 📊 Anexo: Análisis de Archivos Sin Tests

### Top 10 Archivos por Impacto (LOC sin tests)

| #   | Archivo                    | Líneas | Módulo        | Tier | Impacto Estimado |
| --- | -------------------------- | ------ | ------------- | ---- | ---------------- |
| 1   | session.repository.ts      | 261    | session       | 3    | 1.5-2pp          |
| 2   | validation.repository.ts   | 258    | attendance    | 3    | 1.5pp            |
| 3   | qr-emitter.service.ts      | 239    | qr-projection | 4    | 1-1.2pp          |
| 4   | registration.repository.ts | 230    | attendance    | 3    | 1.2pp            |
| 5   | result.repository.ts       | 229    | attendance    | 3    | 1.2pp            |
| 6   | qr-projection.service.ts   | 217    | qr-projection | 4    | 0.8-1pp          |
| 7   | qr-payload.repository.ts   | 206    | shared        | 2    | 1-1.5pp          |
| 8   | penalty.service.ts         | 198    | attendance    | 4    | 0.7-0.9pp        |
| 9   | window.service.ts          | ~120   | attendance    | 1    | 0.5pp            |
| 10  | penalty.calculator.ts      | ~100   | attendance    | 1    | 0.4pp            |

**Total estimado Top 10:** ~10-11pp coverage

---

**Última actualización:** Diciembre 2025  
**Versión:** 1.0  
**Estado:** Ready for execution ✅

¿Listo para comenzar con Fase 1 o prefieres empezar directamente con qr-payload.repository? 🚀
