#!/bin/bash
# Test Fase 6.3: Pool de Proyección
# Verifica que el proyector lea QRs del pool de estudiantes registrados

set -e

BASE_URL="${BASE_URL:-http://localhost:9503}"
CURL_OPTS="-s -w \n%{http_code}"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

# Función para hacer requests
request() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -n "$data" ]; then
    curl $CURL_OPTS -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl $CURL_OPTS -X "$method" "$BASE_URL$endpoint"
  fi
}

# Función para verificar respuesta
check() {
  local name=$1
  local response=$2
  local expected_code=$3
  local check_field=$4
  local expected_value=$5
  
  # Separar body y status code
  local body=$(echo "$response" | head -n -1)
  local code=$(echo "$response" | tail -n 1)
  
  if [ "$code" != "$expected_code" ]; then
    echo -e "${RED}✗ $name${NC}"
    echo "  Expected HTTP $expected_code, got $code"
    echo "  Response: $body"
    ((TESTS_FAILED++))
    return 1
  fi
  
  if [ -n "$check_field" ]; then
    local actual=$(echo "$body" | jq -r "$check_field" 2>/dev/null)
    if [ "$actual" != "$expected_value" ]; then
      echo -e "${RED}✗ $name${NC}"
      echo "  Expected $check_field = $expected_value, got $actual"
      echo "  Response: $body"
      ((TESTS_FAILED++))
      return 1
    fi
  fi
  
  echo -e "${GREEN}✓ $name${NC}"
  ((TESTS_PASSED++))
  return 0
}

# Función para verificar que un campo existe
check_exists() {
  local name=$1
  local response=$2
  local expected_code=$3
  local check_field=$4
  
  local body=$(echo "$response" | head -n -1)
  local code=$(echo "$response" | tail -n 1)
  
  if [ "$code" != "$expected_code" ]; then
    echo -e "${RED}✗ $name${NC}"
    echo "  Expected HTTP $expected_code, got $code"
    ((TESTS_FAILED++))
    return 1
  fi
  
  local actual=$(echo "$body" | jq -r "$check_field" 2>/dev/null)
  if [ "$actual" == "null" ] || [ -z "$actual" ]; then
    echo -e "${RED}✗ $name${NC}"
    echo "  Field $check_field not found or null"
    ((TESTS_FAILED++))
    return 1
  fi
  
  echo -e "${GREEN}✓ $name${NC}"
  ((TESTS_PASSED++))
  return 0
}

echo "=========================================="
echo " Test Fase 6.3: Pool de Proyección"
echo "=========================================="
echo ""

# Generar IDs únicos para esta prueba
SESSION_ID="test-pool-$(date +%s)"
STUDENT_1=101
STUDENT_2=102
STUDENT_3=103

echo "Session ID: $SESSION_ID"
echo "Students: $STUDENT_1, $STUDENT_2, $STUDENT_3"
echo ""

# ==========================================
# SECCIÓN 1: Registro de estudiantes (agregan al pool)
# ==========================================
echo -e "${YELLOW}--- Sección 1: Registro de Estudiantes ---${NC}"

# Test 1.1: Registrar estudiante 1
RESP=$(request POST "/asistencia/api/attendance/register" \
  "{\"sessionId\":\"$SESSION_ID\",\"studentId\":$STUDENT_1}")
check "1.1 Registrar estudiante 1" "$RESP" "200" ".success" "true"

# Test 1.2: Verificar round inicial = 1
RESP=$(request POST "/asistencia/api/attendance/register" \
  "{\"sessionId\":\"$SESSION_ID\",\"studentId\":$STUDENT_1}")
check "1.2 Estudiante 1 tiene round 1" "$RESP" "200" ".data.currentRound" "1"

# Test 1.3: Registrar estudiante 2
RESP=$(request POST "/asistencia/api/attendance/register" \
  "{\"sessionId\":\"$SESSION_ID\",\"studentId\":$STUDENT_2}")
check "1.3 Registrar estudiante 2" "$RESP" "200" ".success" "true"

# Test 1.4: Registrar estudiante 3
RESP=$(request POST "/asistencia/api/attendance/register" \
  "{\"sessionId\":\"$SESSION_ID\",\"studentId\":$STUDENT_3}")
check "1.4 Registrar estudiante 3" "$RESP" "200" ".success" "true"

# ==========================================
# SECCIÓN 2: Verificar estado de estudiantes
# ==========================================
echo ""
echo -e "${YELLOW}--- Sección 2: Verificar Estado ---${NC}"

# Test 2.1: Status estudiante 1
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
check "2.1 Status estudiante 1 - registrado" "$RESP" "200" ".registered" "true"

# Test 2.2: Status estudiante 1 tiene QR activo
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
check "2.2 Status estudiante 1 - tiene QR activo" "$RESP" "200" ".hasActiveQR" "true"

# Test 2.3: Status estudiante 2 tiene QR activo
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_2")
check "2.3 Status estudiante 2 - tiene QR activo" "$RESP" "200" ".hasActiveQR" "true"

# Test 2.4: Status estudiante no registrado
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=999")
check "2.4 Estudiante no registrado" "$RESP" "200" ".registered" "false"

# ==========================================
# SECCIÓN 3: Verificar QR Payloads tienen round correcto
# ==========================================
echo ""
echo -e "${YELLOW}--- Sección 3: Verificar Rounds en QRs ---${NC}"

# Test 3.1: Obtener QR de estudiante 1 y verificar estructura
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
BODY=$(echo "$RESP" | head -n -1)
QR_PAYLOAD=$(echo "$BODY" | jq -r '.qrPayload')

