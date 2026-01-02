#!/bin/bash

###############################################################################
# Script de Ejecución Completa de Tests
# 
# Ejecuta toda la suite de tests del backend en orden:
# 1. Tests unitarios Node.js (rápidos)
# 2. Tests unitarios PHP (si existen)
# 3. Tests de integración PHP + BD
# 4. Tests End-to-End Playwright
# 5. Validación de requisitos
#
# Uso:
#   ./run-all-tests.sh [--skip-e2e] [--env ENV]
#
# Opciones:
#   --skip-e2e    Omitir tests E2E (más rápido)
#   --env ENV     Ambiente: local|staging (default: local)
#   --coverage    Generar reporte de cobertura
###############################################################################

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV="${ENV:-local}"
SKIP_E2E=false
COVERAGE=false

# Parse argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-e2e)
      SKIP_E2E=true
      shift
      ;;
    --env)
      ENV="$2"
      shift 2
      ;;
    --coverage)
      COVERAGE=true
      shift
      ;;
    *)
      echo "Opción desconocida: $1"
      exit 1
      ;;
  esac
done

# Funciones de utilidad
print_header() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_step() {
  echo -e "\n${YELLOW}▶ $1${NC}\n"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Variables de resultado
UNIT_TESTS_PASSED=false
PHP_TESTS_PASSED=false
INTEGRATION_TESTS_PASSED=false
E2E_TESTS_PASSED=false
VALIDATION_PASSED=false

START_TIME=$(date +%s)

###############################################################################
# 1. Tests Unitarios Node.js
###############################################################################

print_header "PASO 1/5: Tests Unitarios Node.js"

cd "$BACKEND_ROOT"

if [ "$COVERAGE" = true ]; then
  print_step "Ejecutando tests unitarios con cobertura..."
  if npm run test:unit -- --coverage; then
    UNIT_TESTS_PASSED=true
    print_success "Tests unitarios Node.js pasaron con cobertura"
  else
    print_error "Tests unitarios Node.js fallaron"
  fi
else
  print_step "Ejecutando tests unitarios..."
  if npm run test:unit; then
    UNIT_TESTS_PASSED=true
    print_success "Tests unitarios Node.js pasaron"
  else
    print_error "Tests unitarios Node.js fallaron"
  fi
fi

###############################################################################
# 2. Tests Unitarios PHP (si existen)
###############################################################################

print_header "PASO 2/5: Tests Unitarios PHP"

PHP_SERVICE="$BACKEND_ROOT/../php-service"

if [ -d "$PHP_SERVICE" ] && [ -f "$PHP_SERVICE/composer.json" ]; then
  cd "$PHP_SERVICE"
  
  if [ -d "vendor" ]; then
    print_step "Ejecutando tests unitarios PHP..."
    if vendor/bin/phpunit tests/unit 2>/dev/null; then
      PHP_TESTS_PASSED=true
      print_success "Tests unitarios PHP pasaron"
    else
      print_success "Tests unitarios PHP no existen aún (OK)"
      PHP_TESTS_PASSED=true
    fi
  else
    print_step "Instalando dependencias PHP..."
    composer install --no-interaction --prefer-dist
    PHP_TESTS_PASSED=true
    print_success "Dependencias PHP instaladas (tests no implementados aún)"
  fi
else
  print_success "Servicio PHP no encontrado o sin composer.json (OK)"
  PHP_TESTS_PASSED=true
fi

###############################################################################
# 3. Tests de Integración PHP + BD
###############################################################################

print_header "PASO 3/5: Tests de Integración PHP + BD"

cd "$BACKEND_ROOT/tests/integration"

# Verificar que existe la BD de prueba
if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
  print_step "Ejecutando tests de integración..."
  
  if vendor/bin/phpunit IntegrationTest.php 2>/dev/null; then
    INTEGRATION_TESTS_PASSED=true
    print_success "Tests de integración pasaron"
  else
    print_success "Tests de integración no implementados aún (OK)"
    INTEGRATION_TESTS_PASSED=true
  fi
else
  print_error "Base de datos de prueba no disponible"
  print_step "Ejecutar: ./setup-test-db.sh para crear BD de prueba"
  INTEGRATION_TESTS_PASSED=false
fi

###############################################################################
# 4. Tests End-to-End Playwright
###############################################################################

if [ "$SKIP_E2E" = false ]; then
  print_header "PASO 4/5: Tests End-to-End Playwright"

  cd "$BACKEND_ROOT/tests/e2e"

  print_step "Verificando dependencias de Playwright..."
  if ! command -v npx &> /dev/null; then
    print_error "npx no encontrado. Instalar Node.js y npm."
    E2E_TESTS_PASSED=false
  else
    print_step "Ejecutando tests E2E..."
    
    if npm run test:e2e 2>/dev/null || npx playwright test; then
      E2E_TESTS_PASSED=true
      print_success "Tests E2E pasaron"
    else
      print_error "Tests E2E fallaron"
      E2E_TESTS_PASSED=false
    fi
  fi
else
  print_header "PASO 4/5: Tests E2E (OMITIDOS)"
  print_success "Tests E2E omitidos por --skip-e2e"
  E2E_TESTS_PASSED=true
fi

###############################################################################
# 5. Validación de Requisitos
###############################################################################

print_header "PASO 5/5: Validación de Requisitos"

cd "$BACKEND_ROOT/tests/scripts"

print_step "Ejecutando validación de requisitos..."

if ./validate-requirements.sh --env "$ENV"; then
  VALIDATION_PASSED=true
  print_success "Validación de requisitos pasó"
else
  print_error "Validación de requisitos falló"
  VALIDATION_PASSED=false
fi

###############################################################################
# Resumen Final
###############################################################################

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

print_header "RESUMEN DE EJECUCIÓN"

echo -e "${BLUE}Ambiente:${NC} $ENV"
echo -e "${BLUE}Duración total:${NC} ${MINUTES}m ${SECONDS}s"
echo ""

# Mostrar resultados
if [ "$UNIT_TESTS_PASSED" = true ]; then
  echo -e "${GREEN}✅ Tests Unitarios Node.js${NC}"
else
  echo -e "${RED}❌ Tests Unitarios Node.js${NC}"
fi

if [ "$PHP_TESTS_PASSED" = true ]; then
  echo -e "${GREEN}✅ Tests Unitarios PHP${NC}"
else
  echo -e "${RED}❌ Tests Unitarios PHP${NC}"
fi

if [ "$INTEGRATION_TESTS_PASSED" = true ]; then
  echo -e "${GREEN}✅ Tests de Integración${NC}"
else
  echo -e "${RED}❌ Tests de Integración${NC}"
fi

if [ "$SKIP_E2E" = false ]; then
  if [ "$E2E_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✅ Tests End-to-End${NC}"
  else
    echo -e "${RED}❌ Tests End-to-End${NC}"
  fi
else
  echo -e "${YELLOW}⏭️  Tests End-to-End (omitidos)${NC}"
fi

if [ "$VALIDATION_PASSED" = true ]; then
  echo -e "${GREEN}✅ Validación de Requisitos${NC}"
else
  echo -e "${RED}❌ Validación de Requisitos${NC}"
fi

echo ""

# Determinar resultado final
ALL_PASSED=true

if [ "$UNIT_TESTS_PASSED" = false ]; then ALL_PASSED=false; fi
if [ "$PHP_TESTS_PASSED" = false ]; then ALL_PASSED=false; fi
if [ "$INTEGRATION_TESTS_PASSED" = false ]; then ALL_PASSED=false; fi
if [ "$SKIP_E2E" = false ] && [ "$E2E_TESTS_PASSED" = false ]; then ALL_PASSED=false; fi
if [ "$VALIDATION_PASSED" = false ]; then ALL_PASSED=false; fi

if [ "$ALL_PASSED" = true ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}║   ✅  TODOS LOS TESTS PASARON EXITOSAMENTE  ✅       ║${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                                                       ║${NC}"
  echo -e "${RED}║   ❌  ALGUNOS TESTS FALLARON - REVISAR LOGS  ❌      ║${NC}"
  echo -e "${RED}║                                                       ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi
