#!/bin/bash
# Test Fase 6.1: Frontend Crypto Integration
# Verifica que la infraestructura criptográfica del frontend funciona correctamente

set -e

echo "======================================"
echo "  TEST FASE 6.1: Frontend Crypto      "
echo "======================================"

PASSED=0
FAILED=0
BASE_URL="${BASE_URL:-http://localhost:3000}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass() {
  echo -e "\033[32m✓ PASS:\033[0m $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo -e "\033[31m✗ FAIL:\033[0m $1"
  FAILED=$((FAILED + 1))
}

info() {
  echo -e "\033[34mℹ INFO:\033[0m $1"
}

# Test 1: Verificar archivos creados
echo ""
echo "Test 1: Verificar archivos de infraestructura crypto"

if [ -f "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts" ]; then
  pass "aes-gcm.ts existe"
else
  fail "aes-gcm.ts no existe"
fi

if [ -f "$PROJECT_DIR/node-service/src/frontend/shared/crypto/mock-keys.ts" ]; then
  pass "mock-keys.ts existe"
else
  fail "mock-keys.ts no existe"
fi

if [ -f "$PROJECT_DIR/node-service/src/frontend/shared/crypto/index.ts" ]; then
  pass "index.ts (barrel) existe"
else
  fail "index.ts (barrel) no existe"
fi

# Test 2: Verificar que mock key coincide con backend
echo ""
echo "Test 2: Verificar consistencia de mock keys"

FRONTEND_KEY=$(grep "MOCK_SESSION_KEY = " "$PROJECT_DIR/node-service/src/frontend/shared/crypto/mock-keys.ts" | grep -o "'[^']*'" | tr -d "'")
BACKEND_KEY=$(grep "desarrollo_asistencia_mock_key" "$PROJECT_DIR/node-service/src/shared/infrastructure/crypto/crypto.service.ts" | grep -o "'[^']*'" | tr -d "'")

if [ "$FRONTEND_KEY" = "$BACKEND_KEY" ]; then
  pass "Mock keys coinciden entre frontend y backend"
  info "Key: $FRONTEND_KEY"
else
  fail "Mock keys NO coinciden"
  info "Frontend: $FRONTEND_KEY"
  info "Backend: $BACKEND_KEY"
fi

# Test 3: TypeScript compila
echo ""
echo "Test 3: TypeScript compila sin errores"

if podman compose exec -T node-service npx tsc --noEmit 2>&1 | grep -q "error"; then
  fail "TypeScript tiene errores de compilación"
  podman compose exec -T node-service npx tsc --noEmit 2>&1 | grep "error" | head -5
else
  pass "TypeScript compila sin errores"
fi

# Test 4: Verificar funciones exportadas en aes-gcm.ts
echo ""
echo "Test 4: Verificar funciones criptográficas"

if grep -q "export async function decryptQR" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts"; then
  pass "decryptQR exportada"
else
  fail "decryptQR no encontrada"
fi

if grep -q "export async function encryptPayload" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts"; then
  pass "encryptPayload exportada"
else
  fail "encryptPayload no encontrada"
fi

if grep -q "export function clearKeyCache" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts"; then
  pass "clearKeyCache exportada"
else
  fail "clearKeyCache no encontrada"
fi

# Test 5: Verificar formato de payload documentado
echo ""
echo "Test 5: Verificar formato de payload (iv.ciphertext.authTag)"

if grep -q "iv\.ciphertext\.authTag" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts"; then
  pass "Formato de payload documentado correctamente"
else
  fail "Documentación de formato de payload no encontrada"
fi

# Test 6: Verificar constantes de seguridad
echo ""
echo "Test 6: Verificar constantes criptográficas"

if grep -q "IV_LENGTH = 12" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts"; then
  pass "IV_LENGTH = 12 bytes (96 bits)"
else
  fail "IV_LENGTH incorrecta"
fi

if grep -q "AUTH_TAG_LENGTH = 16" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts"; then
  pass "AUTH_TAG_LENGTH = 16 bytes (128 bits)"
else
  fail "AUTH_TAG_LENGTH incorrecta"
fi

# Test 7: Verificar uso de Web Crypto API
echo ""
echo "Test 7: Verificar uso de Web Crypto API"

if grep -q "crypto.subtle.decrypt" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts"; then
  pass "Usa crypto.subtle.decrypt"
else
  fail "No usa crypto.subtle.decrypt"
fi

if grep -q "crypto.subtle.encrypt" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/aes-gcm.ts"; then
  pass "Usa crypto.subtle.encrypt"
else
  fail "No usa crypto.subtle.encrypt"
fi

if grep -q "crypto.subtle.importKey" "$PROJECT_DIR/node-service/src/frontend/shared/crypto/mock-keys.ts"; then
  pass "Usa crypto.subtle.importKey para mock key"
else
  fail "No usa crypto.subtle.importKey"
fi

# Test 8: Verificar que qr-scan.service.ts importa correctamente
echo ""
echo "Test 8: Verificar integración con qr-scan.service.ts"

if grep -q "import.*decryptQR.*from.*crypto" "$PROJECT_DIR/node-service/src/frontend/features/qr-reader/services/qr-scan.service.ts"; then
  pass "qr-scan.service.ts importa decryptQR"
else
  fail "qr-scan.service.ts no importa decryptQR"
fi

if grep -q "import.*encryptPayload.*from.*crypto" "$PROJECT_DIR/node-service/src/frontend/features/qr-reader/services/qr-scan.service.ts"; then
  pass "qr-scan.service.ts importa encryptPayload"
else
  fail "qr-scan.service.ts no importa encryptPayload"
fi

# Resumen
echo ""
echo "======================================"
echo "  RESUMEN FASE 6.1                    "
echo "======================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "\033[32mTodos los tests pasaron\033[0m"
  exit 0
else
  echo -e "\033[31mAlgunos tests fallaron\033[0m"
  exit 1
fi
