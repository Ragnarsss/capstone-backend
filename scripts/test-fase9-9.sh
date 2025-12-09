#!/bin/bash
# =============================================================================
# test-fase9-9.sh - Tests para Fase 9.9: Política 1:1 Enrollment
# =============================================================================
# Ejecutar desde la raíz del proyecto:
#   bash scripts/test-fase9-9.sh
# =============================================================================

# No usar set -e porque PASSED++ puede fallar con PASSED=0

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
echo "  TEST FASE 9.9: Política 1:1         "
echo "======================================"
echo ""

# =============================================================================
# Test 1: DeviceRepository
# =============================================================================
echo "Test 1: DeviceRepository"

REPO_FILE="node-service/src/backend/enrollment/infrastructure/repositories/device.repository.ts"

if [ -f "$REPO_FILE" ]; then
    pass "DeviceRepository existe"
else
    fail "DeviceRepository no existe"
fi

if grep -q "findByCredentialIdIncludingInactive" "$REPO_FILE" 2>/dev/null; then
    pass "findByCredentialIdIncludingInactive() definido"
else
    fail "findByCredentialIdIncludingInactive() no encontrado"
fi

if grep -q "revokeAllByUserId" "$REPO_FILE" 2>/dev/null; then
    pass "revokeAllByUserId() definido"
else
    fail "revokeAllByUserId() no encontrado"
fi

if grep -q "ORDER BY is_active DESC" "$REPO_FILE" 2>/dev/null; then
    pass "findByCredentialIdIncludingInactive ordena por is_active"
else
    fail "findByCredentialIdIncludingInactive no ordena correctamente"
fi

if grep -q "1:1 policy" "$REPO_FILE" 2>/dev/null; then
    pass "Documentación de política 1:1 en repositorio"
else
    fail "Falta documentación de política 1:1 en repositorio"
fi

# =============================================================================
# Test 2: FinishEnrollmentUseCase
# =============================================================================
echo ""
echo "Test 2: FinishEnrollmentUseCase"

FINISH_FILE="node-service/src/backend/enrollment/application/use-cases/finish-enrollment.use-case.ts"

if [ -f "$FINISH_FILE" ]; then
    pass "FinishEnrollmentUseCase existe"
else
    fail "FinishEnrollmentUseCase no existe"
fi

if grep -q "Política 1:1" "$FINISH_FILE" 2>/dev/null; then
    pass "Documentación de política 1:1 presente"
else
    fail "Documentación de política 1:1 no encontrada"
fi

if grep -q "previousUserUnlinked" "$FINISH_FILE" 2>/dev/null; then
    pass "previousUserUnlinked en output"
else
    fail "previousUserUnlinked no encontrado"
fi

if grep -q "ownDevicesRevoked" "$FINISH_FILE" 2>/dev/null; then
    pass "ownDevicesRevoked en output"
else
    fail "ownDevicesRevoked no encontrado"
fi

if grep -q "findByCredentialIdIncludingInactive" "$FINISH_FILE" 2>/dev/null; then
    pass "Usa findByCredentialIdIncludingInactive"
else
    fail "No usa findByCredentialIdIncludingInactive"
fi

if grep -q "revokeAllByUserId" "$FINISH_FILE" 2>/dev/null; then
    pass "Usa revokeAllByUserId"
else
    fail "No usa revokeAllByUserId"
fi

# =============================================================================
# Test 3: StartEnrollmentUseCase
# =============================================================================
echo ""
echo "Test 3: StartEnrollmentUseCase"

START_FILE="node-service/src/backend/enrollment/application/use-cases/start-enrollment.use-case.ts"

if [ -f "$START_FILE" ]; then
    pass "StartEnrollmentUseCase existe"
else
    fail "StartEnrollmentUseCase no existe"
fi

if grep -q "MAX_DEVICES_REACHED" "$START_FILE" 2>/dev/null; then
    fail "Aún tiene verificación MAX_DEVICES_REACHED (debe eliminarse)"
