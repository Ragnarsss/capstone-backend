#!/bin/bash
# =============================================================================
# Test Suite: Fase 12.4 - JWT y postMessage
# =============================================================================
# Verifica que los modals y el endpoint de token funcionan correctamente
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
header "Verificando Estructura de Archivos JWT/postMessage"
# =============================================================================

DEV_SIM="$PROJECT_ROOT/php-service/src/dev-simulator"

# Test 1: api/token.php existe
if [ -f "$DEV_SIM/api/token.php" ]; then
    pass "api/token.php existe"
else
    fail "api/token.php no existe"
fi

# Test 2: modal-host.php existe
if [ -f "$DEV_SIM/modal-host.php" ]; then
    pass "modal-host.php existe"
else
    fail "modal-host.php no existe"
fi

# Test 3: modal-reader.php existe
if [ -f "$DEV_SIM/modal-reader.php" ]; then
    pass "modal-reader.php existe"
else
    fail "modal-reader.php no existe"
fi

# =============================================================================
header "Verificando Contenido de api/token.php"
# =============================================================================

# Test 4: token.php usa biblioteca JWT de producción
if grep -q "asistencia-node-integration/lib/crypto/JWT.php" "$DEV_SIM/api/token.php" 2>/dev/null; then
    pass "token.php usa biblioteca JWT de produccion"
else
    fail "token.php no usa biblioteca JWT de produccion"
fi

# Test 5: token.php usa Config de producción
if grep -q "asistencia-node-integration/config/Config.php" "$DEV_SIM/api/token.php" 2>/dev/null; then
    pass "token.php usa Config de produccion"
else
    fail "token.php no usa Config de produccion"
fi

# Test 6: token.php verifica autenticación
if grep -q "dev_is_logged_in" "$DEV_SIM/api/token.php" 2>/dev/null; then
    pass "token.php verifica autenticacion"
else
    fail "token.php no verifica autenticacion"
fi

# Test 7: token.php genera JWT con encode()
if grep -q "jwtLibrary->encode" "$DEV_SIM/api/token.php" 2>/dev/null; then
    pass "token.php genera JWT con encode()"
else
    fail "token.php no genera JWT con encode()"
fi

# Test 8: token.php retorna formato success/token
if grep -q "'success' => true" "$DEV_SIM/api/token.php" 2>/dev/null && \
   grep -q "'token' =>" "$DEV_SIM/api/token.php" 2>/dev/null; then
    pass "token.php retorna formato success/token"
else
    fail "token.php no retorna formato correcto"
fi

# Test 9: token.php incluye payload con userId, username, rol
if grep -q "'userId'" "$DEV_SIM/api/token.php" 2>/dev/null && \
   grep -q "'username'" "$DEV_SIM/api/token.php" 2>/dev/null && \
   grep -q "'rol'" "$DEV_SIM/api/token.php" 2>/dev/null; then
    pass "token.php incluye userId, username, rol en payload"
else
    fail "token.php no incluye datos completos en payload"
fi

# =============================================================================
header "Verificando Contenido de modal-host.php"
# =============================================================================

# Test 10: modal-host.php verifica autenticación
if grep -q "dev_is_logged_in" "$DEV_SIM/modal-host.php" 2>/dev/null; then
    pass "modal-host.php verifica autenticacion"
else
    fail "modal-host.php no verifica autenticacion"
fi

# Test 11: modal-host.php verifica permisos de profesor
if grep -q "can_control_asistencia" "$DEV_SIM/modal-host.php" 2>/dev/null; then
    pass "modal-host.php verifica permisos de profesor"
else
    fail "modal-host.php no verifica permisos de profesor"
fi

# Test 12: modal-host.php hace fetch a api/token.php del dev-simulator
if grep -q "/dev-simulator/api/token.php" "$DEV_SIM/modal-host.php" 2>/dev/null; then
    pass "modal-host.php hace fetch a /dev-simulator/api/token.php"
else
    fail "modal-host.php no hace fetch al endpoint correcto"
fi

# Test 13: modal-host.php carga iframe con /asistencia/host/
if grep -q "/asistencia/host/" "$DEV_SIM/modal-host.php" 2>/dev/null; then
    pass "modal-host.php carga iframe con /asistencia/host/"
else
    fail "modal-host.php no carga iframe correcto"
fi

# Test 14: modal-host.php usa postMessage con AUTH_TOKEN
if grep -q "postMessage" "$DEV_SIM/modal-host.php" 2>/dev/null && \
   grep -q "AUTH_TOKEN" "$DEV_SIM/modal-host.php" 2>/dev/null; then
    pass "modal-host.php usa postMessage con AUTH_TOKEN"
else
    fail "modal-host.php no usa postMessage correctamente"
fi

# Test 15: modal-host.php escucha mensajes del iframe
if grep -q "addEventListener.*message" "$DEV_SIM/modal-host.php" 2>/dev/null; then
    pass "modal-host.php escucha mensajes del iframe"
