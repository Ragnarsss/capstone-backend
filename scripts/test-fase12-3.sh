#!/bin/bash
# =============================================================================
# Test Suite: Fase 12.3 - Dashboards Profesor y Alumno
# =============================================================================
# Verifica que los dashboards funcionan correctamente
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0

# Funciones de test
pass() {
    echo -e "${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

header() {
    echo ""
    echo -e "${YELLOW}=== $1 ===${NC}"
}

# =============================================================================
header "Verificando Estructura de Archivos de Dashboards"
# =============================================================================

DEV_SIM="$PROJECT_ROOT/php-service/src/dev-simulator"

# Test 1: profesor-dashboard.php existe
if [ -f "$DEV_SIM/profesor-dashboard.php" ]; then
    pass "profesor-dashboard.php existe"
else
    fail "profesor-dashboard.php no existe"
fi

# Test 2: alumno-dashboard.php existe
if [ -f "$DEV_SIM/alumno-dashboard.php" ]; then
    pass "alumno-dashboard.php existe"
else
    fail "alumno-dashboard.php no existe"
fi

# =============================================================================
header "Verificando Contenido de profesor-dashboard.php"
# =============================================================================

# Test 3: profesor-dashboard verifica autenticacion
if grep -q 'dev_is_logged_in' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard verifica autenticacion"
else
    fail "profesor-dashboard no verifica autenticacion"
fi

# Test 4: profesor-dashboard verifica rol
if grep -q 'dev_get_user_role' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard verifica rol"
else
    fail "profesor-dashboard no verifica rol"
fi

# Test 5: profesor-dashboard usa MockDataProvider
if grep -q 'MockDataProvider' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard usa MockDataProvider"
else
    fail "profesor-dashboard no usa MockDataProvider"
fi

# Test 6: profesor-dashboard obtiene cursos del profesor
if grep -q 'getCursosByProfesor' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard obtiene cursos del profesor"
else
    fail "profesor-dashboard no obtiene cursos del profesor"
fi

# Test 7: profesor-dashboard muestra sesiones
if grep -q 'getAllSesiones\|getSesiones' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard obtiene sesiones"
else
    fail "profesor-dashboard no obtiene sesiones"
fi

# Test 8: profesor-dashboard tiene enlace a crear sesion
if grep -q 'crear-sesion' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard tiene enlace a crear sesion"
else
    fail "profesor-dashboard no tiene enlace a crear sesion"
fi

# Test 9: profesor-dashboard tiene enlace a modal-host
if grep -q 'modal-host' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard tiene enlace a modal-host"
else
    fail "profesor-dashboard no tiene enlace a modal-host"
fi

# Test 10: profesor-dashboard muestra codigo de sesion
if grep -q "sesion\['codigo'\]" "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard muestra codigo de sesion"
else
    fail "profesor-dashboard no muestra codigo de sesion"
fi

# Test 11: profesor-dashboard tiene enlace a logout
if grep -q 'logout.php' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard tiene enlace a logout"
else
    fail "profesor-dashboard no tiene enlace a logout"
fi

# =============================================================================
header "Verificando Contenido de alumno-dashboard.php"
# =============================================================================

# Test 12: alumno-dashboard verifica autenticacion
if grep -q 'dev_is_logged_in' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard verifica autenticacion"
else
    fail "alumno-dashboard no verifica autenticacion"
fi

# Test 13: alumno-dashboard verifica rol
if grep -q 'dev_get_user_role' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard verifica rol"
else
    fail "alumno-dashboard no verifica rol"
fi

# Test 14: alumno-dashboard usa MockDataProvider
if grep -q 'MockDataProvider' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard usa MockDataProvider"
else
    fail "alumno-dashboard no usa MockDataProvider"
fi

# Test 15: alumno-dashboard obtiene inscripciones
if grep -q 'getInscripcionesByAlumno' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard obtiene inscripciones del alumno"
else
    fail "alumno-dashboard no obtiene inscripciones del alumno"
fi

# Test 16: alumno-dashboard muestra cursos inscritos
if grep -q 'misCursos' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard muestra cursos inscritos"
else
    fail "alumno-dashboard no muestra cursos inscritos"
fi

# Test 17: alumno-dashboard tiene enlace a modal-reader
if grep -q 'modal-reader' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard tiene enlace a modal-reader"
else
    fail "alumno-dashboard no tiene enlace a modal-reader"
fi

# Test 18: alumno-dashboard muestra sesiones activas
if grep -q 'sesionesActivas' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard muestra sesiones activas"
else
    fail "alumno-dashboard no muestra sesiones activas"
fi

# Test 19: alumno-dashboard tiene enlace a logout
if grep -q 'logout.php' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard tiene enlace a logout"
else
    fail "alumno-dashboard no tiene enlace a logout"
fi

# =============================================================================
header "Verificando MockDataProvider tiene metodos necesarios"
# =============================================================================

# Test 20: MockDataProvider tiene getSemestreActual
if grep -q 'function getSemestreActual' "$DEV_SIM/MockDataProvider.php" 2>/dev/null; then
    pass "MockDataProvider tiene getSemestreActual()"
else
    fail "MockDataProvider no tiene getSemestreActual()"
fi

# Test 21: MockDataProvider tiene getAllSesiones
if grep -q 'function getAllSesiones' "$DEV_SIM/MockDataProvider.php" 2>/dev/null; then
    pass "MockDataProvider tiene getAllSesiones()"
else
    fail "MockDataProvider no tiene getAllSesiones()"
fi

# Test 22: MockDataProvider tiene getInscripcionesByAlumno
if grep -q 'function getInscripcionesByAlumno' "$DEV_SIM/MockDataProvider.php" 2>/dev/null; then
    pass "MockDataProvider tiene getInscripcionesByAlumno()"
else
    fail "MockDataProvider no tiene getInscripcionesByAlumno()"
fi

# Test 23: MockDataProvider tiene getCursosByProfesor
if grep -q 'function getCursosByProfesor' "$DEV_SIM/MockDataProvider.php" 2>/dev/null; then
    pass "MockDataProvider tiene getCursosByProfesor()"
else
    fail "MockDataProvider no tiene getCursosByProfesor()"
fi

# Test 24: MockDataProvider tiene getBloqueById
if grep -q 'function getBloqueById' "$DEV_SIM/MockDataProvider.php" 2>/dev/null; then
    pass "MockDataProvider tiene getBloqueById()"
else
    fail "MockDataProvider no tiene getBloqueById()"
fi

# =============================================================================
header "Verificando Redireccion entre Dashboards"
# =============================================================================

# Test 25: profesor-dashboard redirige a alumno si no es profesor
if grep -q 'alumno-dashboard.php' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard redirige a alumno-dashboard si rol incorrecto"
else
    fail "profesor-dashboard no redirige a alumno-dashboard"
fi

# Test 26: alumno-dashboard redirige a profesor si no es alumno
if grep -q 'profesor-dashboard.php' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard redirige a profesor-dashboard si rol incorrecto"
else
    fail "alumno-dashboard no redirige a profesor-dashboard"
fi

# =============================================================================
# Resumen
# =============================================================================

echo ""
echo "=========================================="
echo -e "Tests pasados: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests fallidos: ${RED}$TESTS_FAILED${NC}"
echo "=========================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}Fase 12.3: Dashboards - COMPLETADA${NC}"
    exit 0
else
    echo -e "${RED}Fase 12.3: Hay tests fallidos${NC}"
    exit 1
fi
