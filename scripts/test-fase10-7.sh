#!/bin/bash
# ============================================================================
# test-fase10-7.sh - Tests para Fase 10.7: Cleanup y Documentación
# ============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase10-7.sh
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

echo "=============================================="
echo "  Fase 10.7: Cleanup y Documentacion"
echo "=============================================="
echo ""

# ============================================================================
# Tests de Deprecación - ACTUALIZADO: FakeQRGenerator ya eliminado (Fase 11-9)
# ============================================================================
echo "--- Tests de Cleanup FakeQRGenerator ---"

# Test 1: FakeQRGenerator ya NO existe (fue eliminado en Fase 11-9)
FAKE_GEN="${BASE_PATH}/backend/attendance/application/fake-qr-generator.ts"
echo "Test 1: FakeQRGenerator fue eliminado..."
if [ ! -f "$FAKE_GEN" ]; then
    pass "FakeQRGenerator eliminado correctamente"
else
    fail "FakeQRGenerator aun existe (debe eliminarse)"
fi

# Test 2: attendance/application/index.ts NO exporta FakeQRGenerator
echo "Test 2: index.ts no exporta FakeQRGenerator..."
INDEX_FILE="${BASE_PATH}/backend/attendance/application/index.ts"
if grep -q "FakeQRGenerator" "$INDEX_FILE" 2>/dev/null; then
    fail "index.ts aun exporta FakeQRGenerator"
else
    pass "index.ts no exporta FakeQRGenerator"
fi

# ============================================================================
# Tests de ParticipationService
# ============================================================================
echo ""
echo "--- Tests de ParticipationService ---"

PARTICIPATION="${BASE_PATH}/backend/attendance/application/participation.service.ts"

# Test 3: ParticipationService usa PoolBalancer
echo "Test 3: ParticipationService importa PoolBalancer..."
if grep -q "import.*PoolBalancer" "$PARTICIPATION" 2>/dev/null; then
    pass "ParticipationService importa PoolBalancer"
else
    fail "ParticipationService no importa PoolBalancer"
fi

# Test 4: ParticipationService NO importa FakeQRGenerator
echo "Test 4: ParticipationService no importa FakeQRGenerator..."
if grep -q "import.*FakeQRGenerator" "$PARTICIPATION" 2>/dev/null; then
    fail "ParticipationService aun importa FakeQRGenerator"
else
    pass "ParticipationService no importa FakeQRGenerator"
fi

# Test 5: ParticipationService tiene poolBalancer field
echo "Test 5: ParticipationService tiene field poolBalancer..."
if grep -q "poolBalancer:" "$PARTICIPATION" 2>/dev/null; then
    pass "ParticipationService tiene poolBalancer"
else
    fail "ParticipationService no tiene poolBalancer"
fi

# ============================================================================
# Tests de ARCHITECTURE.md
# ============================================================================
echo ""
echo "--- Tests de ARCHITECTURE.md ---"

ARCH_FILE="${PWD}/node-service/ARCHITECTURE.md"
if [ ! -f "$ARCH_FILE" ]; then
    ARCH_FILE="/app/ARCHITECTURE.md"
fi

# Test 6: ARCHITECTURE.md documenta PayloadBuilder
echo "Test 6: ARCHITECTURE.md documenta PayloadBuilder..."
if grep -q "PayloadBuilder" "$ARCH_FILE" 2>/dev/null; then
    pass "ARCHITECTURE.md documenta PayloadBuilder"
else
    fail "ARCHITECTURE.md no documenta PayloadBuilder"
fi

# Test 7: ARCHITECTURE.md documenta PoolFeeder
echo "Test 7: ARCHITECTURE.md documenta PoolFeeder..."
if grep -q "PoolFeeder" "$ARCH_FILE" 2>/dev/null; then
    pass "ARCHITECTURE.md documenta PoolFeeder"
else
    fail "ARCHITECTURE.md no documenta PoolFeeder"
fi

# Test 8: ARCHITECTURE.md documenta PoolBalancer
echo "Test 8: ARCHITECTURE.md documenta PoolBalancer..."
if grep -q "PoolBalancer" "$ARCH_FILE" 2>/dev/null; then
    pass "ARCHITECTURE.md documenta PoolBalancer"
