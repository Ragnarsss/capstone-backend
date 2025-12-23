# Testing Quick Reference

## 🚀 Ejecutar Tests con Reporte Completo

Para obtener TODA la información necesaria de tests en una sola ejecución:

```bash
# Reporte completo (tests + coverage)
npm run test:report

# Reporte rápido (solo tests, sin coverage)
npm run test:report:quick
```

### Lo que obtiene el reporte:

✅ **Tests**: Total ejecutados, pasados, fallados, saltados  
✅ **Coverage**: % Lines, Branches, Functions, Statements  
✅ **Progreso**: Distancia al objetivo de 60%  
✅ **Ubicaciones**: Reportes HTML y archivos guardados  
✅ **Timestamp**: Fecha y hora de ejecución

Los reportes se guardan en: `test-reports/test-report-YYYYMMDD_HHMMSS.txt`

## 📖 Más Opciones

Ver documentación completa: [scripts/README-TEST-REPORT.md](scripts/README-TEST-REPORT.md)

```bash
# Test de archivo específico
./scripts/test-report.sh --file mi-archivo.test.ts

# Modo watch para desarrollo
./scripts/test-report.sh --watch

# Archivo específico en watch
./scripts/test-report.sh --watch --file mi-archivo.test.ts
```
