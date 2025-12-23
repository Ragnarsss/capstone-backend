#!/bin/bash

# Script para ejecutar tests y obtener reporte completo
# Uso: ./scripts/test-report.sh [opciones]
# Opciones:
#   --file <archivo>  : Ejecutar solo un archivo de test específico
#   --watch          : Ejecutar en modo watch
#   --no-coverage    : No ejecutar coverage (más rápido)

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Directorios
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${PROJECT_DIR}/test-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Crear directorio de reportes si no existe
mkdir -p "${REPORT_DIR}"

# Archivo de reporte
REPORT_FILE="${REPORT_DIR}/test-report-${TIMESTAMP}.txt"

# Parsear argumentos
RUN_COVERAGE=true
TEST_FILE=""
WATCH_MODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --file)
      TEST_FILE="$2"
      shift 2
      ;;
    --no-coverage)
      RUN_COVERAGE=false
      shift
      ;;
    --watch)
      WATCH_MODE=true
      RUN_COVERAGE=false
      shift
      ;;
    *)
      echo "Opción desconocida: $1"
      exit 1
      ;;
  esac
done

# Banner
echo -e "${BOLD}${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TEST REPORT - Node Service Asistencia             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Función para mostrar sección
print_section() {
  echo -e "${BOLD}${YELLOW}▶ $1${NC}"
  echo "────────────────────────────────────────────────────────────"
}

# Función para guardar en reporte
log_to_report() {
  echo "$1" | tee -a "${REPORT_FILE}"
}

# Cambiar al directorio del proyecto
cd "${PROJECT_DIR}"

# Iniciar reporte
log_to_report "════════════════════════════════════════════════════════════"
log_to_report "TEST REPORT - $(date '+%Y-%m-%d %H:%M:%S')"
log_to_report "════════════════════════════════════════════════════════════"
log_to_report ""

# 1. Ejecutar Tests
print_section "1. EJECUTANDO TESTS"
log_to_report "1. TESTS EXECUTION"
log_to_report "────────────────────────────────────────────────────────────"

if [ "$WATCH_MODE" = true ]; then
  echo -e "${GREEN}Ejecutando en modo watch...${NC}"
  if [ -n "$TEST_FILE" ]; then
    npm test -- --watch "$TEST_FILE"
  else
    npm test -- --watch
  fi
  exit 0
fi

TEST_OUTPUT=$(mktemp)

if [ -n "$TEST_FILE" ]; then
  echo -e "${BLUE}Ejecutando archivo específico: ${TEST_FILE}${NC}"
  log_to_report "Test File: ${TEST_FILE}"
  npm test -- "$TEST_FILE" 2>&1 | tee "$TEST_OUTPUT"
else
  echo -e "${BLUE}Ejecutando todos los tests...${NC}"
  log_to_report "Test Mode: All tests"
  npm test 2>&1 | tee "$TEST_OUTPUT"
fi

TEST_EXIT_CODE=${PIPESTATUS[0]}
echo ""

# Extraer resumen de tests
print_section "2. RESUMEN DE TESTS"
log_to_report ""
log_to_report "2. TEST SUMMARY"
log_to_report "────────────────────────────────────────────────────────────"

TEST_SUMMARY=$(grep -E "Test Files|Tests " "$TEST_OUTPUT" | tail -2)
if [ -n "$TEST_SUMMARY" ]; then
  echo "$TEST_SUMMARY"
  log_to_report "$TEST_SUMMARY"
else
  echo -e "${RED}No se pudo extraer el resumen de tests${NC}"
  log_to_report "Error: Could not extract test summary"
fi

# Contar tests por estado
PASSED_TESTS=$(echo "$TEST_SUMMARY" | grep -oP '\d+(?= passed)' | head -1 || echo "0")
FAILED_TESTS=$(echo "$TEST_SUMMARY" | grep -oP '\d+(?= failed)' | head -1 || echo "0")
SKIPPED_TESTS=$(echo "$TEST_SUMMARY" | grep -oP '\d+(?= skipped)' | head -1 || echo "0")

echo ""
log_to_report ""
log_to_report "Passed:  ${PASSED_TESTS}"
log_to_report "Failed:  ${FAILED_TESTS}"
log_to_report "Skipped: ${SKIPPED_TESTS}"

