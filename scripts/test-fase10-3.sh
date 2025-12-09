#!/bin/bash
# =============================================================================
# test-fase10-3.sh - Tests para Fase 10.3: PoolBalancer Application Service
# =============================================================================
# Ejecutar desde la raiz del proyecto:
#   bash scripts/test-fase10-3.sh
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Contadores
PASSED=0
FAILED=0

pass() {
    echo -e "  ${GREEN}[OK]${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "  ${RED}[FAIL]${NC} $1"
    FAILED=$((FAILED + 1))
}

info() {
    echo -e "  ${YELLOW}[INFO]${NC} $1"
}

echo "======================================"
echo "  TEST FASE 10.3: PoolBalancer        "
echo "======================================"
echo ""

# =============================================================================
# Test 1: Estructura de archivos
# =============================================================================
echo "Test 1: Estructura de archivos"

SERVICE_FILE="node-service/src/backend/qr-projection/application/services/pool-balancer.service.ts"
INDEX_FILE="node-service/src/backend/qr-projection/application/services/index.ts"

if [ -f "$SERVICE_FILE" ]; then
    pass "PoolBalancer service existe"
else
    fail "PoolBalancer service no existe"
fi

# =============================================================================
# Test 2: Usa PayloadBuilder (no QRGenerator)
# =============================================================================
echo ""
echo "Test 2: Usa PayloadBuilder (no QRGenerator)"

if grep -q "import { PayloadBuilder }" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa PayloadBuilder"
else
    fail "No usa PayloadBuilder"
fi

if grep "^import.*QRGenerator" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa QRGenerator (debe usar PayloadBuilder)"
else
    pass "No importa QRGenerator"
fi

if grep -q "PayloadBuilder.buildFakePayload" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa PayloadBuilder.buildFakePayload()"
else
    fail "No usa PayloadBuilder.buildFakePayload()"
fi

# =============================================================================
# Test 3: Dependencias correctas
# =============================================================================
echo ""
echo "Test 3: Dependencias correctas"

if grep -q "import { AesGcmService }" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa AesGcmService"
else
    fail "No usa AesGcmService"
fi

if grep -q "import { ProjectionPoolRepository" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa ProjectionPoolRepository"
else
    fail "No usa ProjectionPoolRepository"
fi

if grep -q "encryptWithRandomKey" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa encryptWithRandomKey para fakes"
else
    fail "No usa encryptWithRandomKey"
fi

# =============================================================================
# Test 4: Interfaces
# =============================================================================
echo ""
echo "Test 4: Interfaces"

if grep -q "interface PoolBalancerConfig" "$SERVICE_FILE" 2>/dev/null; then
    pass "PoolBalancerConfig interface definida"
else
    fail "PoolBalancerConfig interface no definida"
fi

if grep -q "interface BalanceResult" "$SERVICE_FILE" 2>/dev/null; then
    pass "BalanceResult interface definida"
else
    fail "BalanceResult interface no definida"
fi

if grep -q "readonly minPoolSize: number" "$SERVICE_FILE" 2>/dev/null; then
    pass "minPoolSize es readonly"
else
    fail "minPoolSize no es readonly"
fi

# =============================================================================
# Test 5: Metodos principales
# =============================================================================
echo ""
echo "Test 5: Metodos principales"

if grep -q "async balance(" "$SERVICE_FILE" 2>/dev/null; then
    pass "balance() definido"
else
    fail "balance() no definido"
fi

if grep -q "calculateFakesNeeded" "$SERVICE_FILE" 2>/dev/null; then
    pass "calculateFakesNeeded() definido"
else
    fail "calculateFakesNeeded() no definido"
fi

if grep -q "async injectFakes" "$SERVICE_FILE" 2>/dev/null; then
    pass "injectFakes() definido"
else
    fail "injectFakes() no definido"
fi

if grep -q "async getPoolStats" "$SERVICE_FILE" 2>/dev/null; then
    pass "getPoolStats() definido"
else
    fail "getPoolStats() no definido"
fi

if grep -q "getConfig()" "$SERVICE_FILE" 2>/dev/null; then
    pass "getConfig() definido"
