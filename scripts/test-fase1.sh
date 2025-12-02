#!/bin/bash
# Script de prueba Fase 1 - Payload V1 estructurado
# Uso: ./scripts/test-fase1.sh

set -e

echo "=== FASE 1: Verificacion Payload V1 ==="
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

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 0. Ejecutar baseline primero
echo "Ejecutando verificacion baseline..."
./scripts/test-baseline.sh > /dev/null 2>&1 && pass "Baseline OK" || fail "Baseline fallido"
echo ""

# 1. Verificar que TypeScript compila sin errores
echo "Verificando compilacion TypeScript..."

# Compilar dentro del contenedor
if podman exec asistencia-node npm run build 2>&1 | grep -q "built in"; then
    pass "TypeScript compila sin errores"
else
    # Mostrar errores específicos
    echo ""
    warn "Errores de TypeScript detectados:"
    podman exec asistencia-node npm run build 2>&1 | head -20
    fail "TypeScript tiene errores de compilacion"
fi

# 2. Verificar estructura de QRPayloadV1 en models.ts
echo "Verificando interfaz QRPayloadV1..."
if grep -q "export interface QRPayloadV1" node-service/src/backend/qr-projection/domain/models.ts; then
    pass "QRPayloadV1 definida en models.ts"
else
    fail "QRPayloadV1 no encontrada en models.ts"
fi

# 3. Verificar campos requeridos de QRPayloadV1
echo "Verificando campos de QRPayloadV1..."
REQUIRED_FIELDS=("readonly v: 1" "readonly sid: string" "readonly uid: number" "readonly r: number" "readonly ts: number" "readonly n: string")
for field in "${REQUIRED_FIELDS[@]}"; do
    if grep -q "$field" node-service/src/backend/qr-projection/domain/models.ts; then
        pass "Campo encontrado: $field"
    else
        fail "Campo faltante en QRPayloadV1: $field"
    fi
done

# 4. Verificar metodos en QRGenerator
echo "Verificando metodos de QRGenerator..."
QR_GEN_FILE="node-service/src/backend/qr-projection/domain/qr-generator.ts"

if grep -q "generateNonce()" "$QR_GEN_FILE"; then
    pass "Metodo generateNonce() existe"
else
    fail "Metodo generateNonce() no encontrado"
fi

if grep -q "buildPayloadV1(" "$QR_GEN_FILE"; then
    pass "Metodo buildPayloadV1() existe"
else
    fail "Metodo buildPayloadV1() no encontrado"
fi

if grep -q "toQRString(" "$QR_GEN_FILE"; then
    pass "Metodo toQRString() existe"
else
    fail "Metodo toQRString() no encontrado"
fi

if grep -q "generateV1(" "$QR_GEN_FILE"; then
    pass "Metodo generateV1() existe"
else
    fail "Metodo generateV1() no encontrado"
fi

# 5. Verificar uso de crypto para nonce
echo "Verificando uso de crypto..."
if grep -q "import.*randomBytes.*from 'crypto'" "$QR_GEN_FILE"; then
    pass "randomBytes importado de crypto"
else
    fail "randomBytes no importado de crypto"
fi

# 6. Verificar tipos de presentacion actualizados
echo "Verificando tipos de presentacion..."
TYPES_FILE="node-service/src/backend/qr-projection/presentation/types.ts"

if grep -q "QRPayloadV1DTO" "$TYPES_FILE"; then
    pass "QRPayloadV1DTO definido en types.ts"
else
    fail "QRPayloadV1DTO no encontrado en types.ts"
fi

if grep -q "qrContent: string" "$TYPES_FILE"; then
    pass "qrContent en QRUpdateMessageDTO"
else
    fail "qrContent no encontrado en QRUpdateMessageDTO"
fi

# 7. Verificar frontend actualizado
echo "Verificando frontend service..."
FE_SERVICE="node-service/src/frontend/features/qr-host/services/qr-projection.service.ts"

if grep -q "extractQRContent" "$FE_SERVICE"; then
    pass "extractQRContent metodo en frontend"
else
    fail "extractQRContent no encontrado en frontend"
fi

if grep -q "QRPayloadV1" "$FE_SERVICE"; then
    pass "QRPayloadV1 interface en frontend"
else
    fail "QRPayloadV1 no definida en frontend"
fi

# 8. Verificar ProjectionContext en servicio
echo "Verificando ProjectionContext..."
SERVICE_FILE="node-service/src/backend/qr-projection/application/qr-projection.service.ts"

if grep -q "ProjectionContext" "$SERVICE_FILE"; then
    pass "ProjectionContext definido"
else
    fail "ProjectionContext no encontrado"
fi

if grep -q "userId: number" "$SERVICE_FILE"; then
    pass "userId en ProjectionContext"
else
    fail "userId no encontrado en ProjectionContext"
fi

echo ""
echo "=== Fase 1 verificada correctamente ==="
echo ""
echo "Prueba manual requerida:"
echo "  1. Abrir http://localhost:9500 en browser"
echo "  2. Click en boton proyectar QR"
echo "  3. Abrir DevTools > Network > WS"
echo "  4. Verificar que mensajes qr-update tienen formato:"
echo '     {"type":"qr-update","payload":{"data":{"v":1,"sid":"...","uid":...,"r":1,"ts":...,"n":"..."},"qrContent":"...","sessionId":"..."}}'
echo ""
echo "  5. Verificar que el QR se muestra y rota correctamente"
