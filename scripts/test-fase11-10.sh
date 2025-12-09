#!/bin/bash
# test-fase11-10.sh - Verificacion de limpieza de codigo sin uso
# Fase 11-10: Eliminar codigo deprecado y sin uso

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

BASE_PATH="${PROJECT_DIR}/node-service/src"
QR_PROJ_INFRA="${BASE_PATH}/backend/qr-projection/infrastructure"
QR_PROJ_DOMAIN="${BASE_PATH}/backend/qr-projection/domain"
ATTENDANCE="${BASE_PATH}/backend/attendance"
SHARED="${BASE_PATH}/shared"

echo "=========================================="
echo "Test Fase 11-10: Limpieza de Codigo Sin Uso"
echo "=========================================="
echo ""

# 1. Verificar archivos eliminados
echo "1. Verificando archivos eliminados..."
if [ ! -f "${QR_PROJ_INFRA}/qrcode-library.renderer.ts" ]; then
    pass "qrcode-library.renderer.ts eliminado"
else
    fail "qrcode-library.renderer.ts aun existe"
fi

if [ ! -f "${QR_PROJ_INFRA}/qr-metadata.repository.ts" ]; then
    pass "qr-metadata.repository.ts eliminado"
else
    fail "qr-metadata.repository.ts aun existe"
fi

if [ ! -f "${QR_PROJ_INFRA}/projection-queue.repository.ts" ]; then
    pass "projection-queue.repository.ts eliminado"
else
    fail "projection-queue.repository.ts aun existe"
fi

# 2. Verificar tipos eliminados de models.ts
echo ""
echo "2. Verificando tipos eliminados de models.ts..."
if ! grep -q "interface QRPayload {" "${QR_PROJ_DOMAIN}/models.ts" 2>/dev/null; then
    pass "QRPayload eliminado de models.ts"
else
    fail "QRPayload aun existe en models.ts"
fi

if ! grep -q "interface QRMetadata {" "${QR_PROJ_DOMAIN}/models.ts" 2>/dev/null; then
    pass "QRMetadata eliminado de models.ts"
else
    fail "QRMetadata aun existe en models.ts"
fi

if ! grep -q "interface CountdownState {" "${QR_PROJ_DOMAIN}/models.ts" 2>/dev/null; then
    pass "CountdownState eliminado de models.ts"
else
    fail "CountdownState aun existe en models.ts"
fi

if ! grep -q "interface ProjectionSession {" "${QR_PROJ_DOMAIN}/models.ts" 2>/dev/null; then
    pass "ProjectionSession eliminado de models.ts"
else
    fail "ProjectionSession aun existe en models.ts"
fi

# 3. Verificar exports limpios en domain/index.ts
echo ""
echo "3. Verificando exports limpios en domain/index.ts..."
if ! grep -q "QRPayload," "${QR_PROJ_DOMAIN}/index.ts" 2>/dev/null; then
    pass "QRPayload no exportado en index.ts"
else
    fail "QRPayload aun exportado en index.ts"
fi

if ! grep -q "QRMetadata" "${QR_PROJ_DOMAIN}/index.ts" 2>/dev/null; then
    pass "QRMetadata no exportado en index.ts"
else
    fail "QRMetadata aun exportado en index.ts"
fi

if ! grep -q "Legacy" "${QR_PROJ_DOMAIN}/index.ts" 2>/dev/null; then
    pass "Comentario Legacy eliminado de index.ts"
else
    fail "Comentario Legacy aun existe en index.ts"
fi

# 4. Verificar ProjectionCallbacksLegacy eliminado
echo ""
echo "4. Verificando ProjectionCallbacksLegacy eliminado..."
if ! grep -q "ProjectionCallbacksLegacy" "${BASE_PATH}/backend/qr-projection/application/qr-projection.service.ts" 2>/dev/null; then
    pass "ProjectionCallbacksLegacy eliminado"
else
    fail "ProjectionCallbacksLegacy aun existe"
fi

