#!/bin/bash
# Test Fase 7: Persistencia PostgreSQL
# Verifica que las validaciones y resultados se persistan en PostgreSQL

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
echo "  TEST FASE 7: Persistencia PostgreSQL"
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

# =============================================================================
# Test 0: Verificar que PostgreSQL esté corriendo
# =============================================================================
echo "Test 0: Verificar conexión PostgreSQL"

PG_CHECK=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "SELECT 1" 2>&1)
if echo "$PG_CHECK" | grep -q "1 row"; then
  pass "PostgreSQL accesible"
else
  fail "No se puede conectar a PostgreSQL"
  exit 1
fi

# Verificar que el schema attendance exista
SCHEMA_CHECK=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'attendance'" 2>&1)
if echo "$SCHEMA_CHECK" | grep -q "attendance"; then
  pass "Schema 'attendance' existe"
else
  fail "Schema 'attendance' no existe"
  exit 1
fi

# =============================================================================
# Test 1: Verificar tablas requeridas
# =============================================================================
echo ""
echo "Test 1: Verificar tablas de persistencia"

TABLES=("sessions" "registrations" "validations" "results")
for TABLE in "${TABLES[@]}"; do
  TABLE_CHECK=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'attendance' AND table_name = '${TABLE}'" 2>&1)
  if echo "$TABLE_CHECK" | grep -q "${TABLE}"; then
    pass "Tabla attendance.${TABLE} existe"
  else
    fail "Tabla attendance.${TABLE} no existe"
  fi
done

# =============================================================================
# Test 2: Insertar sesión de prueba en PostgreSQL
# =============================================================================
echo ""
echo "Test 2: Crear sesión de prueba en PostgreSQL"

# Limpiar sesiones de prueba anteriores
podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "DELETE FROM attendance.sessions WHERE professor_id = 9999" > /dev/null 2>&1 || true

# Insertar sesión de prueba
SESSION_INSERT=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -t -c "
INSERT INTO attendance.sessions (professor_id, professor_name, course_code, course_name, room, semester, max_rounds, status)
VALUES (9999, 'Profesor Test', 'TEST-101', 'Curso de Prueba', 'A-101', '2025-1', 3, 'active')
RETURNING session_id;
" 2>&1)

if echo "$SESSION_INSERT" | grep -q "[0-9]"; then
  PG_SESSION_ID=$(echo "$SESSION_INSERT" | tr -d ' \n')
  pass "Sesión creada con ID: ${PG_SESSION_ID}"
else
  fail "No se pudo crear sesión: $SESSION_INSERT"
  exit 1
fi

# =============================================================================
# Test 3: Insertar registro de estudiante
# =============================================================================
echo ""
echo "Test 3: Insertar registro de estudiante"

STUDENT_ID=8888

REG_INSERT=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -t -c "
INSERT INTO attendance.registrations (session_id, user_id, queue_position, status)
VALUES (${PG_SESSION_ID}, ${STUDENT_ID}, 1, 'active')
RETURNING registration_id;
" 2>&1)

if echo "$REG_INSERT" | grep -q "[0-9]"; then
  REG_ID=$(echo "$REG_INSERT" | tr -d ' \n')
  pass "Registro creado con ID: ${REG_ID}"
else
  fail "No se pudo crear registro: $REG_INSERT"
  exit 1
fi

# =============================================================================
# Test 4: Insertar validaciones de prueba
# =============================================================================
echo ""
echo "Test 4: Insertar validaciones de prueba"

for ROUND in 1 2 3; do
  RT=$((800 + RANDOM % 400))  # Response time entre 800-1200ms
  VAL_INSERT=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "
  INSERT INTO attendance.validations (registration_id, round_number, qr_generated_at, response_received_at, response_time_ms, validation_status)
  VALUES (${REG_ID}, ${ROUND}, NOW() - interval '${RT} milliseconds', NOW(), ${RT}, 'success');
  " 2>&1)
  
  if echo "$VAL_INSERT" | grep -q "INSERT"; then
    pass "Validación round ${ROUND} insertada (RT: ${RT}ms)"
  else
    fail "Error insertando validación round ${ROUND}"
  fi
done

# =============================================================================
# Test 5: Verificar función de estadísticas
# =============================================================================
echo ""
echo "Test 5: Calcular estadísticas de response time"

STATS=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -t -c "
SELECT 
  ROUND(AVG(response_time_ms)::numeric, 2) as avg,
  ROUND(STDDEV(response_time_ms)::numeric, 2) as stddev,
  MIN(response_time_ms) as min,
  MAX(response_time_ms) as max,
  COUNT(*) as count
FROM attendance.validations
WHERE registration_id = ${REG_ID} AND validation_status = 'success';
" 2>&1)

if echo "$STATS" | grep -q "[0-9]"; then
  pass "Estadísticas calculadas correctamente"
  info "Stats: $STATS"
else
  fail "Error calculando estadísticas"
fi

# =============================================================================
# Test 6: Insertar resultado final
# =============================================================================
echo ""
echo "Test 6: Insertar resultado final"

