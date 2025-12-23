# Comandos de Testing - Referencia Rápida

## 🚀 Comandos Básicos

```bash
# Ejecutar todos los tests
npm run test

# Tests en modo watch (auto-rerun)
npm run test:watch

# Tests con cobertura
npm run test:coverage
```

---

## 🎯 Ejecutar Tests Específicos

### Por Módulo

```bash
# Solo tests de Auth
npm run test -- auth/__tests__

# Solo tests de Attendance
npm run test -- attendance/__tests__

# Solo tests de Session
npm run test -- session/__tests__

# Solo tests de Enrollment
npm run test -- enrollment/__tests__
```

### Por Archivo

```bash
# Un archivo específico
npm run test -- user-id.test.ts

# Múltiples archivos
npm run test -- jwt-utils.test.ts auth.service.test.ts
```

### Por Patrón

```bash
# Todos los archivos que contengan "auth"
npm run test -- auth

# Todos los archivos que contengan "stage"
npm run test -- stage
```

---

## 🔍 Debugging

### Ver Output Detallado

```bash
npm run test -- --reporter=verbose
```

### Ejecutar Solo Un Test

```typescript
// En el archivo .test.ts, agregar .only
it.only("debe ejecutar solo este test", () => {
  // ...
});
```

### Skip un Test

```typescript
// En el archivo .test.ts, agregar .skip
it.skip("este test no se ejecuta", () => {
  // ...
});
```

---

## 📊 Cobertura

### Ver Reporte en Terminal

```bash
npm run test:coverage
```

### Ver Reporte HTML

```bash
npm run test:coverage
# Abrir: coverage/index.html
```

### Cobertura Mínima Requerida

```bash
npm run test:coverage -- --coverage.thresholds.lines=80
```

---

## 🧪 Crear Nuevos Tests

### 1. Crear archivo test

```bash
# Dentro de cualquier módulo
touch src/backend/mi-modulo/__tests__/mi-archivo.test.ts
```

### 2. Estructura básica

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("MiComponente", () => {
  beforeEach(() => {
    // Setup antes de cada test
  });

  it("debe hacer algo", () => {
    // Arrange
    const input = "test";

    // Act
    const result = miComponente.metodo(input);

    // Assert
    expect(result).toBe("expected");
  });
});
```

### 3. Usar helpers

```typescript
import {
  createValidContext,
  generateTestJWT,
  timestampSecondsAgo,
} from "@backend/shared/__tests__/test-helpers";

import {
  createMockStudentRepository,
  resetAllMocks,
} from "@backend/shared/__tests__/mock-factories";
```

---

## 🔧 Comandos Útiles con Watch Mode

```bash
# Ejecutar en watch mode
npm run test:watch

# En watch mode, presiona:
# a - Ejecutar todos los tests
# f - Ejecutar solo tests que fallaron
# t - Filtrar por nombre de test
# p - Filtrar por nombre de archivo
# q - Salir
```

---

## 📝 Verificar Tests Antes de Commit

```bash
# 1. Ejecutar tests
npm run test

# 2. Verificar que no hay errores de TypeScript
npm run type-check

# 3. Ver cobertura
npm run test:coverage
```

---

## 🐛 Solución de Problemas

### Tests fallan por variables de entorno

```bash
# Copiar .env.example
cp .env.example .env

# Editar .env con valores de desarrollo
nano .env
```

### Tests muy lentos

```bash
# Ejecutar solo los tests necesarios
npm run test -- mi-archivo.test.ts

# O usar modo watch
npm run test:watch
```

### Mocks no se resetean

```typescript
import { resetAllMocks } from "@backend/shared/__tests__/mock-factories";

beforeEach(() => {
  resetAllMocks(mockObject);
});
```

---

## 📦 Tests en CI/CD

### GitHub Actions

```yaml
- name: Run tests
  run: npm run test

- name: Check coverage
  run: npm run test:coverage -- --coverage.thresholds.lines=80
```

### GitLab CI

```yaml
test:
  script:
    - npm install
    - npm run test
    - npm run test:coverage -- --coverage.thresholds.lines=80
```

---

## 🎓 Recursos

- [Vitest Docs](https://vitest.dev/)
- [Guía de Testing Backend](./GUIA-TESTING-BACKEND.md)
- [Tests de Auth (ejemplo)](../node-service/src/backend/auth/__tests__/)
- [Test Helpers](../node-service/src/backend/shared/__tests__/test-helpers.ts)
- [Mock Factories](../node-service/src/backend/shared/__tests__/mock-factories.ts)

---

## ⚡ Tips Pro

1. **Usar watch mode** durante desarrollo para feedback inmediato
2. **Escribir tests antes** de implementar (TDD)
3. **Tests pequeños** y enfocados en una sola cosa
4. **Nombres descriptivos** que expliquen el comportamiento esperado
5. **No testear implementación**, testear comportamiento
6. **Aislar tests** - no compartir estado entre tests
7. **Usar helpers** para evitar duplicación
8. **Mock solo lo necesario** - no todo necesita mock
9. **Verificar interacciones** importantes con mocks
10. **Mantener tests rápidos** - menos de 1s por archivo

---

**Última actualización**: 18 de diciembre, 2025