# 5. Verificar metodos deprecados eliminados de QRGenerator
echo ""
echo "5. Verificando metodos deprecados de QRGenerator..."
if ! grep -q "generateUniqueMessage" "${QR_PROJ_DOMAIN}/qr-generator.ts" 2>/dev/null; then
    pass "generateUniqueMessage eliminado"
else
    fail "generateUniqueMessage aun existe"
fi

if ! grep -q "generate(sessionId: SessionId): QRPayload" "${QR_PROJ_DOMAIN}/qr-generator.ts" 2>/dev/null; then
    pass "generate() deprecado eliminado"
else
    fail "generate() deprecado aun existe"
fi

if ! grep -q "generateV1Unencrypted" "${QR_PROJ_DOMAIN}/qr-generator.ts" 2>/dev/null; then
    pass "generateV1Unencrypted eliminado"
else
    fail "generateV1Unencrypted aun existe"
fi

# 6. Verificar shared/types limpio
echo ""
echo "6. Verificando shared/types/index.ts limpio..."
if ! grep -q "interface BaseEntity" "${SHARED}/types/index.ts" 2>/dev/null; then
    pass "BaseEntity eliminado"
else
    fail "BaseEntity aun existe"
fi

if ! grep -q "interface Result<T>" "${SHARED}/types/index.ts" 2>/dev/null; then
    pass "Result<T> eliminado"
else
    fail "Result<T> aun existe"
fi

# 7. Verificar attendance legacy limpio
echo ""
echo "7. Verificando attendance legacy limpio..."
if ! grep -q "mapLegacyErrorCode" "${ATTENDANCE}/presentation/error-mapper.ts" 2>/dev/null; then
    pass "mapLegacyErrorCode eliminado"
else
    fail "mapLegacyErrorCode aun existe"
fi

if ! grep -q "type StudentSessionState" "${ATTENDANCE}/infrastructure/student-session.repository.ts" 2>/dev/null; then
    pass "StudentSessionState alias eliminado"
else
    fail "StudentSessionState alias aun existe"
fi

if grep -q "StudentSessionData" "${ATTENDANCE}/infrastructure/index.ts" 2>/dev/null; then
    pass "StudentSessionData exportado correctamente"
else
    fail "StudentSessionData no exportado"
fi

# 8. Verificar MOCK_SESSION_KEY marcado para eliminacion
echo ""
echo "8. Verificando MOCK_SESSION_KEY marcado para eliminacion futura..."
if grep -q "@deprecated" "${BASE_PATH}/frontend/shared/crypto/mock-keys.ts" 2>/dev/null; then
    pass "mock-keys.ts marcado con @deprecated"
else
    fail "mock-keys.ts no tiene @deprecated"
fi

if grep -q "Fase 12" "${BASE_PATH}/frontend/shared/crypto/mock-keys.ts" 2>/dev/null; then
    pass "Fecha estimada de eliminacion documentada"
else
    fail "Fecha estimada no documentada"
fi

# 9. Verificar que QRPayloadEnvelope sigue existiendo (no eliminar accidentalmente)
echo ""
echo "9. Verificando tipos necesarios siguen existiendo..."
if grep -q "interface QRPayloadEnvelope" "${QR_PROJ_DOMAIN}/models.ts" 2>/dev/null; then
    pass "QRPayloadEnvelope existe"
else
    fail "QRPayloadEnvelope fue eliminado por error"
fi

if grep -q "class QRGenerator" "${QR_PROJ_DOMAIN}/qr-generator.ts" 2>/dev/null; then
    pass "QRGenerator existe"
else
    fail "QRGenerator fue eliminado por error"
fi

if grep -q "generateV1" "${QR_PROJ_DOMAIN}/qr-generator.ts" 2>/dev/null; then
    pass "generateV1 existe"
else
    fail "generateV1 fue eliminado por error"
fi

if grep -q "generateForStudent" "${QR_PROJ_DOMAIN}/qr-generator.ts" 2>/dev/null; then
    pass "generateForStudent existe"
else
    fail "generateForStudent fue eliminado por error"
fi

# Resumen
echo ""
echo "=========================================="
echo "Resumen"
echo "=========================================="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Fase 11-10 completada exitosamente${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}Fase 11-10 tiene errores${NC}"
    exit 1
fi
