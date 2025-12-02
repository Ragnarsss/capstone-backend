#!/bin/bash
# Script de prueba baseline para verificar servicios
# Uso: ./scripts/test-baseline.sh

set -e

echo "=== FASE 0: Verificacion Baseline ==="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}[OK]${NC} $1"
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    exit 1
}

# 1. Verificar PHP via HTTP
echo "Verificando PHP (HTTP:9500)..."
if curl -s http://localhost:9500/ | grep -q "Sistema de Gestion"; then
    pass "PHP responde en puerto 9500"
else
    fail "PHP no responde en puerto 9500"
fi

# 2. Verificar PHP via HTTPS
echo "Verificando PHP (HTTPS:9505)..."
if curl -sk https://localhost:9505/ | grep -q "Sistema de Gestion"; then
    pass "PHP responde en puerto 9505"
else
    fail "PHP no responde en puerto 9505"
fi

# 3. Verificar Node via proxy HTTP
echo "Verificando Node via proxy (HTTP:9500)..."
if curl -s http://localhost:9500/asistencia/features/qr-host/index.html | grep -q "Asistencia"; then
    pass "Node accesible via proxy HTTP"
else
    fail "Node no accesible via proxy HTTP"
fi

# 4. Verificar Node via proxy HTTPS
echo "Verificando Node via proxy (HTTPS:9505)..."
if curl -sk https://localhost:9505/asistencia/features/qr-host/index.html | grep -q "Asistencia"; then
    pass "Node accesible via proxy HTTPS"
else
    fail "Node no accesible via proxy HTTPS"
fi

# 5. Verificar JWT endpoint HTTP
echo "Verificando JWT endpoint (HTTP)..."
JWT_RESPONSE=$(curl -s -X POST http://localhost:9500/asistencia-node-integration/api/token \
    -H "Content-Type: application/json" \
    -d '{"userId": 1}')
if echo "$JWT_RESPONSE" | grep -q '"success":true'; then
    pass "JWT endpoint funciona (HTTP)"
else
    fail "JWT endpoint falla (HTTP)"
fi

# 6. Verificar JWT endpoint HTTPS
echo "Verificando JWT endpoint (HTTPS)..."
JWT_RESPONSE=$(curl -sk -X POST https://localhost:9505/asistencia-node-integration/api/token \
    -H "Content-Type: application/json" \
    -d '{"userId": 1}')
if echo "$JWT_RESPONSE" | grep -q '"success":true'; then
    pass "JWT endpoint funciona (HTTPS)"
else
    fail "JWT endpoint falla (HTTPS)"
fi

# 7. Verificar Node health directamente (solo dev)
echo "Verificando Node health (directo:9503)..."
if curl -s http://localhost:9503/health | grep -q '"status":"ok"'; then
    pass "Node health OK (puerto 9503)"
else
    fail "Node health falla (puerto 9503)"
fi

echo ""
echo "=== Baseline verificado correctamente ==="
echo ""
echo "Prueba manual pendiente:"
echo "  - Abrir http://localhost:9500 en browser"
echo "  - Click en boton proyectar QR"
echo "  - Verificar que QR se muestra y rota"
