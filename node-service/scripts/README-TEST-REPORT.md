# Test Report Script

Script automatizado para ejecutar tests y generar reportes completos con toda la información necesaria.

## 🚀 Uso Rápido

### Ejecutar reporte completo (tests + coverage)

```bash
npm run test:report
```

### Ejecutar reporte rápido (solo tests, sin coverage)

```bash
npm run test:report:quick
```

### Ejecutar script directamente

```bash
./scripts/test-report.sh
```

## 📋 Opciones

### `--no-coverage`

Ejecuta solo los tests sin calcular coverage (más rápido).

```bash
./scripts/test-report.sh --no-coverage
```

### `--file <archivo>`

Ejecuta un archivo de test específico.

```bash
./scripts/test-report.sh --file load-qr-state.stage.test.ts
./scripts/test-report.sh --file complete-scan-deps.factory.test.ts
```

### `--watch`

Ejecuta tests en modo watch (ideal para desarrollo).

```bash
./scripts/test-report.sh --watch
./scripts/test-report.sh --watch --file load-qr-state.stage.test.ts
```

## 📊 Información que Recopila

El script genera un reporte completo que incluye:

1. **Test Execution**

   - Total de tests ejecutados
   - Tests pasados/fallados/saltados
   - Tiempo de ejecución

2. **Test Summary**

   - Resumen por archivo
   - Conteo de tests por estado
   - Test files pasados/fallados

3. **Coverage Report** (si está habilitado)

   - % Lines (Líneas cubiertas)
   - % Branches (Ramas cubiertas)
   - % Functions (Funciones cubiertas)
   - % Statements (Sentencias cubiertas)
   - Distancia al objetivo de 60%

4. **Additional Info**

   - Total de archivos de test
   - Ubicación del proyecto
   - Timestamp de ejecución
   - Ubicación del reporte HTML de coverage

5. **Final Status**
   - Estado general (PASSED/FAILED)
   - Exit code apropiado

## 📁 Reportes Guardados

Los reportes se guardan automáticamente en:

```
node-service/test-reports/test-report-YYYYMMDD_HHMMSS.txt
```

Ejemplo:

```
node-service/test-reports/test-report-20251219_095430.txt
```

## 🎨 Output con Colores

El script usa colores para mejor legibilidad:

- 🔵 **Azul**: Secciones e información general
- 🟢 **Verde**: Tests exitosos, objetivo alcanzado
- 🔴 **Rojo**: Tests fallidos, errores
- 🟡 **Amarillo**: Advertencias, información intermedia

## 📖 Ejemplos de Uso

### Desarrollo rápido

```bash
# Ver tests actuales sin coverage (más rápido)
npm run test:report:quick
```

### Verificación completa

```bash
# Ejecutar todo con coverage (para commits)
npm run test:report
```

### Debuggear archivo específico

```bash
# Probar un archivo mientras lo editas
./scripts/test-report.sh --watch --file mi-archivo.test.ts
```

### Test específico sin watch

```bash
# Ejecutar solo un archivo una vez
./scripts/test-report.sh --file complete-scan-deps.factory.test.ts
```

## 🔍 Interpretación del Reporte

### Ejemplo de Output:

```
╔════════════════════════════════════════════════════════════╗
║         TEST REPORT - Node Service Asistencia             ║
╚════════════════════════════════════════════════════════════╝

▶ 1. EJECUTANDO TESTS
────────────────────────────────────────────────────────────
Test Files  79 passed (79)
      Tests  1239 passed | 2 skipped (1241)

▶ 2. RESUMEN DE TESTS
────────────────────────────────────────────────────────────
Passed:  1239
Failed:  0
Skipped: 2

▶ 4. RESUMEN DE COVERAGE
────────────────────────────────────────────────────────────
All files          |   59.27 |    90.76 |   78.95 |   59.27 |

Coverage Breakdown:
  Lines:    59.27
  Branches: 90.76
  Functions: 78.95

Faltan 0.73% para llegar al objetivo de 60%

▶ 6. STATUS FINAL
────────────────────────────────────────────────────────────
✓ TESTS: PASSED
✓ COVERAGE: COMPLETED
```

### ¿Cómo interpretar los porcentajes?

- **Lines (59.27%)**: Porcentaje de líneas ejecutadas
  - Meta: 60%
  - Muy cerca del objetivo ✅
- **Branches (90.76%)**: Porcentaje de ramas (if/else) ejecutadas
  - Excelente cobertura ✅
- **Functions (78.95%)**: Porcentaje de funciones ejecutadas
  - Buena cobertura ✅

## 💡 Tips

1. **Para desarrollo diario**: Usa `npm run test:report:quick`
2. **Antes de commit**: Usa `npm run test:report` para verificar coverage
3. **Debuggear tests**: Usa `--watch` con `--file` para iteración rápida
4. **Ver detalles de coverage**: Abre el HTML en `coverage/index.html`
5. **Revisar reportes antiguos**: Todos se guardan en `test-reports/`

## 🛠️ Troubleshooting

### El script no se ejecuta

```bash
# Verificar que sea ejecutable
chmod +x scripts/test-report.sh
```

### No encuentra el comando bc

```bash
# Instalar bc (para cálculos)
sudo yum install bc  # Red Hat/CentOS
sudo apt install bc  # Debian/Ubuntu
```

### Tests fallan pero el script no lo muestra

El script propaga el exit code correcto, verifica:

```bash
echo $?  # Después de ejecutar el script
# 0 = éxito, >0 = fallo
```

## 📝 Historial de Reportes

Los reportes se acumulan con timestamp único. Para limpiar reportes antiguos:

```bash
# Borrar reportes más antiguos de 30 días
find test-reports/ -name "test-report-*.txt" -mtime +30 -delete

# Mantener solo los últimos 10 reportes
ls -t test-reports/test-report-*.txt | tail -n +11 | xargs rm -f
```

## 🤝 Integración con CI/CD

El script es ideal para CI/CD porque:

- Exit code apropiado (0 = éxito, >0 = fallo)
- Output estructurado y parseable
- Genera reportes guardados con timestamp
- Soporta ejecución sin interacción

Ejemplo para GitHub Actions:

```yaml
- name: Run Tests with Report
  run: npm run test:report

- name: Upload Test Report
  uses: actions/upload-artifact@v3
  with:
    name: test-report
    path: test-reports/
```
