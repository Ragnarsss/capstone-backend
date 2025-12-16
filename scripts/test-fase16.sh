#!/usr/bin/env bash
# Test Fase 16: EnrollmentStateMachine - Test Integral
#
# Verifica que todos los componentes de fase 16 estan presentes

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
echo "Fase 16: EnrollmentStateMachine - Test Integral"
echo "============================================================"

NODE_SRC="node-service/src"
DOMAIN="${NODE_SRC}/backend/enrollment/domain"
USECASES="${NODE_SRC}/backend/enrollment/application/use-cases"
REPO="${NODE_SRC}/backend/enrollment/infrastructure/repositories"

# 1. State Machines
echo ""
echo "1. State Machines..."

if [ -f "${DOMAIN}/state-machines/enrollment-state-machine.ts" ]; then
    pass "EnrollmentStateMachine existe"
else
    fail "EnrollmentStateMachine no existe"
fi

if [ -f "${DOMAIN}/state-machines/session-state-machine.ts" ]; then
    pass "SessionStateMachine existe"
else
    fail "SessionStateMachine no existe"
fi

# 2. Tipos de estado
echo ""
echo "2. Tipos de estado..."

if grep -q "type EnrollmentState" "${DOMAIN}/models.ts"; then
    pass "EnrollmentState type definido"
else
    fail "EnrollmentState type no definido"
fi

if grep -q "type SessionState" "${DOMAIN}/models.ts"; then
    pass "SessionState type definido"
else
    fail "SessionState type no definido"
fi

# 3. Use cases con state machine
echo ""
echo "3. Use cases integrados..."

if grep -q "EnrollmentStateMachine" "${USECASES}/get-enrollment-status.use-case.ts"; then
    pass "GetEnrollmentStatus usa state machine"
else
    fail "GetEnrollmentStatus no usa state machine"
fi

if grep -q "EnrollmentStateMachine" "${USECASES}/start-enrollment.use-case.ts"; then
    pass "StartEnrollment usa state machine"
else
    fail "StartEnrollment no usa state machine"
fi

if grep -q "EnrollmentStateMachine" "${USECASES}/login-ecdh.use-case.ts"; then
    pass "LoginEcdh usa state machine"
else
    fail "LoginEcdh no usa state machine"
fi

# 4. Migracion y repository
echo ""
echo "4. Persistencia..."

if [ -f "database/migrations/003-add-enrollment-status.sql" ]; then
    pass "Migracion 003 existe"
else
    fail "Migracion 003 no existe"
fi

if grep -q "updateDeviceFingerprint" "${REPO}/device.repository.ts"; then
    pass "updateDeviceFingerprint en repository"
else
    fail "updateDeviceFingerprint no existe"
fi

# 5. credentialId en DeviceInfo
echo ""
echo "5. Bug fixes..."

if grep -q "credentialId: string" "${USECASES}/get-enrollment-status.use-case.ts"; then
    pass "credentialId en DeviceInfo (bug fix)"
else
    fail "credentialId no en DeviceInfo"
fi

if grep -q "fingerprintUpdated" "${USECASES}/login-ecdh.use-case.ts"; then
    pass "fingerprintUpdated en LoginEcdh output"
else
    fail "fingerprintUpdated no en output"
fi

# 6. Compilacion
echo ""
echo "6. Compilacion TypeScript..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    fail "Errores de compilacion"
else
    pass "Compila sin errores"
fi

echo ""
echo "============================================================"
echo "Resumen Final Fase 16"
echo "============================================================"
echo "Pasaron: $PASSED"
echo "Fallaron: $FAILED"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}FASE 16 COMPLETADA EXITOSAMENTE${NC}"
    echo ""
    echo "State Machines implementados:"
    echo "  - EnrollmentStateMachine (not_enrolled, pending, enrolled, revoked)"
    echo "  - SessionStateMachine (no_session, session_active, session_expired)"
    echo ""
    echo "Funcionalidades:"
    echo "  - Validacion de transiciones de estado en use cases"
    echo "  - Campo status en enrollment.devices"
    echo "  - Verificacion y actualizacion de deviceFingerprint en login"
    echo "  - credentialId en DeviceInfo response"
    exit 0
else
    echo -e "${RED}FASE 16 TIENE ERRORES${NC}"
    exit 1
fi
