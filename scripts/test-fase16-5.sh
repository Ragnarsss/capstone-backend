#!/usr/bin/env bash
# Test Fase 16.5: Refactorizar Use Cases para usar State Machines
# Verifica que los use cases usen EnrollmentStateMachine

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
echo "Test Fase 16.5: Refactorizar Use Cases"
echo "============================================================"

NODE_SRC="node-service/src"
USECASES_DIR="${NODE_SRC}/backend/enrollment/application/use-cases"
REPO_FILE="${NODE_SRC}/backend/enrollment/infrastructure/repositories/device.repository.ts"

# 1. GetEnrollmentStatusUseCase usa inferState
echo ""
echo "1. Verificando GetEnrollmentStatusUseCase..."
GET_STATUS="${USECASES_DIR}/get-enrollment-status.use-case.ts"

if grep -q "EnrollmentStateMachine.inferState" "${GET_STATUS}"; then
    pass "Usa inferState()"
else
    fail "No usa inferState()"
fi

if grep -q "enrollmentState:" "${GET_STATUS}"; then
    pass "Output incluye enrollmentState"
else
    fail "Output no incluye enrollmentState"
fi

if grep -q "credentialId: string" "${GET_STATUS}"; then
    pass "DeviceInfo incluye credentialId (bug fix)"
else
    fail "DeviceInfo no incluye credentialId"
fi

if grep -q "status: EnrollmentState" "${GET_STATUS}"; then
    pass "DeviceInfo incluye status"
else
    fail "DeviceInfo no incluye status"
fi

# 2. StartEnrollmentUseCase valida transicion
echo ""
echo "2. Verificando StartEnrollmentUseCase..."
START_ENROLL="${USECASES_DIR}/start-enrollment.use-case.ts"

if grep -q "EnrollmentStateMachine.assertTransition" "${START_ENROLL}"; then
    pass "Usa assertTransition()"
else
    fail "No usa assertTransition()"
fi

if grep -q "previousState:" "${START_ENROLL}"; then
    pass "Output incluye previousState"
else
    fail "Output no incluye previousState"
fi

# 3. RevokeDeviceUseCase valida transicion
echo ""
echo "3. Verificando RevokeDeviceUseCase..."
REVOKE="${USECASES_DIR}/revoke-device.use-case.ts"

if grep -q "EnrollmentStateMachine.assertTransition" "${REVOKE}"; then
    pass "Usa assertTransition()"
else
    fail "No usa assertTransition()"
fi

if grep -q "device.status" "${REVOKE}"; then
    pass "Usa device.status para validar"
else
    fail "No usa device.status"
fi

# 4. LoginEcdhUseCase usa canStartSession
echo ""
echo "4. Verificando LoginEcdhUseCase..."
LOGIN="${USECASES_DIR}/login-ecdh.use-case.ts"

if grep -q "EnrollmentStateMachine.canStartSession" "${LOGIN}"; then
    pass "Usa canStartSession()"
else
    fail "No usa canStartSession()"
fi

if grep -q "SESSION_NOT_ALLOWED" "${LOGIN}"; then
    pass "Tiene error SESSION_NOT_ALLOWED"
else
    fail "No tiene error SESSION_NOT_ALLOWED"
fi

# 5. DeviceRepository tiene findByUserIdIncludingInactive
echo ""
echo "5. Verificando DeviceRepository..."

if grep -q "findByUserIdIncludingInactive" "${REPO_FILE}"; then
    pass "Tiene findByUserIdIncludingInactive()"
else
    fail "No tiene findByUserIdIncludingInactive()"
fi

# 6. Compilacion TypeScript
echo ""
echo "6. Verificando compilacion TypeScript..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    fail "TypeScript tiene errores de compilacion"
else
    pass "TypeScript compila sin errores"
fi

echo ""
echo "=========================================="
echo "Resumen"
echo "=========================================="
echo "Pasaron: $PASSED"
echo "Fallaron: $FAILED"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo "Fase 16.5 completada exitosamente"
    exit 0
else
    echo "Fase 16.5 tiene errores"
    exit 1
fi
