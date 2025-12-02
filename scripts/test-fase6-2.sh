#!/bin/bash
# Test Fase 6.2: UI Feedback & State Management
# Verifica que la maquina de estados de UI funciona correctamente

set -e

echo "======================================"
echo "  TEST FASE 6.2: UI State Machine    "
echo "======================================"

PASSED=0
FAILED=0
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass() {
  echo -e "\033[32m✓ PASS:\033[0m $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo -e "\033[31m✗ FAIL:\033[0m $1"
  FAILED=$((FAILED + 1))
}

info() {
  echo -e "\033[34mℹ INFO:\033[0m $1"
}

COMPONENT="$PROJECT_DIR/node-service/src/frontend/features/qr-reader/ui/camera-view.component.ts"
SERVICE="$PROJECT_DIR/node-service/src/frontend/features/qr-reader/services/qr-scan.service.ts"
CSS="$PROJECT_DIR/node-service/src/frontend/shared/styles/base.css"

# Test 1: Verificar tipo ScannerState
echo ""
echo "Test 1: Verificar definicion de estados"

if grep -q "export type ScannerState" "$COMPONENT"; then
  pass "ScannerState type exportado"
else
  fail "ScannerState type no encontrado"
fi

for state in IDLE WAITING_AUTH SCANNING PROCESSING SUCCESS PARTIAL_SUCCESS ERROR COOLDOWN; do
  if grep -q "'$state'" "$COMPONENT"; then
    pass "Estado $state definido"
  else
    fail "Estado $state no definido"
  fi
done

# Test 2: Verificar metodo getState
echo ""
echo "Test 2: Verificar getter de estado"

if grep -q "getState(): ScannerState" "$COMPONENT"; then
  pass "getState() implementado"
else
  fail "getState() no encontrado"
fi

# Test 3: Verificar metodo showCooldown
echo ""
echo "Test 3: Verificar cooldown con cuenta regresiva"

if grep -q "showCooldown(seconds: number" "$COMPONENT"; then
  pass "showCooldown() implementado"
else
  fail "showCooldown() no encontrado"
fi

if grep -q "clearCooldownTimer" "$COMPONENT"; then
  pass "clearCooldownTimer() implementado"
else
  fail "clearCooldownTimer() no encontrado"
fi

if grep -q "cooldownTimer" "$COMPONENT"; then
  pass "cooldownTimer property existe"
else
  fail "cooldownTimer property no existe"
fi

# Test 4: Verificar spinner en overlay
echo ""
echo "Test 4: Verificar spinner visual"

if grep -q "showSpinner.*boolean" "$COMPONENT"; then
  pass "setOverlay soporta spinner"
else
  fail "setOverlay no soporta spinner"
fi

if grep -q 'class="spinner"' "$COMPONENT"; then
  pass "Spinner HTML generado"
else
  fail "Spinner HTML no encontrado"
fi

if grep -q "overlay--loading" "$COMPONENT"; then
  pass "Clase overlay--loading usada"
else
  fail "Clase overlay--loading no usada"
fi

# Test 5: Verificar estilos del spinner
echo ""
echo "Test 5: Verificar CSS del spinner"

if grep -q "\.scanner__overlay .spinner" "$CSS"; then
  pass "Estilos de spinner en overlay"
else
  fail "Estilos de spinner no encontrados"
fi

if grep -q "overlay--loading" "$CSS"; then
  pass "Estilos de overlay--loading"
else
  fail "Estilos de overlay--loading no encontrados"
fi

# Test 6: Verificar integracion en qr-scan.service.ts
echo ""
echo "Test 6: Verificar integracion en servicio"

if grep -q "COOLDOWN_SECONDS" "$SERVICE"; then
  pass "COOLDOWN_SECONDS definido"
else
  fail "COOLDOWN_SECONDS no definido"
fi

if grep -q "ERROR_RECOVERY_SECONDS" "$SERVICE"; then
  pass "ERROR_RECOVERY_SECONDS definido"
else
  fail "ERROR_RECOVERY_SECONDS no definido"
fi

if grep -q "component.showCooldown" "$SERVICE"; then
  pass "showCooldown usado en servicio"
else
  fail "showCooldown no usado en servicio"
fi

if grep -q "clearCooldownTimer" "$SERVICE"; then
  pass "clearCooldownTimer usado en stop()"
else
  fail "clearCooldownTimer no usado en stop()"
fi

# Test 7: TypeScript compila
echo ""
echo "Test 7: TypeScript compila sin errores"

if podman compose exec -T node-service npx tsc --noEmit 2>&1 | grep -q "error"; then
  fail "TypeScript tiene errores de compilacion"
  podman compose exec -T node-service npx tsc --noEmit 2>&1 | grep "error" | head -5
else
  pass "TypeScript compila sin errores"
fi

# Resumen
echo ""
echo "======================================"
echo "  RESUMEN FASE 6.2                    "
echo "======================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "\033[32mTodos los tests pasaron\033[0m"
  exit 0
else
  echo -e "\033[31mAlgunos tests fallaron\033[0m"
  exit 1
fi
