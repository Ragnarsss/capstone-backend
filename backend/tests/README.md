# Suite de Tests del Backend - Sistema de Asistencia

Esta carpeta contiene todos los tests automatizados del backend del sistema de asistencia, organizados por tipo y propósito.

## 📁 Estructura

```
tests/
├── unit/                           # Tests unitarios (componentes aislados)
│   ├── auth/                      # Tests de autenticación
│   ├── attendance/                # Tests de asistencia
│   ├── session/                   # Tests de sesiones
│   └── shared/                    # Tests de utilidades compartidas
│
├── integration/                    # Tests de integración (PHP + BD)
│   ├── IntegrationTest.php        # Suite de tests PHP
│   └── fixtures/                  # Datos de prueba
│
├── e2e/                           # Tests End-to-End (flujos completos)
│   ├── requisitos/                # Tests por requisito funcional
│   │   ├── req-01-sistema-aislado.spec.ts
│   │   ├── req-02-opcion-estudiante.spec.ts
│   │   ├── req-03-opcion-profesor.spec.ts
│   │   ├── req-04-registro-exitoso.spec.ts
│   │   ├── req-05-encuestas.spec.ts
│   │   ├── req-06-pantalla-general.spec.ts
│   │   └── req-07-duracion-qr.spec.ts
│   ├── setup/                     # Configuración y helpers
│   │   ├── test-db.ts            # Gestión de BD de prueba
│   │   ├── test-users.ts         # Usuarios de prueba
│   │   └── helpers.ts            # Utilidades compartidas
│   ├── playwright.config.ts       # Configuración Playwright
│   └── README.md                  # Documentación E2E
│
└── scripts/                        # Scripts de automatización
    ├── validate-requirements.sh   # Validación automática de requisitos
    ├── run-all-tests.sh          # Ejecutar todos los tests
    └── setup-test-db.sh          # Setup de BD de prueba
```

## 🎯 Tipos de Tests

### 1. Tests Unitarios (Unit Tests)

**Propósito:** Validar componentes individuales de forma aislada.

**Stack:**

- **Node.js:** Vitest (206 tests existentes)
- **PHP:** PHPUnit (a implementar)

**Ejecución:**

```bash
# Node.js
cd backend
npm run test:unit

# PHP
cd ../php-service
vendor/bin/phpunit tests/unit
```

**Cobertura esperada:** > 80%

### 2. Tests de Integración (Integration Tests)

**Propósito:** Validar interacción entre componentes (PHP + BD, Node + BD).

**Stack:**

- PHPUnit con conexión a BD de prueba
- Fixtures para datos de prueba
- Transacciones para cleanup

**Ejecución:**

```bash
cd backend/tests/integration
vendor/bin/phpunit IntegrationTest.php
```

**Casos cubiertos:**

- ✅ Autenticación de sesiones PHP
- ✅ Generación de JWT
- ✅ Permisos de profesor (`can_tomar_asistencia`)
- ✅ Registro de asistencia en BD
- ✅ Guardado de encuestas
- ✅ Validación de duplicados
- ✅ TTL de sesiones

### 3. Tests End-to-End (E2E Tests)

**Propósito:** Validar flujos completos de usuario desde UI hasta BD.

**Stack:**

- Playwright (navegador automatizado)
- TypeScript
- PostgreSQL de prueba

**Ejecución:**

```bash
cd backend/tests/e2e
npm run test:e2e

# Ejecutar requisito específico
npm run test:e2e -- requisitos/req-03-opcion-profesor.spec.ts

# Con UI interactiva
npm run test:e2e:ui

# Generar reporte HTML
npm run test:e2e:report
```

**Flujos cubiertos:**

- ✅ Login profesor → Abrir modal → Generar QR
- ✅ Login estudiante → Escanear QR → Registrar asistencia
- ✅ Completar encuesta post-asistencia
- ✅ Verificar registro en pantalla general
- ✅ Validar expiración de QR

### 4. Scripts de Validación Automática

**Propósito:** Validar todos los requisitos funcionales de forma automatizada.

**Ejecución:**

```bash
cd backend/tests/scripts

# Validar todos los requisitos
./validate-requirements.sh

# Validar requisito específico
./validate-requirements.sh --req 3

# Con reporte HTML y evidencias
./validate-requirements.sh --report --evidence

# En ambiente específico
./validate-requirements.sh --env staging
```

**Salida:**

- Consola con resultados coloreados
- Reporte HTML en `evidencias/`
- Screenshots y logs de evidencia
- Exit code: 0 si pasa, 1 si falla

## 🚀 Ejecución Rápida

### Ejecutar TODOS los tests

```bash
cd backend/tests/scripts
./run-all-tests.sh
```

Este script ejecuta en orden:

1. Tests unitarios Node.js
2. Tests unitarios PHP
3. Tests de integración PHP
4. Tests E2E Playwright
5. Validación de requisitos

**Tiempo estimado:** 15-20 minutos

### Ejecutar solo lo esencial (pre-commit)

```bash
cd backend
npm run test:quick
```

Ejecuta:

- Tests unitarios (rápidos)
- Linters
- Type checking