else
    fail "ARCHITECTURE.md no documenta PoolBalancer"
fi

# Test 9: ARCHITECTURE.md documenta QREmitter
echo "Test 9: ARCHITECTURE.md documenta QREmitter..."
if grep -q "QREmitter" "$ARCH_FILE" 2>/dev/null; then
    pass "ARCHITECTURE.md documenta QREmitter"
else
    fail "ARCHITECTURE.md no documenta QREmitter"
fi

# Test 10: ARCHITECTURE.md documenta shared/infrastructure/valkey
echo "Test 10: ARCHITECTURE.md documenta valkey compartido..."
if grep -q "shared/infrastructure/valkey" "$ARCH_FILE" 2>/dev/null; then
    pass "ARCHITECTURE.md documenta valkey compartido"
else
    fail "ARCHITECTURE.md no documenta valkey compartido"
fi

# ============================================================================
# Tests de Integracion - Todos los servicios existen
# ============================================================================
echo ""
echo "--- Tests de Integracion ---"

# Test 11: PayloadBuilder existe
echo "Test 11: PayloadBuilder existe..."
if [ -f "${BASE_PATH}/backend/qr-projection/domain/services/payload-builder.service.ts" ]; then
    pass "PayloadBuilder existe"
else
    fail "PayloadBuilder no encontrado"
fi

# Test 12: PoolFeeder existe
echo "Test 12: PoolFeeder existe..."
if [ -f "${BASE_PATH}/backend/qr-projection/application/services/pool-feeder.service.ts" ]; then
    pass "PoolFeeder existe"
else
    fail "PoolFeeder no encontrado"
fi

# Test 13: PoolBalancer existe
echo "Test 13: PoolBalancer existe..."
if [ -f "${BASE_PATH}/backend/qr-projection/application/services/pool-balancer.service.ts" ]; then
    pass "PoolBalancer existe"
else
    fail "PoolBalancer no encontrado"
fi

# Test 14: QREmitter existe
echo "Test 14: QREmitter existe..."
if [ -f "${BASE_PATH}/backend/qr-projection/application/services/qr-emitter.service.ts" ]; then
    pass "QREmitter existe"
else
    fail "QREmitter no encontrado"
fi

# Test 15: ProjectionPoolRepository en shared
echo "Test 15: ProjectionPoolRepository en shared..."
if [ -f "${BASE_PATH}/shared/infrastructure/valkey/projection-pool.repository.ts" ]; then
    pass "ProjectionPoolRepository en shared"
else
    fail "ProjectionPoolRepository no en shared"
fi

# Test 16: ActiveSessionRepository en shared
echo "Test 16: ActiveSessionRepository en shared..."
if [ -f "${BASE_PATH}/shared/infrastructure/valkey/active-session.repository.ts" ]; then
    pass "ActiveSessionRepository en shared"
else
    fail "ActiveSessionRepository no en shared"
fi

# ============================================================================
# Test de Compilación
# ============================================================================
echo ""
echo "--- Test de Compilacion ---"

# Test 17: TypeScript compila sin errores
echo "Test 17: Verificando compilación TypeScript..."
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
echo "  RESUMEN - Fase 10.7 (Cleanup)"
echo "=============================================="
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Todos los tests pasaron${NC}"
    echo ""
    echo "Fase 10 COMPLETADA:"
    echo "  - PayloadBuilder (domain service)"
    echo "  - PoolFeeder (application service)"
    echo "  - PoolBalancer (application service)"
    echo "  - QREmitter (application service)"
    echo "  - QRProjectionService refactorizado"
    echo "  - Repos compartidos en shared/infrastructure/valkey"
    echo "  - FakeQRGenerator ELIMINADO (Fase 11-9)"
    echo "  - ParticipationService usa PoolBalancer"
    echo "  - ARCHITECTURE.md actualizado"
    exit 0
else
    echo -e "${RED}✗ Algunos tests fallaron${NC}"
    exit 1
fi
