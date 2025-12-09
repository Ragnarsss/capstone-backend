#!/bin/bash
# =============================================================================
# test-fase10-1.sh - Tests para Fase 10.1: PayloadBuilder Domain Service
# =============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase10-1.sh
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

# Funciones de utilidad
pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "  ${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

info() {
    echo -e "  ${YELLOW}ℹ${NC} $1"
}

echo "======================================"
echo "  TEST FASE 10.1: PayloadBuilder      "
echo "======================================"
echo ""

# =============================================================================
# Test 1: Estructura de archivos
# =============================================================================
echo "Test 1: Estructura de archivos"

SERVICE_FILE="node-service/src/backend/qr-projection/domain/services/payload-builder.service.ts"
INDEX_FILE="node-service/src/backend/qr-projection/domain/services/index.ts"
DOMAIN_INDEX="node-service/src/backend/qr-projection/domain/index.ts"

if [ -f "$SERVICE_FILE" ]; then
    pass "PayloadBuilder service existe"
else
    fail "PayloadBuilder service no existe"
fi

if [ -f "$INDEX_FILE" ]; then
    pass "services/index.ts existe"
else
    fail "services/index.ts no existe"
fi

if [ -f "$DOMAIN_INDEX" ]; then
    pass "domain/index.ts existe"
else
    fail "domain/index.ts no existe"
fi

# =============================================================================
# Test 2: Métodos estáticos (funciones puras)
# =============================================================================
echo ""
echo "Test 2: Métodos estáticos (funciones puras)"

if grep -q "static generateNonce" "$SERVICE_FILE" 2>/dev/null; then
    pass "generateNonce() es estático"
else
    fail "generateNonce() no es estático"
fi

if grep -q "static buildStudentPayload" "$SERVICE_FILE" 2>/dev/null; then
    pass "buildStudentPayload() es estático"
else
    fail "buildStudentPayload() no es estático"
fi

if grep -q "static buildFakePayload" "$SERVICE_FILE" 2>/dev/null; then
    pass "buildFakePayload() es estático"
else
    fail "buildFakePayload() no es estático"
fi

if grep -q "static isValidPayload" "$SERVICE_FILE" 2>/dev/null; then
    pass "isValidPayload() es estático"
else
    fail "isValidPayload() no es estático"
fi

if grep -q "static toJsonString" "$SERVICE_FILE" 2>/dev/null; then
    pass "toJsonString() es estático"
else
    fail "toJsonString() no es estático"
fi

if grep -q "static fromJsonString" "$SERVICE_FILE" 2>/dev/null; then
    pass "fromJsonString() es estático"
else
    fail "fromJsonString() no es estático"
fi

# =============================================================================
# Test 3: Interfaces de input
# =============================================================================
echo ""
echo "Test 3: Interfaces de input"

if grep -q "interface StudentPayloadInput" "$SERVICE_FILE" 2>/dev/null; then
    pass "StudentPayloadInput interface definida"
else
    fail "StudentPayloadInput interface no definida"
fi

if grep -q "interface FakePayloadInput" "$SERVICE_FILE" 2>/dev/null; then
    pass "FakePayloadInput interface definida"
else
    fail "FakePayloadInput interface no definida"
fi

if grep -q "readonly sessionId: string" "$SERVICE_FILE" 2>/dev/null; then
    pass "sessionId es readonly"
else
    fail "sessionId no es readonly"
fi

if grep -q "readonly hostUserId: number" "$SERVICE_FILE" 2>/dev/null; then
    pass "hostUserId es readonly"
else
    fail "hostUserId no es readonly"
fi

if grep -q "readonly roundNumber: number" "$SERVICE_FILE" 2>/dev/null; then
    pass "roundNumber es readonly"
else
    fail "roundNumber no es readonly"
fi

# =============================================================================
# Test 4: Sin dependencias de infraestructura
# =============================================================================
echo ""
echo "Test 4: Sin dependencias de infraestructura"

if grep -q "import.*AesGcmService" "$SERVICE_FILE" 2>/dev/null; then
    fail "Tiene dependencia de AesGcmService (debe ser puro)"
else
    pass "No depende de AesGcmService"
fi

if grep -q "import.*Repository" "$SERVICE_FILE" 2>/dev/null; then
    fail "Tiene dependencia de Repository (debe ser puro)"
else
    pass "No depende de repositorios"
fi

if grep -q "import.*valkey\|import.*redis" "$SERVICE_FILE" 2>/dev/null; then
    fail "Tiene dependencia de Valkey/Redis (debe ser puro)"
else
    pass "No depende de Valkey/Redis"
fi

