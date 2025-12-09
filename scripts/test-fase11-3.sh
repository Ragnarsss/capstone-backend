#!/bin/bash
# =============================================================================
# test-fase11-3.sh - Tests para Fase 11-3: Definir IQRGenerator interface
# =============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase11-3.sh
# =============================================================================

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
    NODE_DIR="/app"
else
    BASE_PATH="${PWD}/node-service/src"
    NODE_DIR="${PWD}/node-service"
fi

echo "=============================================="
echo "  Fase 11-3: Definir IQRGenerator interface"
echo "=============================================="
echo ""

# =============================================================================
echo "--- 1. Verificar shared/ports existe ---"
# =============================================================================

PORTS_DIR="${BASE_PATH}/shared/ports"
PORTS_INDEX="${PORTS_DIR}/index.ts"
QR_PORT="${PORTS_DIR}/qr-generator.port.ts"

if [ -d "$PORTS_DIR" ]; then
    pass "shared/ports/ directorio existe"
else
    fail "shared/ports/ directorio no existe"
fi

if [ -f "$PORTS_INDEX" ]; then
    pass "shared/ports/index.ts existe"
else
    fail "shared/ports/index.ts no existe"
fi

if [ -f "$QR_PORT" ]; then
    pass "qr-generator.port.ts existe"
else
    fail "qr-generator.port.ts no existe"
fi

# =============================================================================
echo ""
echo "--- 2. Verificar IQRGenerator interface ---"
# =============================================================================

if grep -q "export interface IQRGenerator" "$QR_PORT" 2>/dev/null; then
    pass "IQRGenerator interface exportada"
else
    fail "IQRGenerator interface no encontrada"
fi

if grep -q "generateForStudent" "$QR_PORT" 2>/dev/null; then
    pass "IQRGenerator tiene método generateForStudent"
else
    fail "IQRGenerator no tiene método generateForStudent"
fi

if grep -q "generateNonce" "$QR_PORT" 2>/dev/null; then
    pass "IQRGenerator tiene método generateNonce"
else
    fail "IQRGenerator no tiene método generateNonce"
fi

if grep -q "encryptPayloadWithRandomKey" "$QR_PORT" 2>/dev/null; then
    pass "IQRGenerator tiene método encryptPayloadWithRandomKey"
else
    fail "IQRGenerator no tiene método encryptPayloadWithRandomKey"
fi

# =============================================================================
echo ""
echo "--- 3. Verificar QRGenerator implementa IQRGenerator ---"
# =============================================================================

QR_GEN="${BASE_PATH}/backend/qr-projection/domain/qr-generator.ts"

if grep -q "implements IQRGenerator" "$QR_GEN" 2>/dev/null; then
    pass "QRGenerator implementa IQRGenerator"
else
    fail "QRGenerator no implementa IQRGenerator"
fi

if grep -q "import.*IQRGenerator.*from.*shared/ports" "$QR_GEN" 2>/dev/null; then
    pass "QRGenerator importa IQRGenerator de shared/ports"
else
    fail "QRGenerator no importa IQRGenerator de shared/ports"
fi

# =============================================================================
echo ""
echo "--- 4. Verificar attendance usa IQRGenerator ---"
# =============================================================================

PARTICIPATION="${BASE_PATH}/backend/attendance/application/participation.service.ts"

if grep -q "IQRGenerator" "$PARTICIPATION" 2>/dev/null; then
    pass "ParticipationService usa IQRGenerator"
else
    fail "ParticipationService no usa IQRGenerator"
fi

# FakeQRGenerator ya fue eliminado en Fase 11-9, ahora se usa PoolBalancer
FAKE_QR="${BASE_PATH}/backend/attendance/application/fake-qr-generator.ts"
if [ ! -f "$FAKE_QR" ]; then
    pass "FakeQRGenerator eliminado (migrado a PoolBalancer)"
else
    info "FakeQRGenerator existe (sera eliminado en Fase 11-9)"
fi

# =============================================================================
echo ""
echo "--- 5. Health Check ---"
# =============================================================================

if curl -sf "http://localhost:9503/health" > /dev/null 2>&1; then
    pass "GET /health responde (puerto 9503)"
elif curl -sf "http://localhost:3000/health" > /dev/null 2>&1; then
    pass "GET /health responde (puerto 3000)"
else
    fail "GET /health no responde"
fi

# =============================================================================
echo ""
echo "--- 6. Compilación TypeScript ---"
# =============================================================================

cd "$NODE_DIR" 2>/dev/null || true
if command -v npm &> /dev/null; then
    if npm run type-check 2>&1 | grep -q "error"; then
        fail "TypeScript tiene errores de compilación"
    else
        pass "TypeScript compila correctamente"
    fi
else
    info "npm no disponible, saltando verificación de TS"
fi

# =============================================================================
echo ""
echo "=============================================="
echo "  RESUMEN - Fase 11-3"
echo "=============================================="
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Fase 11-3 completada - IQRGenerator interface definida${NC}"
    echo ""
    echo "Beneficios:"
    echo "  - attendance depende de interface, no de implementación"
    echo "  - Fácil testing con mocks"
    echo "  - Preparación para microservicios"
    echo ""
    echo "Proxima fase: 11-4 (Definir IPoolBalancer interface)"
    exit 0
else
    echo -e "${RED}✗ Algunos tests fallaron${NC}"
    exit 1
fi
