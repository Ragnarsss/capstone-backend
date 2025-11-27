#!/bin/bash
# Script de prueba Fase 4: Endpoint de validación
# Uso: ./scripts/test-fase4.sh

set -e

echo "=== FASE 4: Verificacion Endpoint Validacion ==="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}[OK]${NC} $1"
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    exit 1
}

info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# 1. Verificar baseline
echo "Verificando baseline..."
./scripts/test-baseline.sh > /dev/null 2>&1 && pass "Baseline OK" || fail "Baseline fallo"

# 2. Verificar que existe el módulo attendance
echo ""
echo "Verificando modulo attendance..."

if [ -d "node-service/src/backend/attendance" ]; then
    pass "Directorio attendance existe"
else
    fail "Directorio attendance no encontrado"
fi

# 3. Verificar archivos del módulo
echo ""
echo "Verificando estructura del modulo..."

FILES=(
    "node-service/src/backend/attendance/domain/models.ts"
    "node-service/src/backend/attendance/application/attendance-validation.service.ts"
    "node-service/src/backend/attendance/presentation/routes.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        pass "Existe: $(basename $file)"
    else
        fail "No existe: $file"
    fi
done

# 4. Verificar AttendanceValidationService
echo ""
echo "Verificando AttendanceValidationService..."
SERVICE_FILE="node-service/src/backend/attendance/application/attendance-validation.service.ts"

if grep -q "validateScannedPayload(" "$SERVICE_FILE"; then
    pass "Metodo validateScannedPayload() existe"
else
    fail "Metodo validateScannedPayload() no encontrado"
fi

if grep -q "CryptoService" "$SERVICE_FILE"; then
    pass "Usa CryptoService para desencriptar"
else
    fail "No usa CryptoService"
fi

if grep -q "QRPayloadRepository" "$SERVICE_FILE"; then
    pass "Usa QRPayloadRepository para validar"
else
    fail "No usa QRPayloadRepository"
fi

# 5. Verificar rutas registradas en app.ts
echo ""
echo "Verificando registro de rutas..."

if grep -q "registerAttendanceRoutes" node-service/src/app.ts; then
    pass "Rutas de attendance registradas en app.ts"
else
    fail "Rutas de attendance no registradas"
fi

# 6. Verificar compilación
echo ""
echo "Verificando compilacion..."
if podman exec asistencia-node npm run build 2>&1 | grep -q "built in"; then
    pass "Compila correctamente"
else
    fail "Error de compilacion"
fi

# 7. Verificar endpoint health
echo ""
echo "Verificando endpoint health..."
HEALTH=$(curl -s http://localhost:9503/asistencia/api/attendance/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    pass "Health endpoint responde OK"
else
    fail "Health endpoint no responde"
fi

# 8. Verificar endpoint validate (formato inválido)
echo ""
echo "Verificando endpoint validate (formato invalido)..."
RESPONSE=$(curl -s -X POST http://localhost:9503/asistencia/api/attendance/validate \
    -H "Content-Type: application/json" \
    -d '{"encrypted": "this.is.not.valid.base64.format.at.all", "studentId": 1}')

if echo "$RESPONSE" | grep -q '"success":false'; then
    pass "Rechaza payload con formato invalido"
else
    fail "No rechaza payload invalido: $RESPONSE"
fi

if echo "$RESPONSE" | grep -q '"code":"INVALID_FORMAT\|DECRYPTION_FAILED"'; then
    pass "Retorna codigo de error apropiado"
else
    info "Respuesta: $RESPONSE"
    fail "No retorna codigo correcto"
fi

# 9. Verificar via proxy
echo ""
echo "Verificando acceso via proxy..."
HEALTH_PROXY=$(curl -s http://localhost:9500/asistencia/api/attendance/health)
if echo "$HEALTH_PROXY" | grep -q '"status":"ok"'; then
    pass "Health accesible via proxy HTTP"
else
    fail "Health no accesible via proxy"
fi

echo ""
echo "=== Fase 4 verificada correctamente ==="
echo ""
echo "Prueba manual E2E requerida:"
echo "  1. Abrir http://localhost:9500 y proyectar QR"
echo "  2. En otra terminal, obtener un payload de Valkey:"
echo '     podman exec asistencia-valkey redis-cli KEYS "qr:payload:*" | head -1'
echo ""
echo "  3. Obtener el encrypted del payload:"
echo '     podman exec asistencia-valkey redis-cli GET "qr:payload:<nonce>" | jq -r .encrypted'
echo ""
echo "  4. Enviar a validacion:"
echo '     curl -X POST http://localhost:9500/asistencia/api/attendance/validate \'
echo '       -H "Content-Type: application/json" \'
echo '       -d '"'"'{"encrypted": "<valor>", "studentId": 1}'"'"
echo ""
echo "  5. Debe retornar success:true con sessionId y round"
