# 🧪 Sistema de Testing - Backend Node.js

## 📋 Resumen

Sistema completo de testing para el backend del sistema de asistencia UCN, implementado con **Vitest**.

### Estado Actual: ✅ **235 tests pasando**

---

## 🚀 Inicio Rápido

```bash
# Ejecutar todos los tests
npm run test

# Tests en modo watch (auto-rerun al guardar)
npm run test:watch

# Tests con cobertura de código
npm run test:coverage

# Tests de un módulo específico
npm run test -- auth/__tests__
```

---

## 📁 Archivos Creados

### Documentación

1. **[GUIA-TESTING-BACKEND.md](./GUIA-TESTING-BACKEND.md)** - Guía completa de testing
2. **[TESTING-RESUMEN.md](./TESTING-RESUMEN.md)** - Resumen detallado de implementación

### Tests del Módulo Auth (✅ **58 tests**)

1. **[user-id.test.ts](../node-service/src/backend/auth/__tests__/user-id.test.ts)** - Value Object
2. **[jwt-utils.test.ts](../node-service/src/backend/auth/__tests__/jwt-utils.test.ts)** - Utilidades JWT
3. **[auth.service.test.ts](../node-service/src/backend/auth/__tests__/auth.service.test.ts)** - Servicio de autenticación

### Utilidades de Testing

1. **[test-helpers.ts](../node-service/src/backend/shared/__tests__/test-helpers.ts)** - Helpers reutilizables
2. **[mock-factories.ts](../node-service/src/backend/shared/__tests__/mock-factories.ts)** - Factories de mocks
3. **[example-usecase.test.ts](../node-service/src/backend/shared/__tests__/example-usecase.test.ts)** - Ejemplo completo

---

## 📊 Cobertura por Módulo

| Módulo            | Tests | Estado | Descripción                       |
| ----------------- | ----- | ------ | --------------------------------- |
| **Auth**          | 58    | ✅     | JWT, UserId, AuthService          |
| **Attendance**    | 7     | ✅     | Stages de validación, TOTP        |
| **Session**       | 15    | ✅     | Login ECDH, SessionKey            |
| **Enrollment**    | 143   | ✅     | State machines, AAGUID, políticas |
| **Access**        | 9     | ✅     | Gateway de acceso                 |
| **Shared**        | 11    | ✅     | Ejemplos y helpers                |
| **QR-Projection** | -     | ⚠️     | Requiere env vars                 |
| **HKDF**          | -     | ⚠️     | Requiere env vars                 |

### **Total: 235 tests** ✅

---

## 🛠️ Herramientas Disponibles

### Test Helpers

```typescript
import {
  createValidContext, // Contexto de validación completo
  generateTestJWT, // Genera JWT válido
  generateExpiredJWT, // Genera JWT expirado
  createTestSessionKey, // Session key de prueba
  generateRandomRut, // RUT chileno válido
  timestampSecondsAgo, // Timestamp en el pasado
  createMockRedis, // Mock de Redis/Valkey
  createMockPostgres, // Mock de PostgreSQL
} from "@backend/shared/__tests__/test-helpers";
```

### Mock Factories

```typescript
import {
  createMockStudentRepository,
  createMockQRStateRepository,
  createMockSessionKeyRepository,
  createMockDeviceRepository,
  createMockEcdhService,
  createMockTotpService,
  resetAllMocks,
} from "@backend/shared/__tests__/mock-factories";
```

---

## 📝 Ejemplo de Uso

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createMockStudentRepository } from "@backend/shared/__tests__/mock-factories";
import { generateRandomRut } from "@backend/shared/__tests__/test-helpers";

describe("MiUseCase", () => {
  let mockStudentRepo: ReturnType<typeof createMockStudentRepository>;

  beforeEach(() => {
    mockStudentRepo = createMockStudentRepository();
  });

  it("debe ejecutar correctamente", async () => {
    // Arrange
    const rut = generateRandomRut();
    mockStudentRepo.findByRut.mockResolvedValue({
      id: 42,
      rut,
      nombre: "Test",
    });

    // Act
    const result = await miUseCase.execute(rut);

    // Assert
    expect(result).toBeDefined();
    expect(mockStudentRepo.findByRut).toHaveBeenCalledWith(rut);
  });
});
```

---

## ✅ Tests del Módulo Auth (Nuevos)

### 1. UserId Value Object (15 tests)

- ✅ Creación con valores válidos
- ✅ Validación de valores inválidos (0, negativos, decimales, NaN)
- ✅ Conversión (toNumber, toString)
- ✅ Comparación (equals)
- ✅ Inmutabilidad
- ✅ Identidad de objetos

### 2. JWTUtils (23 tests)

- ✅ Verificación de tokens válidos
- ✅ Detección de tokens expirados
- ✅ Validación de secret, issuer, audience
- ✅ Manejo de payloads inválidos
- ✅ Tokens malformados
- ✅ Extracción de headers Authorization
- ✅ Validación de formato "Bearer <token>"
- ✅ Edge cases (caracteres especiales, tokens largos)

### 3. AuthService (20 tests)

- ✅ Autenticación desde header completo
- ✅ Verificación directa de tokens
- ✅ Mapeo a AuthenticatedUser
- ✅ Integración JWT + UserId
- ✅ Manejo de errores de autenticación
- ✅ Preservación de caracteres especiales
- ✅ Validación de roles (profesor, estudiante, admin)

---

## 🎯 Próximos Pasos

### Para continuar añadiendo tests:

1. **Copiar estructura de Auth**

   - Cada módulo debe tener su carpeta `__tests__/`
   - Un archivo test por cada archivo de código importante

2. **Usar los helpers**

   - Importar desde `@backend/shared/__tests__/test-helpers`
   - Importar factories desde `@backend/shared/__tests__/mock-factories`

3. **Seguir el patrón AAA**

   - **Arrange**: Preparar datos y mocks
   - **Act**: Ejecutar la acción
   - **Assert**: Verificar resultados

4. **Ver ejemplos**
   - Tests de Auth como referencia
   - `example-usecase.test.ts` con comentarios explicativos

---

## 📖 Documentación Completa

- **[GUIA-TESTING-BACKEND.md](./GUIA-TESTING-BACKEND.md)** - Guía paso a paso
- **[TESTING-RESUMEN.md](./TESTING-RESUMEN.md)** - Resumen de implementación

---

## ✨ Características

- ✅ **235 tests** implementados y pasando
- ✅ **Helpers reutilizables** para evitar duplicación
- ✅ **Mock factories** para consistencia
- ✅ **Tests rápidos** (<3 segundos para todos)
- ✅ **Sin dependencias externas** (no requiere BD/Redis real)
- ✅ **Documentación completa** con ejemplos
- ✅ **Fácil de extender** siguiendo patrones establecidos

---

## 📞 Soporte

Para dudas sobre testing:

1. Revisar [GUIA-TESTING-BACKEND.md](./GUIA-TESTING-BACKEND.md)
2. Ver ejemplos en `src/backend/auth/__tests__/`
3. Revisar `example-usecase.test.ts` con comentarios

---

**Estado**: ✅ Sistema de testing funcional y listo para usar

**Última actualización**: 18 de diciembre, 2025
