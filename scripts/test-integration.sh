#!/bin/bash
# Script de testing de integracion para modulo asistencia-node-integration
# Valida configuracion, conectividad y endpoints API

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables de configuracion
BASE_URL="${BASE_URL:-http://localhost:9500}"
MODULE_PATH="/asistencia-node-integration"
NODE_SERVICE_URL="${NODE_SERVICE_URL:-http://localhost:3000}"

# Contadores
PASSED=0
FAILED=0

# Funcion para imprimir resultados
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}[FAIL]${NC} $2"
        ((FAILED++))
    fi
}

echo "==============================================="
echo "Testing: Modulo asistencia-node-integration"
echo "Base URL: ${BASE_URL}"
echo "==============================================="
echo ""

# Test 1: Verificar que Apache responde
echo "Test 1: Verificar Apache disponible"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}" || echo "000")
if [ "$HTTP_CODE" -ne "000" ]; then
    print_result 0 "Apache responde (HTTP ${HTTP_CODE})"
else
    print_result 1 "Apache no responde"
fi

# Test 2: Verificar que modulo existe
echo "Test 2: Verificar modulo disponible"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${MODULE_PATH}/" || echo "000")
if [ "$HTTP_CODE" -eq "200" ] || [ "$HTTP_CODE" -eq "302" ]; then
    print_result 0 "Modulo accesible (HTTP ${HTTP_CODE})"
else
    print_result 1 "Modulo no accesible (HTTP ${HTTP_CODE})"
fi

# Test 3: Verificar endpoint de validacion de sesion
echo "Test 3: Endpoint validate-session"
RESPONSE=$(curl -s "${BASE_URL}${MODULE_PATH}/api/validate-session")
if echo "$RESPONSE" | grep -q "authenticated"; then
    print_result 0 "Endpoint validate-session responde"
else
    print_result 1 "Endpoint validate-session no responde correctamente"
fi

# Test 4: Verificar endpoint de token (debe fallar sin sesion activa)
echo "Test 4: Endpoint token (sin autenticacion)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${MODULE_PATH}/api/token")
if [ "$HTTP_CODE" -eq "401" ] || [ "$HTTP_CODE" -eq "403" ]; then
    print_result 0 "Endpoint token rechaza sin auth (HTTP ${HTTP_CODE})"
else
    print_result 1 "Endpoint token no valida auth correctamente (HTTP ${HTTP_CODE})"
fi

# Test 5: Verificar configuracion de variables de entorno
echo "Test 5: Variables de entorno (via PHP info endpoint)"
# Nota: Este test requiere endpoint especial para inspeccionar config
# Por ahora solo verificamos que el modulo no falle por falta de config
RESPONSE=$(curl -s "${BASE_URL}${MODULE_PATH}/api/validate-session")
if echo "$RESPONSE" | grep -q "error"; then
    ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    if echo "$ERROR_MSG" | grep -qi "secret"; then
        print_result 1 "Variables de entorno no configuradas: $ERROR_MSG"
    else
        print_result 0 "Configuracion aparentemente correcta"
    fi
else
    print_result 0 "No hay errores de configuracion evidentes"
fi

# Test 6: Verificar servicio Node disponible
echo "Test 6: Servicio Node disponible"
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${NODE_SERVICE_URL}/health" || echo "000")
    if [ "$HTTP_CODE" -eq "200" ]; then
        print_result 0 "Servicio Node responde (HTTP ${HTTP_CODE})"
    else
        print_result 1 "Servicio Node no responde (HTTP ${HTTP_CODE})"
    fi
else
    echo -e "${YELLOW}[SKIP]${NC} Test 6: curl no disponible"
fi

# Test 7: Verificar archivos criticos existen
echo "Test 7: Archivos criticos del modulo"
CRITICAL_FILES=(
    "php-service/src/asistencia-node-integration/bootstrap.php"
    "php-service/src/asistencia-node-integration/index.php"
    "php-service/src/asistencia-node-integration/config/Config.php"
    "php-service/src/asistencia-node-integration/lib/crypto/JWT.php"
    "php-service/src/asistencia-node-integration/domain/AuthenticationService.php"
)

ALL_EXIST=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}  - Falta: $file${NC}"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = true ]; then
    print_result 0 "Todos los archivos criticos existen"
else
    print_result 1 "Faltan archivos criticos"
fi

# Test 8: Verificar configuracion Apache
echo "Test 8: Configuracion Apache"
if [ -f "php-service/apache-config/asistencia.conf" ]; then
    if grep -q "asistencia-node-integration" "php-service/apache-config/asistencia.conf"; then
        print_result 0 "Configuracion Apache contiene modulo"
    else
        print_result 1 "Configuracion Apache no incluye modulo"
    fi
else
    print_result 1 "Archivo asistencia.conf no encontrado"
fi

# Test 9: Verificar compose.yaml contiene variables de entorno
echo "Test 9: Variables en compose.yaml"
if [ -f "compose.yaml" ]; then
    if grep -q "JWT_SECRET" "compose.yaml" && grep -q "NODE_MODULE_ENABLED" "compose.yaml"; then
        print_result 0 "compose.yaml contiene variables necesarias"
    else
        print_result 1 "compose.yaml falta variables de entorno"
    fi
else
    print_result 1 "compose.yaml no encontrado"
fi

# Test 10: Verificar .env.example existe
echo "Test 10: Archivo .env.example"
if [ -f ".env.example" ]; then
    if grep -q "JWT_SECRET" ".env.example" && grep -q "JWT_SECRET_INTERNAL" ".env.example"; then
        print_result 0 ".env.example contiene configuracion JWT"
    else
        print_result 1 ".env.example falta variables JWT"
    fi
else
    print_result 1 ".env.example no encontrado"
fi

# Resumen
echo ""
echo "==============================================="
echo "RESUMEN DE TESTING"
echo "==============================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo "==============================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}TODOS LOS TESTS PASARON${NC}"
    exit 0
else
    echo -e "${RED}ALGUNOS TESTS FALLARON${NC}"
    echo ""
    echo "Acciones recomendadas:"
    echo "1. Verificar que servicios esten levantados:"
    echo "   podman-compose -f compose.yaml -f compose.dev.yaml up -d"
    echo "2. Verificar variables de entorno en .env"
    echo "3. Revisar logs: podman logs asistencia-php"
    echo "4. Revisar logs: podman logs asistencia-node"
    exit 1
fi
