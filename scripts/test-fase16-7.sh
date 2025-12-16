#!/usr/bin/env bash
# Test Fase 16.7: Verificacion de dispositivo en LoginEcdh
#
# Verifica que LoginEcdh:
# - Acepta deviceFingerprint opcional
# - Actualiza fingerprint cuando cambia pero credentialId coincide
# - Retorna fingerprintUpdated en respuesta

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
echo "Test Fase 16.7: Verificacion de dispositivo en LoginEcdh"
echo "============================================================"

NODE_SRC="node-service/src"
USECASE="${NODE_SRC}/backend/enrollment/application/use-cases/login-ecdh.use-case.ts"
CONTROLLER="${NODE_SRC}/backend/enrollment/presentation/controllers/login-ecdh.controller.ts"
REPO="${NODE_SRC}/backend/enrollment/infrastructure/repositories/device.repository.ts"

# 1. LoginEcdhInput tiene deviceFingerprint opcional
echo ""
echo "1. Verificando LoginEcdhInput..."

if grep -q "deviceFingerprint?: string" "${USECASE}"; then
    pass "deviceFingerprint opcional en Input"
else
    fail "Falta deviceFingerprint en Input"
fi

# 2. LoginEcdhOutput tiene fingerprintUpdated
echo ""
echo "2. Verificando LoginEcdhOutput..."

if grep -q "fingerprintUpdated?: boolean" "${USECASE}"; then
    pass "fingerprintUpdated en Output"
else
    fail "Falta fingerprintUpdated en Output"
fi

# 3. UseCase verifica y actualiza fingerprint
echo ""
echo "3. Verificando logica de actualizacion de fingerprint..."

if grep -q "updateDeviceFingerprint" "${USECASE}"; then
    pass "Llama a updateDeviceFingerprint"
else
    fail "No llama a updateDeviceFingerprint"
fi

if grep -q "fingerprintUpdated = true" "${USECASE}"; then
    pass "Marca fingerprintUpdated cuando actualiza"
else
    fail "No marca fingerprintUpdated"
fi

# 4. DeviceRepository tiene metodo updateDeviceFingerprint
echo ""
echo "4. Verificando DeviceRepository..."

if grep -q "async updateDeviceFingerprint" "${REPO}"; then
    pass "Metodo updateDeviceFingerprint existe"
else
    fail "Falta metodo updateDeviceFingerprint"
fi

if grep -q "SET device_fingerprint" "${REPO}"; then
    pass "Query UPDATE con device_fingerprint"
else
    fail "Falta query UPDATE de fingerprint"
fi

# 5. Controller acepta deviceFingerprint
echo ""
echo "5. Verificando Controller..."

if grep -q "deviceFingerprint?: string" "${CONTROLLER}"; then
    pass "DTO tiene deviceFingerprint opcional"
else
    fail "DTO no tiene deviceFingerprint"
fi

if grep -q "deviceFingerprint," "${CONTROLLER}"; then
    pass "Controller pasa deviceFingerprint al use case"
else
    fail "Controller no pasa deviceFingerprint"
fi

# 6. Respuesta incluye fingerprintUpdated
if grep -q "fingerprintUpdated:" "${CONTROLLER}"; then
    pass "Respuesta incluye fingerprintUpdated"
else
    fail "Respuesta no incluye fingerprintUpdated"
fi

# 7. Compilacion TypeScript
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
    echo "Fase 16.7 completada exitosamente"
    exit 0
else
    echo "Fase 16.7 tiene errores"
    exit 1
fi
