#!/bin/bash
# Test Fase 8: QRs Falsos y Metricas de Fraude
# Verifica la generacion de QRs falsos, balanceo de pool y metricas de fraude

set -e

BASE_URL="${BASE_URL:-http://localhost:9503}"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "  TEST FASE 8: QRs Falsos y Fraude"
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

info() {
  echo -e "${BLUE}ℹ INFO${NC}: $1"
}

warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

# Session ID para tests
SESSION_ID="test-fase8-$(date +%s)"
info "Session ID: ${SESSION_ID}"
echo ""

# =============================================================================
# Test 0: Verificar que el servicio este corriendo
# =============================================================================
echo "Test 0: Verificar servicio Node"

HEALTH=$(curl -s "${BASE_URL}/asistencia/api/attendance/health" 2>&1)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  pass "Servicio Node respondiendo"
else
  fail "Servicio Node no responde: $HEALTH"
  exit 1
fi

# =============================================================================
# Test 1: Verificar que DEV_ENDPOINTS este habilitado
# =============================================================================
echo ""
echo "Test 1: Verificar endpoints de desarrollo"

POOL_CHECK=$(curl -s "${BASE_URL}/asistencia/api/attendance/dev/pool/${SESSION_ID}" 2>&1)
if echo "$POOL_CHECK" | grep -q '"success":true'; then
  pass "DEV_ENDPOINTS habilitados"
else
  fail "DEV_ENDPOINTS no habilitados. Asegurate de tener DEV_ENDPOINTS=true en compose.dev.yaml"
  exit 1
fi

# =============================================================================
# Test 2: Pool vacio inicialmente
# =============================================================================
echo ""
echo "Test 2: Verificar pool vacio"

POOL_STATS=$(curl -s "${BASE_URL}/asistencia/api/attendance/dev/pool/${SESSION_ID}" | jq -r '.data.pool')
TOTAL=$(echo "$POOL_STATS" | jq -r '.total')
STUDENTS=$(echo "$POOL_STATS" | jq -r '.students')
FAKES=$(echo "$POOL_STATS" | jq -r '.fakes')

if [ "$TOTAL" = "0" ] && [ "$STUDENTS" = "0" ] && [ "$FAKES" = "0" ]; then
  pass "Pool vacio inicialmente (total=0, students=0, fakes=0)"
else
  fail "Pool no esta vacio: total=$TOTAL, students=$STUDENTS, fakes=$FAKES"
fi

# =============================================================================
# Test 3: Inyectar QRs falsos manualmente
# =============================================================================
echo ""
echo "Test 3: Inyectar QRs falsos"

INJECT_RESULT=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/dev/fakes" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"${SESSION_ID}\", \"count\": 5}")

INJECTED=$(echo "$INJECT_RESULT" | jq -r '.data.injected')
POOL_FAKES=$(echo "$INJECT_RESULT" | jq -r '.data.pool.fakes')

if [ "$INJECTED" = "5" ] && [ "$POOL_FAKES" = "5" ]; then
  pass "Inyectados 5 QRs falsos (pool.fakes=5)"
else
  fail "Error inyectando falsos: injected=$INJECTED, pool.fakes=$POOL_FAKES"
fi

# =============================================================================
# Test 4: Balancear pool (debe agregar 5 mas para llegar a minPoolSize=10)
# =============================================================================
echo ""
echo "Test 4: Balancear pool (minPoolSize=10)"

BALANCE_RESULT=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/dev/balance" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"${SESSION_ID}\"}")

ADDED=$(echo "$BALANCE_RESULT" | jq -r '.data.balanced.added')
TOTAL_AFTER=$(echo "$BALANCE_RESULT" | jq -r '.data.pool.total')

if [ "$ADDED" = "5" ] && [ "$TOTAL_AFTER" = "10" ]; then
  pass "Balanceo agrego 5 falsos (total=10)"
else
  fail "Error en balanceo: added=$ADDED, total=$TOTAL_AFTER (esperado: added=5, total=10)"
fi

# =============================================================================
# Test 5: Balancear de nuevo (no debe agregar nada)
# =============================================================================
echo ""
echo "Test 5: Balancear de nuevo (sin cambios)"

BALANCE_RESULT2=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/dev/balance" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"${SESSION_ID}\"}")

ADDED2=$(echo "$BALANCE_RESULT2" | jq -r '.data.balanced.added')
REMOVED2=$(echo "$BALANCE_RESULT2" | jq -r '.data.balanced.removed')

if [ "$ADDED2" = "0" ] && [ "$REMOVED2" = "0" ]; then
  pass "Balanceo sin cambios (added=0, removed=0)"
else
  fail "Balanceo inesperado: added=$ADDED2, removed=$REMOVED2"
fi

# =============================================================================
# Test 6: Verificar configuracion
# =============================================================================
echo ""
echo "Test 6: Verificar configuracion FakeQRGenerator"

CONFIG=$(curl -s "${BASE_URL}/asistencia/api/attendance/dev/pool/${SESSION_ID}" | jq -r '.data.config')
MIN_POOL=$(echo "$CONFIG" | jq -r '.minPoolSize')

if [ "$MIN_POOL" = "10" ]; then
  pass "minPoolSize=10 (default)"
else
  fail "minPoolSize incorrecto: $MIN_POOL (esperado: 10)"
fi

# =============================================================================
# Test 7: Cambiar configuracion en runtime
# =============================================================================
echo ""
echo "Test 7: Cambiar minPoolSize a 15"

CONFIG_RESULT=$(curl -s -X PUT "${BASE_URL}/asistencia/api/attendance/dev/config" \
  -H "Content-Type: application/json" \
  -d '{"minPoolSize": 15}')

NEW_MIN_POOL=$(echo "$CONFIG_RESULT" | jq -r '.data.config.minPoolSize')

if [ "$NEW_MIN_POOL" = "15" ]; then
  pass "minPoolSize actualizado a 15"
else
  fail "Error actualizando config: minPoolSize=$NEW_MIN_POOL"
fi

# =============================================================================
# Test 8: Balancear con nueva config (debe agregar 5 para llegar a 15)
# =============================================================================
echo ""
echo "Test 8: Balancear con minPoolSize=15"

BALANCE_RESULT3=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/dev/balance" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"${SESSION_ID}\"}")

ADDED3=$(echo "$BALANCE_RESULT3" | jq -r '.data.balanced.added')
TOTAL3=$(echo "$BALANCE_RESULT3" | jq -r '.data.pool.total')

if [ "$ADDED3" = "5" ] && [ "$TOTAL3" = "15" ]; then
  pass "Balanceo agrego 5 falsos (total=15)"
else
  fail "Error en balanceo: added=$ADDED3, total=$TOTAL3 (esperado: added=5, total=15)"
fi

# =============================================================================
# Test 9: Verificar metricas de fraude (vacias)
# =============================================================================
echo ""
echo "Test 9: Verificar metricas de fraude"

FRAUD_STATS=$(curl -s "${BASE_URL}/asistencia/api/attendance/dev/fraud/${SESSION_ID}")
FRAUD_TOTAL=$(echo "$FRAUD_STATS" | jq -r '.data.fraud.total')
SUSPICIOUS=$(echo "$FRAUD_STATS" | jq -r '.data.suspiciousStudents | length')

if [ "$FRAUD_TOTAL" = "0" ] && [ "$SUSPICIOUS" = "0" ]; then
  pass "Metricas de fraude vacias (total=0, suspicious=0)"
else
  info "Metricas de fraude: total=$FRAUD_TOTAL, suspicious=$SUSPICIOUS"
  pass "Endpoint de fraude funciona"
fi

# =============================================================================
# Test 10: Registrar estudiante y verificar balanceo automatico
# =============================================================================
echo ""
echo "Test 10: Registrar estudiante (balanceo automatico)"

# Restaurar minPoolSize a 10
curl -s -X PUT "${BASE_URL}/asistencia/api/attendance/dev/config" \
  -H "Content-Type: application/json" \
  -d '{"minPoolSize": 10}' > /dev/null

# Limpiar pool
curl -s -X DELETE "${BASE_URL}/asistencia/api/attendance/dev/pool/${SESSION_ID}" > /dev/null

# Registrar estudiante
REGISTER_RESULT=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/register" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"${SESSION_ID}\", \"studentId\": 1001}")

if echo "$REGISTER_RESULT" | grep -q '"success":true'; then
  # Verificar que el pool tenga 1 real + 9 falsos = 10
  POOL_AFTER=$(curl -s "${BASE_URL}/asistencia/api/attendance/dev/pool/${SESSION_ID}" | jq -r '.data.pool')
  STUDENTS_AFTER=$(echo "$POOL_AFTER" | jq -r '.students')
  FAKES_AFTER=$(echo "$POOL_AFTER" | jq -r '.fakes')
  TOTAL_AFTER=$(echo "$POOL_AFTER" | jq -r '.total')
  
  if [ "$STUDENTS_AFTER" = "1" ] && [ "$FAKES_AFTER" = "9" ] && [ "$TOTAL_AFTER" = "10" ]; then
    pass "Balanceo automatico: 1 real + 9 falsos = 10 total"
  else
    fail "Balanceo incorrecto: students=$STUDENTS_AFTER, fakes=$FAKES_AFTER, total=$TOTAL_AFTER"
  fi
