#!/bin/bash
# test-fase14-1.sh - Verificacion de Legacy Bridge para postMessage
# Fase 14.1: Legacy Bridge en Frontend Node

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

info() {
    echo -e "   ${YELLOW}INFO${NC} - $1"
}

# Obtener directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

NODE_SRC="${PROJECT_DIR}/node-service/src"
FRONTEND="${NODE_SRC}/frontend"
SHARED="${FRONTEND}/shared"
QR_HOST="${FRONTEND}/features/qr-host"
QR_READER="${FRONTEND}/features/qr-reader"

echo "================================================"
echo "Test Fase 14.1: Legacy Bridge para postMessage"
echo "================================================"
echo ""

# 1. Verificar que legacy-bridge.service.ts existe
echo "1. Verificando legacy-bridge.service.ts..."
if [ -f "${SHARED}/services/legacy-bridge.service.ts" ]; then
    pass "legacy-bridge.service.ts existe"
else
    fail "legacy-bridge.service.ts no existe"
fi

# 2. Verificar que legacy-context.store.ts existe
echo "2. Verificando legacy-context.store.ts..."
if [ -f "${SHARED}/stores/legacy-context.store.ts" ]; then
    pass "legacy-context.store.ts existe"
else
    fail "legacy-context.store.ts no existe"
fi

# 3. Verificar exports del store
echo "3. Verificando exports del context store..."
if grep -q "export class LegacyContextStore" "${SHARED}/stores/legacy-context.store.ts" 2>/dev/null; then
    pass "LegacyContextStore exportado"
else
    fail "LegacyContextStore no exportado"
fi

if grep -q "export type LegacyContext" "${SHARED}/stores/legacy-context.store.ts" 2>/dev/null; then
    pass "LegacyContext type exportado"
else
    fail "LegacyContext type no exportado"
fi

# 4. Verificar exports del bridge
echo "4. Verificando exports del bridge service..."
if grep -q "export class LegacyBridge" "${SHARED}/services/legacy-bridge.service.ts" 2>/dev/null; then
    pass "LegacyBridge exportado"
else
    fail "LegacyBridge no exportado"
fi

# 5. Verificar que bridge maneja AUTH_TOKEN
echo "5. Verificando manejo de mensajes postMessage..."
if grep -q "AUTH_TOKEN" "${SHARED}/services/legacy-bridge.service.ts" 2>/dev/null; then
    pass "AUTH_TOKEN manejado"
else
    fail "AUTH_TOKEN no manejado"
fi

if grep -q "SESSION_CONTEXT" "${SHARED}/services/legacy-bridge.service.ts" 2>/dev/null; then
    pass "SESSION_CONTEXT manejado"
else
    fail "SESSION_CONTEXT no manejado"
fi

if grep -q "CLOSE_IFRAME" "${SHARED}/services/legacy-bridge.service.ts" 2>/dev/null; then
    pass "CLOSE_IFRAME manejado"
else
    fail "CLOSE_IFRAME no manejado"
fi

# 6. Verificar integracion en qr-host
echo "6. Verificando integracion en qr-host/main.ts..."
if grep -q "import { LegacyBridge }" "${QR_HOST}/main.ts" 2>/dev/null; then
    pass "LegacyBridge importado en qr-host"
else
    fail "LegacyBridge no importado en qr-host"
fi

if grep -q "import { LegacyContextStore }" "${QR_HOST}/main.ts" 2>/dev/null; then
    pass "LegacyContextStore importado en qr-host"
else
    fail "LegacyContextStore no importado en qr-host"
fi

if grep -q "this.legacyBridge.initialize()" "${QR_HOST}/main.ts" 2>/dev/null; then
    pass "Bridge inicializado en qr-host"
else
    fail "Bridge no inicializado en qr-host"
fi

# 7. Verificar integracion en qr-reader
echo "7. Verificando integracion en qr-reader/main.ts..."
if grep -q "import { LegacyBridge }" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "LegacyBridge importado en qr-reader"
else
    fail "LegacyBridge no importado en qr-reader"
fi

if grep -q "import { LegacyContextStore }" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "LegacyContextStore importado en qr-reader"
else
    fail "LegacyContextStore no importado en qr-reader"
fi

if grep -q "this.legacyBridge.initialize()" "${QR_READER}/main.ts" 2>/dev/null; then
    pass "Bridge inicializado en qr-reader"
else
    fail "Bridge no inicializado en qr-reader"
fi

# 8. Verificar tipos de contexto segun roseta.md
echo "8. Verificando tipos de contexto (roseta.md)..."
if grep -q "tipo: 'PROFESOR'" "${SHARED}/stores/legacy-context.store.ts" 2>/dev/null; then
    pass "Contexto PROFESOR definido"
else
    fail "Contexto PROFESOR no definido"
fi

if grep -q "tipo: 'ALUMNO'" "${SHARED}/stores/legacy-context.store.ts" 2>/dev/null; then
    pass "Contexto ALUMNO definido"
else
    fail "Contexto ALUMNO no definido"
fi

# 9. Verificar metodos del store
echo "9. Verificando metodos del context store..."
for method in "save" "get" "hasContext" "isProfesor" "isAlumno" "getAsProfesor" "getAsAlumno" "clear"; do
    if grep -q "${method}(" "${SHARED}/stores/legacy-context.store.ts" 2>/dev/null; then
        pass "Metodo ${method}() presente"
    else
        fail "Metodo ${method}() no encontrado"
    fi
done

# 10. Verificar metodos del bridge
echo "10. Verificando metodos del bridge..."
for method in "initialize" "sendToParent" "notifyAttendanceComplete" "requestClose" "onReady" "isReady"; do
    if grep -q "${method}(" "${SHARED}/services/legacy-bridge.service.ts" 2>/dev/null; then
        pass "Metodo ${method}() presente"
    else
        fail "Metodo ${method}() no encontrado"
    fi
done

# 11. Verificar TypeScript compila
echo "11. Verificando compilacion TypeScript..."
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
    echo -e "${GREEN}Fase 14.1 completada exitosamente${NC}"
    exit 0
else
    echo -e "${RED}Fase 14.1 tiene errores${NC}"
    exit 1
fi