else
    pass "No tiene verificación MAX_DEVICES_REACHED"
fi

if grep -q "deviceCount >= 5" "$START_FILE" 2>/dev/null; then
    fail "Aún tiene límite de 5 dispositivos"
else
    pass "No tiene límite de 5 dispositivos"
fi

if grep -q "Política 1:1" "$START_FILE" 2>/dev/null; then
    pass "Documentación de política 1:1 presente"
else
    fail "Falta documentación de política 1:1"
fi

# =============================================================================
# Test 4: GetEnrollmentStatusUseCase
# =============================================================================
echo ""
echo "Test 4: GetEnrollmentStatusUseCase"

STATUS_FILE="node-service/src/backend/enrollment/application/use-cases/get-enrollment-status.use-case.ts"

if [ -f "$STATUS_FILE" ]; then
    pass "GetEnrollmentStatusUseCase existe"
else
    fail "GetEnrollmentStatusUseCase no existe"
fi

if grep -q "MAX_DEVICES = 1" "$STATUS_FILE" 2>/dev/null; then
    pass "MAX_DEVICES = 1 (política 1:1)"
else
    fail "MAX_DEVICES no es 1"
fi

if grep -q "canEnrollMore: true" "$STATUS_FILE" 2>/dev/null; then
    pass "canEnrollMore: true (siempre puede enrolar)"
else
    fail "canEnrollMore no es siempre true"
fi

# =============================================================================
# Test 5: Controllers
# =============================================================================
echo ""
echo "Test 5: Controllers"

STATUS_CTRL="node-service/src/backend/enrollment/presentation/controllers/enrollment-status.controller.ts"

if grep -q "maxDevices: 1" "$STATUS_CTRL" 2>/dev/null; then
    pass "EnrollmentStatusController stub con maxDevices: 1"
else
    fail "EnrollmentStatusController stub no tiene maxDevices: 1"
fi

START_CTRL="node-service/src/backend/enrollment/presentation/controllers/start-enrollment.controller.ts"

if grep -q "MAX_DEVICES_REACHED" "$START_CTRL" 2>/dev/null; then
    fail "StartEnrollmentController aún maneja MAX_DEVICES_REACHED"
else
    pass "StartEnrollmentController no maneja MAX_DEVICES_REACHED"
fi

if grep -q "PENALTY_ACTIVE" "$START_CTRL" 2>/dev/null; then
    pass "StartEnrollmentController maneja PENALTY_ACTIVE"
else
    fail "StartEnrollmentController no maneja PENALTY_ACTIVE"
fi

# =============================================================================
# Test 6: LoginEcdhController (sin assertion)
# =============================================================================
echo ""
echo "Test 6: LoginEcdhController (cleanup)"

LOGIN_CTRL="node-service/src/backend/enrollment/presentation/controllers/login-ecdh.controller.ts"

if grep -q "assertion" "$LOGIN_CTRL" 2>/dev/null; then
    fail "LoginEcdhController aún tiene assertion (debe eliminarse)"
else
    pass "LoginEcdhController no tiene assertion"
fi

# =============================================================================
# Test 7: Routes (sin fido2Service en loginEcdh)
# =============================================================================
echo ""
echo "Test 7: Routes"

ROUTES_FILE="node-service/src/backend/enrollment/presentation/routes.ts"

# Verificar que LoginEcdhUseCase tiene 4 argumentos, no 5
if grep -A5 "new LoginEcdhUseCase" "$ROUTES_FILE" 2>/dev/null | grep -q "fido2Service"; then
    fail "Routes aún pasa fido2Service a LoginEcdhUseCase"
else
    pass "Routes no pasa fido2Service a LoginEcdhUseCase"
fi

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "======================================"
echo "  RESUMEN FASE 9.9                    "
echo "======================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Algunos tests fallaron${NC}"
    exit 1
else
    echo -e "${GREEN}Todos los tests pasaron - Política 1:1 implementada${NC}"
    exit 0
fi
