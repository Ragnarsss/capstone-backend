#!/bin/bash
# ============================================================================
# test-fase10-5.sh - Tests para Fase 10.5: Refactor QRProjectionService
# ============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase10-5.sh
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
echo "  Fase 10.5: Refactor QRProjectionService"
echo "=============================================="
echo ""

# ============================================================================
# Tests de Estructura
# ============================================================================
echo "--- Tests de Estructura ---"

# Test 1: QRProjectionService existe
echo "Test 1: Verificando QRProjectionService..."
QR_PROJ_FILE="${BASE_PATH}/backend/qr-projection/application/qr-projection.service.ts"
if [ -f "$QR_PROJ_FILE" ]; then
    pass "QRProjectionService existe"
else
    fail "QRProjectionService no encontrado"
fi

# Test 2: QRProjectionService importa PoolBalancer
echo "Test 2: Verificando import de PoolBalancer..."
if grep -q "import.*PoolBalancer" "$QR_PROJ_FILE" 2>/dev/null; then
    pass "QRProjectionService importa PoolBalancer"
else
    fail "QRProjectionService no importa PoolBalancer"
fi

# Test 3: QRProjectionService importa QREmitter
echo "Test 3: Verificando import de QREmitter..."
if grep -q "import.*QREmitter" "$QR_PROJ_FILE" 2>/dev/null; then
    pass "QRProjectionService importa QREmitter"
else
    fail "QRProjectionService no importa QREmitter"
fi

# Test 4: QRProjectionService NO importa QRGenerator (ya no lo necesita)
echo "Test 4: Verificando que NO importa QRGenerator..."
if grep -q "import.*QRGenerator" "$QR_PROJ_FILE" 2>/dev/null; then
    fail "QRProjectionService aún importa QRGenerator (debe delegarse)"
else
    pass "QRProjectionService no importa QRGenerator"
fi

# Test 5: QRProjectionService NO importa QRMetadataRepository (ya no lo necesita)
echo "Test 5: Verificando que NO importa QRMetadataRepository..."
if grep -q "import.*QRMetadataRepository" "$QR_PROJ_FILE" 2>/dev/null; then
    fail "QRProjectionService aún importa QRMetadataRepository"
else
    pass "QRProjectionService no importa QRMetadataRepository"
fi

# Test 6: QRProjectionService NO importa ProjectionQueueRepository
echo "Test 6: Verificando que NO importa ProjectionQueueRepository..."
if grep -q "import.*ProjectionQueueRepository" "$QR_PROJ_FILE" 2>/dev/null; then
    fail "QRProjectionService aún importa ProjectionQueueRepository"
else
    pass "QRProjectionService no importa ProjectionQueueRepository"
fi

# ============================================================================
# Tests de Delegación
# ============================================================================
echo ""
echo "--- Tests de Delegacion ---"

# Test 7: Usa poolBalancer.balance()
echo "Test 7: Verificando uso de poolBalancer.balance()..."
if grep -q "poolBalancer.balance" "$QR_PROJ_FILE" 2>/dev/null; then
    pass "QRProjectionService delega a poolBalancer.balance()"
else
    fail "QRProjectionService no delega a poolBalancer.balance()"
fi

# Test 8: Usa qrEmitter.start()
echo "Test 8: Verificando uso de qrEmitter.start()..."
if grep -q "qrEmitter.start" "$QR_PROJ_FILE" 2>/dev/null; then
    pass "QRProjectionService delega a qrEmitter.start()"
else
    fail "QRProjectionService no delega a qrEmitter.start()"
fi

# Test 9: Usa qrEmitter.stop()
echo "Test 9: Verificando uso de qrEmitter.stop()..."
if grep -q "qrEmitter.stop" "$QR_PROJ_FILE" 2>/dev/null; then
    pass "QRProjectionService delega a qrEmitter.stop()"
else
    fail "QRProjectionService no delega a qrEmitter.stop()"
fi

# ============================================================================
# Tests de app.ts
# ============================================================================
echo ""
echo "--- Tests de app.ts ---"

APP_FILE="${BASE_PATH}/app.ts"

# Test 10: app.ts NO importa QRMetadataRepository
echo "Test 10: Verificando app.ts no importa QRMetadataRepository..."
if grep -q "import.*QRMetadataRepository" "$APP_FILE" 2>/dev/null; then
    fail "app.ts aún importa QRMetadataRepository"
else
    pass "app.ts no importa QRMetadataRepository"
fi

# Test 11: app.ts NO importa ProjectionQueueRepository
echo "Test 11: Verificando app.ts no importa ProjectionQueueRepository..."
if grep -q "import.*ProjectionQueueRepository" "$APP_FILE" 2>/dev/null; then
    fail "app.ts aún importa ProjectionQueueRepository"
else
    pass "app.ts no importa ProjectionQueueRepository"
fi

# Test 12: app.ts usa constructor simplificado
echo "Test 12: Verificando constructor simplificado..."
if grep -q "new QRProjectionService(config.qr)" "$APP_FILE" 2>/dev/null; then
    pass "app.ts usa constructor simplificado"
else
    fail "app.ts no usa constructor simplificado"
fi

# ============================================================================
# Tests de Compilación
# ============================================================================
echo ""
echo "--- Test de Compilacion ---"

# Test 13: TypeScript compila sin errores
echo "Test 13: Verificando compilación TypeScript..."
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
echo "  RESUMEN - Fase 10.5"
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
