#!/bin/bash
# =============================================================================
# Test Suite: Fase 12.2 - Login Simulado
# =============================================================================
# Verifica que el sistema de login/logout simulado funciona correctamente
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
header "Verificando Estructura de Archivos de Login"
# =============================================================================

DEV_SIM="$PROJECT_ROOT/php-service/src/dev-simulator"

# Test 1: login.php existe
if [ -f "$DEV_SIM/login.php" ]; then
    pass "login.php existe"
else
    fail "login.php no existe"
fi

# Test 2: logout.php existe
if [ -f "$DEV_SIM/logout.php" ]; then
    pass "logout.php existe"
else
    fail "logout.php no existe"
fi

# =============================================================================
header "Verificando Contenido de login.php"
# =============================================================================

# Test 3: login.php tiene formulario POST
if grep -q 'method="POST"' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php tiene formulario POST"
else
    fail "login.php no tiene formulario POST"
fi

# Test 4: login.php tiene selector de tipo de usuario
if grep -q 'user_type' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php tiene selector de tipo de usuario"
else
    fail "login.php no tiene selector de tipo de usuario"
fi

# Test 5: login.php tiene selector para profesores
if grep -q 'profesor' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php tiene opcion profesor"
else
    fail "login.php no tiene opcion profesor"
fi

# Test 6: login.php tiene selector para alumnos
if grep -q 'alumno' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php tiene opcion alumno"
else
    fail "login.php no tiene opcion alumno"
fi

# Test 7: login.php carga MockDataProvider
if grep -q 'MockDataProvider' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php usa MockDataProvider"
else
    fail "login.php no usa MockDataProvider"
fi

# Test 8: login.php usa getAllProfesores()
if grep -q 'getAllProfesores' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php usa getAllProfesores()"
else
    fail "login.php no usa getAllProfesores()"
fi

# Test 9: login.php usa getAllAlumnos()
if grep -q 'getAllAlumnos' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php usa getAllAlumnos()"
else
    fail "login.php no usa getAllAlumnos()"
fi

# Test 10: login.php usa dev_save_auth_token
if grep -q 'dev_save_auth_token' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php usa dev_save_auth_token()"
else
    fail "login.php no usa dev_save_auth_token()"
fi

# Test 11: login.php verifica sesion activa y redirige
if grep -q 'dev_is_logged_in' "$DEV_SIM/login.php" 2>/dev/null; then
    pass "login.php verifica sesion activa"
else
    fail "login.php no verifica sesion activa"
fi

# =============================================================================
header "Verificando Contenido de logout.php"
# =============================================================================

# Test 12: logout.php usa dev_auth_logout
if grep -q 'dev_auth_logout' "$DEV_SIM/logout.php" 2>/dev/null; then
    pass "logout.php usa dev_auth_logout()"
else
    fail "logout.php no usa dev_auth_logout()"
fi

# Test 13: logout.php redirige a index
if grep -q 'Location.*index' "$DEV_SIM/logout.php" 2>/dev/null; then
    pass "logout.php redirige a index"
else
    fail "logout.php no redirige a index"
fi

# Test 14: logout.php pasa parametro logout=1
if grep -q 'logout=1' "$DEV_SIM/logout.php" 2>/dev/null; then
    pass "logout.php pasa parametro logout=1"
else
    fail "logout.php no pasa parametro logout=1"
fi

# =============================================================================
header "Verificando Actualizaciones a index.php"
# =============================================================================

# Test 15: index.php tiene enlace a login
if grep -q 'login.php' "$DEV_SIM/index.php" 2>/dev/null; then
    pass "index.php tiene enlace a login"
else
    fail "index.php no tiene enlace a login"
fi

# Test 16: index.php tiene enlace a logout
if grep -q 'logout.php' "$DEV_SIM/index.php" 2>/dev/null; then
    pass "index.php tiene enlace a logout"
else
    fail "index.php no tiene enlace a logout"
fi

# Test 17: index.php muestra mensaje de logout exitoso
if grep -q 'logoutSuccess' "$DEV_SIM/index.php" 2>/dev/null || grep -q '\$_GET\[.logout.\]' "$DEV_SIM/index.php" 2>/dev/null; then
    pass "index.php maneja mensaje de logout"
else
    fail "index.php no maneja mensaje de logout"
fi

# =============================================================================
header "Verificando functions.php tiene stubs necesarios"
# =============================================================================

# Test 18: functions.php tiene dev_save_auth_token
if grep -q 'function dev_save_auth_token' "$DEV_SIM/functions.php" 2>/dev/null; then
    pass "functions.php tiene dev_save_auth_token()"
else
    fail "functions.php no tiene dev_save_auth_token()"
fi

# Test 19: functions.php guarda nombre en sesion
if grep -q 'nombre_completo' "$DEV_SIM/functions.php" 2>/dev/null; then
    pass "functions.php guarda nombre en sesion"
else
    fail "functions.php no guarda nombre en sesion"
fi

# Test 20: functions.php tiene dev_auth_logout
if grep -q 'function dev_auth_logout' "$DEV_SIM/functions.php" 2>/dev/null; then
    pass "functions.php tiene dev_auth_logout()"
else
    fail "functions.php no tiene dev_auth_logout()"
fi

# Test 21: dev_auth_logout destruye sesion
if grep -q 'session_destroy' "$DEV_SIM/functions.php" 2>/dev/null; then
    pass "dev_auth_logout() destruye sesion"
else
    fail "dev_auth_logout() no destruye sesion"
fi

# =============================================================================
header "Verificando MockDataProvider tiene metodos necesarios"
# =============================================================================

# Test 22: MockDataProvider tiene getAllProfesores
if grep -q 'function getAllProfesores' "$DEV_SIM/MockDataProvider.php" 2>/dev/null; then
    pass "MockDataProvider tiene getAllProfesores()"
else
    fail "MockDataProvider no tiene getAllProfesores()"
fi

# Test 23: MockDataProvider tiene getAllAlumnos
if grep -q 'function getAllAlumnos' "$DEV_SIM/MockDataProvider.php" 2>/dev/null; then
    pass "MockDataProvider tiene getAllAlumnos()"
else
    fail "MockDataProvider no tiene getAllAlumnos()"
fi

# Test 24: MockDataProvider tiene getProfesorById
if grep -q 'function getProfesorById' "$DEV_SIM/MockDataProvider.php" 2>/dev/null; then
    pass "MockDataProvider tiene getProfesorById()"
else
    fail "MockDataProvider no tiene getProfesorById()"
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
    echo -e "${GREEN}Fase 12.2: Login Simulado - COMPLETADA${NC}"
    exit 0
else
    echo -e "${RED}Fase 12.2: Hay tests fallidos${NC}"
    exit 1
fi
