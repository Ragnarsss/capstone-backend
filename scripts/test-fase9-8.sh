#!/bin/bash
# Test Fase 9.8: Frontend Guest Module - State Machine
# Verifica la estructura y compilación del módulo guest

set -e

PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "  TEST FASE 9.8: Guest State Machine  "
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
# Test 1: Estructura de módulos
# =============================================================================
echo "Test 1: Estructura de módulos guest"

GUEST_BASE="node-service/src/frontend/features/guest"

# Communication module
if [ -f "${GUEST_BASE}/modules/communication/parent-messenger.ts" ]; then
  pass "ParentMessenger service existe"
else
  fail "ParentMessenger service no existe"
fi

if [ -f "${GUEST_BASE}/modules/communication/index.ts" ]; then
  pass "communication/index.ts existe"
else
  fail "communication/index.ts no existe"
fi

# Enrollment module
if [ -f "${GUEST_BASE}/modules/enrollment/login.service.ts" ]; then
  pass "LoginService existe"
else
  fail "LoginService no existe"
fi

if [ -f "${GUEST_BASE}/modules/enrollment/session-key.store.ts" ]; then
  pass "SessionKeyStore existe"
else
  fail "SessionKeyStore no existe"
fi

if [ -f "${GUEST_BASE}/modules/enrollment/index.ts" ]; then
  pass "enrollment/index.ts existe"
else
  fail "enrollment/index.ts no existe"
fi

# Scanner module
if [ -f "${GUEST_BASE}/modules/scanner/scanner.service.ts" ]; then
  pass "ScannerService existe"
else
  fail "ScannerService no existe"
fi

if [ -f "${GUEST_BASE}/modules/scanner/camera.service.ts" ]; then
  pass "CameraService existe"
else
  fail "CameraService no existe"
fi

if [ -f "${GUEST_BASE}/modules/scanner/index.ts" ]; then
  pass "scanner/index.ts existe"
else
  fail "scanner/index.ts no existe"
fi

# Attendance module
if [ -f "${GUEST_BASE}/modules/attendance/attendance.service.ts" ]; then
  pass "AttendanceService existe"
else
  fail "AttendanceService no existe"
fi

if [ -f "${GUEST_BASE}/modules/attendance/index.ts" ]; then
  pass "attendance/index.ts existe"
else
  fail "attendance/index.ts no existe"
fi

# =============================================================================
# Test 2: Main entry point
# =============================================================================
echo ""
echo "Test 2: Main entry point y HTML"

if [ -f "${GUEST_BASE}/main.ts" ]; then
  pass "main.ts existe"
  
  # Verificar que tiene todos los estados
  if grep -q "CHECKING_ENROLLMENT" "${GUEST_BASE}/main.ts"; then
    pass "main.ts tiene estado CHECKING_ENROLLMENT"
  else
    fail "main.ts falta estado CHECKING_ENROLLMENT"
  fi
  
  if grep -q "ENROLLMENT_SUCCESS" "${GUEST_BASE}/main.ts"; then
    pass "main.ts tiene estado ENROLLMENT_SUCCESS"
  else
    fail "main.ts falta estado ENROLLMENT_SUCCESS"
  fi
  
  if grep -q "PENALTY_WAIT" "${GUEST_BASE}/main.ts"; then
    pass "main.ts tiene estado PENALTY_WAIT"
  else
    fail "main.ts falta estado PENALTY_WAIT"
  fi
  
  if grep -q "LOGGING_IN" "${GUEST_BASE}/main.ts"; then
    pass "main.ts tiene estado LOGGING_IN"
  else
    fail "main.ts falta estado LOGGING_IN"
  fi
  
  if grep -q "READY_TO_SCAN" "${GUEST_BASE}/main.ts"; then
    pass "main.ts tiene estado READY_TO_SCAN"
  else
    fail "main.ts falta estado READY_TO_SCAN"
  fi
  
  if grep -q "VALIDATING" "${GUEST_BASE}/main.ts"; then
    pass "main.ts tiene estado VALIDATING"
  else
    fail "main.ts falta estado VALIDATING"
  fi
else
  fail "main.ts no existe"
fi

