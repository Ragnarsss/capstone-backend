#!/bin/bash
# test-fase13.sh - Verificacion de control de logs por entorno
# Fase 13: Logs solo en desarrollo, suprimidos en produccion

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

NODE_SRC="${PROJECT_DIR}/node-service/src"
SHARED_INFRA="${NODE_SRC}/shared/infrastructure"
MIDDLEWARE="${NODE_SRC}/middleware"
BACKEND="${NODE_SRC}/backend"

echo "=========================================="
echo "Test Fase 13: Control de Logs por Entorno"
echo "=========================================="
echo ""

# 1. Verificar que logger.ts existe
echo "1. Verificando logger centralizado..."
if [ -f "${SHARED_INFRA}/logger.ts" ]; then
    pass "logger.ts existe en shared/infrastructure"
else
    fail "logger.ts no existe"
fi

# 2. Verificar que logger exporta metodos correctos
if grep -q "export const logger" "${SHARED_INFRA}/logger.ts" 2>/dev/null; then
    pass "logger exportado correctamente"
else
    fail "logger no exportado"
fi

if grep -q "config.env.isDevelopment\|config.env.isProduction" "${SHARED_INFRA}/logger.ts" 2>/dev/null; then
    pass "logger usa config.env para control"
else
    fail "logger no usa config.env"
fi

# 3. Verificar que no hay console.log directo en archivos migrados
echo ""
echo "2. Verificando migracion de logs en shared/infrastructure..."

FILES_INFRA=(
    "${SHARED_INFRA}/valkey/valkey-client.ts"
    "${SHARED_INFRA}/valkey/active-session.repository.ts"
    "${SHARED_INFRA}/valkey/projection-pool.repository.ts"
    "${SHARED_INFRA}/database/postgres-pool.ts"
    "${SHARED_INFRA}/crypto/aes-gcm.service.ts"
)

for file in "${FILES_INFRA[@]}"; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        # Verificar que usa logger
        if grep -q "import.*logger.*from" "$file" 2>/dev/null; then
            # Verificar que NO usa console.log/error/warn directamente (excepto en comentarios)
            if grep -E "^\s*(console\.(log|error|warn|debug|info))" "$file" 2>/dev/null | grep -v "//" > /dev/null; then
                fail "$filename aun tiene console.* directo"
            else
                pass "$filename migrado a logger"
            fi
        else
            fail "$filename no importa logger"
        fi
    fi
done

# 4. Verificar middleware
echo ""
echo "3. Verificando migracion de logs en middleware..."

FILES_MIDDLEWARE=(
    "${MIDDLEWARE}/websocket-auth.middleware.ts"
    "${MIDDLEWARE}/rate-limit.middleware.ts"
    "${MIDDLEWARE}/error-handler.middleware.ts"
)

for file in "${FILES_MIDDLEWARE[@]}"; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        if grep -q "import.*logger.*from" "$file" 2>/dev/null; then
            if grep -E "^\s*(console\.(log|error|warn|debug|info))" "$file" 2>/dev/null | grep -v "//" > /dev/null; then
                fail "$filename aun tiene console.* directo"
            else
                pass "$filename migrado a logger"
            fi
        else
            fail "$filename no importa logger"
        fi
    fi
done

# 5. Verificar backend modules
echo ""
echo "4. Verificando migracion de logs en backend..."

FILES_BACKEND=(
    "${BACKEND}/qr-projection/presentation/websocket-controller.ts"
    "${BACKEND}/qr-projection/application/qr-projection.service.ts"
    "${BACKEND}/qr-projection/application/services/pool-balancer.service.ts"
    "${BACKEND}/qr-projection/application/services/qr-emitter.service.ts"
    "${BACKEND}/qr-projection/infrastructure/qr-payload.repository.ts"
    "${BACKEND}/attendance/application/complete-scan.usecase.ts"
    "${BACKEND}/attendance/application/participation.service.ts"
    "${BACKEND}/attendance/infrastructure/student-session.repository.ts"
    "${BACKEND}/attendance/infrastructure/fraud-metrics.repository.ts"
    "${BACKEND}/attendance/presentation/routes.ts"
)

for file in "${FILES_BACKEND[@]}"; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        if grep -q "import.*logger.*from" "$file" 2>/dev/null; then
            if grep -E "^\s*(console\.(log|error|warn|debug|info))" "$file" 2>/dev/null | grep -v "//" > /dev/null; then
                fail "$filename aun tiene console.* directo"
            else
                pass "$filename migrado a logger"
            fi
        else
            fail "$filename no importa logger"
        fi
    fi
done

# 6. Verificar vite.config.ts tiene drop console
echo ""
echo "5. Verificando Vite config..."

if grep -q "drop:.*console" "${PROJECT_DIR}/node-service/vite.config.ts" 2>/dev/null; then
    pass "vite.config.ts tiene drop console en produccion"
else
    fail "vite.config.ts no tiene drop console"
fi

# 7. Verificar compose.dev.yaml tiene LOG_LEVEL
echo ""
echo "6. Verificando compose files..."

if grep -q "LOG_LEVEL=debug" "${PROJECT_DIR}/compose.dev.yaml" 2>/dev/null; then
    pass "compose.dev.yaml tiene LOG_LEVEL=debug"
else
    fail "compose.dev.yaml no tiene LOG_LEVEL"
fi

if grep -q "ENABLE_VERBOSE_LOGS=true" "${PROJECT_DIR}/compose.dev.yaml" 2>/dev/null; then
    pass "compose.dev.yaml tiene ENABLE_VERBOSE_LOGS=true"
else
    fail "compose.dev.yaml no tiene ENABLE_VERBOSE_LOGS"
fi

# Verificar que compose.prod.yaml NO tiene estas variables (default es produccion)
if ! grep -q "LOG_LEVEL" "${PROJECT_DIR}/compose.prod.yaml" 2>/dev/null; then
    pass "compose.prod.yaml no tiene LOG_LEVEL (usa default warn)"
else
    info "compose.prod.yaml tiene LOG_LEVEL definido (verificar que sea warn o error)"
fi

if ! grep -q "ENABLE_VERBOSE_LOGS" "${PROJECT_DIR}/compose.prod.yaml" 2>/dev/null; then
    pass "compose.prod.yaml no tiene ENABLE_VERBOSE_LOGS (default false)"
else
    fail "compose.prod.yaml tiene ENABLE_VERBOSE_LOGS (no deberia)"
fi

# 8. Verificar TypeScript compila (si los contenedores estan corriendo)
echo ""
echo "7. Verificando TypeScript..."

if podman ps --format "{{.Names}}" 2>/dev/null | grep -q "asistencia-node"; then
    TSC_OUTPUT=$(podman exec asistencia-node npx tsc --noEmit 2>&1)
    if [ $? -eq 0 ]; then
        pass "TypeScript compila sin errores"
    else
        fail "TypeScript tiene errores"
        echo "$TSC_OUTPUT" | head -10
    fi
else
    info "Contenedor node no esta corriendo, saltando verificacion TypeScript"
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
    echo -e "${GREEN}Fase 13 completada exitosamente${NC}"
    echo ""
    echo "Proximos pasos:"
    echo "  1. Reconstruir contenedores: podman compose -f compose.yaml -f compose.dev.yaml build"
    echo "  2. Verificar funcionalidad: bash scripts/test-baseline.sh"
    echo "  3. Commit: git add -p && git commit -m 'feat(logging): add environment-based log control'"
    exit 0
else
    echo ""
    echo -e "${RED}Fase 13 tiene errores${NC}"
    exit 1
fi
