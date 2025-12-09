#!/bin/bash
# test-fase14-2.sh - Verificacion de Enrollment en qr-reader
# Fase 14.2: Verificacion Enrollment antes de escaneo QR

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
QR_READER="${NODE_SRC}/frontend/features/qr-reader"

echo "=================================================="
echo "Test Fase 14.2: Verificacion Enrollment en qr-reader"
echo "=================================================="
echo ""

# 1. Verificar que index.html tiene seccion enrollment
echo "1. Verificando secciones en index.html..."
if grep -q 'id="enrollment-section"' "${QR_READER}/index.html" 2>/dev/null; then
    pass "Seccion enrollment existe en HTML"
else
    fail "Seccion enrollment no existe en HTML"
fi

if grep -q 'id="login-section"' "${QR_READER}/index.html" 2>/dev/null; then
    pass "Seccion login existe en HTML"
else
    fail "Seccion login no existe en HTML"
fi

if grep -q 'id="register-section"' "${QR_READER}/index.html" 2>/dev/null; then
    pass "Seccion register existe en HTML"
else
    fail "Seccion register no existe en HTML"
fi

# 2. Verificar imports en main.ts
echo ""
echo "2. Verificando imports en main.ts..."
if grep -q "import { EnrollmentService" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "EnrollmentService importado"
else
    fail "EnrollmentService no importado"
fi

if grep -q "import { LoginService }" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "LoginService importado"
else
    fail "LoginService no importado"
fi

if grep -q "import { SessionKeyStore }" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "SessionKeyStore importado"
else
    fail "SessionKeyStore no importado"
fi

# 3. Verificar metodos de verificacion
echo ""
echo "3. Verificando metodos de verificacion enrollment..."
if grep -q "checkEnrollmentStatus" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Metodo checkEnrollmentStatus existe"
else
    fail "Metodo checkEnrollmentStatus no existe"
fi

if grep -q "showEnrollmentSection" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Metodo showEnrollmentSection existe"
else
    fail "Metodo showEnrollmentSection no existe"
fi

if grep -q "showLoginSection" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Metodo showLoginSection existe"
else
    fail "Metodo showLoginSection no existe"
fi

if grep -q "showReadyState" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Metodo showReadyState existe"
else
    fail "Metodo showReadyState no existe"
fi

# 4. Verificar handlers
echo ""
echo "4. Verificando handlers de enrollment/login..."
if grep -q "handleEnrollClick" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Handler handleEnrollClick existe"
else
    fail "Handler handleEnrollClick no existe"
fi

if grep -q "handleLoginClick" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Handler handleLoginClick existe"
else
    fail "Handler handleLoginClick no existe"
fi

if grep -q "performLogin" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Metodo performLogin existe"
else
    fail "Metodo performLogin no existe"
fi

# 5. Verificar flujo de verificacion
echo ""
echo "5. Verificando flujo de verificacion..."
if grep -q "hasSessionKey()" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Verificacion hasSessionKey() presente"
else
    fail "Verificacion hasSessionKey() no presente"
fi

if grep -q "status.deviceCount" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Verificacion deviceCount presente"
else
    fail "Verificacion deviceCount no presente"
fi

if grep -q "storeSessionKey" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Almacenamiento de session_key presente"
else
    fail "Almacenamiento de session_key no presente"
fi

# 6. Verificar botones en HTML
echo ""
echo "6. Verificando botones en HTML..."
if grep -q 'id="enroll-btn"' "${QR_READER}/index.html" 2>/dev/null; then
    pass "Boton enroll-btn existe"
else
    fail "Boton enroll-btn no existe"
fi

if grep -q 'id="login-btn"' "${QR_READER}/index.html" 2>/dev/null; then
    pass "Boton login-btn existe"
else
    fail "Boton login-btn no existe"
fi

# 7. Verificar TypeScript compila
echo ""
echo "7. Verificando compilacion TypeScript..."
cd "$PROJECT_DIR"
if podman compose -f compose.yaml -f compose.dev.yaml exec -T node-service npx tsc --noEmit 2>&1 | grep -q "error"; then
    fail "Errores de TypeScript encontrados"
else
    pass "TypeScript compila sin errores"
fi

echo ""
echo "=========================================="
echo "Resumen"
echo "=========================================="
echo -e "Pasaron: ${GREEN}${PASSED}${NC}"
echo -e "Fallaron: ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}Fase 14.2 completada exitosamente${NC}"
    exit 0
else
    echo -e "${RED}Fase 14.2 tiene errores${NC}"
    exit 1
fi
