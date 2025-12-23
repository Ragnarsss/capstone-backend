# Despliegue Staging - Cloudflare Tunnel (mantochrisal.cl)

**Fecha:** 2025-12-19  
**Propósito:** Primera tentativa de integración en ambiente staging real  
**Estrategia:** Despliegue incremental - validar flujo end-to-end sin migrar endpoint legacy

---

## 🎯 Objetivo

Validar el flujo completo de asistencia (profesor y alumno) en staging usando:

- Sistema legacy Hawaii (sin cambios mayores)
- Endpoint legacy `api_get_asistencia_token.php` (sin migrar)
- Frontend nuevo (iframe + postMessage)
- Backend Node.js
- Cloudflare Tunnel → mantochrisal.cl (workaround para HTTPS)

---

## ✅ Checklist Pre-Despliegue

### 1. Verificar Secretos JWT

**CRÍTICO:** El secret JWT debe ser **idéntico** en PHP y Node.js

```bash
# En el servidor con Cloudflare Tunnel

# 1. Verificar secret en PHP
grep "jwtSecret" /var/www/html/hawaii/api_get_asistencia_token.php

# 2. Verificar secret en Node.js .env
grep "JWT_SECRET" /var/www/html/hawaii/asistencia/.env

# 3. DEBEN SER IGUALES
# Si no coinciden, actualizar .env y reiniciar contenedores
```

**Valor actual** (según `api_get_asistencia_token.php`):

```
GYw+eD2ykl2k2UDu/ttZPZ+tWaIraic27OYcU2iAxEKHnpbRYKnqC9d2agkfbDBrNm8mr
```

### 2. Variables de Entorno Node.js

**Archivo:** `/var/www/html/hawaii/asistencia/.env`

```bash
# JWT (DEBE coincidir con api_get_asistencia_token.php)
JWT_SECRET="GYw+eD2ykl2k2UDu/ttZPZ+tWaIraic27OYcU2iAxEKHnpbRYKnqC9d2agkfbDBrNm8mr"

# Node.js
NODE_ENV=production
NODE_SERVICE_URL="http://node-service:3000"

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=asistencia
DB_USER=asistencia_user
DB_PASSWORD=<tu-password>

# Redis/Valkey
VALKEY_HOST=valkey
VALKEY_PORT=6379
```

### 3. Cloudflare Tunnel Setup

```bash
# Verificar que el tunnel está corriendo
systemctl status cloudflared

# O si es manual
ps aux | grep cloudflared

# Configuración esperada (cloudflared config.yml)
tunnel: <tu-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # Frontend Hawaii
  - hostname: mantochrisal.cl
    service: http://localhost:80

  # Backend Node.js (API y WebSocket)
  - hostname: mantochrisal.cl
    path: /asistencia/*
    service: http://localhost:9500

  # Catch-all
  - service: http_status:404
```

### 4. Apache Reverse Proxy

**Verificar configuración:** `/etc/httpd/conf.d/asistencia.conf` (o similar)

```apache
# Proxy a Node.js (puerto 9500 en desarrollo)
ProxyPass /asistencia http://localhost:9500/asistencia
ProxyPassReverse /asistencia http://localhost:9500/asistencia

# WebSocket
RewriteEngine on
RewriteCond %{HTTP:Upgrade} websocket [NC]
RewriteCond %{HTTP:Connection} upgrade [NC]
RewriteRule ^/asistencia/ws(.*) ws://localhost:9500/asistencia/ws$1 [P,L]

ProxyPass /asistencia/ws ws://localhost:9500/asistencia/ws
ProxyPassReverse /asistencia/ws ws://localhost:9500/asistencia/ws
```

### 5. Contenedores

```bash
cd /var/www/html/hawaii/asistencia

# Verificar que .env existe
ls -la .env

# Levantar servicios
podman-compose -f compose.yaml -f compose.prod.yaml up -d --build

# Verificar estado
podman ps

# Deberías ver:
# - asistencia-php (puerto 9500)
# - asistencia-node (puerto interno 3000)
# - asistencia-postgres
# - asistencia-valkey
```

### 6. URLs de Integración

Actualizar las URLs en el código:

**horario.php** (línea ~952):

```javascript
// Alumno - Lector QR
openAsistenciaModal(
  "https://mantochrisal.cl/asistencia/features/qr-reader/index.html",
  response.token,
  "Tomar Asistencia"
);
```

**main_curso.php** (ubicación a confirmar):

```javascript
// Profesor - Proyección QR
openAsistenciaModal(
  "https://mantochrisal.cl/asistencia/features/qr-projection/index.html",
  response.token,
  "Proyectar QR"
);
```

---

## 🧪 Testing en Staging

### Test 1: Verificar Endpoint JWT

```bash
# Con sesión activa en Hawaii
curl -b "PHPSESSID=<tu-session-id>" \
  https://mantochrisal.cl/api_get_asistencia_token.php

# Respuesta esperada:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 300,
  "userId": 123456,
  "username": "usuario@ucn.cl"
}
```

