#!/bin/bash
# ============================================================================
# test-fase10-6.sh - Tests para Fase 10.6: Mover Repos Compartidos
# ============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase10-6.sh
# ============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Contadores
PASSED=0
FAILED=0

# Funciones
pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Determinar path base
if [ -d "/app/src" ]; then
    BASE_PATH="/app/src"
else
    BASE_PATH="${PWD}/node-service/src"
fi

SHARED_VALKEY="${BASE_PATH}/shared/infrastructure/valkey"
ATTENDANCE_INFRA="${BASE_PATH}/backend/attendance/infrastructure"

echo "=============================================="
echo "  Fase 10.6: Mover Repos Compartidos"
echo "=============================================="
echo ""

# ============================================================================
# Tests de Ubicación de Archivos
# ============================================================================
echo "--- Tests de Ubicacion ---"

# Test 1: ProjectionPoolRepository en shared
echo "Test 1: ProjectionPoolRepository en shared/infrastructure/valkey..."
if [ -f "${SHARED_VALKEY}/projection-pool.repository.ts" ]; then
    pass "ProjectionPoolRepository en shared"
else
    fail "ProjectionPoolRepository no encontrado en shared"
fi

# Test 2: ActiveSessionRepository en shared
echo "Test 2: ActiveSessionRepository en shared/infrastructure/valkey..."
if [ -f "${SHARED_VALKEY}/active-session.repository.ts" ]; then
    pass "ActiveSessionRepository en shared"
else
    fail "ActiveSessionRepository no encontrado en shared"
fi

# Test 3: index.ts barrel export en shared
echo "Test 3: Barrel export en shared/infrastructure/valkey..."
if [ -f "${SHARED_VALKEY}/index.ts" ]; then
    pass "Barrel export existe"
else
    fail "Barrel export no encontrado"
fi

# Test 4: ProjectionPoolRepository NO en attendance
echo "Test 4: ProjectionPoolRepository NO en attendance/infrastructure..."
if [ -f "${ATTENDANCE_INFRA}/projection-pool.repository.ts" ]; then
    fail "ProjectionPoolRepository aun existe en attendance"
else
    pass "ProjectionPoolRepository eliminado de attendance"
fi

# Test 5: ActiveSessionRepository NO en attendance
echo "Test 5: ActiveSessionRepository NO en attendance/infrastructure..."
if [ -f "${ATTENDANCE_INFRA}/active-session.repository.ts" ]; then
    fail "ActiveSessionRepository aun existe en attendance"
else
    pass "ActiveSessionRepository eliminado de attendance"
fi

# ============================================================================
# Tests de Exports
# ============================================================================
echo ""
echo "--- Tests de Exports ---"

# Test 6: shared/valkey/index.ts exporta ProjectionPoolRepository
echo "Test 6: shared exporta ProjectionPoolRepository..."
if grep -q "ProjectionPoolRepository" "${SHARED_VALKEY}/index.ts" 2>/dev/null; then
    pass "shared exporta ProjectionPoolRepository"
else
    fail "shared no exporta ProjectionPoolRepository"
fi

# Test 7: shared/valkey/index.ts exporta ActiveSessionRepository
echo "Test 7: shared exporta ActiveSessionRepository..."
if grep -q "ActiveSessionRepository" "${SHARED_VALKEY}/index.ts" 2>/dev/null; then
    pass "shared exporta ActiveSessionRepository"
else
    fail "shared no exporta ActiveSessionRepository"
fi

# Test 8: shared/valkey/index.ts exporta PoolEntry type
echo "Test 8: shared exporta type PoolEntry..."
if grep -q "type PoolEntry" "${SHARED_VALKEY}/index.ts" 2>/dev/null; then
    pass "shared exporta type PoolEntry"
else
    fail "shared no exporta type PoolEntry"
fi

# ============================================================================
# Tests de Imports Actualizados
# ============================================================================
echo ""
echo "--- Tests de Imports ---"

# Test 9: qr-projection usa import de shared
echo "Test 9: qr-projection/pool-balancer importa de shared..."
BALANCER_FILE="${BASE_PATH}/backend/qr-projection/application/services/pool-balancer.service.ts"
if grep -q "from.*shared/infrastructure/valkey" "$BALANCER_FILE" 2>/dev/null; then
    pass "pool-balancer importa de shared"
else
    fail "pool-balancer no importa de shared"
fi

# Test 10: qr-projection/qr-emitter usa import de shared
echo "Test 10: qr-projection/qr-emitter importa de shared..."
EMITTER_FILE="${BASE_PATH}/backend/qr-projection/application/services/qr-emitter.service.ts"
if grep -q "from.*shared/infrastructure/valkey" "$EMITTER_FILE" 2>/dev/null; then
    pass "qr-emitter importa de shared"
else
    fail "qr-emitter no importa de shared"
fi

# Test 11: websocket-controller usa import de shared
echo "Test 11: websocket-controller importa de shared..."
WS_FILE="${BASE_PATH}/backend/qr-projection/presentation/websocket-controller.ts"
if grep -q "from.*shared/infrastructure/valkey" "$WS_FILE" 2>/dev/null; then
    pass "websocket-controller importa de shared"
else
    fail "websocket-controller no importa de shared"
fi

# Test 12: attendance/routes usa import de shared
echo "Test 12: attendance/routes importa de shared..."
ROUTES_FILE="${BASE_PATH}/backend/attendance/presentation/routes.ts"
if grep -q "from.*shared/infrastructure/valkey" "$ROUTES_FILE" 2>/dev/null; then
    pass "attendance/routes importa de shared"
else
    fail "attendance/routes no importa de shared"
fi

# Test 13: attendance/infrastructure/index re-exporta de shared
echo "Test 13: attendance/infrastructure/index re-exporta de shared..."
INDEX_FILE="${ATTENDANCE_INFRA}/index.ts"
if grep -q "from.*shared/infrastructure/valkey" "$INDEX_FILE" 2>/dev/null; then
    pass "attendance/infrastructure re-exporta de shared"
else
    fail "attendance/infrastructure no re-exporta de shared"
fi

# ============================================================================
# Tests de Compilación
# ============================================================================
echo ""
echo "--- Test de Compilacion ---"

# Test 14: TypeScript compila sin errores
echo "Test 14: Verificando compilación TypeScript..."
cd /app 2>/dev/null || cd node-service 2>/dev/null || true
if npm run type-check 2>&1 | grep -q "error"; then
    fail "TypeScript tiene errores de compilación"
else
    pass "TypeScript compila correctamente"
fi

# ============================================================================
# Resumen
# ============================================================================
echo ""
echo "=============================================="
echo "  RESUMEN - Fase 10.6"
echo "=============================================="
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Todos los tests pasaron${NC}"
    exit 0
else
    echo -e "${RED}✗ Algunos tests fallaron${NC}"
    exit 1
fi