# Solo debe importar randomBytes de crypto y tipos de models
IMPORTS=$(grep "^import" "$SERVICE_FILE" 2>/dev/null | wc -l)
if [ "$IMPORTS" -le 2 ]; then
    pass "Mínimas importaciones ($IMPORTS)"
else
    fail "Demasiadas importaciones ($IMPORTS)"
fi

# =============================================================================
# Test 5: Payload falso con uid=0
# =============================================================================
echo ""
echo "Test 5: Payload falso con uid=0"

if grep -q "uid: 0" "$SERVICE_FILE" 2>/dev/null; then
    pass "buildFakePayload usa uid=0"
else
    fail "buildFakePayload no usa uid=0"
fi

if grep -q "Marca interna de payload falso" "$SERVICE_FILE" 2>/dev/null; then
    pass "Documentación de uid=0 como marca"
else
    fail "Falta documentación de uid=0"
fi

# =============================================================================
# Test 6: Exportaciones
# =============================================================================
echo ""
echo "Test 6: Exportaciones"

if grep -q "export { PayloadBuilder }" "$INDEX_FILE" 2>/dev/null; then
    pass "PayloadBuilder exportado en services/index.ts"
else
    fail "PayloadBuilder no exportado en services/index.ts"
fi

if grep -q "export type { StudentPayloadInput" "$INDEX_FILE" 2>/dev/null; then
    pass "StudentPayloadInput type exportado"
else
    fail "StudentPayloadInput type no exportado"
fi

if grep -q "export type { FakePayloadInput" "$INDEX_FILE" 2>/dev/null || grep -q "export type {.*FakePayloadInput" "$INDEX_FILE" 2>/dev/null; then
    pass "FakePayloadInput type exportado"
else
    fail "FakePayloadInput type no exportado"
fi

if grep -q "export { PayloadBuilder } from './services'" "$DOMAIN_INDEX" 2>/dev/null; then
    pass "PayloadBuilder re-exportado en domain/index.ts"
else
    fail "PayloadBuilder no re-exportado en domain/index.ts"
fi

# =============================================================================
# Test 7: Validación de payload
# =============================================================================
echo ""
echo "Test 7: Validación de payload"

if grep -q "p.v === 1" "$SERVICE_FILE" 2>/dev/null; then
    pass "Valida versión v=1"
else
    fail "No valida versión"
fi

if grep -q "p.sid.length > 0" "$SERVICE_FILE" 2>/dev/null; then
    pass "Valida sid no vacío"
else
    fail "No valida sid"
fi

if grep -q "p.uid >= 0" "$SERVICE_FILE" 2>/dev/null; then
    pass "Valida uid >= 0 (permite fakes con uid=0)"
else
    fail "No valida uid correctamente"
fi

if grep -q "p.r >= 1" "$SERVICE_FILE" 2>/dev/null; then
    pass "Valida round >= 1"
else
    fail "No valida round"
fi

if grep -q "p.n.length === 32" "$SERVICE_FILE" 2>/dev/null; then
    pass "Valida nonce de 32 chars (16 bytes hex)"
else
    fail "No valida longitud de nonce"
fi

# =============================================================================
# Test 8: Documentación
# =============================================================================
echo ""
echo "Test 8: Documentación"

if grep -q "@example" "$SERVICE_FILE" 2>/dev/null; then
    pass "Tiene ejemplos de uso"
else
    fail "Falta ejemplos de uso"
fi

if grep -q "Responsabilidad ÚNICA" "$SERVICE_FILE" 2>/dev/null; then
    pass "Documenta SoC (Single Responsibility)"
else
    fail "Falta documentación de SoC"
fi

if grep -q "Funciones PURAS" "$SERVICE_FILE" 2>/dev/null; then
    pass "Documenta pureza funcional"
else
    fail "Falta documentación de pureza"
fi

# =============================================================================
# Test 9: TypeScript compila
# =============================================================================
echo ""
echo "Test 9: TypeScript compila"

cd node-service 2>/dev/null || cd /app 2>/dev/null || true

if command -v pnpm &> /dev/null; then
    if pnpm tsc --noEmit 2>&1 | grep -q "error TS"; then
        fail "TypeScript tiene errores de compilación"
    else
        pass "TypeScript compila sin errores"
    fi
else
    info "pnpm no disponible, saltando verificación de TS"
fi

cd - > /dev/null 2>&1 || true

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "======================================"
echo "  RESUMEN FASE 10.1                   "
echo "======================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Algunos tests fallaron${NC}"
    exit 1
else
    echo -e "${GREEN}Todos los tests pasaron - PayloadBuilder implementado${NC}"
    exit 0
fi
