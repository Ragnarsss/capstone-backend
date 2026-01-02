#!/bin/bash

###############################################################################
# Script de Validación Automática de Requisitos
# 
# Este script ejecuta todas las validaciones necesarias para verificar
# que se cumplen los 7 requisitos funcionales del sistema de asistencia.
#
# Uso:
#   ./validate-requirements.sh [--req NUM] [--env ENV]
#
# Opciones:
#   --req NUM    Ejecutar solo el requisito NUM (1-7)
#   --env ENV    Ambiente: local|staging|production (default: local)
#   --report     Generar reporte HTML
#   --evidence   Guardar evidencias en carpeta
#
# Ejemplos:
#   ./validate-requirements.sh                    # Todos los requisitos
#   ./validate-requirements.sh --req 3            # Solo requisito 3
#   ./validate-requirements.sh --env staging      # En staging
#   ./validate-requirements.sh --report --evidence # Con reporte y evidencias
###############################################################################

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EVIDENCE_DIR="$PROJECT_ROOT/evidencias/$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$EVIDENCE_DIR/validation-report.html"

# Variables de ambiente
ENV="${ENV:-local}"
SPECIFIC_REQ=""
GENERATE_REPORT=false
SAVE_EVIDENCE=false

# Parse argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --req)
      SPECIFIC_REQ="$2"
      shift 2
      ;;
    --env)
      ENV="$2"
      shift 2
      ;;
    --report)
      GENERATE_REPORT=true
      shift
      ;;
    --evidence)
      SAVE_EVIDENCE=true
      shift
      ;;
    *)
      echo "Opción desconocida: $1"
      exit 1
      ;;
  esac
done

# Crear carpeta de evidencias si es necesario
if [ "$SAVE_EVIDENCE" = true ]; then
  mkdir -p "$EVIDENCE_DIR"
  echo -e "${BLUE}📁 Evidencias se guardarán en: $EVIDENCE_DIR${NC}"
fi

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Array para resultados
declare -A RESULTS

###############################################################################
# Funciones de utilidad
###############################################################################

print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_test() {
  echo -e "${YELLOW}🔍 Test: $1${NC}"
}

print_pass() {
  echo -e "${GREEN}✅ PASS: $1${NC}"
  ((PASSED_TESTS++))
  RESULTS["$2"]="PASS"
}

print_fail() {
  echo -e "${RED}❌ FAIL: $1${NC}"
  ((FAILED_TESTS++))
  RESULTS["$2"]="FAIL"
}

print_skip() {
  echo -e "${YELLOW}⏭️  SKIP: $1${NC}"
  ((SKIPPED_TESTS++))
  RESULTS["$2"]="SKIP"
}

save_screenshot() {
  if [ "$SAVE_EVIDENCE" = true ]; then
    local name="$1"
    local url="$2"
    # Usar Playwright CLI para screenshot
    npx playwright screenshot "$url" "$EVIDENCE_DIR/${name}.png" 2>/dev/null || true
  fi
}

save_query_result() {
  if [ "$SAVE_EVIDENCE" = true ]; then
    local name="$1"
    local query="$2"
    psql "$DATABASE_URL" -c "$query" -o "$EVIDENCE_DIR/${name}.txt" 2>/dev/null || true
  fi
}

###############################################################################
# Requisito 1: Sistema Aislado
###############################################################################

