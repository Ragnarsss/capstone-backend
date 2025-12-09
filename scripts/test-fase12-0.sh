#!/bin/bash
# =============================================================================
# test-fase12-0.sh - Tests para Fase 12.0: Estructura Base del Simulador
# =============================================================================
# Ejecutar desde la raiz del proyecto:
#   bash scripts/test-fase12-0.sh
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Contadores
PASSED=0
FAILED=0

# Funciones
pass() {
    echo -e "${GREEN}[OK]${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED=$((FAILED + 1))
}

info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Base URL
BASE_URL="${BASE_URL:-http://localhost:9500}"

echo "=============================================="
echo "  Fase 12.0: Estructura Base del Simulador"
echo "=============================================="
echo ""

# =============================================================================
echo "--- 1. Verificar estructura de archivos ---"
# =============================================================================

DEV_SIM_PATH="php-service/src/dev-simulator"

if [ -d "$DEV_SIM_PATH" ]; then
    pass "Directorio dev-simulator existe"
else
    fail "Directorio dev-simulator no existe"
fi

if [ -f "$DEV_SIM_PATH/index.php" ]; then
    pass "index.php existe"
else
    fail "index.php no existe"
fi

if [ -f "$DEV_SIM_PATH/functions.php" ]; then
    pass "functions.php existe"
else
    fail "functions.php no existe"
fi

if [ -f "$DEV_SIM_PATH/.htaccess" ]; then
    pass ".htaccess existe"
else
    fail ".htaccess no existe"
fi

if [ -d "$DEV_SIM_PATH/mock-data" ]; then
    pass "Directorio mock-data existe"
else
    fail "Directorio mock-data no existe"
fi

# =============================================================================
echo ""
echo "--- 2. Verificar contenido de functions.php ---"
# =============================================================================

if grep -q "dev_is_logged_in" "$DEV_SIM_PATH/functions.php" 2>/dev/null; then
    pass "Funcion dev_is_logged_in definida"
else
    fail "Funcion dev_is_logged_in no encontrada"
fi

if grep -q "dev_get_usuario_actual" "$DEV_SIM_PATH/functions.php" 2>/dev/null; then
    pass "Funcion dev_get_usuario_actual definida"
else
    fail "Funcion dev_get_usuario_actual no encontrada"
fi

if grep -q "dev_gen_cod_reserva" "$DEV_SIM_PATH/functions.php" 2>/dev/null; then
    pass "Funcion dev_gen_cod_reserva definida"
else
    fail "Funcion dev_gen_cod_reserva no encontrada"
fi

if grep -q "K_ROOT" "$DEV_SIM_PATH/functions.php" 2>/dev/null; then
    pass "Constantes de sesion definidas"
else
    fail "Constantes de sesion no encontradas"
fi

# =============================================================================
echo ""
echo "--- 3. Verificar configuracion Apache ---"
# =============================================================================

APACHE_CONF="php-service/apache-config/asistencia.conf"

if grep -q "/dev-simulator" "$APACHE_CONF" 2>/dev/null; then
    pass "Alias /dev-simulator configurado en Apache"
else
    fail "Alias /dev-simulator no encontrado en Apache config"
fi

# =============================================================================
echo ""
echo "--- 4. Verificar acceso HTTP (requiere contenedor) ---"
# =============================================================================

# Verificar si el contenedor esta corriendo
if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${BASE_URL}/" 2>/dev/null | grep -q "200\|302"; then
    info "Contenedor PHP disponible, probando endpoints..."
    
    # Probar acceso al simulador
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${BASE_URL}/dev-simulator/" 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        pass "GET /dev-simulator/ responde 200"
    else
        fail "GET /dev-simulator/ responde $HTTP_CODE (esperado 200)"
    fi
    
    # Verificar que el contenido tiene el titulo esperado
    CONTENT=$(curl -s --max-time 5 "${BASE_URL}/dev-simulator/" 2>/dev/null)
    if echo "$CONTENT" | grep -q "Dev Simulator"; then
        pass "Contenido incluye 'Dev Simulator'"
    else
        fail "Contenido no incluye 'Dev Simulator'"
    fi
else
    info "Contenedor PHP no disponible - saltando tests HTTP"
    info "Ejecutar: podman compose -f compose.yaml -f compose.dev.yaml up -d"
fi

# =============================================================================
echo ""
echo "=============================================="
echo "  Resultados: $PASSED passed, $FAILED failed"
echo "=============================================="

if [ $FAILED -gt 0 ]; then
    exit 1
fi
exit 0