# 3. Ejecutar Coverage (si está habilitado)
if [ "$RUN_COVERAGE" = true ] && [ -z "$TEST_FILE" ]; then
  echo ""
  print_section "3. EJECUTANDO COVERAGE"
  log_to_report ""
  log_to_report "3. COVERAGE REPORT"
  log_to_report "────────────────────────────────────────────────────────────"
  
  COVERAGE_OUTPUT=$(mktemp)
  npm run test:coverage 2>&1 | tee "$COVERAGE_OUTPUT"
  COVERAGE_EXIT_CODE=${PIPESTATUS[0]}
  
  echo ""
  print_section "4. RESUMEN DE COVERAGE"
  log_to_report ""
  log_to_report "4. COVERAGE SUMMARY"
  log_to_report "────────────────────────────────────────────────────────────"
  
  # Extraer línea de resumen (All files)
  COVERAGE_SUMMARY=$(grep "^All files" "$COVERAGE_OUTPUT" | head -1)
  if [ -n "$COVERAGE_SUMMARY" ]; then
    echo "$COVERAGE_SUMMARY"
    log_to_report "$COVERAGE_SUMMARY"
    
    # Extraer porcentajes (formato: All files | Stmts | Branch | Funcs | Lines | ...)
    STMTS_COV=$(echo "$COVERAGE_SUMMARY" | awk '{print $4}')
    BRANCH_COV=$(echo "$COVERAGE_SUMMARY" | awk '{print $6}')
    FUNCS_COV=$(echo "$COVERAGE_SUMMARY" | awk '{print $8}')
    LINES_COV=$(echo "$COVERAGE_SUMMARY" | awk '{print $10}')
    
    echo ""
    echo -e "${BOLD}Coverage Breakdown:${NC}"
    echo -e "  Statements: ${STMTS_COV}"
    echo -e "  Branches:   ${BRANCH_COV}"
    echo -e "  Functions:  ${FUNCS_COV}"
    echo -e "  Lines:      ${LINES_COV}"
    
    log_to_report ""
    log_to_report "Statements: ${STMTS_COV}"
    log_to_report "Branches:   ${BRANCH_COV}"
    log_to_report "Functions:  ${FUNCS_COV}"
    log_to_report "Lines:      ${LINES_COV}"
    
    # Verificar si llegamos al objetivo
    LINES_NUM=$(echo "$LINES_COV" | grep -oP '[\d.]+')
    if (( $(echo "$LINES_NUM >= 60" | bc -l) )); then
      echo ""
      echo -e "${GREEN}${BOLD}✓ ¡Objetivo de 60% alcanzado! (${LINES_COV})${NC}"
      log_to_report ""
      log_to_report "✓ Target 60% REACHED! (${LINES_COV})"
    else
      REMAINING=$(echo "60 - $LINES_NUM" | bc -l)
      echo ""
      echo -e "${YELLOW}Faltan ${REMAINING}% para llegar al objetivo de 60%${NC}"
      log_to_report ""
      log_to_report "Remaining: ${REMAINING}% to reach 60% target"
    fi
  else
    echo -e "${RED}No se pudo extraer el resumen de coverage${NC}"
    log_to_report "Error: Could not extract coverage summary"
  fi
  
  # Mostrar ubicación del reporte HTML
  echo ""
  echo -e "${BLUE}Reporte HTML de coverage:${NC}"
  echo "  file://${PROJECT_DIR}/coverage/index.html"
  log_to_report ""
  log_to_report "HTML Coverage Report:"
  log_to_report "  file://${PROJECT_DIR}/coverage/index.html"
  
  rm -f "$COVERAGE_OUTPUT"
elif [ -n "$TEST_FILE" ]; then
  echo ""
  echo -e "${YELLOW}ℹ Coverage omitido (archivo específico)${NC}"
  log_to_report ""
  log_to_report "Coverage: Skipped (specific file mode)"
else
  echo ""
  echo -e "${YELLOW}ℹ Coverage omitido (--no-coverage)${NC}"
  log_to_report ""
  log_to_report "Coverage: Skipped (--no-coverage flag)"
fi

# 5. Archivos de Test
echo ""
print_section "5. INFORMACIÓN ADICIONAL"
log_to_report ""
log_to_report "5. ADDITIONAL INFO"
log_to_report "────────────────────────────────────────────────────────────"

TEST_FILE_COUNT=$(find src -name "*.test.ts" | wc -l)
echo -e "Total archivos de test: ${TEST_FILE_COUNT}"
log_to_report "Total test files: ${TEST_FILE_COUNT}"

# Ubicación del proyecto
echo -e "Directorio del proyecto: ${PROJECT_DIR}"
log_to_report "Project directory: ${PROJECT_DIR}"

# Timestamp
echo -e "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
log_to_report "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

# 6. Status Final
echo ""
print_section "6. STATUS FINAL"
log_to_report ""
log_to_report "6. FINAL STATUS"
log_to_report "────────────────────────────────────────────────────────────"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✓ TESTS: PASSED${NC}"
  log_to_report "✓ TESTS: PASSED"
else
  echo -e "${RED}${BOLD}✗ TESTS: FAILED${NC}"
  log_to_report "✗ TESTS: FAILED"
fi

if [ "$RUN_COVERAGE" = true ] && [ -z "$TEST_FILE" ]; then
  if [ $COVERAGE_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ COVERAGE: COMPLETED${NC}"
    log_to_report "✓ COVERAGE: COMPLETED"
  else
    echo -e "${RED}${BOLD}✗ COVERAGE: FAILED${NC}"
    log_to_report "✗ COVERAGE: FAILED"
  fi
fi

# Footer
echo ""
log_to_report ""
log_to_report "════════════════════════════════════════════════════════════"
echo -e "${BOLD}${BLUE}"
echo "────────────────────────────────────────────────────────────"
echo "Reporte guardado en: ${REPORT_FILE}"
echo "────────────────────────────────────────────────────────────"
echo -e "${NC}"

# Cleanup
rm -f "$TEST_OUTPUT"

# Exit con el código de los tests
exit $TEST_EXIT_CODE