if [ -f "${GUEST_BASE}/index.html" ]; then
  pass "index.html existe"
  
  # Verificar secciones de estado en HTML
  if grep -q 'id="state-enrollment-success"' "${GUEST_BASE}/index.html"; then
    pass "HTML tiene state-enrollment-success"
  else
    fail "HTML falta state-enrollment-success"
  fi
  
  if grep -q 'id="state-penalty-wait"' "${GUEST_BASE}/index.html"; then
    pass "HTML tiene state-penalty-wait"
  else
    fail "HTML falta state-penalty-wait"
  fi
  
  if grep -q 'id="state-logging-in"' "${GUEST_BASE}/index.html"; then
    pass "HTML tiene state-logging-in"
  else
    fail "HTML falta state-logging-in"
  fi
  
  if grep -q 'id="state-ready-to-scan"' "${GUEST_BASE}/index.html"; then
    pass "HTML tiene state-ready-to-scan"
  else
    fail "HTML falta state-ready-to-scan"
  fi
  
  if grep -q 'id="state-validating"' "${GUEST_BASE}/index.html"; then
    pass "HTML tiene state-validating"
  else
    fail "HTML falta state-validating"
  fi
  
  if grep -q 'id="btn-close-return"' "${GUEST_BASE}/index.html"; then
    pass "HTML tiene botón btn-close-return"
  else
    fail "HTML falta botón btn-close-return"
  fi
else
  fail "index.html no existe"
fi

# =============================================================================
# Test 3: Type declarations
# =============================================================================
echo ""
echo "Test 3: Declaraciones de tipos"

if [ -f "node-service/src/frontend/types/zxing.d.ts" ]; then
  pass "zxing.d.ts existe"
  
  if grep -q "BrowserMultiFormatReader" "node-service/src/frontend/types/zxing.d.ts"; then
    pass "zxing.d.ts tiene BrowserMultiFormatReader"
  else
    fail "zxing.d.ts falta BrowserMultiFormatReader"
  fi
else
  fail "zxing.d.ts no existe"
fi

# =============================================================================
# Test 4: CSS Styles
# =============================================================================
echo ""
echo "Test 4: Estilos CSS"

if [ -f "${GUEST_BASE}/styles/guest.css" ]; then
  pass "guest.css existe"
  
  if grep -q ".success-container" "${GUEST_BASE}/styles/guest.css"; then
    pass "guest.css tiene .success-container"
  else
    fail "guest.css falta .success-container"
  fi
  
  if grep -q ".penalty-container" "${GUEST_BASE}/styles/guest.css"; then
    pass "guest.css tiene .penalty-container"
  else
    fail "guest.css falta .penalty-container"
  fi
  
  if grep -q ".penalty-info" "${GUEST_BASE}/styles/guest.css"; then
    pass "guest.css tiene .penalty-info"
  else
    fail "guest.css falta .penalty-info"
  fi
  
  if grep -q ".validating-container" "${GUEST_BASE}/styles/guest.css"; then
    pass "guest.css tiene .validating-container"
  else
    fail "guest.css falta .validating-container"
  fi
else
  fail "guest.css no existe"
fi

# =============================================================================
# Test 5: Verificar imports en main.ts
# =============================================================================
echo ""
echo "Test 5: Imports en main.ts"

if grep -q "import.*ParentMessenger.*from" "${GUEST_BASE}/main.ts"; then
  pass "main.ts importa ParentMessenger"
else
  fail "main.ts no importa ParentMessenger"
fi

if grep -q "import.*LoginService.*from" "${GUEST_BASE}/main.ts"; then
  pass "main.ts importa LoginService"
else
  fail "main.ts no importa LoginService"
fi

if grep -q "import.*ScannerService.*from" "${GUEST_BASE}/main.ts"; then
  pass "main.ts importa ScannerService"
else
  fail "main.ts no importa ScannerService"
fi

if grep -q "import.*AttendanceService.*from" "${GUEST_BASE}/main.ts"; then
  pass "main.ts importa AttendanceService"
else
  fail "main.ts no importa AttendanceService"
fi

if grep -q "import.*getSessionKeyStore.*from" "${GUEST_BASE}/main.ts"; then
  pass "main.ts importa getSessionKeyStore"
else
  fail "main.ts no importa getSessionKeyStore"
fi

