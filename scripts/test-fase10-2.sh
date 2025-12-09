#!/bin/bash
# =============================================================================
# test-fase10-2.sh - Tests para Fase 10.2: PoolFeeder Application Service
# =============================================================================
# Ejecutar desde la raiz del proyecto:
#   bash scripts/test-fase10-2.sh
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
echo "  TEST FASE 10.2: PoolFeeder          "
echo "======================================"
echo ""

# =============================================================================
# Test 1: Estructura de archivos
# =============================================================================
echo "Test 1: Estructura de archivos"

SERVICE_FILE="node-service/src/backend/qr-projection/application/services/pool-feeder.service.ts"
INDEX_FILE="node-service/src/backend/qr-projection/application/services/index.ts"

if [ -f "$SERVICE_FILE" ]; then
    pass "PoolFeeder service existe"
else
    fail "PoolFeeder service no existe"
fi

if [ -f "$INDEX_FILE" ]; then
    pass "services/index.ts existe"
else
    fail "services/index.ts no existe"
fi

# =============================================================================
# Test 2: Dependencias correctas
# =============================================================================
echo ""
echo "Test 2: Dependencias correctas"

if grep -q "import { PayloadBuilder }" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa PayloadBuilder"
else
    fail "No usa PayloadBuilder"
fi

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

if grep -q "import { QRPayloadRepository }" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa QRPayloadRepository"
else
    fail "No usa QRPayloadRepository"
fi

# =============================================================================
# Test 3: Interfaces de input/output
# =============================================================================
echo ""
echo "Test 3: Interfaces de input/output"

if grep -q "interface FeedStudentInput" "$SERVICE_FILE" 2>/dev/null; then
    pass "FeedStudentInput interface definida"
else
    fail "FeedStudentInput interface no definida"
fi

if grep -q "interface FeedResult" "$SERVICE_FILE" 2>/dev/null; then
    pass "FeedResult interface definida"
else
    fail "FeedResult interface no definida"
fi

if grep -q "readonly sessionId: string" "$SERVICE_FILE" 2>/dev/null; then
    pass "sessionId es readonly"
else
    fail "sessionId no es readonly"
fi

if grep -q "readonly studentId: number" "$SERVICE_FILE" 2>/dev/null; then
    pass "studentId es readonly"
else
    fail "studentId no es readonly"
fi

# =============================================================================
# Test 4: Metodo principal
# =============================================================================
echo ""
echo "Test 4: Metodo principal"

if grep -q "async feedStudentQR" "$SERVICE_FILE" 2>/dev/null; then
    pass "feedStudentQR() definido"
else
    fail "feedStudentQR() no definido"
fi

if grep -q "PayloadBuilder.buildStudentPayload" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa PayloadBuilder.buildStudentPayload()"
else
    fail "No usa PayloadBuilder.buildStudentPayload()"
fi

if grep -q "PayloadBuilder.toJsonString" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa PayloadBuilder.toJsonString()"
else
    fail "No usa PayloadBuilder.toJsonString()"
fi

if grep -q "encryptToPayload" "$SERVICE_FILE" 2>/dev/null; then
    pass "Usa aesGcmService.encryptToPayload()"
else
    fail "No usa encryptToPayload()"
fi

if grep -q "payloadRepo.store" "$SERVICE_FILE" 2>/dev/null; then
    pass "Almacena payload para validacion"
else
    fail "No almacena payload"
fi

if grep -q "poolRepo.upsertStudentQR" "$SERVICE_FILE" 2>/dev/null; then
    pass "Inserta en pool de proyeccion"
else
    fail "No inserta en pool"
fi

# =============================================================================
# Test 5: Responsabilidad unica (SoC)
# =============================================================================
echo ""
echo "Test 5: Responsabilidad unica (SoC)"

# Buscar imports de StudentSessionRepository (no comentarios)
if grep "^import.*StudentSessionRepository" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa StudentSessionRepository (viola SoC)"
else
    pass "No importa StudentSessionRepository"
fi

# Buscar imports de FakeQRGenerator
if grep "^import.*FakeQRGenerator" "$SERVICE_FILE" 2>/dev/null; then
    fail "Importa FakeQRGenerator (viola SoC)"
else
    pass "No importa FakeQRGenerator"
fi

# Buscar uso de WebSocket (no en comentarios)
if grep "^import.*WebSocket\|\.emit(" "$SERVICE_FILE" 2>/dev/null; then
    fail "Usa WebSocket directamente (viola SoC)"
else
    pass "No usa WebSocket directamente"
fi

# =============================================================================
# Test 6: Documentacion
# =============================================================================
echo ""
echo "Test 6: Documentacion"

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
# Test 7: Exportaciones
# =============================================================================
echo ""
echo "Test 7: Exportaciones"

if grep -q "export { PoolFeeder }" "$INDEX_FILE" 2>/dev/null; then
    pass "PoolFeeder exportado"
else
    fail "PoolFeeder no exportado"
fi

if grep -q "export type { FeedStudentInput" "$INDEX_FILE" 2>/dev/null; then
    pass "FeedStudentInput type exportado"
else
    fail "FeedStudentInput type no exportado"
fi

if grep -q "export type {.*FeedResult" "$INDEX_FILE" 2>/dev/null || grep -q "FeedResult }" "$INDEX_FILE" 2>/dev/null; then
    pass "FeedResult type exportado"
else
    fail "FeedResult type no exportado"
fi

# =============================================================================
# Test 8: Metodos auxiliares
# =============================================================================
echo ""
echo "Test 8: Metodos auxiliares"

if grep -q "async feedMultiple" "$SERVICE_FILE" 2>/dev/null; then
    pass "feedMultiple() para registro masivo"
else
    fail "feedMultiple() no definido"
fi

if grep -q "static getNonce" "$SERVICE_FILE" 2>/dev/null; then
    pass "getNonce() estatico para obtener nonce"
else
    fail "getNonce() no definido"
fi

# =============================================================================
# Test 9: TypeScript compila
# =============================================================================
echo ""
echo "Test 9: TypeScript compila"

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
echo "  RESUMEN FASE 10.2                   "
echo "======================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Algunos tests fallaron${NC}"
    exit 1
else
    echo -e "${GREEN}Todos los tests pasaron - PoolFeeder implementado${NC}"
    exit 0
fi
