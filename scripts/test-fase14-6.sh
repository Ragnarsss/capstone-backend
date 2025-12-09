#!/usr/bin/env bash
# Test Fase 14.6: Enrollment Funcional
#
# Verifica que EnrollmentService delegue a los Use Cases reales
# en lugar de usar stubs.

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
echo "Test Fase 14.6: Enrollment Funcional"
echo "============================================================"

NODE_SRC="node-service/src"
ENROLLMENT_SERVICE="${NODE_SRC}/backend/enrollment/application/enrollment.service.ts"
CONTROLLER="${NODE_SRC}/backend/enrollment/presentation/enrollment-controller.ts"
TYPES="${NODE_SRC}/backend/enrollment/presentation/types.ts"
SCHEMAS="${NODE_SRC}/backend/enrollment/presentation/validation-schemas.ts"

# 1. Verificar que EnrollmentService importa Use Cases
echo ""
echo "1. Verificando imports de Use Cases en EnrollmentService..."
if grep -q "StartEnrollmentUseCase" "${ENROLLMENT_SERVICE}" && \
   grep -q "FinishEnrollmentUseCase" "${ENROLLMENT_SERVICE}" && \
   grep -q "GetEnrollmentStatusUseCase" "${ENROLLMENT_SERVICE}" && \
   grep -q "LoginEcdhUseCase" "${ENROLLMENT_SERVICE}"; then
    pass "EnrollmentService importa todos los Use Cases"
else
    fail "EnrollmentService no importa todos los Use Cases"
fi

# 2. Verificar que EnrollmentService NO tiene TODOs
echo ""
echo "2. Verificando que no hay TODOs en EnrollmentService..."
if ! grep -q "// TODO:" "${ENROLLMENT_SERVICE}"; then
    pass "EnrollmentService no tiene TODOs"
else
    fail "EnrollmentService aun tiene TODOs"
fi

# 3. Verificar que EnrollmentService instancia Use Cases
echo ""
echo "3. Verificando instanciacion de Use Cases..."
if grep -q "new StartEnrollmentUseCase" "${ENROLLMENT_SERVICE}" && \
   grep -q "new FinishEnrollmentUseCase" "${ENROLLMENT_SERVICE}" && \
   grep -q "new LoginEcdhUseCase" "${ENROLLMENT_SERVICE}"; then
    pass "EnrollmentService instancia Use Cases"
else
    fail "EnrollmentService no instancia Use Cases"
fi

# 4. Verificar que LoginECDHRequestDTO tiene credentialId
echo ""
echo "4. Verificando LoginECDHRequestDTO..."
if grep -q "credentialId:" "${TYPES}"; then
    pass "LoginECDHRequestDTO tiene credentialId"
else
    fail "LoginECDHRequestDTO no tiene credentialId"
fi

# 5. Verificar que FinishEnrollmentRequestDTO tiene deviceFingerprint
echo ""
echo "5. Verificando FinishEnrollmentRequestDTO..."
if grep -q "deviceFingerprint" "${TYPES}"; then
    pass "FinishEnrollmentRequestDTO tiene deviceFingerprint"
else
    fail "FinishEnrollmentRequestDTO no tiene deviceFingerprint"
fi

# 6. Verificar validation schema para credentialId
echo ""
echo "6. Verificando validation schema para login..."
if grep -q "credentialId" "${SCHEMAS}"; then
    pass "Validation schema incluye credentialId"
else
    fail "Validation schema no incluye credentialId"
fi

# 7. Verificar que controller usa credentialId
echo ""
echo "7. Verificando controller loginECDH..."
if grep -q "credentialId.*publicKey\|publicKey.*credentialId" "${CONTROLLER}"; then
    pass "Controller usa credentialId y publicKey"
else
    # Verificar por separado
    if grep -q "credentialId" "${CONTROLLER}" && grep -q "publicKey" "${CONTROLLER}"; then
        pass "Controller usa credentialId y publicKey"
    else
        fail "Controller no usa credentialId correctamente"
    fi
fi

# 8. Verificar tabla enrollment.devices existe
echo ""
echo "8. Verificando tabla enrollment.devices..."
if podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "SELECT 1 FROM enrollment.devices LIMIT 0" 2>/dev/null; then
    pass "Tabla enrollment.devices existe"
else
    fail "Tabla enrollment.devices no existe"
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
    echo -e "${GREEN}Fase 14.6 completada exitosamente${NC}"
    exit 0
else
    echo -e "${RED}Fase 14.6 tiene errores${NC}"
    exit 1
fi
