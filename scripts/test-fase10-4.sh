#!/bin/bash
# =============================================================================
# test-fase10-4.sh - Tests para Fase 10.4: QREmitter Application Service
# =============================================================================
# Ejecutar desde la raiz del proyecto:
#   bash scripts/test-fase10-4.sh
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
echo "  TEST FASE 10.4: QREmitter           "
echo "======================================"
echo ""

# =============================================================================
# Test 1: Estructura de archivos
# =============================================================================
echo "Test 1: Estructura de archivos"

SERVICE_FILE="node-service/src/backend/qr-projection/application/services/qr-emitter.service.ts"
INDEX_FILE="node-service/src/backend/qr-projection/application/services/index.ts"

if [ -f "$SERVICE_FILE" ]; then
    pass "QREmitter service existe"
else
    fail "QREmitter service no existe"
fi

# =============================================================================
# Test 2: Dependencias minimas
# =============================================================================
echo ""
echo "Test 2: Dependencias minimas"

if grep -q "import { ProjectionPoolRepository" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa ProjectionPoolRepository"
else
    fail "No usa ProjectionPoolRepository"
fi

if grep -q "import type { QRPayloadV1, QRPayloadEnvelope }" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa tipos de dominio"
else
    fail "No usa tipos de dominio"
fi

if grep -q "import { SessionId }" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa SessionId"
else
    fail "No usa SessionId"
fi

# =============================================================================
# Test 3: No depende de servicios hermanos
# =============================================================================
echo ""
echo "Test 3: No depende de servicios hermanos (SoC)"

if grep "^import.*PoolFeeder" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa PoolFeeder (viola SoC)"
else
    pass "No importa PoolFeeder"
fi

if grep "^import.*PoolBalancer" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa PoolBalancer (viola SoC)"
else
    pass "No importa PoolBalancer"
fi

if grep "^import.*AesGcmService" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa AesGcmService (no necesario para emision)"
else
    pass "No importa AesGcmService"
fi

if grep "^import.*WebSocket" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa WebSocket directamente (viola SoC)"
else
    pass "No importa WebSocket"
fi

# =============================================================================
# Test 4: Tipos de callback
# =============================================================================
echo ""
echo "Test 4: Tipos de callback"

if grep -q "type EmitCallback" "$SERVICE_FILE" 2>/dev/null; then
    pass "EmitCallback type definido"
else
    fail "EmitCallback type no definido"
fi

if grep -q "type ShouldStopCallback" "$SERVICE_FILE" 2>/dev/null; then
    pass "ShouldStopCallback type definido"
else
    fail "ShouldStopCallback type no definido"
fi

if grep -q "interface QREmitterConfig" "$SERVICE_FILE" 2>/dev/null; then
    pass "QREmitterConfig interface definida"
else
    fail "QREmitterConfig interface no definida"
fi

# =============================================================================
# Test 5: Metodos principales
# =============================================================================
echo ""
echo "Test 5: Metodos principales"

if grep -q "start(" "$SERVICE_FILE" 2>/dev/null; then
    pass "start() definido"
else
    fail "start() no definido"
fi

if grep -q "stop(" "$SERVICE_FILE" 2>/dev/null; then
    pass "stop() definido"
else
    fail "stop() no definido"
fi

if grep -q "stopAll(" "$SERVICE_FILE" 2>/dev/null; then
    pass "stopAll() definido"
else
    fail "stopAll() no definido"
fi

if grep -q "isEmitting(" "$SERVICE_FILE" 2>/dev/null; then
    pass "isEmitting() definido"
else
    fail "isEmitting() no definido"
fi

if grep -q "getActiveSessions(" "$SERVICE_FILE" 2>/dev/null; then
    pass "getActiveSessions() definido"
else
    fail "getActiveSessions() no definido"
fi

# =============================================================================
# Test 6: Logica de emision
# =============================================================================
echo ""
echo "Test 6: Logica de emision"

if grep -q "setInterval" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa setInterval para emision periodica"
else
    fail "No usa setInterval"
fi

if grep -q "clearInterval" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa clearInterval para detener"
else
    fail "No usa clearInterval"
fi

if grep -q "getNextEntry" "$SERVICE_FILE" 2>/dev/null; then
    pass "Lee del pool con getNextEntry (round-robin)"
else
    fail "No usa getNextEntry"
fi

if grep -q "activeEmissions" "$SERVICE_FILE" 2>/dev/null; then
    pass "Mantiene estado de emisiones activas"
else
    fail "No mantiene estado de emisiones"
fi

# =============================================================================
# Test 7: Manejo de pool vacio
# =============================================================================
echo ""
echo "Test 7: Manejo de pool vacio"

if grep -q "createWaitingEnvelope" "$SERVICE_FILE" 2>/dev/null; then
    pass "Crea envelope de espera cuando pool vacio"
else
    fail "No maneja pool vacio"
fi

if grep -q 'uid: -1' "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa uid=-1 para indicar espera"
else
    fail "No usa uid=-1 para espera"
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

# =============================================================================
# Test 9: Exportaciones
# =============================================================================
echo ""
echo "Test 9: Exportaciones"

if grep -q "export { QREmitter }" "$INDEX_FILE" 2>/dev/null; then
    pass "QREmitter exportado"
else
    fail "QREmitter no exportado"
fi

if grep -q "QREmitterConfig" "$INDEX_FILE" 2>/dev/null; then
    pass "QREmitterConfig type exportado"
else
    fail "QREmitterConfig type no exportado"
fi

if grep -q "EmitCallback" "$INDEX_FILE" 2>/dev/null; then
    pass "EmitCallback type exportado"
else
    fail "EmitCallback type no exportado"
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
echo "  RESUMEN FASE 10.4                   "
echo "======================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Algunos tests fallaron${NC}"
    exit 1
else
    echo -e "${GREEN}Todos los tests pasaron - QREmitter implementado${NC}"
    exit 0
fi
