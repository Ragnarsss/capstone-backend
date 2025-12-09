#!/bin/bash
# =============================================================================
# test-fase12-1.sh - Tests para Fase 12.1: Datos Mock
# =============================================================================
# Ejecutar desde la raiz del proyecto:
#   bash scripts/test-fase12-1.sh
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

# Paths
DEV_SIM_PATH="php-service/src/dev-simulator"
MOCK_DATA_PATH="$DEV_SIM_PATH/mock-data"

echo "=============================================="
echo "  Fase 12.1: Datos Mock"
echo "=============================================="
echo ""

# =============================================================================
echo "--- 1. Verificar archivos JSON ---"
# =============================================================================

if [ -f "$MOCK_DATA_PATH/usuarios.json" ]; then
    pass "usuarios.json existe"
else
    fail "usuarios.json no existe"
fi

if [ -f "$MOCK_DATA_PATH/cursos.json" ]; then
    pass "cursos.json existe"
else
    fail "cursos.json no existe"
fi

if [ -f "$MOCK_DATA_PATH/sesiones.json" ]; then
    pass "sesiones.json existe"
else
    fail "sesiones.json no existe"
fi

# =============================================================================
echo ""
echo "--- 2. Verificar estructura de usuarios.json ---"
# =============================================================================

if command -v jq &> /dev/null; then
    # Verificar profesores
    PROF_COUNT=$(jq '.profesores | length' "$MOCK_DATA_PATH/usuarios.json" 2>/dev/null)
    if [ "$PROF_COUNT" -ge 2 ]; then
        pass "usuarios.json tiene $PROF_COUNT profesores"
    else
        fail "usuarios.json tiene menos de 2 profesores"
    fi
    
    # Verificar alumnos
    ALUM_COUNT=$(jq '.alumnos | length' "$MOCK_DATA_PATH/usuarios.json" 2>/dev/null)
    if [ "$ALUM_COUNT" -ge 3 ]; then
        pass "usuarios.json tiene $ALUM_COUNT alumnos"
    else
        fail "usuarios.json tiene menos de 3 alumnos"
    fi
    
    # Verificar campos de profesor
    if jq -e '.profesores[0] | has("id", "email", "nombre", "rut")' "$MOCK_DATA_PATH/usuarios.json" > /dev/null 2>&1; then
        pass "Profesor tiene campos requeridos (id, email, nombre, rut)"
    else
        fail "Profesor no tiene campos requeridos"
    fi
    
    # Verificar campos de alumno
    if jq -e '.alumnos[0] | has("id", "rut", "nombre", "email")' "$MOCK_DATA_PATH/usuarios.json" > /dev/null 2>&1; then
        pass "Alumno tiene campos requeridos (id, rut, nombre, email)"
    else
        fail "Alumno no tiene campos requeridos"
    fi
else
    info "jq no instalado, saltando validacion de estructura JSON"
fi

# =============================================================================
echo ""
echo "--- 3. Verificar estructura de cursos.json ---"
# =============================================================================

if command -v jq &> /dev/null; then
    CURSO_COUNT=$(jq '.cursos | length' "$MOCK_DATA_PATH/cursos.json" 2>/dev/null)
    if [ "$CURSO_COUNT" -ge 2 ]; then
        pass "cursos.json tiene $CURSO_COUNT cursos"
    else
        fail "cursos.json tiene menos de 2 cursos"
    fi
    
    BLOQUE_COUNT=$(jq '.bloques | length' "$MOCK_DATA_PATH/cursos.json" 2>/dev/null)
    if [ "$BLOQUE_COUNT" -ge 3 ]; then
        pass "cursos.json tiene $BLOQUE_COUNT bloques"
    else
        fail "cursos.json tiene menos de 3 bloques"
    fi
    
    INSCR_COUNT=$(jq '.inscripciones | length' "$MOCK_DATA_PATH/cursos.json" 2>/dev/null)
    if [ "$INSCR_COUNT" -ge 5 ]; then
        pass "cursos.json tiene $INSCR_COUNT inscripciones"
    else
        fail "cursos.json tiene menos de 5 inscripciones"
    fi
fi

# =============================================================================
echo ""
echo "--- 4. Verificar estructura de sesiones.json ---"
# =============================================================================

if command -v jq &> /dev/null; then
    SESION_COUNT=$(jq '.sesiones | length' "$MOCK_DATA_PATH/sesiones.json" 2>/dev/null)
    if [ "$SESION_COUNT" -ge 2 ]; then
        pass "sesiones.json tiene $SESION_COUNT sesiones"
    else
        fail "sesiones.json tiene menos de 2 sesiones"
    fi
    
    TIPO_COUNT=$(jq '.tipos_encuesta | length' "$MOCK_DATA_PATH/sesiones.json" 2>/dev/null)
    if [ "$TIPO_COUNT" -ge 5 ]; then
        pass "sesiones.json tiene $TIPO_COUNT tipos de encuesta"
    else
        fail "sesiones.json tiene menos de 5 tipos de encuesta"
    fi
    
    # Verificar que sesion tiene codigo tipo CVYAFO
    CODIGO=$(jq -r '.sesiones[0].codigo' "$MOCK_DATA_PATH/sesiones.json" 2>/dev/null)
    if [[ "$CODIGO" =~ ^[A-Z]{6}$ ]]; then
        pass "Sesion tiene codigo valido: $CODIGO"
    else
        fail "Sesion no tiene codigo valido de 6 letras"
    fi
fi

# =============================================================================
echo ""
echo "--- 5. Verificar MockDataProvider.php ---"
# =============================================================================

if [ -f "$DEV_SIM_PATH/MockDataProvider.php" ]; then
    pass "MockDataProvider.php existe"
else
    fail "MockDataProvider.php no existe"
fi

if grep -q "class MockDataProvider" "$DEV_SIM_PATH/MockDataProvider.php" 2>/dev/null; then
    pass "Clase MockDataProvider definida"
else
    fail "Clase MockDataProvider no encontrada"
fi

if grep -q "getProfesorByEmail" "$DEV_SIM_PATH/MockDataProvider.php" 2>/dev/null; then
    pass "Metodo getProfesorByEmail definido"
else
    fail "Metodo getProfesorByEmail no encontrado"
fi

if grep -q "getAlumnoByRut" "$DEV_SIM_PATH/MockDataProvider.php" 2>/dev/null; then
    pass "Metodo getAlumnoByRut definido"
else
    fail "Metodo getAlumnoByRut no encontrado"
fi

if grep -q "getSesionByCodigo" "$DEV_SIM_PATH/MockDataProvider.php" 2>/dev/null; then
    pass "Metodo getSesionByCodigo definido"
else
    fail "Metodo getSesionByCodigo no encontrado"
fi

if grep -q "getInstance" "$DEV_SIM_PATH/MockDataProvider.php" 2>/dev/null; then
    pass "Patron Singleton implementado"
else
    fail "Patron Singleton no encontrado"
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
