# Tests End-to-End (E2E) del Sistema de Asistencia

Este directorio contiene tests automatizados que validan los flujos completos de usuario, desde la interfaz hasta la base de datos.

## Estructura

```
e2e/
├── setup/                    # Configuración y fixtures
│   ├── test-db.ts           # Setup de base de datos de prueba
│   ├── test-users.ts        # Usuarios de prueba
│   └── helpers.ts           # Utilidades compartidas
├── requisitos/              # Tests organizados por requisito
│   ├── req-01-sistema-aislado.spec.ts
│   ├── req-02-opcion-estudiante.spec.ts
│   ├── req-03-opcion-profesor.spec.ts
│   ├── req-04-registro-exitoso.spec.ts
│   ├── req-05-encuestas.spec.ts
│   ├── req-06-pantalla-general.spec.ts
│   └── req-07-duracion-qr.spec.ts
├── flows/                   # Tests de flujos completos
│   ├── profesor-flow.spec.ts
│   └── estudiante-flow.spec.ts
└── playwright.config.ts     # Configuración de Playwright
```

## Stack Tecnológico

- **Playwright** - Framework de testing E2E
- **TypeScript** - Lenguaje de programación
- **PostgreSQL** - Base de datos de prueba (copia de esquema)
- **Docker** - Contenedores para ambiente aislado

## Ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar todos los tests E2E
npm run test:e2e

# Ejecutar tests de un requisito específico
npm run test:e2e -- requisitos/req-03-opcion-profesor.spec.ts

# Ejecutar con UI interactiva
npm run test:e2e:ui

# Generar reporte HTML
npm run test:e2e:report
```

## Características

- ✅ **Automatización completa** de interacciones de usuario
- ✅ **Validación de estados** de base de datos
- ✅ **Screenshots y videos** de cada test
- ✅ **Ejecución paralela** para mayor velocidad
- ✅ **Retry automático** en caso de fallas transitorias
- ✅ **Trazabilidad** a requisitos funcionales

## Configuración

### Variables de Entorno

```bash
# .env.test
DATABASE_URL=postgresql://test_user:test_pass@localhost:5433/hawaii_test
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
LEGACY_URL=http://localhost:8080
```

### Base de Datos de Prueba

Se crea automáticamente antes de cada ejecución de tests:

1. Copia del esquema de producción
2. Carga de datos de prueba (fixtures)
3. Limpieza después de cada test

## Reportes

Después de ejecutar los tests, se generan reportes en:

- `playwright-report/` - Reporte HTML interactivo
- `test-results/` - Screenshots y videos de fallas
- `coverage/` - Cobertura de código (si aplica)
