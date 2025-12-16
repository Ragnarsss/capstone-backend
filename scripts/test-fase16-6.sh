#!/usr/bin/env bash
# Test Fase 16.6: Fix credentialId y mejoras de debugging
#
# Verifica:
# - credentialId en DeviceInfo (ya verificado en 16.5)
# - Mejoras de debugging en backend
# - Proxy /minodo-api en Apache
# - Remote logger service en frontend
# - Fix userId alumnos en dev-simulator

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
echo "Test Fase 16.6: Fix credentialId y mejoras debugging"
echo "============================================================"

NODE_SRC="node-service/src"
PHP_SRC="php-service/src"
APACHE_CONF="php-service/apache-config"

# 1. Verificar fido2.service mejoras
echo ""
echo "1. Verificando fido2.service (attestation direct, residentKey)..."
FIDO2="${NODE_SRC}/backend/enrollment/infrastructure/crypto/fido2.service.ts"

if grep -q "attestationType: 'direct'" "${FIDO2}"; then
    pass "attestationType: direct (obtiene certificado dispositivo)"
else
    fail "attestationType no es direct"
fi

if grep -q "residentKey: 'discouraged'" "${FIDO2}"; then
    pass "residentKey: discouraged (no passkey sincronizable)"
else
    fail "residentKey no es discouraged"
fi

if grep -q "Missing registration info" "${FIDO2}"; then
    pass "Validacion de registrationInfo en extractCredentialInfo"
else
    fail "Falta validacion de registrationInfo"
fi

# 2. Verificar proxy /minodo-api en Apache
echo ""
echo "2. Verificando proxy /minodo-api en Apache..."

if grep -q "minodo-api" "${APACHE_CONF}/asistencia.conf"; then
    pass "Proxy /minodo-api configurado en HTTP"
else
    fail "Falta proxy /minodo-api en HTTP"
fi

if grep -q "minodo-api" "${APACHE_CONF}/asistencia-ssl.conf"; then
    pass "Proxy /minodo-api configurado en HTTPS"
else
    fail "Falta proxy /minodo-api en HTTPS"
fi

# 3. Verificar remote-logger.service
echo ""
echo "3. Verificando remote-logger.service..."
REMOTE_LOGGER="${NODE_SRC}/frontend/features/enrollment/services/remote-logger.service.ts"

if [ -f "${REMOTE_LOGGER}" ]; then
    pass "remote-logger.service.ts existe"
else
    fail "remote-logger.service.ts no existe"
fi

if grep -q "getRemoteLogger" "${REMOTE_LOGGER}"; then
    pass "Singleton getRemoteLogger exportado"
else
    fail "Falta getRemoteLogger"
fi

# 4. Verificar fix userId alumnos en dev-simulator
echo ""
echo "4. Verificando fix userId alumnos..."
TOKEN_PHP="${PHP_SRC}/dev-simulator/api/token.php"

if grep -q "preg_replace.*RUT" "${TOKEN_PHP}" || grep -q "userId.*RUT" "${TOKEN_PHP}"; then
    pass "token.php usa RUT como userId para alumnos"
else
    fail "Falta fix de userId en token.php"
fi

# 5. Verificar endpoint client-log
echo ""
echo "5. Verificando endpoint client-log..."
ROUTES="${NODE_SRC}/backend/enrollment/presentation/routes.ts"

if grep -q "client-log" "${ROUTES}"; then
    pass "Endpoint /client-log registrado"
else
    fail "Falta endpoint /client-log"
fi

# 6. Verificar rate limit desarrollo
echo ""
echo "6. Verificando rate limit desarrollo..."

if grep -q "max: 100" "${ROUTES}"; then
    pass "Rate limit 100/min para desarrollo"
else
    fail "Rate limit no es 100/min"
fi

# 7. Compilacion TypeScript
echo ""
echo "7. Verificando compilacion TypeScript..."
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
    echo "Fase 16.6 completada exitosamente"
    exit 0
else
    echo "Fase 16.6 tiene errores"
    exit 1
fi