**Tiempo estimado:** 2-3 minutos

## 📊 Matriz de Cobertura

| Requisito                    | Unitarios | Integración | E2E           | Validación Manual    |
| ---------------------------- | --------- | ----------- | ------------- | -------------------- |
| **REQ-01** Sistema Aislado   | N/A       | 5 tests     | Health checks | ✅ Checklist         |
| **REQ-02** Opción Estudiante | 10 tests  | 5 tests     | 5 tests E2E   | ✅ Screenshot        |
| **REQ-03** Opción Profesor   | 20 tests  | 8 tests     | 8 tests E2E   | ✅ Video QR          |
| **REQ-04** Registro Exitoso  | 30 tests  | 5 tests     | 5 tests E2E   | ✅ Query SQL         |
| **REQ-05** Encuestas         | 15 tests  | 5 tests     | 5 tests E2E   | ✅ Video flujo       |
| **REQ-06** Pantalla General  | 10 tests  | 7 tests     | 6 tests E2E   | ✅ Screenshot        |
| **REQ-07** Duración QR       | 25 tests  | 6 tests     | 6 tests E2E   | ✅ Test automatizado |

**Total:** 115 tests unitarios + 41 tests integración + 35 tests E2E = **191 tests automatizados**

## 🔧 Configuración de Ambiente de Testing

### Variables de Entorno

Crear archivo `.env.test` en la raíz del backend:

```bash
# Base de datos de prueba
DATABASE_URL=postgresql://test_user:test_pass@localhost:5433/hawaii_test

# URLs de servicios
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
LEGACY_URL=http://localhost:8080

# JWT
JWT_SECRET=test-secret-key-cambiar-en-produccion
JWT_EXPIRY=3600

# Configuración de tests
TEST_TIMEOUT=30000
E2E_HEADLESS=true
SAVE_SCREENSHOTS=true
```

### Setup de Base de Datos de Prueba

```bash
# Crear BD de prueba
createdb hawaii_test

# Cargar esquema
psql hawaii_test < schema.sql

# Cargar fixtures
cd backend/tests/e2e/setup/fixtures
psql hawaii_test < semestres.sql
psql hawaii_test < profesores.sql
psql hawaii_test < cursos.sql
psql hawaii_test < alumnos.sql
```

O usar el script automatizado:

```bash
cd backend/tests/scripts
./setup-test-db.sh
```

## 📝 Escribir Nuevos Tests

### Test Unitario (Node.js)

```typescript
// backend/tests/unit/auth/token-generation.test.ts
import { describe, it, expect } from "vitest";
import { generateToken } from "../../../src/modules/auth/jwt";

describe("Token Generation", () => {
  it("should generate valid JWT", () => {
    const token = generateToken({ userId: "123", role: "profesor" });
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);
  });
});
```

### Test de Integración (PHP)

```php
// backend/tests/integration/AuthenticationTest.php
public function testGenerateToken()
{
    $authService = new AuthenticationService();
    $token = $authService->generateToken('profesor@ucn.cl', 'profesor');

    $this->assertNotEmpty($token);
    $parts = explode('.', $token);
    $this->assertCount(3, $parts);
}
```

### Test E2E (Playwright)

```typescript
// backend/tests/e2e/requisitos/req-XX-nueva-funcionalidad.spec.ts
import { test, expect } from "@playwright/test";

test("REQ-XX-001: Descripción del test", async ({ page }) => {
  await page.goto("/ruta");
  await page.click("#boton");
  await expect(page.locator("#resultado")).toBeVisible();
});
```

## 🔍 Debugging

### Playwright con UI

```bash
cd backend/tests/e2e
npx playwright test --ui
```

### Ver trace de test fallido

```bash
npx playwright show-trace test-results/nombre-test/trace.zip
```

### Ejecutar PHP con Xdebug

```bash
export XDEBUG_MODE=debug
vendor/bin/phpunit tests/integration/IntegrationTest.php
```

## 📦 CI/CD Integration

Los tests se ejecutan automáticamente en GitHub Actions:

```yaml
# .github/workflows/tests.yml
- name: Run Unit Tests
  run: npm run test:unit

- name: Run Integration Tests
  run: vendor/bin/phpunit tests/integration

- name: Run E2E Tests
  run: npm run test:e2e

- name: Validate Requirements
  run: ./tests/scripts/validate-requirements.sh
```

## 📚 Recursos

- [Documentación Playwright](https://playwright.dev)
- [Documentación Vitest](https://vitest.dev)
- [Documentación PHPUnit](https://phpunit.de)
- [Plan de Implementación](../../documents/implementacion-final/PLAN_IMPLEMENTACION_ENERO_2025.md)

## 🤝 Contribuir

Al agregar nuevas funcionalidades:

1. ✅ Escribir tests unitarios primero (TDD)
2. ✅ Agregar tests de integración si hay interacción con BD
3. ✅ Agregar test E2E si afecta un flujo de usuario
4. ✅ Actualizar matriz de cobertura
5. ✅ Ejecutar `./run-all-tests.sh` antes de commit

---

**Última actualización:** Enero 2026