if [ -n "$QR_PAYLOAD" ] && [ "$QR_PAYLOAD" != "null" ]; then
  # Verificar formato iv.ciphertext.authTag
  PARTS=$(echo "$QR_PAYLOAD" | tr '.' '\n' | wc -l)
  if [ "$PARTS" -eq 3 ]; then
    echo -e "${GREEN}✓ 3.1 QR tiene formato correcto (iv.ciphertext.authTag)${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ 3.1 QR no tiene formato correcto${NC}"
    ((TESTS_FAILED++))
  fi
else
  echo -e "${RED}✗ 3.1 No se pudo obtener QR payload${NC}"
  ((TESTS_FAILED++))
fi

# Test 3.2: Verificar que el QR payload está encriptado (no es JSON plano)
if echo "$QR_PAYLOAD" | jq . >/dev/null 2>&1; then
  echo -e "${RED}✗ 3.2 QR está en texto plano (debería estar encriptado)${NC}"
  ((TESTS_FAILED++))
else
  echo -e "${GREEN}✓ 3.2 QR está encriptado correctamente${NC}"
  ((TESTS_PASSED++))
fi

# ==========================================
# SECCIÓN 4: Simular avance de round
# ==========================================
echo ""
echo -e "${YELLOW}--- Sección 4: Avance de Rounds ---${NC}"

# Para probar el avance, necesitamos validar un QR
# Esto requiere obtener el QR encriptado y enviarlo al endpoint de validación

# Primero obtenemos el QR del estudiante 1
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
BODY=$(echo "$RESP" | head -n -1)
QR_ENCRYPTED=$(echo "$BODY" | jq -r '.qrPayload')

# Test 4.1: Validar QR (esto debería avanzar al round 2)
RESP=$(request POST "/asistencia/api/attendance/validate" \
  "{\"encrypted\":\"$QR_ENCRYPTED\",\"studentId\":$STUDENT_1}")
check "4.1 Validar round 1 - success" "$RESP" "200" ".valid" "true"

# Test 4.2: Verificar que avanzó al round 2
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
check "4.2 Estudiante 1 ahora en round 2" "$RESP" "200" ".currentRound" "2"

# Test 4.3: Obtener nuevo QR y validar round 2
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
BODY=$(echo "$RESP" | head -n -1)
QR_ENCRYPTED_R2=$(echo "$BODY" | jq -r '.qrPayload')

RESP=$(request POST "/asistencia/api/attendance/validate" \
  "{\"encrypted\":\"$QR_ENCRYPTED_R2\",\"studentId\":$STUDENT_1}")
check "4.3 Validar round 2 - success" "$RESP" "200" ".valid" "true"

# Test 4.4: Verificar que avanzó al round 3
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
check "4.4 Estudiante 1 ahora en round 3" "$RESP" "200" ".currentRound" "3"

# Test 4.5: Completar round 3 y verificar certeza
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
BODY=$(echo "$RESP" | head -n -1)
QR_ENCRYPTED_R3=$(echo "$BODY" | jq -r '.qrPayload')

RESP=$(request POST "/asistencia/api/attendance/validate" \
  "{\"encrypted\":\"$QR_ENCRYPTED_R3\",\"studentId\":$STUDENT_1}")
check "4.5 Validar round 3 - complete" "$RESP" "200" ".isComplete" "true"

# Test 4.6: Verificar certeza está presente
RESP=$(request POST "/asistencia/api/attendance/validate" \
  "{\"encrypted\":\"$QR_ENCRYPTED_R3\",\"studentId\":$STUDENT_1}")
# El QR ya fue consumido, debería fallar
BODY=$(echo "$RESP" | head -n -1)
CODE=$(echo "$RESP" | tail -n 1)
if [ "$CODE" == "200" ]; then
  VALID=$(echo "$BODY" | jq -r '.valid')
  if [ "$VALID" == "false" ]; then
    echo -e "${GREEN}✓ 4.6 QR ya consumido no puede reusarse${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ 4.6 QR consumido fue aceptado de nuevo${NC}"
    ((TESTS_FAILED++))
  fi
else
  echo -e "${RED}✗ 4.6 Error inesperado${NC}"
  ((TESTS_FAILED++))
fi

# Test 4.7: Estudiante 1 tiene status completed
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_1")
check "4.7 Estudiante 1 status completed" "$RESP" "200" ".status" "completed"

# ==========================================
# SECCIÓN 5: Verificar independencia de estudiantes
# ==========================================
echo ""
echo -e "${YELLOW}--- Sección 5: Independencia de Estudiantes ---${NC}"

# Test 5.1: Estudiante 2 sigue en round 1
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_2")
check "5.1 Estudiante 2 sigue en round 1" "$RESP" "200" ".currentRound" "1"

# Test 5.2: Estudiante 3 sigue en round 1
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_3")
check "5.2 Estudiante 3 sigue en round 1" "$RESP" "200" ".currentRound" "1"

# Test 5.3: Estudiante 2 tiene status active
RESP=$(request GET "/asistencia/api/attendance/status?sessionId=$SESSION_ID&studentId=$STUDENT_2")
check "5.3 Estudiante 2 status active" "$RESP" "200" ".status" "active"

# ==========================================
# SECCIÓN 6: Healthcheck
# ==========================================
echo ""
echo -e "${YELLOW}--- Sección 6: Healthcheck ---${NC}"

RESP=$(request GET "/asistencia/api/attendance/health")
check "6.1 Healthcheck OK" "$RESP" "200" ".status" "ok"

# ==========================================
# RESUMEN
# ==========================================
echo ""
echo "=========================================="
echo " RESUMEN"
echo "=========================================="
echo -e "Tests pasados: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests fallidos: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}¡Todos los tests pasaron!${NC}"
  exit 0
else
  echo -e "${RED}Algunos tests fallaron${NC}"
  exit 1
fi
