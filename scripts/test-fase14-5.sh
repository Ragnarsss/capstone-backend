#!/usr/bin/env bash
# Test Fase 14.5: Session Key Real en Backend (Validacion)
#
# Verifica que el stage de decrypt use la session_key del estudiante
# para desencriptar los payloads en la validacion.

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
echo "Test Fase 14.5: Session Key Real en Backend (Validacion)"
echo "============================================================"

NODE_SRC="node-service/src"
DECRYPT_STAGE="${NODE_SRC}/backend/attendance/domain/validation-pipeline/stages/decrypt.stage.ts"
STAGES_INDEX="${NODE_SRC}/backend/attendance/domain/validation-pipeline/stages/index.ts"

# 1. Verificar import de SessionKeyRepository en decrypt.stage.ts
echo ""
echo "1. Verificando imports en DecryptStage..."
if grep -q "import.*SessionKeyRepository" "${DECRYPT_STAGE}"; then
    pass "DecryptStage importa SessionKeyRepository"
else
    fail "DecryptStage no importa SessionKeyRepository"
fi

# 2. Verificar interface DecryptStageDeps
echo ""
echo "2. Verificando interface DecryptStageDeps..."
if grep -q "interface DecryptStageDeps" "${DECRYPT_STAGE}"; then
    pass "DecryptStageDeps interface definida"
else
    fail "DecryptStageDeps interface no encontrada"
fi

# 3. Verificar que DecryptStageDeps tiene sessionKeyRepo
echo ""
echo "3. Verificando dependencia sessionKeyRepo en DecryptStageDeps..."
if grep -q "sessionKeyRepo.*SessionKeyRepository" "${DECRYPT_STAGE}"; then
    pass "DecryptStageDeps incluye sessionKeyRepo"
else
    fail "DecryptStageDeps no incluye sessionKeyRepo"
fi

# 4. Verificar overload de createDecryptStage para retrocompatibilidad
echo ""
echo "4. Verificando overloads de createDecryptStage..."
if grep -c "export function createDecryptStage" "${DECRYPT_STAGE}" | grep -q "2"; then
    pass "createDecryptStage tiene overloads para retrocompatibilidad"
else
    # Contar manualmente
    COUNT=$(grep -c "export function createDecryptStage\|function createDecryptStage" "${DECRYPT_STAGE}" || echo "0")
    if [ "$COUNT" -ge 2 ]; then
        pass "createDecryptStage tiene overloads para retrocompatibilidad"
    else
        fail "createDecryptStage no tiene overloads"
    fi
fi

# 5. Verificar busqueda de session_key por studentId
echo ""
echo "5. Verificando busqueda de session_key en execute..."
if grep -q "findByUserId.*ctx.studentId\|findByUserId(ctx.studentId)" "${DECRYPT_STAGE}"; then
    pass "DecryptStage busca session_key por ctx.studentId"
else
    fail "DecryptStage no busca session_key por studentId"
fi

# 6. Verificar creacion de AesGcmService con session_key real
echo ""
echo "6. Verificando creacion de AesGcmService con clave real..."
if grep -q "new AesGcmService(sessionKeyData.sessionKey)" "${DECRYPT_STAGE}"; then
    pass "AesGcmService se crea con session_key real"
else
    fail "AesGcmService no usa session_key real"
fi

# 7. Verificar fallback a servicio de respaldo
echo ""
echo "7. Verificando fallback en DecryptStage..."
if grep -q "fallbackAesGcmService" "${DECRYPT_STAGE}"; then
    pass "DecryptStage tiene fallback para desarrollo"
else
    fail "DecryptStage no tiene fallback"
fi

# 8. Verificar export de DecryptStageDeps en index.ts
echo ""
echo "8. Verificando export de DecryptStageDeps..."
if grep -q "export type.*DecryptStageDeps" "${STAGES_INDEX}"; then
    pass "DecryptStageDeps exportado en index.ts"
else
    fail "DecryptStageDeps no exportado"
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
    echo -e "${GREEN}Fase 14.5 completada exitosamente${NC}"
    exit 0
else
    echo -e "${RED}Fase 14.5 tiene errores${NC}"
    exit 1
fi
