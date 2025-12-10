#!/usr/bin/env bash
# Test Fase 16.1: Tipos de Estado
#
# Verifica que los tipos EnrollmentState y SessionState estan definidos

set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() {
    echo -e "   ${GREEN}OK${NC} - $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "   ${RED}FAIL${NC} - $1"
    FAILED=$((FAILED + 1))
}

echo "============================================================"
echo "Test Fase 16.1: Tipos de Estado"
echo "============================================================"

NODE_SRC="node-service/src"
MODELS="${NODE_SRC}/backend/enrollment/domain/models.ts"
STATE_MACHINES_INDEX="${NODE_SRC}/backend/enrollment/domain/state-machines/index.ts"

# 1. Verificar que EnrollmentState existe
echo ""
echo "1. Verificando tipo EnrollmentState..."
if grep -q "export type EnrollmentState" "${MODELS}"; then
    pass "EnrollmentState definido"
else
    fail "EnrollmentState no encontrado"
fi

# 2. Verificar estados de enrollment
echo ""
echo "2. Verificando estados de enrollment..."
if grep -q "'not_enrolled'" "${MODELS}" && \
   grep -q "'pending'" "${MODELS}" && \
   grep -q "'enrolled'" "${MODELS}" && \
   grep -q "'revoked'" "${MODELS}"; then
    pass "Todos los estados de enrollment presentes"
else
    fail "Faltan estados de enrollment"
fi

# 3. Verificar que SessionState existe
echo ""
echo "3. Verificando tipo SessionState..."
if grep -q "export type SessionState" "${MODELS}"; then
    pass "SessionState definido"
else
    fail "SessionState no encontrado"
fi

# 4. Verificar estados de session
echo ""
echo "4. Verificando estados de session..."
if grep -q "'no_session'" "${MODELS}" && \
   grep -q "'session_active'" "${MODELS}" && \
   grep -q "'session_expired'" "${MODELS}"; then
    pass "Todos los estados de session presentes"
else
    fail "Faltan estados de session"
fi

# 5. Verificar constantes ENROLLMENT_STATES
echo ""
echo "5. Verificando constantes ENROLLMENT_STATES..."
if grep -q "export const ENROLLMENT_STATES" "${MODELS}"; then
    pass "ENROLLMENT_STATES definido"
else
    fail "ENROLLMENT_STATES no encontrado"
fi

# 6. Verificar constantes SESSION_STATES
echo ""
echo "6. Verificando constantes SESSION_STATES..."
if grep -q "export const SESSION_STATES" "${MODELS}"; then
    pass "SESSION_STATES definido"
else
    fail "SESSION_STATES no encontrado"
fi

# 7. Verificar carpeta state-machines existe
echo ""
echo "7. Verificando carpeta state-machines..."
if [ -d "${NODE_SRC}/backend/enrollment/domain/state-machines" ]; then
    pass "Carpeta state-machines existe"
else
    fail "Carpeta state-machines no existe"
fi

# 8. Verificar index.ts de state-machines
echo ""
echo "8. Verificando index.ts de state-machines..."
if [ -f "${STATE_MACHINES_INDEX}" ]; then
    pass "index.ts de state-machines existe"
else
    fail "index.ts de state-machines no existe"
fi

# 9. Verificar compilacion TypeScript
echo ""
echo "9. Verificando compilacion TypeScript..."
if podman exec asistencia-node npx tsc --noEmit 2>&1; then
    pass "TypeScript compila sin errores"
else
    fail "TypeScript tiene errores de compilacion"
fi

# Resumen
echo ""
echo "=========================================="
echo "Resumen"
echo "=========================================="
echo "Pasaron: ${PASSED}"
echo "Fallaron: ${FAILED}"
echo ""

if [ "${FAILED}" -eq 0 ]; then
    echo -e "${GREEN}Fase 16.1 completada exitosamente${NC}"
    exit 0
else
    echo -e "${RED}Fase 16.1 tiene errores${NC}"
    exit 1
fi
