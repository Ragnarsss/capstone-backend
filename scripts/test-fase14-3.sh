#!/bin/bash
# test-fase14-3.sh - Verificacion de eliminacion MOCK_SESSION_KEY
# Fase 14.3: Mock solo en desarrollo, error en produccion

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Contadores
PASSED=0
FAILED=0

pass() {
    echo -e "   ${GREEN}OK${NC} - $1"
    ((PASSED++))
}

fail() {
    echo -e "   ${RED}FAIL${NC} - $1"
    ((FAILED++))
}

# Obtener directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

NODE_SRC="${PROJECT_DIR}/node-service/src"
CRYPTO="${NODE_SRC}/frontend/shared/crypto"

echo "============================================================"
echo "Test Fase 14.3: Eliminar MOCK_SESSION_KEY del Frontend"
echo "============================================================"
echo ""

# 1. Verificar que aes-gcm.ts tiene verificacion de DEV
echo "1. Verificando logica de fallback en aes-gcm.ts..."
if grep -q "import.meta.env.DEV" "${CRYPTO}/aes-gcm.ts" 2>/dev/null; then
    pass "Verificacion import.meta.env.DEV presente"
else
    fail "Verificacion import.meta.env.DEV no encontrada"
fi

# 2. Verificar que hay error en produccion
if grep -q "throw new Error" "${CRYPTO}/aes-gcm.ts" 2>/dev/null; then
    pass "Error throw en produccion presente"
else
    fail "Error throw en produccion no encontrado"
fi

# 3. Verificar mensaje de error descriptivo
if grep -q "No hay session_key disponible" "${CRYPTO}/aes-gcm.ts" 2>/dev/null; then
    pass "Mensaje de error descriptivo presente"
else
    fail "Mensaje de error descriptivo no encontrado"
fi

# 4. Verificar que el fallback mock esta dentro de if DEV
echo ""
echo "2. Verificando estructura del fallback..."
# El fallback debe estar DENTRO de if (import.meta.env.DEV)
if grep -A5 "import.meta.env.DEV" "${CRYPTO}/aes-gcm.ts" | grep -q "getMockSessionKey"; then
    pass "getMockSessionKey dentro de bloque DEV"
else
    fail "getMockSessionKey no esta dentro de bloque DEV"
fi

# 5. Verificar que mock-keys.ts tiene deprecation warning
echo ""
echo "3. Verificando deprecation en mock-keys.ts..."
if grep -q "@deprecated" "${CRYPTO}/mock-keys.ts" 2>/dev/null; then
    pass "Deprecation warning en mock-keys.ts"
else
    fail "Deprecation warning no encontrado en mock-keys.ts"
fi

# 6. Verificar que MOCK_SESSION_KEY sigue exportado (para debug)
if grep -q "export const MOCK_SESSION_KEY" "${CRYPTO}/mock-keys.ts" 2>/dev/null; then
    pass "MOCK_SESSION_KEY exportado (para debug en dev)"
else
    fail "MOCK_SESSION_KEY no exportado"
fi

# 7. Verificar que qr-reader usa helpers solo en DEV
echo ""
echo "4. Verificando qr-reader/main.ts..."
QR_READER="${NODE_SRC}/frontend/features/qr-reader/main.ts"
# Buscar que MOCK_KEY esta dentro de un bloque if (import.meta.env.DEV)
if grep -B10 "MOCK_KEY:" "${QR_READER}" | grep -q "import.meta.env.DEV"; then
    pass "Debug helpers solo en DEV en qr-reader"
else
    fail "Debug helpers no estan protegidos por DEV"
fi

# 8. Verificar TypeScript compila
echo ""
echo "5. Verificando compilacion TypeScript..."
cd "$PROJECT_DIR"
if podman compose -f compose.yaml -f compose.dev.yaml exec -T node-service npx tsc --noEmit 2>&1 | grep -q "error"; then
    fail "Errores de TypeScript encontrados"
else
    pass "TypeScript compila sin errores"
fi

# 9. Verificar comentarios actualizados
echo ""
echo "6. Verificando documentacion en codigo..."
if grep -q "SOLO en desarrollo" "${CRYPTO}/aes-gcm.ts" 2>/dev/null; then
    pass "Documentacion actualizada en aes-gcm.ts"
else
    fail "Documentacion no actualizada"
fi

echo ""
echo "=========================================="
echo "Resumen"
echo "=========================================="
echo -e "Pasaron: ${GREEN}${PASSED}${NC}"
echo -e "Fallaron: ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}Fase 14.3 completada exitosamente${NC}"
    exit 0
else
    echo -e "${RED}Fase 14.3 tiene errores${NC}"
    exit 1
fi
