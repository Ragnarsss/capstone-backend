#!/bin/bash
# =============================================================================
# test-fase11-0.sh - Tests para Fase 11-0: Auditoria de Acoplamientos
# =============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase11-0.sh
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Determinar path base (contenedor vs host)
if [ -d "/app/src" ]; then
    BASE_PATH="/app/src"
    NODE_DIR="/app"
else
    BASE_PATH="${PWD}/node-service/src"
    NODE_DIR="${PWD}/node-service"
fi

echo "=============================================="
echo "  Fase 11-0: Auditoria de Acoplamientos"
echo "=============================================="
echo ""
info "Base path: ${BASE_PATH}"
echo ""

# =============================================================================
echo "--- 1. Verificacion de Estructura de Modulos ---"
# =============================================================================

# Verificar modulos principales
for mod in attendance enrollment qr-projection auth; do
    if [ -d "${BASE_PATH}/backend/${mod}" ]; then
        pass "Modulo ${mod}/ existe"
    else
        fail "Modulo ${mod}/ no existe"
    fi
done

# Verificar estructura vertical slicing en attendance
for layer in domain application infrastructure presentation; do
    if [ -d "${BASE_PATH}/backend/attendance/${layer}" ]; then
        pass "attendance/${layer}/ existe"
    else
        fail "attendance/${layer}/ no existe"
    fi
done

# =============================================================================
echo ""
echo "--- 2. Conteo de Acoplamientos (Baseline) ---"
# =============================================================================

# Contar imports de qr-projection en attendance
QR_IMPORTS=$(grep -r "from.*qr-projection" "${BASE_PATH}/backend/attendance/" 2>/dev/null | wc -l)
info "Imports de qr-projection en attendance: ${QR_IMPORTS}"

# Contar tipos QRPayloadV1 importados
PAYLOAD_IMPORTS=$(grep -r "QRPayloadV1" "${BASE_PATH}/backend/attendance/" 2>/dev/null | wc -l)
info "Referencias a QRPayloadV1 en attendance: ${PAYLOAD_IMPORTS}"

# Contar servicios importados directamente
SERVICE_IMPORTS=$(grep -r "import.*PoolBalancer\|import.*QRGenerator" "${BASE_PATH}/backend/attendance/" 2>/dev/null | wc -l)
info "Imports de servicios (QRGenerator, PoolBalancer): ${SERVICE_IMPORTS}"

# Contar repositorios importados
REPO_IMPORTS=$(grep -r "import.*QRPayloadRepository" "${BASE_PATH}/backend/attendance/" 2>/dev/null | wc -l)
info "Imports de QRPayloadRepository en attendance: ${REPO_IMPORTS}"

# Este es un baseline, registramos los valores
pass "Baseline de acoplamientos registrado"

# =============================================================================
echo ""
echo "--- 3. Verificacion de Codigo Deprecado ---"
# =============================================================================

FAKE_GEN="${BASE_PATH}/backend/attendance/application/fake-qr-generator.ts"
if [ -f "$FAKE_GEN" ]; then
    if grep -q "@deprecated" "$FAKE_GEN" 2>/dev/null; then
        pass "FakeQRGenerator marcado como @deprecated"
    else
        fail "FakeQRGenerator NO esta marcado como @deprecated"
    fi
else
    info "FakeQRGenerator no existe (ya eliminado o no aplica)"
    pass "Verificacion de deprecacion completada"
fi

# =============================================================================
echo ""
echo "--- 4. Verificacion de shared/types ---"
# =============================================================================

if [ -d "${BASE_PATH}/shared/types" ]; then
    pass "shared/types/ existe"
else
    info "shared/types/ no existe (se creara en fase 11-1)"
    pass "Verificacion de shared/types/ OK (esperado)"
fi

# =============================================================================
echo ""
echo "--- 5. Health Checks via HTTP ---"
# =============================================================================

# Usar puerto 9503 (host) o 3000 (contenedor)
if curl -sf "http://localhost:9503/health" > /dev/null 2>&1; then
    pass "GET /health responde (puerto 9503)"
elif curl -sf "http://localhost:3000/health" > /dev/null 2>&1; then
    pass "GET /health responde (puerto 3000)"
else
    fail "GET /health no responde"
fi

# =============================================================================
echo ""
echo "--- 6. Compilacion TypeScript ---"
# =============================================================================

cd "$NODE_DIR" 2>/dev/null || true
if command -v npm &> /dev/null; then
    if npm run type-check 2>&1 | grep -q "error"; then
        fail "TypeScript tiene errores de compilacion"
    else
        pass "TypeScript compila correctamente"
    fi
else
    info "npm no disponible, saltando verificacion de TS"
fi

# =============================================================================
echo ""
echo "=============================================="
echo "  RESUMEN - Fase 11-0"
echo "=============================================="
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo "=============================================="
echo ""
echo "Hallazgos de la auditoria:"
echo "  - ${QR_IMPORTS} imports cruzados attendance -> qr-projection"
echo "  - ${PAYLOAD_IMPORTS} referencias al tipo QRPayloadV1"
echo "  - ${SERVICE_IMPORTS} imports directos de servicios"
echo "  - ${REPO_IMPORTS} imports de QRPayloadRepository"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Fase 11-0 completada - Auditoria exitosa${NC}"
    echo ""
    echo "Proxima fase: 11-1 (Extraer QRPayloadV1 a shared/types)"
    exit 0
else
    echo -e "${RED}✗ Algunos tests fallaron${NC}"
    exit 1
fi
