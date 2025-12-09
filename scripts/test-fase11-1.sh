#!/bin/bash
# =============================================================================
# test-fase11-1.sh - Tests para Fase 11-1: Extraer QRPayloadV1 a shared/types
# =============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase11-1.sh
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
echo "  Fase 11-1: Extraer QRPayloadV1 a shared"
echo "=============================================="
echo ""

# =============================================================================
echo "--- 1. Verificar archivo shared/types/qr-payload.types.ts ---"
# =============================================================================

QR_TYPES="${BASE_PATH}/shared/types/qr-payload.types.ts"

if [ -f "$QR_TYPES" ]; then
    pass "qr-payload.types.ts existe"
else
    fail "qr-payload.types.ts no existe"
fi

# Verificar exports
if grep -q "export interface QRPayloadV1" "$QR_TYPES" 2>/dev/null; then
    pass "QRPayloadV1 interface exportada"
else
    fail "QRPayloadV1 interface no exportada"
fi

if grep -q "export function isQRPayloadV1" "$QR_TYPES" 2>/dev/null; then
    pass "isQRPayloadV1 type guard exportado"
else
    fail "isQRPayloadV1 type guard no exportado"
fi

if grep -q "export const PAYLOAD_VERSION" "$QR_TYPES" 2>/dev/null; then
    pass "PAYLOAD_VERSION constante exportada"
else
    fail "PAYLOAD_VERSION constante no exportada"
fi

# =============================================================================
echo ""
echo "--- 2. Verificar re-export en shared/types/index.ts ---"
# =============================================================================

SHARED_INDEX="${BASE_PATH}/shared/types/index.ts"

if grep -q "QRPayloadV1" "$SHARED_INDEX" 2>/dev/null; then
    pass "QRPayloadV1 re-exportado en index.ts"
else
    fail "QRPayloadV1 no re-exportado en index.ts"
fi

if grep -q "isQRPayloadV1" "$SHARED_INDEX" 2>/dev/null; then
    pass "isQRPayloadV1 re-exportado en index.ts"
else
    fail "isQRPayloadV1 no re-exportado en index.ts"
fi

# =============================================================================
echo ""
echo "--- 3. Verificar qr-projection re-exporta desde shared ---"
# =============================================================================

QR_MODELS="${BASE_PATH}/backend/qr-projection/domain/models.ts"

if grep -q "export.*QRPayloadV1.*from.*shared/types" "$QR_MODELS" 2>/dev/null; then
    pass "qr-projection re-exporta QRPayloadV1 desde shared"
else
    fail "qr-projection no re-exporta desde shared"
fi

# Verificar que NO tiene definición local
if grep -q "^export interface QRPayloadV1" "$QR_MODELS" 2>/dev/null; then
    fail "qr-projection aún tiene definición local de QRPayloadV1"
else
    pass "qr-projection no tiene definición local duplicada"
fi

# =============================================================================
echo ""
echo "--- 4. Verificar attendance importa desde shared ---"
# =============================================================================

# Contar imports desde shared/types
SHARED_IMPORTS=$(grep -r "from.*shared/types.*QRPayloadV1\|QRPayloadV1.*from.*shared/types" "${BASE_PATH}/backend/attendance/" 2>/dev/null | wc -l)

# Contar imports desde qr-projection (debería ser 0)
OLD_IMPORTS=$(grep -r "from.*qr-projection.*QRPayloadV1\|QRPayloadV1.*from.*qr-projection" "${BASE_PATH}/backend/attendance/" 2>/dev/null | wc -l)

info "Imports de QRPayloadV1 desde shared/types: ${SHARED_IMPORTS}"
info "Imports de QRPayloadV1 desde qr-projection: ${OLD_IMPORTS}"

if [ "$OLD_IMPORTS" -eq 0 ]; then
    pass "attendance no importa QRPayloadV1 desde qr-projection"
else
    fail "attendance aún importa QRPayloadV1 desde qr-projection ($OLD_IMPORTS)"
fi

if [ "$SHARED_IMPORTS" -gt 0 ]; then
    pass "attendance importa QRPayloadV1 desde shared/types"
else
    fail "attendance no importa QRPayloadV1 desde shared/types"
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
echo "  RESUMEN - Fase 11-1"
echo "=============================================="
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Fase 11-1 completada - QRPayloadV1 extraído a shared/types${NC}"
    echo ""
    echo "Proxima fase: 11-2 (Extraer isValidPayloadStructure a shared)"
    exit 0
else
    echo -e "${RED}✗ Algunos tests fallaron${NC}"
    exit 1
fi