else
    fail "modal-host.php no escucha mensajes del iframe"
fi

# =============================================================================
header "Verificando Contenido de modal-reader.php"
# =============================================================================

# Test 16: modal-reader.php verifica autenticación
if grep -q "dev_is_logged_in" "$DEV_SIM/modal-reader.php" 2>/dev/null; then
    pass "modal-reader.php verifica autenticacion"
else
    fail "modal-reader.php no verifica autenticacion"
fi

# Test 17: modal-reader.php hace fetch a api/token.php del dev-simulator
if grep -q "/dev-simulator/api/token.php" "$DEV_SIM/modal-reader.php" 2>/dev/null; then
    pass "modal-reader.php hace fetch a /dev-simulator/api/token.php"
else
    fail "modal-reader.php no hace fetch al endpoint correcto"
fi

# Test 18: modal-reader.php carga iframe con /asistencia/reader/
if grep -q "/asistencia/reader/" "$DEV_SIM/modal-reader.php" 2>/dev/null; then
    pass "modal-reader.php carga iframe con /asistencia/reader/"
else
    fail "modal-reader.php no carga iframe correcto"
fi

# Test 19: modal-reader.php usa postMessage con AUTH_TOKEN
if grep -q "postMessage" "$DEV_SIM/modal-reader.php" 2>/dev/null && \
   grep -q "AUTH_TOKEN" "$DEV_SIM/modal-reader.php" 2>/dev/null; then
    pass "modal-reader.php usa postMessage con AUTH_TOKEN"
else
    fail "modal-reader.php no usa postMessage correctamente"
fi

# Test 20: modal-reader.php escucha attendance-completed
if grep -q "attendance-completed" "$DEV_SIM/modal-reader.php" 2>/dev/null; then
    pass "modal-reader.php escucha mensaje attendance-completed"
else
    fail "modal-reader.php no escucha attendance-completed"
fi

# Test 21: modal-reader.php maneja datos de encuesta (studentId, sessionId)
if grep -q "studentId" "$DEV_SIM/modal-reader.php" 2>/dev/null && \
   grep -q "sessionId" "$DEV_SIM/modal-reader.php" 2>/dev/null; then
    pass "modal-reader.php maneja datos de encuesta"
else
    fail "modal-reader.php no maneja datos de encuesta"
fi

# =============================================================================
header "Verificando Integracion con Dashboards"
# =============================================================================

# Test 22: profesor-dashboard enlaza a modal-host.php (sin target="_blank" para dev)
if grep -q 'href="modal-host.php' "$DEV_SIM/profesor-dashboard.php" 2>/dev/null; then
    pass "profesor-dashboard enlaza a modal-host.php"
else
    fail "profesor-dashboard no enlaza a modal-host.php"
fi

# Test 23: alumno-dashboard enlaza a modal-reader.php (sin target="_blank" para dev)
if grep -q 'href="modal-reader.php' "$DEV_SIM/alumno-dashboard.php" 2>/dev/null; then
    pass "alumno-dashboard enlaza a modal-reader.php"
else
    fail "alumno-dashboard no enlaza a modal-reader.php"
fi

# =============================================================================
header "Verificando Consistencia con Produccion"
# =============================================================================

PROD_VIEWS="$PROJECT_ROOT/php-service/src/asistencia-node-integration/presentation/views"

# Test 24: Formato de postMessage igual que producción
PROD_MSG=$(grep -o "type: 'AUTH_TOKEN'" "$PROD_VIEWS/modal-host.php" 2>/dev/null || echo "")
DEV_MSG=$(grep -o "type: 'AUTH_TOKEN'" "$DEV_SIM/modal-host.php" 2>/dev/null || echo "")
if [ -n "$PROD_MSG" ] && [ "$PROD_MSG" = "$DEV_MSG" ]; then
    pass "Formato postMessage consistente con produccion"
else
    fail "Formato postMessage difiere de produccion"
fi

# Test 25: Mismo iframe src que producción (/asistencia/host/)
PROD_SRC=$(grep -o "iframe.src = '/asistencia/host/'" "$PROD_VIEWS/modal-host.php" 2>/dev/null || echo "")
DEV_SRC=$(grep -o "iframe.src = '/asistencia/host/'" "$DEV_SIM/modal-host.php" 2>/dev/null || echo "")
if [ -n "$PROD_SRC" ] && [ "$PROD_SRC" = "$DEV_SRC" ]; then
    pass "Iframe src consistente con produccion"
else
    fail "Iframe src difiere de produccion"
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
    echo -e "${GREEN}Fase 12.4: JWT y postMessage - COMPLETADA${NC}"
    exit 0
else
    echo -e "${RED}Fase 12.4: Hay tests fallidos${NC}"
    exit 1
fi