# =============================================================================
# Test 6: Verificar State Machine transitions
# =============================================================================
echo ""
echo "Test 6: State Machine transitions"

if grep -q "transitionTo('CHECKING_ENROLLMENT')" "${GUEST_BASE}/main.ts"; then
  pass "Transición a CHECKING_ENROLLMENT"
else
  fail "Falta transición a CHECKING_ENROLLMENT"
fi

if grep -q "transitionTo('ENROLLMENT_SUCCESS')" "${GUEST_BASE}/main.ts"; then
  pass "Transición a ENROLLMENT_SUCCESS"
else
  fail "Falta transición a ENROLLMENT_SUCCESS"
fi

if grep -q "transitionTo('LOGGING_IN')" "${GUEST_BASE}/main.ts"; then
  pass "Transición a LOGGING_IN"
else
  fail "Falta transición a LOGGING_IN"
fi

if grep -q "transitionTo('READY_TO_SCAN')" "${GUEST_BASE}/main.ts"; then
  pass "Transición a READY_TO_SCAN"
else
  fail "Falta transición a READY_TO_SCAN"
fi

if grep -q "transitionTo('VALIDATING')" "${GUEST_BASE}/main.ts"; then
  pass "Transición a VALIDATING"
else
  fail "Falta transición a VALIDATING"
fi

# =============================================================================
# Test 7: PostMessage communication
# =============================================================================
echo ""
echo "Test 7: PostMessage communication"

if grep -q "notifyEnrollmentComplete" "${GUEST_BASE}/modules/communication/parent-messenger.ts"; then
  pass "ParentMessenger tiene notifyEnrollmentComplete"
else
  fail "ParentMessenger falta notifyEnrollmentComplete"
fi

if grep -q "notifyAttendanceComplete" "${GUEST_BASE}/modules/communication/parent-messenger.ts"; then
  pass "ParentMessenger tiene notifyAttendanceComplete"
else
  fail "ParentMessenger falta notifyAttendanceComplete"
fi

if grep -q "requestClose" "${GUEST_BASE}/modules/communication/parent-messenger.ts"; then
  pass "ParentMessenger tiene requestClose"
else
  fail "ParentMessenger falta requestClose"
fi

if grep -q "window.parent.postMessage" "${GUEST_BASE}/modules/communication/parent-messenger.ts"; then
  pass "ParentMessenger usa window.parent.postMessage"
else
  fail "ParentMessenger no usa window.parent.postMessage"
fi

# =============================================================================
# Test 8: SessionKeyStore
# =============================================================================
echo ""
echo "Test 8: SessionKeyStore"

if grep -q "sessionStorage" "${GUEST_BASE}/modules/enrollment/session-key.store.ts"; then
  pass "SessionKeyStore usa sessionStorage"
else
  fail "SessionKeyStore no usa sessionStorage"
fi

if grep -q "storeSessionKey" "${GUEST_BASE}/modules/enrollment/session-key.store.ts"; then
  pass "SessionKeyStore tiene storeSessionKey"
else
  fail "SessionKeyStore falta storeSessionKey"
fi

if grep -q "getSessionKey" "${GUEST_BASE}/modules/enrollment/session-key.store.ts"; then
  pass "SessionKeyStore tiene getSessionKey"
else
  fail "SessionKeyStore falta getSessionKey"
fi

if grep -q "hasSessionKey" "${GUEST_BASE}/modules/enrollment/session-key.store.ts"; then
  pass "SessionKeyStore tiene hasSessionKey"
else
  fail "SessionKeyStore falta hasSessionKey"
fi

# =============================================================================
# Test 9: Verificar dependencias en package.json
# =============================================================================
echo ""
echo "Test 9: Dependencias"

if grep -q "@simplewebauthn/browser" "node-service/package.json"; then
  pass "Dependencia @simplewebauthn/browser"
else
  fail "Falta dependencia @simplewebauthn/browser"
fi

if grep -q "@zxing/browser" "node-service/package.json"; then
  pass "Dependencia @zxing/browser"
else
  fail "Falta dependencia @zxing/browser"
fi

if grep -q "@zxing/library" "node-service/package.json"; then
  pass "Dependencia @zxing/library"
else
  fail "Falta dependencia @zxing/library"
fi

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo "======================================"
echo "  RESUMEN FASE 9.8                    "
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
