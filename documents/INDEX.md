# 📚 Documentación del Sistema de Asistencia

## 🧪 Testing (NUEVO)

Sistema completo de testing para el backend Node.js con **235 tests** implementados.

### Documentos de Testing

| Documento                                                | Descripción                            |
| -------------------------------------------------------- | -------------------------------------- |
| **[README-TESTING.md](./README-TESTING.md)**             | 🚀 Inicio rápido y resumen general     |
| **[GUIA-TESTING-BACKEND.md](./GUIA-TESTING-BACKEND.md)** | 📖 Guía completa paso a paso           |
| **[TESTING-RESUMEN.md](./TESTING-RESUMEN.md)**           | 📊 Resumen detallado de implementación |
| **[TESTING-COMANDOS.md](./TESTING-COMANDOS.md)**         | ⚡ Referencia rápida de comandos       |

### Inicio Rápido

```bash
# Ejecutar tests
npm run test

# Tests en modo watch
npm run test:watch

# Cobertura de código
npm run test:coverage
```

---

## 📂 Estructura de Documentación

### 01. Contexto

- [Análisis de Contenedores](./01-contexto/ANALISIS-CONTENEDORES.md)
- [Flujo Legacy](./01-contexto/flujo_legacy.md)
- [Roseta de Integración PHP Legacy](./01-contexto/roseta-integracion-php-legacy.md)

### 02. Módulos

- [Attendance](./02-modulos/attendance.md) - Validación de asistencia
- [Auth](./02-modulos/auth.md) - Autenticación JWT
- [QR Projection](./02-modulos/qr-projection.md) - Proyección de QR dinámico

### 03. Especificaciones Técnicas

- [Decision TOTP Session Key](./03-especificaciones-tecnicas/14-decision-totp-session-key.md)

### 04. Caracterización

- [Caracterización del Sistema](./04-caracteriazcion/Caracteriazcion.md)

---

## 🐛 Bugs y Problemas

| Documento                                              | Descripción                    |
| ------------------------------------------------------ | ------------------------------ |
| [BUG-REPORT-001](./BUG-REPORT-001-INTEGER-OVERFLOW.md) | Integer overflow en timestamps |
| [BUG-001-SOLUTION](./BUG-001-SOLUTION-APPLIED.md)      | Solución aplicada              |
| [BUILD-ISSUES-PROD](./BUILD-ISSUES-PROD-DEPLOYMENT.md) | Problemas de deployment        |

---

## 🎯 Navegación Rápida

### Para Desarrolladores

- **¿Nuevo en el proyecto?** → Empieza con [README-TESTING.md](./README-TESTING.md)
- **¿Necesitas escribir tests?** → Lee [GUIA-TESTING-BACKEND.md](./GUIA-TESTING-BACKEND.md)
- **¿Buscas comandos?** → Revisa [TESTING-COMANDOS.md](./TESTING-COMANDOS.md)
- **¿Quieres entender el flujo?** → Lee [flujo_legacy.md](./01-contexto/flujo_legacy.md)

### Para Testing

1. **[README-TESTING.md](./README-TESTING.md)** - Empieza aquí
2. **[TESTING-COMANDOS.md](./TESTING-COMANDOS.md)** - Referencia rápida
3. **[GUIA-TESTING-BACKEND.md](./GUIA-TESTING-BACKEND.md)** - Guía completa
4. Tests de ejemplo en `../node-service/src/backend/auth/__tests__/`

### Para Arquitectura

1. [attendance.md](./02-modulos/attendance.md) - Pipeline de validación
2. [auth.md](./02-modulos/auth.md) - Sistema de autenticación
3. [roseta-integracion-php-legacy.md](./01-contexto/roseta-integracion-php-legacy.md) - Integración PHP

---

## 📊 Estado del Proyecto

| Componente        | Estado          | Tests     | Documentación |
| ----------------- | --------------- | --------- | ------------- |
| Backend Node.js   | ✅ Producción   | 235 tests | ✅ Completa   |
| Testing System    | ✅ Implementado | -         | ✅ Completa   |
| Attendance Module | ✅ Producción   | 7 tests   | ✅ Completa   |
| Auth Module       | ✅ Producción   | 58 tests  | ✅ Completa   |
| Session Module    | ✅ Producción   | 15 tests  | ✅ Completa   |
| Enrollment Module | ✅ Producción   | 143 tests | ✅ Completa   |

---

## 🔗 Enlaces Útiles

- [Node Service](../node-service/) - Código fuente del backend
- [Tests](../node-service/src/backend/) - Tests del backend
- [Vitest Docs](https://vitest.dev/) - Framework de testing

---

## 📝 Convenciones

### Documentación de Testing

- **README-TESTING.md**: Resumen general y inicio rápido
- **GUIA-\*.md**: Guías detalladas paso a paso
- **TESTING-\*.md**: Documentos relacionados con testing
- **\*-COMANDOS.md**: Referencias rápidas de comandos

### Documentación de Módulos

- **attendance.md**: Documentación del módulo de asistencia
- **auth.md**: Documentación del módulo de autenticación
- **\*.md**: Otros módulos y especificaciones

---

## 🆕 Últimas Actualizaciones

### 18 de Diciembre, 2025

- ✅ Sistema completo de testing implementado (235 tests)
- ✅ 58 tests nuevos para módulo Auth
- ✅ Helpers y mock factories reutilizables
- ✅ Documentación completa de testing
- ✅ Guías y ejemplos de uso

---

**Mantenido por**: Equipo de Desarrollo UCN  
**Última actualización**: 18 de diciembre, 2025
