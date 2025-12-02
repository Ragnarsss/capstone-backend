#!/bin/bash
# Script de prueba Fase 2: Encriptación AES-256-GCM
# Uso: ./scripts/test-fase2.sh

set -e

echo "=== FASE 2: Verificacion Encriptacion AES-256-GCM ==="
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
echo "Ejecutando verificacion Fase 1..."
./scripts/test-fase1.sh > /dev/null 2>&1 && pass "Fase 1 OK" || fail "Fase 1 fallo"

# 2. Verificar que existe CryptoService
echo ""
echo "Verificando CryptoService..."
CRYPTO_FILE="node-service/src/shared/infrastructure/crypto/crypto.service.ts"

if [ -f "$CRYPTO_FILE" ]; then
    pass "CryptoService existe"
else
    fail "CryptoService no encontrado"
fi

# 3. Verificar métodos de CryptoService
echo ""
echo "Verificando metodos de CryptoService..."

if grep -q "encrypt(" "$CRYPTO_FILE"; then
    pass "Metodo encrypt() existe"
else
    fail "Metodo encrypt() no encontrado"
fi

if grep -q "decrypt(" "$CRYPTO_FILE"; then
    pass "Metodo decrypt() existe"
else
    fail "Metodo decrypt() no encontrado"
fi

if grep -q "encryptToPayload(" "$CRYPTO_FILE"; then
    pass "Metodo encryptToPayload() existe"
else
    fail "Metodo encryptToPayload() no encontrado"
fi

if grep -q "decryptFromPayload(" "$CRYPTO_FILE"; then
    pass "Metodo decryptFromPayload() existe"
else
    fail "Metodo decryptFromPayload() no encontrado"
fi

# 4. Verificar algoritmo AES-256-GCM
echo ""
echo "Verificando configuracion criptografica..."

if grep -q "aes-256-gcm" "$CRYPTO_FILE"; then
    pass "Algoritmo AES-256-GCM configurado"
else
    fail "Algoritmo AES-256-GCM no encontrado"
fi

if grep -q "IV_LENGTH = 12" "$CRYPTO_FILE"; then
    pass "IV length = 12 bytes (96 bits)"
else
    fail "IV length incorrecto"
fi

if grep -q "AUTH_TAG_LENGTH = 16" "$CRYPTO_FILE"; then
    pass "Auth tag length = 16 bytes (128 bits)"
else
    fail "Auth tag length incorrecto"
fi

# 5. Verificar MOCK_SESSION_KEY
echo ""
echo "Verificando mock session key..."

if grep -q "MOCK_SESSION_KEY" "$CRYPTO_FILE"; then
    pass "MOCK_SESSION_KEY definida"
else
    fail "MOCK_SESSION_KEY no encontrada"
fi

# 6. Verificar QRGenerator usa CryptoService
echo ""
echo "Verificando integracion en QRGenerator..."
QR_GEN_FILE="node-service/src/backend/qr-projection/domain/qr-generator.ts"

if grep -q "import.*CryptoService" "$QR_GEN_FILE"; then
    pass "QRGenerator importa CryptoService"
else
    fail "QRGenerator no importa CryptoService"
fi

if grep -q "encryptPayload(" "$QR_GEN_FILE"; then
    pass "Metodo encryptPayload() en QRGenerator"
else
    fail "Metodo encryptPayload() no encontrado"
fi

# 7. Verificar QRProjectionService inyecta CryptoService
echo ""
echo "Verificando inyeccion de dependencias..."
SERVICE_FILE="node-service/src/backend/qr-projection/application/qr-projection.service.ts"

if grep -q "import.*CryptoService" "$SERVICE_FILE"; then
    pass "Service importa CryptoService"
else
    fail "Service no importa CryptoService"
fi

if grep -q "cryptoService.*CryptoService" "$SERVICE_FILE"; then
    pass "Constructor acepta CryptoService"
else
    fail "Constructor no acepta CryptoService"
fi

# 8. Verificar que compila
echo ""
echo "Verificando compilacion..."
if podman exec asistencia-node npm run build 2>&1 | grep -q "built in"; then
    pass "Compila correctamente"
else
    fail "Error de compilacion"
fi

# 9. Reiniciar node y verificar baseline
echo ""
echo "Reiniciando servicio node..."
podman restart asistencia-node > /dev/null 2>&1
sleep 3

echo "Verificando servicios..."
if curl -s http://localhost:9503/health | grep -q '"status":"ok"'; then
    pass "Node health OK"
else
    fail "Node no responde"
fi

echo ""
echo "=== Fase 2 verificada correctamente ==="
echo ""
echo "Prueba manual requerida:"
echo "  1. Abrir http://localhost:9500 en browser"
echo "  2. Click en boton proyectar QR"
echo "  3. Abrir DevTools > Network > WS"
echo "  4. Verificar que qrContent ahora es encriptado:"
echo '     Formato: "iv.ciphertext.authTag" (3 partes separadas por punto)'
echo ""
echo "  5. El QR debe seguir mostrandose (frontend lo maneja transparente)"
echo ""
echo "Nota: En esta fase el contenido esta encriptado pero el frontend"
echo "      aun no puede desencriptar. Solo verifica que el QR se genera."
