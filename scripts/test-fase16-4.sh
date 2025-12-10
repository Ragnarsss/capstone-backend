#!/usr/bin/env bash
# Test Fase 16.4: Migracion DB Status
#
# Verifica que la migracion 003 esta creada y que el codigo
# maneja el campo status correctamente

set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() {
    echo -e "   ${GREEN}OK${NC} - $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "   ${RED}FAIL${NC} - $1"
    FAILED=$((FAILED + 1))
}

echo "============================================================"
echo "Test Fase 16.4: Migracion DB Status"
echo "============================================================"

MIGRATION="database/migrations/003-add-enrollment-status.sql"
ENTITY="node-service/src/backend/enrollment/domain/entities/device.entity.ts"
REPO="node-service/src/backend/enrollment/infrastructure/repositories/device.repository.ts"

# 1. Verificar que la migracion existe
echo ""
echo "1. Verificando archivo de migracion..."
if [ -f "${MIGRATION}" ]; then
    pass "Migracion 003 existe"
else
    fail "Migracion 003 no encontrada"
fi

# 2. Verificar contenido de la migracion
echo ""
echo "2. Verificando contenido de la migracion..."
if grep -q "ADD COLUMN.*status" "${MIGRATION}" && \
   grep -q "CHECK.*pending.*enrolled.*revoked" "${MIGRATION}"; then
    pass "Migracion agrega columna status con CHECK constraint"
else
    fail "Migracion no tiene la estructura correcta"
fi

# 3. Verificar que Device entity tiene campo status
echo ""
echo "3. Verificando campo status en Device entity..."
if grep -q "readonly status: EnrollmentState" "${ENTITY}"; then
    pass "Device entity tiene campo status"
else
    fail "Device entity no tiene campo status"
fi

# 4. Verificar que CreateDeviceDto tiene status opcional
echo ""
echo "4. Verificando status en CreateDeviceDto..."
if grep -q "status?.*EnrollmentState" "${ENTITY}"; then
    pass "CreateDeviceDto tiene status opcional"
else
    fail "CreateDeviceDto no tiene status"
fi

# 5. Verificar que DeviceRepository importa EnrollmentState
echo ""
echo "5. Verificando imports en DeviceRepository..."
if grep -q "import.*EnrollmentState" "${REPO}" && \
   grep -q "import.*ENROLLMENT_STATES" "${REPO}"; then
    pass "DeviceRepository importa tipos de estado"
else
    fail "DeviceRepository no importa tipos de estado"
fi

# 6. Verificar que DeviceRepository incluye status en INSERT
echo ""
echo "6. Verificando INSERT con status en DeviceRepository..."
if grep -q "status" "${REPO}" && grep -q "ENROLLMENT_STATES.ENROLLED" "${REPO}"; then
    pass "DeviceRepository maneja status en INSERT"
else
    fail "DeviceRepository no maneja status en INSERT"
fi

# 7. Verificar que mapRowToDevice incluye status
echo ""
echo "7. Verificando mapRowToDevice con status..."
if grep -q "status:.*row.status" "${REPO}"; then
    pass "mapRowToDevice incluye status"
else
    fail "mapRowToDevice no incluye status"
fi

# 8. Verificar compilacion TypeScript
echo ""
echo "8. Verificando compilacion TypeScript..."
if podman exec asistencia-node npx tsc --noEmit 2>&1; then
    pass "TypeScript compila sin errores"
else
    fail "TypeScript tiene errores de compilacion"
fi

# Resumen
echo ""
echo "=========================================="
echo "Resumen"
echo "=========================================="
echo "Pasaron: ${PASSED}"
echo "Fallaron: ${FAILED}"
echo ""

if [ "${FAILED}" -eq 0 ]; then
    echo -e "${GREEN}Fase 16.4 completada exitosamente${NC}"
    echo ""
    echo "NOTA: Para aplicar la migracion en la base de datos, ejecuta:"
    echo "  podman exec asistencia-postgres psql -U asistencia -d asistencia_db -f /docker-entrypoint-initdb.d/migrations/003-add-enrollment-status.sql"
    exit 0
else
    echo -e "${RED}Fase 16.4 tiene errores${NC}"
    exit 1
fi
