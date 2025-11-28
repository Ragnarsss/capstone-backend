#!/bin/bash
# Test Fase 6: Sistema de Rounds e Intentos
# Verifica el flujo completo de participación con rounds e intentos

set -e

BASE_URL="${BASE_URL:-http://localhost:9500}"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "  TEST FASE 6: Rounds e Intentos     "
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

# Generar IDs únicos para esta ejecución
SESSION_ID="test-session-$(date +%s)"
STUDENT_ID=$((RANDOM % 1000 + 100))

info "Session ID: ${SESSION_ID}"
info "Student ID: ${STUDENT_ID}"
echo ""

# =============================================================================
# Test 1: Registro de participación
# =============================================================================
echo "Test 1: Registro de participación"

REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/register" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"${SESSION_ID}\",\"studentId\":${STUDENT_ID}}")

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
  pass "Registro exitoso"
  
  # Extraer datos
  CURRENT_ROUND=$(echo "$REGISTER_RESPONSE" | grep -o '"currentRound":[0-9]*' | cut -d: -f2)
  TOTAL_ROUNDS=$(echo "$REGISTER_RESPONSE" | grep -o '"totalRounds":[0-9]*' | cut -d: -f2)
  QR_PAYLOAD=$(echo "$REGISTER_RESPONSE" | grep -o '"qrPayload":"[^"]*"' | cut -d'"' -f4)
  
  info "Round: ${CURRENT_ROUND}/${TOTAL_ROUNDS}"
  
  if [ "$CURRENT_ROUND" = "1" ] && [ "$TOTAL_ROUNDS" = "3" ]; then
    pass "Valores iniciales correctos (round 1/3)"
  else
    fail "Valores iniciales incorrectos"
  fi
  
  if [ -n "$QR_PAYLOAD" ]; then
    pass "QR payload recibido"
  else
    fail "No se recibió QR payload"
  fi
else
  fail "Registro falló: $REGISTER_RESPONSE"
  exit 1
fi

# =============================================================================
# Test 2: Consulta de estado
# =============================================================================
echo ""
echo "Test 2: Consulta de estado"

STATUS_RESPONSE=$(curl -s "${BASE_URL}/asistencia/api/attendance/status?sessionId=${SESSION_ID}&studentId=${STUDENT_ID}")

if echo "$STATUS_RESPONSE" | grep -q '"registered":true'; then
  pass "Estado muestra registrado"
  
  if echo "$STATUS_RESPONSE" | grep -q '"status":"active"'; then
    pass "Estado es 'active'"
  else
    fail "Estado no es 'active'"
  fi
  
  if echo "$STATUS_RESPONSE" | grep -q '"hasActiveQR":true'; then
    pass "Tiene QR activo"
  else
    fail "No tiene QR activo"
  fi
else
  fail "Estado incorrecto: $STATUS_RESPONSE"
fi

# =============================================================================
# Test 3: Validar Round 1
# =============================================================================
echo ""
echo "Test 3: Validar Round 1"

VALIDATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/validate" \
  -H "Content-Type: application/json" \
  -d "{\"encrypted\":\"${QR_PAYLOAD}\",\"studentId\":${STUDENT_ID}}")

if echo "$VALIDATE_RESPONSE" | grep -q '"success":true'; then
  pass "Validación Round 1 exitosa"
  
  if echo "$VALIDATE_RESPONSE" | grep -q '"isComplete":false'; then
    pass "No completado (correcto, faltan rounds)"
  else
    fail "Debería indicar no completado"
  fi
  
  # Extraer QR del siguiente round
  NEXT_QR=$(echo "$VALIDATE_RESPONSE" | grep -o '"qrPayload":"[^"]*"' | cut -d'"' -f4)
  NEXT_ROUND=$(echo "$VALIDATE_RESPONSE" | grep -o '"round":[0-9]*' | tail -1 | cut -d: -f2)
  
  if [ "$NEXT_ROUND" = "2" ]; then
    pass "Avanzó a Round 2"
  else
    fail "No avanzó correctamente al round 2"
  fi
else
  fail "Validación Round 1 falló: $VALIDATE_RESPONSE"
  exit 1
fi

# =============================================================================
# Test 4: Validar Round 2
# =============================================================================
echo ""
echo "Test 4: Validar Round 2"

VALIDATE_R2=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/validate" \
  -H "Content-Type: application/json" \
  -d "{\"encrypted\":\"${NEXT_QR}\",\"studentId\":${STUDENT_ID}}")

