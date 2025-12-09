#!/bin/bash
# Test Fase 11-9: Limpieza Final
# Verifica la eliminacion de FakeQRGenerator y migracion a PoolBalancer

set -e

echo "=== Test Fase 11-9: Limpieza Final ==="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Verificar que FakeQRGenerator fue eliminado
echo "1. Verificando eliminacion de fake-qr-generator.ts..."
if [ -f "node-service/src/backend/attendance/application/fake-qr-generator.ts" ]; then
    echo -e "   ${RED}FAIL${NC} - Archivo todavia existe"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - Archivo eliminado"
fi

# 2. Verificar que index.ts no exporta FakeQRGenerator
echo "2. Verificando que index.ts no exporta FakeQRGenerator..."
if grep -q "FakeQRGenerator" node-service/src/backend/attendance/application/index.ts; then
    echo -e "   ${RED}FAIL${NC} - index.ts aun exporta FakeQRGenerator"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - index.ts no exporta FakeQRGenerator"
fi

# 3. Verificar que routes.ts no importa FakeQRGenerator
echo "3. Verificando que routes.ts no importa FakeQRGenerator..."
if grep -q "import.*FakeQRGenerator" node-service/src/backend/attendance/presentation/routes.ts; then
    echo -e "   ${RED}FAIL${NC} - routes.ts aun importa FakeQRGenerator"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - routes.ts no importa FakeQRGenerator"
fi

# 4. Verificar que routes.ts importa PoolBalancer
echo "4. Verificando que routes.ts importa PoolBalancer..."
if grep -q "import.*PoolBalancer" node-service/src/backend/attendance/presentation/routes.ts; then
    echo -e "   ${GREEN}OK${NC} - routes.ts importa PoolBalancer"
else
    echo -e "   ${RED}FAIL${NC} - routes.ts no importa PoolBalancer"
    ERRORS=$((ERRORS + 1))
fi

# 5. Verificar que routes.ts usa poolBalancer (no fakeQRGenerator)
echo "5. Verificando uso de poolBalancer en routes.ts..."
if grep -q "fakeQRGenerator" node-service/src/backend/attendance/presentation/routes.ts; then
    echo -e "   ${RED}FAIL${NC} - routes.ts aun usa fakeQRGenerator"
    ERRORS=$((ERRORS + 1))
elif grep -q "poolBalancer" node-service/src/backend/attendance/presentation/routes.ts; then
    echo -e "   ${GREEN}OK${NC} - routes.ts usa poolBalancer"
else
    echo -e "   ${RED}FAIL${NC} - routes.ts no usa poolBalancer"
    ERRORS=$((ERRORS + 1))
fi

# 6. Verificar que PoolBalancer existe en qr-projection
echo "6. Verificando PoolBalancer en qr-projection..."
if [ -f "node-service/src/backend/qr-projection/application/services/pool-balancer.service.ts" ]; then
    echo -e "   ${GREEN}OK${NC} - pool-balancer.service.ts existe"
else
    echo -e "   ${RED}FAIL${NC} - pool-balancer.service.ts no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 7. Verificar metodos de PoolBalancer
echo "7. Verificando metodos de PoolBalancer..."
for METHOD in "injectFakes" "balance" "getConfig" "updateConfig"; do
    if grep -q "$METHOD" node-service/src/backend/qr-projection/application/services/pool-balancer.service.ts; then
        echo -e "   ${GREEN}OK${NC} - $METHOD encontrado"
    else
        echo -e "   ${RED}FAIL${NC} - $METHOD no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 8. Verificar ARCHITECTURE.md actualizado
echo "8. Verificando ARCHITECTURE.md..."
if grep -q "FakeQRGenerator.*Application.*@deprecated" node-service/ARCHITECTURE.md; then
    echo -e "   ${RED}FAIL${NC} - ARCHITECTURE.md aun lista FakeQRGenerator como activo"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - ARCHITECTURE.md actualizado"
fi

# 9. Verificar compilacion TypeScript
echo "9. Verificando compilacion TypeScript..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npm exec tsc -- --noEmit 2>&1 | grep -q "error"; then
    echo -e "   ${RED}FAIL${NC} - Errores de compilacion"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - Compilacion exitosa"
fi

# 10. Ejecutar tests unitarios existentes
echo "10. Ejecutando tests unitarios..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npm test 2>&1 | grep -q "failed"; then
    echo -e "   ${RED}FAIL${NC} - Tests unitarios fallaron"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - Tests unitarios pasan"
fi

echo ""
echo "=== Resumen ==="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Fase 11-9 completada - Limpieza Final${NC}"
    echo ""
    echo "Cambios realizados:"
    echo "  - FakeQRGenerator eliminado de attendance/application"
    echo "  - Dev endpoints migrados a usar PoolBalancer"
    echo "  - index.ts actualizado"
    echo "  - ARCHITECTURE.md actualizado"
    echo ""
    echo "Beneficios:"
    echo "  - SoC mejorado: generacion de fakes en qr-projection"
    echo "  - DRY: una sola implementacion de pool balancing"
    echo "  - Codigo mas limpio sin @deprecated"
    exit 0
else
    echo -e "${RED}$ERRORS errores encontrados${NC}"
    exit 1
fi
