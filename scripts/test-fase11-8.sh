#!/bin/bash
# Test Fase 11-8: Pipeline Factory
# Verifica que el factory de pipeline este correctamente implementado

set -e

echo "=== Test Fase 11-8: Pipeline Factory ==="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Verificar que existe el archivo del factory
echo "1. Verificando archivo pipeline.factory.ts..."
if [ -f "node-service/src/backend/attendance/domain/validation-pipeline/pipeline.factory.ts" ]; then
    echo -e "   ${GREEN}OK${NC} - Archivo existe"
else
    echo -e "   ${RED}FAIL${NC} - Archivo no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 2. Verificar funciones exportadas
echo "2. Verificando funciones del factory..."
for FUNC in "createDefaultPipeline" "createMinimalPipeline" "createCustomPipeline"; do
    if grep -q "export function $FUNC" node-service/src/backend/attendance/domain/validation-pipeline/pipeline.factory.ts; then
        echo -e "   ${GREEN}OK${NC} - $FUNC exportado"
    else
        echo -e "   ${RED}FAIL${NC} - $FUNC no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 3. Verificar tipos exportados
echo "3. Verificando tipos del factory..."
for TYPE in "PipelineDependencies" "CustomPipelineOptions" "OptionalStage"; do
    if grep -q "export.*$TYPE" node-service/src/backend/attendance/domain/validation-pipeline/pipeline.factory.ts; then
        echo -e "   ${GREEN}OK${NC} - $TYPE exportado"
    else
        echo -e "   ${RED}FAIL${NC} - $TYPE no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 4. Verificar re-export desde index.ts
echo "4. Verificando re-export desde validation-pipeline/index.ts..."
if grep -q "from './pipeline.factory'" node-service/src/backend/attendance/domain/validation-pipeline/index.ts; then
    echo -e "   ${GREEN}OK${NC} - Re-export encontrado"
else
    echo -e "   ${RED}FAIL${NC} - Re-export no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 5. Verificar que ValidateScanUseCase usa el factory
echo "5. Verificando uso del factory en ValidateScanUseCase..."
if grep -q "createDefaultPipeline" node-service/src/backend/attendance/application/validate-scan.usecase.ts; then
    echo -e "   ${GREEN}OK${NC} - ValidateScanUseCase usa createDefaultPipeline"
else
    echo -e "   ${RED}FAIL${NC} - ValidateScanUseCase no usa createDefaultPipeline"
    ERRORS=$((ERRORS + 1))
fi

# 6. Verificar que ValidateScanUseCase NO tiene buildPipeline privado
echo "6. Verificando que buildPipeline fue removido de ValidateScanUseCase..."
if grep -q "private buildPipeline" node-service/src/backend/attendance/application/validate-scan.usecase.ts; then
    echo -e "   ${RED}FAIL${NC} - buildPipeline todavia existe en UseCase"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - buildPipeline fue movido al factory"
fi

# 7. Verificar compilacion TypeScript
echo "7. Verificando compilacion TypeScript..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npm exec tsc -- --noEmit 2>&1 | grep -q "error"; then
    echo -e "   ${RED}FAIL${NC} - Errores de compilacion"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - Compilacion exitosa"
fi

# 8. Ejecutar tests unitarios existentes
echo "8. Ejecutando tests unitarios..."
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