### Test 2: Verificar Node.js Health

```bash
# Health check
curl https://mantochrisal.cl/asistencia/api/health

# Respuesta esperada:
{
  "status": "ok",
  "timestamp": "2025-12-19T...",
  "uptime": 12345
}
```

### Test 3: Validar Token en Node.js

```bash
# Usar el token del Test 1
TOKEN="<token-del-test-1>"

curl -H "Authorization: Bearer $TOKEN" \
  https://mantochrisal.cl/asistencia/api/enrollment/status

# Si funciona, significa que Node.js validó correctamente el JWT
```

### Test 4: Flujo Completo Alumno

1. Login en Hawaii (https://mantochrisal.cl/hawaii/)
2. Click en "Tomar Asistencia"
3. Verificar:
   - ✅ Modal se abre con iframe
   - ✅ Console del navegador NO muestra errores de CORS
   - ✅ Frontend recibe token vía postMessage
   - ✅ Cámara solicita permiso
   - ✅ Puede escanear QR
   - ✅ Asistencia se registra

**Debug en consola del navegador:**

```javascript
// Verificar que el iframe recibe el token
window.addEventListener("message", (event) => {
  console.log("Mensaje recibido:", event.data);
});
```

### Test 5: Flujo Completo Profesor

1. Login en Hawaii como profesor
2. Abrir curso → "Proyectar QR"
3. Verificar:
   - ✅ Modal se abre con iframe
   - ✅ Frontend recibe token
   - ✅ WebSocket conecta (wss://mantochrisal.cl/asistencia/ws)
   - ✅ QR se proyecta y rota cada 30s
   - ✅ Lista de estudiantes se actualiza en tiempo real

---

## 🐛 Troubleshooting

### Problema: "Token inválido" en Node.js

**Causa:** Secretos JWT no coinciden

**Solución:**

```bash
# 1. Verificar secret en PHP
grep jwtSecret /var/www/html/hawaii/api_get_asistencia_token.php

# 2. Actualizar .env
vi /var/www/html/hawaii/asistencia/.env
# JWT_SECRET="<mismo-valor-que-php>"

# 3. Reiniciar contenedores
cd /var/www/html/hawaii/asistencia
podman-compose restart node-service
```

### Problema: WebSocket no conecta

**Causa:** Cloudflare Tunnel o Apache no reescribe correctamente

**Verificar:**

```bash
# Ver logs de Apache
tail -f /var/log/httpd/error_log

# Ver logs de Node.js
podman logs -f asistencia-node

# Verificar configuración WebSocket en Apache
grep -A 5 "RewriteCond.*websocket" /etc/httpd/conf.d/asistencia.conf
```

### Problema: CORS errors

**Causa:** Headers CORS no configurados

**Solución temporal en Node.js:**

```typescript
// En node-service/src/middleware/cors.middleware.ts
allowedOrigins: [
  "https://mantochrisal.cl",
  "http://localhost",
  // ...
];
```

### Problema: "Cannot read session"

**Causa:** Cookie de sesión PHP no se envía al iframe

**Esto es ESPERADO** - El flujo usa JWT, no cookies en iframe.

**Verificar que:**

1. `api_get_asistencia_token.php` se llama ANTES de abrir iframe
2. Token se envía vía postMessage (no cookies)

---

## 📊 Monitoreo

### Logs a revisar:

```bash
# Apache
tail -f /var/log/httpd/access_log
tail -f /var/log/httpd/error_log

# Node.js
podman logs -f asistencia-node

# PostgreSQL
podman logs -f asistencia-postgres

# Cloudflare Tunnel
journalctl -u cloudflared -f
```

### Métricas importantes:

- ✅ JWT generados vs JWT válidos (success rate)
- ✅ WebSocket connections activas
- ✅ Latencia de validación QR
- ✅ Errores de autenticación

---

## 🚀 Post-Validación

Una vez que TODO funciona en staging:

1. ✅ Documentar problemas encontrados
2. ✅ Actualizar configuraciones según aprendizajes
3. ⏭️ **Fase 2:** Migrar a módulo PHP profesional ([MIGRACION-ENDPOINT-TOKEN.md](./MIGRACION-ENDPOINT-TOKEN.md))
4. ⏭️ Preparar deploy a servidor tradicional (sin Cloudflare Tunnel)

---

## 📝 Notas

- **Cloudflare Tunnel es temporal** - Solo para bypass del bastión sin HTTPS
- **Endpoint legacy se mantiene** - Migración después de validar
- **Focus:** Validar flujo end-to-end, no optimizar arquitectura
- **Next:** Despliegue en servidor tradicional con HTTPS nativo

---

## 🔗 Referencias

- [MIGRACION-ENDPOINT-TOKEN.md](./MIGRACION-ENDPOINT-TOKEN.md) - Para Fase 2
- [COMPONENTES-PHP-REUTILIZABLES.md](./COMPONENTES-PHP-REUTILIZABLES.md)
- [README.md](../README.md) - Arquitectura general
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
