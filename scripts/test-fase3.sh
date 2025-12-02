#!/bin/bash
# Script de prueba Fase 3: Almacenamiento en Valkey
# Uso: ./scripts/test-fase3.sh

set -e

echo "=== FASE 3: Verificacion Almacenamiento Valkey ==="
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

# 1. Ejecutar pruebas de fase anterior
echo "Ejecutando verificacion Fase 2..."
./scripts/test-fase2.sh > /dev/null 2>&1 && pass "Fase 2 OK" || fail "Fase 2 fallo"

# 2. Verificar que existe QRPayloadRepository
echo ""
echo "Verificando QRPayloadRepository..."
REPO_FILE="node-service/src/backend/qr-projection/infrastructure/qr-payload.repository.ts"

if [ -f "$REPO_FILE" ]; then
    pass "QRPayloadRepository existe"
else
    fail "QRPayloadRepository no encontrado"
fi

# 3. Verificar métodos del repositorio
echo ""
echo "Verificando metodos de QRPayloadRepository..."

REQUIRED_METHODS=("store(" "findByNonce(" "validate(" "markAsConsumed(")

for method in "${REQUIRED_METHODS[@]}"; do
    if grep -q "$method" "$REPO_FILE"; then
        pass "Metodo $method existe"
    else
        fail "Metodo $method no encontrado"
    fi
done

# 4. Verificar StoredPayload interface
echo ""
echo "Verificando StoredPayload interface..."

if grep -q "interface StoredPayload" "$REPO_FILE"; then
    pass "StoredPayload interface definida"
else
    fail "StoredPayload interface no encontrada"
fi

if grep -q "consumed: boolean" "$REPO_FILE"; then
    pass "Campo consumed en StoredPayload"
else
    fail "Campo consumed no encontrado"
fi

# 5. Verificar integración en QRProjectionService
echo ""
echo "Verificando integracion en QRProjectionService..."
SERVICE_FILE="node-service/src/backend/qr-projection/application/qr-projection.service.ts"

if grep -q "import.*QRPayloadRepository" "$SERVICE_FILE"; then
    pass "Service importa QRPayloadRepository"
else
    fail "Service no importa QRPayloadRepository"
fi

if grep -q "payloadRepository.store(" "$SERVICE_FILE"; then
    pass "Service almacena payloads"
else
    fail "Service no almacena payloads"
fi

if grep -q "validatePayload(" "$SERVICE_FILE"; then
    pass "Metodo validatePayload() expuesto"
else
    fail "Metodo validatePayload() no encontrado"
fi

if grep -q "consumePayload(" "$SERVICE_FILE"; then
    pass "Metodo consumePayload() expuesto"
else
    fail "Metodo consumePayload() no encontrado"
fi

# 6. Verificar configuración payloadTTL
echo ""
echo "Verificando configuracion TTL..."

if grep -q "payloadTTL" "$SERVICE_FILE"; then
    pass "payloadTTL configurado"
else
    fail "payloadTTL no encontrado"
fi

# 7. Verificar compilación
echo ""
echo "Verificando compilacion..."
if podman exec asistencia-node npm run build 2>&1 | grep -q "built in"; then
    pass "Compila correctamente"
else
    fail "Error de compilacion"
fi

# 8. Reiniciar y verificar servicios
echo ""
echo "Reiniciando servicio node..."
podman restart asistencia-node > /dev/null 2>&1
sleep 3

# 9. Verificar conexión a Valkey
echo ""
echo "Verificando conexion a Valkey..."
if podman exec asistencia-valkey redis-cli PING | grep -q "PONG"; then
    pass "Valkey responde PING"
else
    fail "Valkey no responde"
fi

# 10. Verificar baseline
echo ""
echo "Verificando servicios..."
if curl -s http://localhost:9503/health | grep -q '"status":"ok"'; then
    pass "Node health OK"
else
    fail "Node no responde"
fi

echo ""
echo "=== Fase 3 verificada correctamente ==="
echo ""
echo "Prueba manual requerida:"
echo "  1. Abrir http://localhost:9500 en browser"
echo "  2. Click en boton proyectar QR"
echo "  3. En otra terminal, verificar payloads en Valkey:"
echo '     podman exec asistencia-valkey redis-cli KEYS "qr:payload:*"'
echo ""
echo "  4. Debe ver claves apareciendo y desapareciendo (TTL 30s)"
echo "  5. Escanear QR con telefono (contenido aun encriptado)"
