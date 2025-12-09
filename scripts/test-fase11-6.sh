#!/bin/bash
# Test Fase 11-6: Centralizacion de constantes de configuracion
# Verifica que las constantes esten centralizadas en shared/config

set -e

echo "=== Test Fase 11-6: Config Centralization ==="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Verificar que existe el archivo de constantes
echo "1. Verificando archivo shared/config/attendance.defaults.ts..."
if [ -f "node-service/src/shared/config/attendance.defaults.ts" ]; then
    echo -e "   ${GREEN}OK${NC} - Archivo existe"
else
    echo -e "   ${RED}FAIL${NC} - Archivo no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 2. Verificar que exporta las constantes esperadas
echo "2. Verificando exports de constantes..."
for CONST in "DEFAULT_MAX_ROUNDS" "DEFAULT_MAX_ATTEMPTS" "DEFAULT_QR_TTL_SECONDS" "DEFAULT_MIN_POOL_SIZE"; do
    if grep -q "export const $CONST" node-service/src/shared/config/attendance.defaults.ts; then
        echo -e "   ${GREEN}OK${NC} - $CONST exportado"
    else
        echo -e "   ${RED}FAIL${NC} - $CONST no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 3. Verificar re-export desde index.ts
echo "3. Verificando re-export desde shared/config/index.ts..."
if grep -q "from './attendance.defaults'" node-service/src/shared/config/index.ts; then
    echo -e "   ${GREEN}OK${NC} - Re-export encontrado"
else
    echo -e "   ${RED}FAIL${NC} - Re-export no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 4. Verificar que los archivos consumidores importan desde shared/config
echo "4. Verificando imports en archivos consumidores..."

if grep -q "from '../../../shared/config'" node-service/src/backend/attendance/infrastructure/student-session.repository.ts; then
    echo -e "   ${GREEN}OK${NC} - student-session.repository.ts importa desde shared/config"
else
    echo -e "   ${RED}FAIL${NC} - student-session.repository.ts no importa desde shared/config"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "from '../../../shared/config'" node-service/src/backend/attendance/application/participation.service.ts; then
    echo -e "   ${GREEN}OK${NC} - participation.service.ts importa desde shared/config"
else
    echo -e "   ${RED}FAIL${NC} - participation.service.ts no importa desde shared/config"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "from '../../../shared/config'" node-service/src/backend/attendance/application/complete-scan.usecase.ts; then
    echo -e "   ${GREEN}OK${NC} - complete-scan.usecase.ts importa desde shared/config"
else
    echo -e "   ${RED}FAIL${NC} - complete-scan.usecase.ts no importa desde shared/config"
    ERRORS=$((ERRORS + 1))
fi

# 5. Verificar que NO hay valores hardcodeados en DEFAULT_CONFIG
echo "5. Verificando eliminacion de valores hardcodeados..."

# En student-session.repository.ts
if grep -A5 "const DEFAULT_CONFIG" node-service/src/backend/attendance/infrastructure/student-session.repository.ts | grep -q "maxRounds: 3"; then
    echo -e "   ${RED}FAIL${NC} - student-session.repository.ts tiene maxRounds: 3 hardcodeado"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - student-session.repository.ts usa constante"
fi

# En participation.service.ts
if grep -A10 "const DEFAULT_CONFIG" node-service/src/backend/attendance/application/participation.service.ts | grep -q "maxRounds: 3"; then
    echo -e "   ${RED}FAIL${NC} - participation.service.ts tiene maxRounds: 3 hardcodeado"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - participation.service.ts usa constante"
fi

# En complete-scan.usecase.ts
if grep -A5 "const DEFAULT_CONFIG" node-service/src/backend/attendance/application/complete-scan.usecase.ts | grep -q "maxRounds: 3"; then
    echo -e "   ${RED}FAIL${NC} - complete-scan.usecase.ts tiene maxRounds: 3 hardcodeado"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - complete-scan.usecase.ts usa constante"
fi

# 6. Verificar compilacion TypeScript
echo "6. Verificando compilacion TypeScript..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npm exec tsc -- --noEmit 2>&1 | grep -q "error"; then
    echo -e "   ${RED}FAIL${NC} - Errores de compilacion"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - Compilacion exitosa"
fi

# 7. Ejecutar tests unitarios existentes
echo "7. Ejecutando tests unitarios..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npm test 2>&1 | grep -q "failed"; then
    echo -e "   ${RED}FAIL${NC} - Tests unitarios fallaron"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - Tests unitarios pasan"
fi

echo ""
echo "=== Resumen ==="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Todos los tests pasaron${NC}"
    exit 0
else
    echo -e "${RED}$ERRORS errores encontrados${NC}"
    exit 1
fi
