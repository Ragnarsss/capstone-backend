#!/bin/bash
# Test Fase 11-5: IQRPayloadRepository Interface
# Verifica que la interfaz IQRPayloadRepository esté correctamente definida y usada

set -e

echo "=== Test Fase 11-5: IQRPayloadRepository Interface ==="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Verificar que existe el archivo de interfaz
echo "1. Verificando archivo shared/ports/qr-payload-repository.port.ts..."
if [ -f "node-service/src/shared/ports/qr-payload-repository.port.ts" ]; then
    echo -e "   ${GREEN}OK${NC} - Archivo existe"
else
    echo -e "   ${RED}FAIL${NC} - Archivo no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 2. Verificar que IQRPayloadRepository está exportado desde index
echo "2. Verificando export desde shared/ports/index.ts..."
if grep -q "qr-payload-repository.port" node-service/src/shared/ports/index.ts; then
    echo -e "   ${GREEN}OK${NC} - Export encontrado"
else
    echo -e "   ${RED}FAIL${NC} - Export no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 3. Verificar que QRPayloadRepository implementa IQRPayloadRepository
echo "3. Verificando que QRPayloadRepository implementa IQRPayloadRepository..."
if grep -q "implements IQRPayloadRepository" node-service/src/backend/qr-projection/infrastructure/qr-payload.repository.ts; then
    echo -e "   ${GREEN}OK${NC} - QRPayloadRepository implementa IQRPayloadRepository"
else
    echo -e "   ${RED}FAIL${NC} - QRPayloadRepository no implementa IQRPayloadRepository"
    ERRORS=$((ERRORS + 1))
fi

# 4. Verificar que ParticipationService usa IQRPayloadRepository como tipo
echo "4. Verificando uso de IQRPayloadRepository en ParticipationService..."
if grep -q "IQRPayloadRepository" node-service/src/backend/attendance/application/participation.service.ts; then
    echo -e "   ${GREEN}OK${NC} - ParticipationService usa IQRPayloadRepository"
else
    echo -e "   ${RED}FAIL${NC} - ParticipationService no usa IQRPayloadRepository"
    ERRORS=$((ERRORS + 1))
fi

# 5. Verificar tipos exportados desde port
echo "5. Verificando tipos en qr-payload-repository.port.ts..."
for TYPE in "IQRPayloadRepository" "StoredPayload" "PayloadValidationResult"; do
    if grep -q "export interface $TYPE" node-service/src/shared/ports/qr-payload-repository.port.ts; then
        echo -e "   ${GREEN}OK${NC} - $TYPE definido"
    else
        echo -e "   ${RED}FAIL${NC} - $TYPE no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 6. Verificar metodos en interfaz
echo "6. Verificando metodos en IQRPayloadRepository..."
for METHOD in "store" "findByNonce" "validate" "markAsConsumed" "delete" "countActiveForSession"; do
    if grep -q "$METHOD" node-service/src/shared/ports/qr-payload-repository.port.ts; then
        echo -e "   ${GREEN}OK${NC} - $METHOD definido"
    else
        echo -e "   ${RED}FAIL${NC} - $METHOD no encontrado"
        ERRORS=$((ERRORS + 1))
    fi
done

# 7. Verificar compilacion TypeScript
echo "7. Verificando compilacion TypeScript..."
if podman compose -f compose.yaml -f compose.dev.yaml exec node-service npm exec tsc -- --noEmit 2>&1 | grep -q "error"; then
    echo -e "   ${RED}FAIL${NC} - Errores de compilacion"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}OK${NC} - Compilacion exitosa"
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