validate_req_01() {
  if [ -n "$SPECIFIC_REQ" ] && [ "$SPECIFIC_REQ" != "1" ]; then
    return 0
  fi

  print_header "REQUISITO 1: Sistema Hawaii operando en versión aislada propia"

  # Test 1.1: Hawaii legacy responde
  print_test "REQ-01-001: Hawaii legacy responde HTTP 200"
  ((TOTAL_TESTS++))
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
  if [ "$HTTP_CODE" = "200" ]; then
    print_pass "Hawaii legacy responde correctamente" "REQ-01-001"
  else
    print_fail "Hawaii legacy no responde (HTTP $HTTP_CODE)" "REQ-01-001"
  fi

  # Test 1.2: Módulo asistencia responde
  print_test "REQ-01-002: Módulo asistencia responde"
  ((TOTAL_TESTS++))
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/asistencia/health")
  if [ "$HTTP_CODE" = "200" ]; then
    print_pass "Módulo asistencia responde correctamente" "REQ-01-002"
  else
    print_fail "Módulo asistencia no responde (HTTP $HTTP_CODE)" "REQ-01-002"
  fi

  # Test 1.3: PHP integration responde
  print_test "REQ-01-003: PHP integration genera JWT"
  ((TOTAL_TESTS++))
  RESPONSE=$(curl -s "$BASE_URL/api_get_asistencia_token.php")
  if echo "$RESPONSE" | jq -e '.success == true and .token' > /dev/null 2>&1; then
    print_pass "PHP integration genera JWT correctamente" "REQ-01-003"
  else
    print_fail "PHP integration no genera JWT" "REQ-01-003"
  fi

  # Test 1.4: Sin errores 500 en logs
  print_test "REQ-01-004: Sin errores 500 en logs de Apache"
  ((TOTAL_TESTS++))
  ERROR_COUNT=$(grep -c "500" /var/log/httpd/error_log 2>/dev/null || echo 0)
  if [ "$ERROR_COUNT" = "0" ]; then
    print_pass "No hay errores 500 en logs" "REQ-01-004"
  else
    print_fail "Se encontraron $ERROR_COUNT errores 500" "REQ-01-004"
  fi

  # Test 1.5: Esquema de BD sin conflictos
  print_test "REQ-01-005: Esquema de BD sin conflictos"
  ((TOTAL_TESTS++))
  CONSTRAINT_ERRORS=$(psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM pg_constraint WHERE convalidated = false" -t 2>/dev/null || echo "-1")
  if [ "$CONSTRAINT_ERRORS" = "0" ] || [ "$CONSTRAINT_ERRORS" = " 0" ]; then
    print_pass "Esquema de BD sin conflictos" "REQ-01-005"
  else
    print_fail "Existen constraints no validados" "REQ-01-005"
  fi
}

###############################################################################
# Requisito 2: Opción Estudiante
###############################################################################

validate_req_02() {
  if [ -n "$SPECIFIC_REQ" ] && [ "$SPECIFIC_REQ" != "2" ]; then
    return 0
  fi

  print_header "REQUISITO 2: Disponibilidad de opción 'marcar asistencia' para estudiantes"

  # Test 2.1-2.5: Ejecutar tests E2E de Playwright
  print_test "REQ-02-E2E: Ejecutando tests E2E de opción estudiante"
  ((TOTAL_TESTS++))
  if npm run test:e2e -- requisitos/req-02-opcion-estudiante.spec.ts > /dev/null 2>&1; then
    print_pass "Tests E2E de opción estudiante pasaron" "REQ-02-E2E"
  else
    print_fail "Tests E2E de opción estudiante fallaron" "REQ-02-E2E"
  fi
}

###############################################################################
# Requisito 3: Opción Profesor
###############################################################################

validate_req_03() {
  if [ -n "$SPECIFIC_REQ" ] && [ "$SPECIFIC_REQ" != "3" ]; then
    return 0
  fi

  print_header "REQUISITO 3: Capacidad de profesores para 'abrir' sesión de asistencia"

  # Test 3.1-3.8: Ejecutar tests E2E de Playwright
  print_test "REQ-03-E2E: Ejecutando tests E2E de opción profesor"
  ((TOTAL_TESTS++))
  if npm run test:e2e -- requisitos/req-03-opcion-profesor.spec.ts > /dev/null 2>&1; then
    print_pass "Tests E2E de opción profesor pasaron" "REQ-03-E2E"
  else
    print_fail "Tests E2E de opción profesor fallaron" "REQ-03-E2E"
  fi

  # Test 3.9: Validar JWT generado
  print_test "REQ-03-009: JWT generado con estructura correcta"
  ((TOTAL_TESTS++))
  RESPONSE=$(curl -s -X GET "$BASE_URL/api_get_asistencia_token.php" \
    -H "Cookie: PHPSESSID=$TEST_SESSION_ID")
  TOKEN=$(echo "$RESPONSE" | jq -r '.token')
  
  if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    JWT_PARTS=$(echo "$TOKEN" | tr '.' '\n' | wc -l)
    if [ "$JWT_PARTS" -eq 3 ]; then
      print_pass "JWT tiene estructura correcta (3 partes)" "REQ-03-009"
    else
      print_fail "JWT tiene estructura incorrecta ($JWT_PARTS partes)" "REQ-03-009"
    fi
  else
    print_fail "No se pudo obtener JWT" "REQ-03-009"
  fi
}

###############################################################################
# Requisito 4: Registro Exitoso
###############################################################################

validate_req_04() {
  if [ -n "$SPECIFIC_REQ" ] && [ "$SPECIFIC_REQ" != "4" ]; then
    return 0
  fi

  print_header "REQUISITO 4: Registro exitoso de asistencia por parte de estudiantes"

  # Test 4.1-4.5: Ejecutar tests E2E de Playwright
  print_test "REQ-04-E2E: Ejecutando tests E2E de registro exitoso"
  ((TOTAL_TESTS++))
  if npm run test:e2e -- requisitos/req-04-registro-exitoso.spec.ts > /dev/null 2>&1; then
    print_pass "Tests E2E de registro exitoso pasaron" "REQ-04-E2E"
  else
    print_fail "Tests E2E de registro exitoso fallaron" "REQ-04-E2E"
  fi
}

###############################################################################
# Requisito 5: Encuestas
###############################################################################

validate_req_05() {
  if [ -n "$SPECIFIC_REQ" ] && [ "$SPECIFIC_REQ" != "5" ]; then
    return 0
  fi

  print_header "REQUISITO 5: Preservación del flujo de encuestas post-asistencia"

  # Test 5.1-5.5: Ejecutar tests E2E de Playwright
  print_test "REQ-05-E2E: Ejecutando tests E2E de encuestas"
  ((TOTAL_TESTS++))
  if npm run test:e2e -- requisitos/req-05-encuestas.spec.ts > /dev/null 2>&1; then
    print_pass "Tests E2E de encuestas pasaron" "REQ-05-E2E"
  else
    print_fail "Tests E2E de encuestas fallaron" "REQ-05-E2E"
  fi
}

###############################################################################
# Requisito 6: Pantalla General
###############################################################################

validate_req_06() {
  if [ -n "$SPECIFIC_REQ" ] && [ "$SPECIFIC_REQ" != "6" ]; then
    return 0
  fi

  print_header "REQUISITO 6: Registro correcto en pantalla general de asistencia"

  # Test 6.1-6.6: Ejecutar tests E2E de Playwright
  print_test "REQ-06-E2E: Ejecutando tests E2E de pantalla general"
  ((TOTAL_TESTS++))
  if npm run test:e2e -- requisitos/req-06-pantalla-general.spec.ts > /dev/null 2>&1; then
    print_pass "Tests E2E de pantalla general pasaron" "REQ-06-E2E"
  else
    print_fail "Tests E2E de pantalla general fallaron" "REQ-06-E2E"
  fi

  # Test 6.7: Verificar sin duplicados
  print_test "REQ-06-007: Sin duplicados en alumno_asistencia"
  ((TOTAL_TESTS++))
  DUPLICATES=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM (
      SELECT rut, fecha, bloque, COUNT(*)
      FROM alumno_asistencia
      GROUP BY rut, fecha, bloque
      HAVING COUNT(*) > 1
    ) duplicates
  " 2>/dev/null | tr -d ' ')
  
  if [ "$DUPLICATES" = "0" ]; then
    print_pass "No hay duplicados en alumno_asistencia" "REQ-06-007"
    save_query_result "req-06-007-sin-duplicados" "SELECT rut, fecha, bloque, COUNT(*) FROM alumno_asistencia GROUP BY rut, fecha, bloque HAVING COUNT(*) > 1"
  else
    print_fail "Se encontraron $DUPLICATES registros duplicados" "REQ-06-007"
  fi
}

###############################################################################
# Requisito 7: Duración Configurable
###############################################################################

validate_req_07() {
  if [ -n "$SPECIFIC_REQ" ] && [ "$SPECIFIC_REQ" != "7" ]; then
    return 0
  fi

  print_header "REQUISITO 7: Validación de duración configurable del código de reserva"

  # Test 7.1-7.5: Ejecutar tests E2E de Playwright
  print_test "REQ-07-E2E: Ejecutando tests E2E de duración QR"
  ((TOTAL_TESTS++))
  if npm run test:e2e -- requisitos/req-07-duracion-qr.spec.ts > /dev/null 2>&1; then
    print_pass "Tests E2E de duración QR pasaron" "REQ-07-E2E"
  else
    print_fail "Tests E2E de duración QR fallaron" "REQ-07-E2E"
  fi

  # Test 7.6: Verificar TTL por defecto
  print_test "REQ-07-006: TTL por defecto es 5 minutos"
  ((TOTAL_TESTS++))
  AVG_TTL=$(psql "$DATABASE_URL" -t -c "
    SELECT AVG(EXTRACT(EPOCH FROM (fechahora_termino - fechahora_inicio))/60)
    FROM asistencia_curso
    WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
  " 2>/dev/null | tr -d ' ')
  
  # Verificar que TTL promedio está entre 4.5 y 5.5 minutos
  if (( $(echo "$AVG_TTL > 4.5" | bc -l) )) && (( $(echo "$AVG_TTL < 5.5" | bc -l) )); then
    print_pass "TTL promedio es correcto (${AVG_TTL} minutos)" "REQ-07-006"
    save_query_result "req-07-006-ttl-correcto" "SELECT fechahora_inicio, fechahora_termino, EXTRACT(EPOCH FROM (fechahora_termino - fechahora_inicio))/60 as ttl_minutes FROM asistencia_curso WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'"
  else
    print_fail "TTL promedio incorrecto (${AVG_TTL} minutos, esperado ~5)" "REQ-07-006"
  fi
}

###############################################################################
# Generar reporte HTML
###############################################################################

generate_report() {
  if [ "$GENERATE_REPORT" = false ]; then
    return 0
  fi

  cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Validación de Requisitos</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      color: #7f8c8d;
      font-size: 14px;
      text-transform: uppercase;
    }
    .summary-card .value {
      font-size: 36px;
      font-weight: bold;
    }
    .pass { color: #27ae60; }
    .fail { color: #e74c3c; }
    .skip { color: #f39c12; }
    .total { color: #3498db; }
    table {
      width: 100%;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }
    th {
      background: #34495e;
      color: white;
      font-weight: 600;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge.pass {
      background: #d4edda;
      color: #155724;
    }
    .badge.fail {
      background: #f8d7da;
      color: #721c24;
    }
    .badge.skip {
      background: #fff3cd;
      color: #856404;
    }
    .timestamp {
      color: #7f8c8d;
      font-size: 14px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <h1>📊 Reporte de Validación de Requisitos</h1>
  
  <div class="timestamp">
    <strong>Fecha:</strong> $(date '+%Y-%m-%d %H:%M:%S')<br>
    <strong>Ambiente:</strong> $ENV<br>
    <strong>Base URL:</strong> $BASE_URL
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Total Tests</h3>
      <div class="value total">$TOTAL_TESTS</div>
    </div>
    <div class="summary-card">
      <h3>Aprobados</h3>
      <div class="value pass">$PASSED_TESTS</div>
    </div>
    <div class="summary-card">
      <h3>Fallados</h3>
      <div class="value fail">$FAILED_TESTS</div>
    </div>
    <div class="summary-card">
      <h3>Omitidos</h3>
      <div class="value skip">$SKIPPED_TESTS</div>
    </div>
  </div>

  <h2>Resultados Detallados</h2>
  <table>
    <thead>
      <tr>
        <th>Test ID</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
EOF

  for test_id in "${!RESULTS[@]}"; do
    result="${RESULTS[$test_id]}"
    cat >> "$REPORT_FILE" << EOF
      <tr>
        <td>$test_id</td>
        <td><span class="badge ${result,,}">$result</span></td>
      </tr>
EOF
  done

  cat >> "$REPORT_FILE" << EOF
    </tbody>
  </table>
</body>
</html>
EOF

  echo -e "\n${GREEN}📄 Reporte HTML generado: $REPORT_FILE${NC}"
}

###############################################################################
# Main
###############################################################################

main() {
  print_header "SISTEMA DE VALIDACIÓN AUTOMÁTICA DE REQUISITOS"
  
  echo -e "${BLUE}Ambiente: $ENV${NC}"
  echo -e "${BLUE}Base URL: $BASE_URL${NC}"
  
  if [ -n "$SPECIFIC_REQ" ]; then
    echo -e "${BLUE}Ejecutando solo requisito: $SPECIFIC_REQ${NC}"
  fi
  
  echo ""

  # Validar requisitos
  validate_req_01
  validate_req_02
  validate_req_03
  validate_req_04
  validate_req_05
  validate_req_06
  validate_req_07

  # Generar reporte
  generate_report

  # Resumen final
  print_header "RESUMEN FINAL"
  echo -e "${BLUE}Total tests ejecutados:${NC} $TOTAL_TESTS"
  echo -e "${GREEN}Tests aprobados:${NC} $PASSED_TESTS"
  echo -e "${RED}Tests fallados:${NC} $FAILED_TESTS"
  echo -e "${YELLOW}Tests omitidos:${NC} $SKIPPED_TESTS"
  
  SUCCESS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
  echo -e "\n${BLUE}Tasa de éxito:${NC} ${SUCCESS_RATE}%"

  if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "\n${GREEN}✅ TODOS LOS TESTS PASARON EXITOSAMENTE${NC}\n"
    exit 0
  else
    echo -e "\n${RED}❌ ALGUNOS TESTS FALLARON${NC}\n"
    exit 1
  fi
}

# Ejecutar
main
