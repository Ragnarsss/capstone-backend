# Critical Path Coverage Analysis

## 🎯 Definición de Critical Paths

Los **Critical Paths** son los flujos de código que:

1. Se ejecutan en producción con alta frecuencia
2. Manejan datos sensibles (seguridad, privacidad)
3. Afectan la experiencia del usuario directamente
4. Pueden causar pérdida de datos o fallas críticas

## 📊 Critical Paths Identificados

### PATH 1: Flujo de Asistencia con QR ⭐⭐⭐⭐⭐ (CRÍTICO)

**Frecuencia:** Alta (cada escaneo de estudiante)  
**Impacto:** Alto (pérdida de asistencia)

```
Estudiante Escanea QR
  ↓
1. decrypt.stage.ts (67.27% ❌) - DESENCRIPTAR PAYLOAD
  ↓
2. validate-structure.stage.ts (100% ✅)
  ↓
3. validate-qr.stage.ts (100% ✅)
  ↓
4. load-qr-state.stage.ts (100% ✅)
  ↓
5. load-student-state.stage.ts (100% ✅)
  ↓
6. validate-ownership.stage.ts (100% ✅)
  ↓
7. validate-student.stage.ts (100% ✅)
  ↓
8. complete-scan.usecase.ts (87.5% ⚠️)
  ↓
9. attendance-persistence.service.ts (86.72% ⚠️)
  ↓
✅ Asistencia Registrada
```

**PROBLEMA:** decrypt.stage.ts solo tiene 67% coverage en código crítico de seguridad!

---

### PATH 2: Generación y Distribución de QRs ⭐⭐⭐⭐ (ALTO)

**Frecuencia:** Media (cada clase)  
**Impacto:** Alto (sistema no funciona sin QRs)

```
Profesor Inicia Clase
  ↓
1. qr-generator.ts (100% ✅)
  ↓
2. pool-feeder.service.ts (4.27% ❌❌❌) - CASI SIN TESTS!
  ↓
3. projection-pool.repository.ts (32.71% ❌)
  ↓
4. pool-balancer.service.ts (100% ✅)
  ↓
✅ QRs Disponibles para Estudiantes
```

**PROBLEMA GRAVE:** pool-feeder.service.ts tiene solo 4% coverage!

---

### PATH 3: Enrollment/Login con FIDO2 ⭐⭐⭐⭐ (ALTO)

**Frecuencia:** Media (cada login)  
**Impacto:** Crítico (seguridad, acceso)

```
Usuario Inicia Login
  ↓
1. start-enrollment.controller.ts (100% ✅)
  ↓
2. ecdh.service.ts (100% ✅)
  ↓
3. hkdf.service.ts (98.83% ✅)
  ↓
4. fido2.service.ts (100% ✅)
  ↓
5. finish-enrollment.controller.ts (100% ✅)
  ↓
6. device.repository.ts (98.51% ✅)
  ↓
✅ Usuario Autenticado
```

**ESTADO:** Excelente coverage en path de seguridad ✅

---

### PATH 4: Validación de Session Keys ⭐⭐⭐ (MEDIO)

**Frecuencia:** Alta  
**Impacto:** Alto (encriptación de QRs)

```
Sistema Encripta QR
  ↓
1. session-key.repository.ts (100% ✅)
  ↓
2. aes-gcm.service.ts (92.85% ⚠️)
  ↓
3. session-id.ts (59.25% ❌)
  ↓
✅ QR Encriptado
```

**PROBLEMA:** session-id.ts tiene validaciones con bajo coverage

---

## 🔴 Prioridades de Testing

### PRIORIDAD 1 (URGENTE): Completar Path de Asistencia

- [ ] **decrypt.stage.ts** → Agregar 10-15 tests
  - Error handling (invalid format, corrupted data)
  - Edge cases (empty payload, malformed IV)
  - Production scenarios (timeout, connection errors)

### PRIORIDAD 2 (CRÍTICO): Completar Path de Generación QR

- [ ] **pool-feeder.service.ts** → Agregar 20-30 tests (casi vacío!)

  - Tests unitarios completos
  - Error handling
  - Integration con pool

- [ ] **projection-pool.repository.ts** → Agregar 10-15 tests
  - Operaciones CRUD del pool
  - Concurrencia
  - TTL management

### PRIORIDAD 3 (IMPORTANTE): Reforzar Validaciones

- [ ] **session-id.ts** → Agregar 5-10 tests

  - Validación de formato
  - Edge cases
  - Security tests

- [ ] **complete-scan.usecase.ts** → Mejorar tests existentes

  - Más edge cases
  - Error recovery
  - Race conditions

- [ ] **attendance-persistence.service.ts** → Mejorar tests
  - Transaction failures
  - Rollback scenarios
  - Data integrity

---

## 📈 Métricas de Critical Path

| Path          | Coverage Actual | Coverage Objetivo | Gap    |
| ------------- | --------------- | ----------------- | ------ |
| Asistencia QR | 92.3%           | 95%+              | -2.7%  |
| Generación QR | 45.6% ❌        | 90%+              | -44.4% |
| FIDO2 Login   | 98.9% ✅        | 95%+              | +3.9%  |
| Session Keys  | 84.0% ⚠️        | 90%+              | -6.0%  |

**Coverage Promedio de Critical Paths: 80.2%**  
**Objetivo: 92%+**

---

## 🎯 Plan de Acción (Próximas 2 horas)

### Fase 1: Seguridad Crítica (45 min)

1. Tests para `decrypt.stage.ts` (10-15 tests)
2. Tests para `pool-feeder.service.ts` (20-30 tests)
3. **Resultado Esperado:** Coverage general sube a 61-62%

### Fase 2: Validaciones (30 min)

1. Tests para `session-id.ts` (5-10 tests)
2. Mejorar `complete-scan.usecase.ts` (5 tests adicionales)
3. **Resultado Esperado:** Critical path coverage > 85%

### Fase 3: Integración End-to-End (45 min)

1. Test completo del flujo de asistencia
2. Test completo del flujo de generación de QR
3. **Resultado Esperado:** Confianza en producción ✅

---

## 💡 Notas Importantes

- **Branch Coverage: 90.76%** → Excelente, indica buena cobertura de lógica condicional
- **Function Coverage: 78.95%** → Bueno, pero hay funciones sin tests
- **Line Coverage: 59.27%** → Objetivo inmediato: 60%+

El bajo coverage general NO refleja que los paths críticos estén desprotegidos.
El problema está concentrado en:

1. pool-feeder.service.ts (casi sin tests)
2. decrypt.stage.ts (edge cases sin cubrir)
3. Infrastructure/presentation layers (menos críticos)

---

## 📋 Checklist de Validación

Antes de considerar "completo" el critical path coverage:

- [ ] Todos los happy paths tienen tests
- [ ] Todos los error paths tienen tests
- [ ] Edge cases documentados están testeados
- [ ] Escenarios de producción cubiertos
- [ ] Tests de seguridad para datos sensibles
- [ ] Tests de concurrencia donde aplique
- [ ] Integration tests end-to-end
- [ ] Performance/load tests básicos
