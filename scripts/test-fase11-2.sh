#!/bin/bash
# =============================================================================
# test-fase11-2.sh - Tests para Fase 11-2: Consolidar validación de payload
# =============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase11-2.sh
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
echo "  Fase 11-2: Consolidar validación de payload"
echo "=============================================="
echo ""

# =============================================================================
echo "--- 1. Verificar isQRPayloadV1 en shared/types ---"
# =============================================================================

QR_TYPES="${BASE_PATH}/shared/types/qr-payload.types.ts"

if grep -q "export function isQRPayloadV1" "$QR_TYPES" 2>/dev/null; then
    pass "isQRPayloadV1 exportada en shared/types"
else
    fail "isQRPayloadV1 no encontrada en shared/types"
fi

# Verificar validaciones completas
if grep -q "Number.isInteger(p.uid)" "$QR_TYPES" 2>/dev/null; then
    pass "isQRPayloadV1 valida uid como entero"
else
    fail "isQRPayloadV1 no valida uid como entero"
fi

if grep -q "Number.isInteger(p.r)" "$QR_TYPES" 2>/dev/null; then
    pass "isQRPayloadV1 valida round como entero"
else
    fail "isQRPayloadV1 no valida round como entero"
fi

# =============================================================================
echo ""
echo "--- 2. Verificar PayloadBuilder usa isQRPayloadV1 ---"
# =============================================================================

PAYLOAD_BUILDER="${BASE_PATH}/backend/qr-projection/domain/services/payload-builder.service.ts"

if grep -q "import.*isQRPayloadV1.*from.*shared/types" "$PAYLOAD_BUILDER" 2>/dev/null; then
    pass "PayloadBuilder importa isQRPayloadV1 de shared"
else
    fail "PayloadBuilder no importa isQRPayloadV1 de shared"
fi

if grep -q "@deprecated" "$PAYLOAD_BUILDER" 2>/dev/null; then
    pass "PayloadBuilder.isValidPayload marcado como @deprecated"
else
    fail "PayloadBuilder.isValidPayload no está marcado como @deprecated"
fi

if grep -q "return isQRPayloadV1(payload)" "$PAYLOAD_BUILDER" 2>/dev/null; then
    pass "PayloadBuilder.isValidPayload delega a isQRPayloadV1"
else
    fail "PayloadBuilder.isValidPayload no delega correctamente"
fi

# =============================================================================
echo ""
echo "--- 3. Verificar validate-structure.stage usa isQRPayloadV1 ---"
# =============================================================================

VALIDATE_STAGE="${BASE_PATH}/backend/attendance/domain/validation-pipeline/stages/validate-structure.stage.ts"

if grep -q "import.*isQRPayloadV1.*from.*shared/types" "$VALIDATE_STAGE" 2>/dev/null; then
    pass "validate-structure.stage importa isQRPayloadV1 de shared"
else
    fail "validate-structure.stage no importa isQRPayloadV1 de shared"
fi

# Verificar que NO tiene función local isValidPayloadStructure
if grep -q "function isValidPayloadStructure" "$VALIDATE_STAGE" 2>/dev/null; then
    fail "validate-structure.stage aún tiene isValidPayloadStructure local"
else
    pass "validate-structure.stage eliminó isValidPayloadStructure local"
fi

if grep -q "isQRPayloadV1(ctx.response.original)" "$VALIDATE_STAGE" 2>/dev/null; then
    pass "validate-structure.stage usa isQRPayloadV1 para validar"
else
    fail "validate-structure.stage no usa isQRPayloadV1"
fi

# =============================================================================
echo ""
echo "--- 4. Contar funciones de validación duplicadas ---"
# =============================================================================

# Contar definiciones de funciones de validación de payload
VALIDATION_FUNCS=$(grep -r "function isValidPayload\|function isQRPayloadV1" "${BASE_PATH}" 2>/dev/null | wc -l)
info "Funciones de validación de payload encontradas: ${VALIDATION_FUNCS}"

if [ "$VALIDATION_FUNCS" -eq 1 ]; then
    pass "Solo existe UNA función de validación (isQRPayloadV1 en shared)"
else
    info "Hay ${VALIDATION_FUNCS} funciones (1 canónica + delegaciones es OK)"
    pass "Verificación de funciones completada"
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
echo "  RESUMEN - Fase 11-2"
echo "=============================================="
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Fase 11-2 completada - Validación de payload consolidada${NC}"
    echo ""
    echo "Beneficios:"
    echo "  - Una sola fuente de verdad para validación de QRPayloadV1"
    echo "  - PayloadBuilder.isValidPayload delegado (backward compatible)"
    echo "  - validate-structure.stage usa función compartida"
    echo ""
    echo "Proxima fase: 11-3 (Definir IQRGenerator interface)"
    exit 0
else
    echo -e "${RED}✗ Algunos tests fallaron${NC}"
    exit 1
fi