RESULT_INSERT=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "
INSERT INTO attendance.results (
  registration_id, total_rounds, successful_rounds, failed_rounds,
  avg_response_time_ms, std_dev_response_time, min_response_time_ms, max_response_time_ms,
  certainty_score, final_status
)
SELECT 
  ${REG_ID},
  3,
  COUNT(*) FILTER (WHERE validation_status = 'success'),
  COUNT(*) FILTER (WHERE validation_status != 'success'),
  ROUND(AVG(response_time_ms)::numeric, 2),
  ROUND(STDDEV(response_time_ms)::numeric, 2),
  MIN(response_time_ms),
  MAX(response_time_ms),
  85,
  'PRESENT'
FROM attendance.validations
WHERE registration_id = ${REG_ID};
" 2>&1)

if echo "$RESULT_INSERT" | grep -q "INSERT"; then
  pass "Resultado final insertado"
else
  fail "Error insertando resultado: $RESULT_INSERT"
fi

# =============================================================================
# Test 7: Verificar integridad referencial
# =============================================================================
echo ""
echo "Test 7: Verificar integridad referencial"

# Intentar insertar validación con registration_id inválido
INVALID=$(podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "
INSERT INTO attendance.validations (registration_id, round_number, qr_generated_at, validation_status)
VALUES (99999, 1, NOW(), 'pending');
" 2>&1 || true)

if echo "$INVALID" | grep -q "violates foreign key"; then
  pass "FK constraint funciona (rechaza registration_id inválido)"
else
  fail "FK constraint no funcionó como se esperaba"
fi

# =============================================================================
# Test 8: Verificar repositorios TypeScript
# =============================================================================
echo ""
echo "Test 8: Verificar archivos de repositorios"

REPO_FILES=(
  "node-service/src/backend/attendance/infrastructure/repositories/session.repository.ts"
  "node-service/src/backend/attendance/infrastructure/repositories/registration.repository.ts"
  "node-service/src/backend/attendance/infrastructure/repositories/validation.repository.ts"
  "node-service/src/backend/attendance/infrastructure/repositories/result.repository.ts"
  "node-service/src/backend/attendance/infrastructure/repositories/index.ts"
)

for FILE in "${REPO_FILES[@]}"; do
  if [ -f "${FILE}" ]; then
    pass "$(basename ${FILE}) existe"
  else
    fail "$(basename ${FILE}) no existe"
  fi
done

# =============================================================================
# Test 9: TypeScript compila
# =============================================================================
echo ""
echo "Test 9: TypeScript compila"

TSC_OUTPUT=$(podman exec asistencia-node npx tsc --noEmit 2>&1)
if [ -z "$TSC_OUTPUT" ]; then
  pass "TypeScript compila sin errores"
else
  fail "TypeScript tiene errores: $TSC_OUTPUT"
fi

# =============================================================================
# Test 10: Verificar integración con UseCase
# =============================================================================
echo ""
echo "Test 10: Verificar UseCase tiene persistencia"

if grep -q "PersistenceDependencies" "node-service/src/backend/attendance/application/complete-scan.usecase.ts"; then
  pass "UseCase tiene interface PersistenceDependencies"
else
  fail "UseCase no tiene interface PersistenceDependencies"
fi

if grep -q "persistValidation" "node-service/src/backend/attendance/application/complete-scan.usecase.ts"; then
  pass "UseCase tiene método persistValidation"
else
  fail "UseCase no tiene método persistValidation"
fi

if grep -q "persistResult" "node-service/src/backend/attendance/application/complete-scan.usecase.ts"; then
  pass "UseCase tiene método persistResult"
else
  fail "UseCase no tiene método persistResult"
fi

# =============================================================================
# Test 11: Verificar variable de entorno habilitada
# =============================================================================
echo ""
echo "Test 11: Verificar configuración de persistencia"

if grep -q "ENABLE_POSTGRES_PERSISTENCE=true" "compose.dev.yaml"; then
  pass "Persistencia habilitada en compose.dev.yaml"
else
  warn "Persistencia no habilitada en compose.dev.yaml"
fi

if grep -q "enablePostgresPersistence" "node-service/src/backend/attendance/infrastructure/adapters/complete-scan-deps.factory.ts"; then
  pass "Factory soporta flag enablePostgresPersistence"
else
  fail "Factory no soporta flag enablePostgresPersistence"
fi

# =============================================================================
# Limpieza
# =============================================================================
echo ""
echo "Limpiando datos de prueba..."

podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "
DELETE FROM attendance.results WHERE registration_id = ${REG_ID};
DELETE FROM attendance.validations WHERE registration_id = ${REG_ID};
DELETE FROM attendance.registrations WHERE session_id = ${PG_SESSION_ID};
DELETE FROM attendance.sessions WHERE session_id = ${PG_SESSION_ID};
" > /dev/null 2>&1

info "Datos de prueba eliminados"

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "======================================"
echo "  RESUMEN FASE 7                      "
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