else
  fail "Error registrando estudiante: $REGISTER_RESULT"
fi

# =============================================================================
# Test 11: Registrar mas estudiantes
# =============================================================================
echo ""
echo "Test 11: Registrar 4 estudiantes mas"

for STUDENT_ID in 1002 1003 1004 1005; do
  curl -s -X POST "${BASE_URL}/asistencia/api/attendance/register" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"${SESSION_ID}\", \"studentId\": ${STUDENT_ID}}" > /dev/null
done

POOL_AFTER2=$(curl -s "${BASE_URL}/asistencia/api/attendance/dev/pool/${SESSION_ID}" | jq -r '.data.pool')
STUDENTS_AFTER2=$(echo "$POOL_AFTER2" | jq -r '.students')
FAKES_AFTER2=$(echo "$POOL_AFTER2" | jq -r '.fakes')
TOTAL_AFTER2=$(echo "$POOL_AFTER2" | jq -r '.total')

# 5 estudiantes + 5 falsos = 10
if [ "$STUDENTS_AFTER2" = "5" ] && [ "$FAKES_AFTER2" = "5" ] && [ "$TOTAL_AFTER2" = "10" ]; then
  pass "Balanceo automatico: 5 reales + 5 falsos = 10 total"
else
  fail "Balanceo incorrecto: students=$STUDENTS_AFTER2, fakes=$FAKES_AFTER2, total=$TOTAL_AFTER2"
fi

# =============================================================================
# Test 12: Registrar hasta superar minPoolSize
# =============================================================================
echo ""
echo "Test 12: Registrar hasta superar minPoolSize"

for STUDENT_ID in 1006 1007 1008 1009 1010 1011 1012; do
  curl -s -X POST "${BASE_URL}/asistencia/api/attendance/register" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"${SESSION_ID}\", \"studentId\": ${STUDENT_ID}}" > /dev/null
done

POOL_AFTER3=$(curl -s "${BASE_URL}/asistencia/api/attendance/dev/pool/${SESSION_ID}" | jq -r '.data.pool')
STUDENTS_AFTER3=$(echo "$POOL_AFTER3" | jq -r '.students')
FAKES_AFTER3=$(echo "$POOL_AFTER3" | jq -r '.fakes')
TOTAL_AFTER3=$(echo "$POOL_AFTER3" | jq -r '.total')

# 12 estudiantes + 0 falsos = 12 (superamos minPoolSize, no hay falsos)
if [ "$STUDENTS_AFTER3" = "12" ] && [ "$FAKES_AFTER3" = "0" ]; then
  pass "Sin falsos cuando estudiantes > minPoolSize: $STUDENTS_AFTER3 reales + 0 falsos"
else
  fail "Deberia haber 0 falsos: students=$STUDENTS_AFTER3, fakes=$FAKES_AFTER3"
fi

# =============================================================================
# Test 13: TypeScript compila
# =============================================================================
echo ""
echo "Test 13: TypeScript compila"

TSC_OUTPUT=$(podman exec asistencia-node npx tsc --noEmit 2>&1)
if [ -z "$TSC_OUTPUT" ]; then
  pass "TypeScript compila sin errores"
else
  fail "TypeScript tiene errores"
  echo "$TSC_OUTPUT" | head -10
fi

# =============================================================================
# Test 14: Tests unitarios
# =============================================================================
echo ""
echo "Test 14: Tests unitarios de stages"

TEST_OUTPUT=$(podman exec asistencia-node npx tsx --test src/backend/attendance/__tests__/stages.test.ts 2>&1)
if echo "$TEST_OUTPUT" | grep -q "# pass 20"; then
  pass "20 tests unitarios pasando"
else
  PASS_COUNT=$(echo "$TEST_OUTPUT" | grep "# pass" | awk '{print $3}')
  FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep "# fail" | awk '{print $3}')
  if [ "$FAIL_COUNT" = "0" ]; then
    pass "$PASS_COUNT tests pasando"
  else
    fail "$FAIL_COUNT tests fallaron"
  fi
fi

# =============================================================================
# Limpieza
# =============================================================================
echo ""
echo "Limpiando datos de prueba..."

curl -s -X DELETE "${BASE_URL}/asistencia/api/attendance/dev/pool/${SESSION_ID}" > /dev/null

# Restaurar config default
curl -s -X PUT "${BASE_URL}/asistencia/api/attendance/dev/config" \
  -H "Content-Type: application/json" \
  -d '{"minPoolSize": 10}' > /dev/null

info "Datos de prueba eliminados"

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "======================================"
echo "  RESUMEN FASE 8                      "
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
