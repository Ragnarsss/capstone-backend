#!/bin/bash
# Test Fase 11-7: StudentSession Entity
# Verifica que la entidad rica StudentSession este correctamente implementada

set -e

echo "=== Test Fase 11-7: StudentSession Entity ==="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Verificar que existe el archivo de la entidad
echo "1. Verificando archivo student-session.entity.ts..."
if [ -f "node-service/src/backend/attendance/domain/student-session.entity.ts" ]; then
    echo -e "   ${GREEN}OK${NC} - Archivo existe"
else
    echo -e "   ${RED}FAIL${NC} - Archivo no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 2. Verificar clase StudentSession
echo "2. Verificando clase StudentSession..."
if grep -q "export class StudentSession" node-service/src/backend/attendance/domain/student-session.entity.ts; then
    echo -e "   ${GREEN}OK${NC} - Clase StudentSession exportada"
else
    echo -e "   ${RED}FAIL${NC} - Clase StudentSession no encontrada"
    ERRORS=$((ERRORS + 1))
fi

# 3. Verificar factory methods
echo "3. Verificando factory methods..."
for METHOD in "static create" "static fromData"; do
    if grep -q "$METHOD" node-service/src/backend/attendance/domain/student-session.entity.ts; then
        echo -e "   ${GREEN}OK${NC} - $METHOD encontrado"
    else
        echo -e "   ${RED}FAIL${NC} - $METHOD no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 4. Verificar metodos de negocio
echo "4. Verificando metodos de negocio..."
for METHOD in "completeRound" "failRound" "isComplete" "canRetry" "withActiveQR"; do
    if grep -q "$METHOD" node-service/src/backend/attendance/domain/student-session.entity.ts; then
        echo -e "   ${GREEN}OK${NC} - $METHOD encontrado"
    else
        echo -e "   ${RED}FAIL${NC} - $METHOD no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 5. Verificar tipos exportados
echo "5. Verificando tipos exportados..."
for TYPE in "StudentSessionData" "StudentSessionStatus" "RoundResult" "CompleteRoundResult" "FailRoundResult"; do
    if grep -q "export.*$TYPE" node-service/src/backend/attendance/domain/student-session.entity.ts; then
        echo -e "   ${GREEN}OK${NC} - $TYPE exportado"
    else
        echo -e "   ${RED}FAIL${NC} - $TYPE no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 6. Verificar re-export desde domain/index.ts
echo "6. Verificando re-export desde domain/index.ts..."
if grep -q "from './student-session.entity'" node-service/src/backend/attendance/domain/index.ts; then
    echo -e "   ${GREEN}OK${NC} - Re-export encontrado"
else
    echo -e "   ${RED}FAIL${NC} - Re-export no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 7. Verificar que Repository usa la entidad
echo "7. Verificando uso de entidad en StudentSessionRepository..."
if grep -q "StudentSession.fromData" node-service/src/backend/attendance/infrastructure/student-session.repository.ts; then
    echo -e "   ${GREEN}OK${NC} - Repository usa StudentSession.fromData"
else
    echo -e "   ${RED}FAIL${NC} - Repository no usa StudentSession.fromData"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "session.completeRound" node-service/src/backend/attendance/infrastructure/student-session.repository.ts; then
    echo -e "   ${GREEN}OK${NC} - Repository delega completeRound a entidad"
else
    echo -e "   ${RED}FAIL${NC} - Repository no delega completeRound"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "session.failRound" node-service/src/backend/attendance/infrastructure/student-session.repository.ts; then
    echo -e "   ${GREEN}OK${NC} - Repository delega failRound a entidad"
else
    echo -e "   ${RED}FAIL${NC} - Repository no delega failRound"
    ERRORS=$((ERRORS + 1))
fi

# 8. Verificar compilacion TypeScript
echo "8. Verificando compilacion TypeScript..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npm exec tsc -- --noEmit 2>&1 | grep -q "error"; then
    echo -e "   ${RED}FAIL${NC} - Errores de compilacion"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - Compilacion exitosa"
fi

# 9. Ejecutar tests unitarios existentes
echo "9. Ejecutando tests unitarios..."
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