if echo "$VALIDATE_R2" | grep -q '"success":true'; then
  pass "Validación Round 2 exitosa"
  
  NEXT_QR=$(echo "$VALIDATE_R2" | grep -o '"qrPayload":"[^"]*"' | cut -d'"' -f4)
  NEXT_ROUND=$(echo "$VALIDATE_R2" | grep -o '"round":[0-9]*' | tail -1 | cut -d: -f2)
  
  if [ "$NEXT_ROUND" = "3" ]; then
    pass "Avanzó a Round 3"
  else
    fail "No avanzó correctamente al round 3"
  fi
else
  fail "Validación Round 2 falló: $VALIDATE_R2"
fi

# =============================================================================
# Test 5: Validar Round 3 (final)
# =============================================================================
echo ""
echo "Test 5: Validar Round 3 (final)"

VALIDATE_R3=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/validate" \
  -H "Content-Type: application/json" \
  -d "{\"encrypted\":\"${NEXT_QR}\",\"studentId\":${STUDENT_ID}}")

if echo "$VALIDATE_R3" | grep -q '"success":true'; then
  pass "Validación Round 3 exitosa"
  
  if echo "$VALIDATE_R3" | grep -q '"isComplete":true'; then
    pass "Marcado como completado"
  else
    fail "Debería estar completado"
  fi
  
  if echo "$VALIDATE_R3" | grep -q '"certainty"'; then
    pass "Incluye certeza en respuesta"
    CERTAINTY=$(echo "$VALIDATE_R3" | grep -o '"certainty":[0-9]*' | cut -d: -f2)
    info "Certeza calculada: ${CERTAINTY}%"
  else
    fail "No incluye certeza"
  fi
else
  fail "Validación Round 3 falló: $VALIDATE_R3"
fi

# =============================================================================
# Test 6: Verificar estado final
# =============================================================================
echo ""
echo "Test 6: Verificar estado final"

FINAL_STATUS=$(curl -s "${BASE_URL}/asistencia/api/attendance/status?sessionId=${SESSION_ID}&studentId=${STUDENT_ID}")

if echo "$FINAL_STATUS" | grep -q '"status":"completed"'; then
  pass "Estado final es 'completed'"
else
  fail "Estado final no es 'completed': $FINAL_STATUS"
fi

if echo "$FINAL_STATUS" | grep -q '"roundsCompleted":3'; then
  pass "3 rounds completados"
else
  fail "Rounds completados incorrectos"
fi

# =============================================================================
# Test 7: Intentar registrar nuevamente (ya completado)
# =============================================================================
echo ""
echo "Test 7: Intentar registrar nuevamente"

REREGISTER=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/register" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"${SESSION_ID}\",\"studentId\":${STUDENT_ID}}")

if echo "$REREGISTER" | grep -q '"success":false'; then
  if echo "$REREGISTER" | grep -q 'ALREADY_COMPLETED\|completaste'; then
    pass "Rechaza re-registro correctamente"
  else
    fail "Error inesperado: $REREGISTER"
  fi
else
  fail "No debería permitir re-registro"
fi

# =============================================================================
# Test 8: Probar con estudiante diferente (nuevo flujo)
# =============================================================================
echo ""
echo "Test 8: Estudiante nuevo en misma sesión"

STUDENT2_ID=$((STUDENT_ID + 1))
info "Student 2 ID: ${STUDENT2_ID}"

REG2=$(curl -s -X POST "${BASE_URL}/asistencia/api/attendance/register" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"${SESSION_ID}\",\"studentId\":${STUDENT2_ID}}")

if echo "$REG2" | grep -q '"success":true'; then
  pass "Segundo estudiante registrado"
  
  if echo "$REG2" | grep -q '"currentRound":1'; then
    pass "Segundo estudiante empieza en round 1"
  else
    fail "Round incorrecto para segundo estudiante"
  fi
else
  fail "Registro de segundo estudiante falló"
fi

# =============================================================================
# Test 9: Verificar archivos creados
# =============================================================================
echo ""
echo "Test 9: Verificar archivos de código"

FILES_OK=true

if [ -f "node-service/src/backend/attendance/infrastructure/student-session.repository.ts" ]; then
  pass "student-session.repository.ts existe"
else
  fail "student-session.repository.ts no existe"
  FILES_OK=false
fi

if [ -f "node-service/src/backend/attendance/application/participation.service.ts" ]; then
  pass "participation.service.ts existe"
else
  fail "participation.service.ts no existe"
  FILES_OK=false
fi

# =============================================================================
# Test 10: TypeScript compila
# =============================================================================
echo ""
echo "Test 10: TypeScript compila"

if podman compose exec node-service npm run type-check 2>&1 | grep -q "error"; then
  fail "TypeScript tiene errores"
else
  pass "TypeScript compila sin errores"
fi

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "======================================"
echo "  RESUMEN FASE 6                      "
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
