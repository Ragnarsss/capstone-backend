#!/bin/bash
# Test Fase 5: Frontend scanner integration
# Verifica la integración del frontend scanner con el endpoint de validación

set -e

BASE_URL="${BASE_URL:-http://localhost:9500}"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "  TEST FASE 5: Frontend Scanner      "
echo "======================================"
echo ""

# Helper functions
pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
  PASSED=$((PASSED+1))
}

fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  FAILED=$((FAILED+1))
}

warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

# Test 1: Verificar que el archivo attendance-api.client.ts existe
echo "Test 1: Verificar attendance-api.client.ts existe"
if [ -f "node-service/src/frontend/features/qr-reader/services/attendance-api.client.ts" ]; then
  pass "attendance-api.client.ts existe"
else
  fail "attendance-api.client.ts no existe"
fi

# Test 2: Verificar que QRScanService importa AttendanceApiClient
echo ""
echo "Test 2: Verificar integración en QRScanService"
if grep -q "AttendanceApiClient" node-service/src/frontend/features/qr-reader/services/qr-scan.service.ts; then
  pass "QRScanService importa AttendanceApiClient"
else
  fail "QRScanService no importa AttendanceApiClient"
fi

# Test 3: Verificar que QRScanService tiene método handleScanResult
echo ""
echo "Test 3: Verificar método handleScanResult"
if grep -q "handleScanResult" node-service/src/frontend/features/qr-reader/services/qr-scan.service.ts; then
  pass "QRScanService tiene handleScanResult"
else
  fail "QRScanService no tiene handleScanResult"
fi

# Test 4: Verificar que CameraViewComponent tiene métodos de validación
echo ""
echo "Test 4: Verificar métodos de validación en UI"
if grep -q "showValidating\|showValidationSuccess\|showValidationError" node-service/src/frontend/features/qr-reader/ui/camera-view.component.ts; then
  pass "CameraViewComponent tiene métodos de validación"
else
  fail "CameraViewComponent no tiene métodos de validación"
fi

# Test 5: Verificar que AuthClient tiene getUserId
echo ""
echo "Test 5: Verificar AuthClient.getUserId()"
if grep -q "getUserId" node-service/src/frontend/shared/auth/auth-client.ts; then
  pass "AuthClient tiene método getUserId"
else
  fail "AuthClient no tiene método getUserId"
fi

# Test 6: Verificar que base.css tiene estilo result-pending
echo ""
echo "Test 6: Verificar estilo result-pending"
if grep -q "result-pending" node-service/src/frontend/shared/styles/base.css; then
  pass "base.css tiene estilo result-pending"
else
  fail "base.css no tiene estilo result-pending"
fi

# Test 7: Verificar que el frontend HTML carga el lector
echo ""
echo "Test 7: Verificar carga del lector QR"
READER_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/asistencia/features/qr-reader/")
if [ "$READER_RESPONSE" = "200" ]; then
  pass "Frontend QR-reader accesible (HTTP $READER_RESPONSE)"
else
  fail "Frontend QR-reader no accesible (HTTP $READER_RESPONSE)"
fi

# Test 8: Verificar que los archivos JS se sirven correctamente
echo ""
echo "Test 8: Verificar servicio de assets"
# El servidor Vite compila TypeScript a JS en desarrollo
MAIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/asistencia/features/qr-reader/main.ts")
if [ "$MAIN_RESPONSE" = "200" ]; then
  pass "main.ts se sirve correctamente (HTTP $MAIN_RESPONSE)"
else
  warn "main.ts retorna HTTP $MAIN_RESPONSE (puede ser normal en producción)"
fi

# Test 9: Validar que endpoint de validación responde
echo ""
echo "Test 9: Verificar endpoint de validación"
VALIDATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/validate" \
  -H "Content-Type: application/json" \
  -d '{"encrypted":"test","studentId":1}')

if echo "$VALIDATE_RESPONSE" | grep -q '"success":false\|"error"'; then
  pass "Endpoint de validación responde correctamente a payload inválido"
else
  fail "Endpoint de validación no responde como esperado"
fi

# Test 10: TypeScript compila sin errores (verificación estática)
echo ""
echo "Test 10: Verificar compilación TypeScript"
if podman compose exec node-service npm run type-check 2>&1 | grep -q "error"; then
  fail "TypeScript tiene errores de compilación"
else
  pass "TypeScript compila sin errores"
fi

# Resumen
echo ""
echo "======================================"
echo "  RESUMEN FASE 5                      "
echo "======================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Algunos tests fallaron${NC}"
  exit 1
else
  echo -e "${GREEN}Todos los tests pasaron${NC}"
  exit 0
fi