else
    fail "getConfig() no definido"
fi

if grep -q "updateConfig(" "$SERVICE_FILE" 2>/dev/null; then
    pass "updateConfig() definido"
else
    fail "updateConfig() no definido"
fi

# =============================================================================
# Test 6: Logica de balanceo
# =============================================================================
echo ""
echo "Test 6: Logica de balanceo"

if grep -q "stats.fakes < fakesNeeded" "$SERVICE_FILE" 2>/dev/null; then
    pass "Detecta cuando faltan fakes"
else
    fail "No detecta cuando faltan fakes"
fi

if grep -q "stats.fakes > fakesNeeded" "$SERVICE_FILE" 2>/dev/null; then
    pass "Detecta cuando sobran fakes"
else
    fail "No detecta cuando sobran fakes"
fi

if grep -q "addFakeQRs" "$SERVICE_FILE" 2>/dev/null; then
    pass "Agrega fakes al pool"
else
    fail "No agrega fakes al pool"
fi

if grep -q "removeFakeQRs" "$SERVICE_FILE" 2>/dev/null; then
    pass "Remueve fakes del pool"
else
    fail "No remueve fakes del pool"
fi

# =============================================================================
# Test 7: Responsabilidad unica (SoC)
# =============================================================================
echo ""
echo "Test 7: Responsabilidad unica (SoC)"

if grep "^import.*PoolFeeder" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa PoolFeeder (viola SoC)"
else
    pass "No importa PoolFeeder"
fi

if grep "^import.*StudentSessionRepository" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa StudentSessionRepository (viola SoC)"
else
    pass "No importa StudentSessionRepository"
fi

if grep "^import.*WebSocket" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa WebSocket (viola SoC)"
else
    pass "No importa WebSocket"
fi

# =============================================================================
# Test 8: Documentacion
# =============================================================================
echo ""
echo "Test 8: Documentacion"

if grep -q "Responsabilidad UNICA" "$SERVICE_FILE" 2>/dev/null; then
    pass "Documenta SoC"
else
    fail "Falta documentacion de SoC"
fi

if grep -q "Este servicio NO maneja" "$SERVICE_FILE" 2>/dev/null; then
    pass "Documenta lo que NO hace"
else
    fail "Falta documentacion de exclusiones"
fi

if grep -q "Pool de tamano fijo" "$SERVICE_FILE" 2>/dev/null; then
    pass "Documenta estrategia de balanceo"
else
    fail "Falta documentacion de estrategia"
fi

# =============================================================================
# Test 9: Exportaciones
# =============================================================================
echo ""
echo "Test 9: Exportaciones"

if grep -q "export { PoolBalancer }" "$INDEX_FILE" 2>/dev/null; then
    pass "PoolBalancer exportado"
else
    fail "PoolBalancer no exportado"
fi

if grep -q "PoolBalancerConfig" "$INDEX_FILE" 2>/dev/null; then
    pass "PoolBalancerConfig type exportado"
else
    fail "PoolBalancerConfig type no exportado"
fi

if grep -q "BalanceResult" "$INDEX_FILE" 2>/dev/null; then
    pass "BalanceResult type exportado"
else
    fail "BalanceResult type no exportado"
fi

# =============================================================================
# Test 10: TypeScript compila
# =============================================================================
echo ""
echo "Test 10: TypeScript compila"

cd node-service 2>/dev/null || cd /app 2>/dev/null || true

if command -v npx &> /dev/null; then
    TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
    if echo "$TSC_OUTPUT" | grep -q "error TS"; then
        fail "TypeScript tiene errores de compilacion"
        echo "$TSC_OUTPUT" | grep "error TS" | head -5
    else
        pass "TypeScript compila sin errores"
    fi
else
    info "npx no disponible, saltando verificacion de TS"
fi

cd - > /dev/null 2>&1 || true

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "======================================"
echo "  RESUMEN FASE 10.3                   "
echo "======================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Algunos tests fallaron${NC}"
    exit 1
else
    echo -e "${GREEN}Todos los tests pasaron - PoolBalancer implementado${NC}"
    exit 0
fi
