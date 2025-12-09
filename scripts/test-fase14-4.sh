#!/usr/bin/env bash
# Test Fase 14.4: Session Key Real en Backend (Generacion QR)
# Verifica que PoolFeeder use SessionKeyRepository para obtener claves

set -uo pipefail
cd "$(dirname "$0")/.."

PASSED=0
FAILED=0

pass() { echo "   OK - $1"; PASSED=$((PASSED + 1)); }
fail() { echo "   FAIL - $1"; FAILED=$((FAILED + 1)); }

echo "============================================================"
echo "Test Fase 14.4: Session Key Real en Backend (Generacion QR)"
echo "============================================================"

NODE_SRC="node-service/src"
POOL_FEEDER="${NODE_SRC}/backend/qr-projection/application/services/pool-feeder.service.ts"
SESSION_KEY_REPO="${NODE_SRC}/backend/enrollment/infrastructure/session-key.repository.ts"

# 1. Verificar que PoolFeeder importa SessionKeyRepository
echo ""
echo "1. Verificando imports en PoolFeeder..."
if grep -q "import.*SessionKeyRepository.*from.*enrollment" "${POOL_FEEDER}"; then
    pass "PoolFeeder importa SessionKeyRepository"
else
    fail "PoolFeeder no importa SessionKeyRepository"
fi

# 2. Verificar que PoolFeeder tiene sessionKeyRepo como dependencia
echo ""
echo "2. Verificando dependencia SessionKeyRepository en PoolFeeder..."
if grep -q "private readonly sessionKeyRepo: SessionKeyRepository" "${POOL_FEEDER}"; then
    pass "PoolFeeder tiene sessionKeyRepo como dependencia"
else
    fail "PoolFeeder no tiene sessionKeyRepo como dependencia"
fi

# 3. Verificar que PoolFeeder busca session_key del estudiante
echo ""
echo "3. Verificando busqueda de session_key en feedStudentQR..."
if grep -q "sessionKeyRepo.findByUserId" "${POOL_FEEDER}"; then
    pass "PoolFeeder busca session_key por userId"
else
    fail "PoolFeeder no busca session_key por userId"
fi

# 4. Verificar que se crea AesGcmService con session_key real
echo ""
echo "4. Verificando creacion de AesGcmService con clave real..."
if grep -q "new AesGcmService(sessionKeyData.sessionKey)" "${POOL_FEEDER}"; then
    pass "AesGcmService se crea con session_key real"
else
    fail "AesGcmService no usa session_key real"
fi

# 5. Verificar que SessionKeyRepository usa patron correcto
echo ""
echo "5. Verificando patron de clave en SessionKeyRepository..."
if grep -q 'session:\${userId}:key' "${SESSION_KEY_REPO}" || grep -q "session:.*:key" "${SESSION_KEY_REPO}"; then
    pass "SessionKeyRepository usa patron session:{userId}:key"
else
    fail "SessionKeyRepository no usa patron correcto"
fi

# 6. Verificar que SessionKeyRepository tiene metodo findByUserId
echo ""
echo "6. Verificando metodo findByUserId en SessionKeyRepository..."
if grep -q "async findByUserId" "${SESSION_KEY_REPO}"; then
    pass "SessionKeyRepository tiene findByUserId"
else
    fail "SessionKeyRepository no tiene findByUserId"
fi

# 7. Verificar fallback cuando no hay session_key
echo ""
echo "7. Verificando fallback en PoolFeeder..."
if grep -q "fallbackAesGcmService" "${POOL_FEEDER}"; then
    pass "PoolFeeder tiene fallback para desarrollo"
else
    fail "PoolFeeder no tiene fallback"
fi

# 8. Verificar documentacion del flujo actualizada
echo ""
echo "8. Verificando documentacion del flujo en PoolFeeder..."
if grep -q "Obtener session_key del estudiante" "${POOL_FEEDER}"; then
    pass "Flujo documentado incluye paso de session_key"
else
    fail "Flujo no documenta paso de session_key"
fi

# 9. Verificar compilacion TypeScript
echo ""
echo "9. Verificando compilacion TypeScript..."
if podman compose exec node-service npx tsc --noEmit 2>&1 | grep -q "error"; then
    fail "TypeScript tiene errores de compilacion"
else
    pass "TypeScript compila sin errores"
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
    echo "Fase 14.4 completada exitosamente"
    exit 0
else
    echo "Fase 14.4 tiene errores"
    exit 1
fi
