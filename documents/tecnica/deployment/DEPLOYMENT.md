# Deployment - Sistema de Asistencia

**Última actualización:** 2026-01-03

## Resumen

El sistema soporta dos configuraciones:

1. **Staging** - Cloudflare Tunnel para desarrollo/testing con HTTPS
2. **Producción** - Apache directo con certificado SSL propio

Ambas comparten: PHP + Node.js + PostgreSQL + Valkey en contenedores Podman.

---

## Configuración Base

### Variables de Entorno

Archivo: `/var/www/html/hawaii/asistencia/.env`

```bash
# JWT - DEBE coincidir con JWT Bridge Service (puerto 9001)
JWT_SECRET="GYw+eD2ykl2k2UDu/ttZPZ+tWaIraic27OYcU2iAxEKHnpbRYKnqC9d2agkfbDBrNm8mr"

# Server Cryptographic Master Secret
SERVER_MASTER_SECRET="<generar-con-openssl-rand>"

# Node.js
NODE_ENV=production
NODE_SERVICE_URL="http://node-service:3000"

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=asistencia
DB_USER=asistencia_user
DB_PASSWORD=<password>

# Valkey
VALKEY_HOST=valkey
VALKEY_PORT=6379
```

Generar SERVER_MASTER_SECRET:

```bash
echo -e "\nSERVER_MASTER_SECRET=$(openssl rand -base64 64 | tr -d '\n')" >> .env
```

### Verificar Sincronización JWT

CRÍTICO: El JWT_SECRET debe ser idéntico en JWT Bridge Service y Node.js

```bash
# Verificar JWT Bridge Service (php-service/src/config/config.php)
grep "JWT_SECRET" /var/www/html/hawaii/asistencia/php-service/.env

# Verificar Node.js
grep "JWT_SECRET" /var/www/html/hawaii/asistencia/.env

# Si no coinciden, actualizar .env y reiniciar
```

### Apache Reverse Proxy

Archivo: `/etc/httpd/conf.d/asistencia.conf`

```apache
# Proxy a Node.js
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

### Levantar Contenedores

```bash
cd /var/www/html/hawaii/asistencia

# Build y deploy
podman-compose -f compose.yaml -f compose.prod.yaml up -d --build

# Verificar estado
podman ps

# Esperado:
# - asistencia-php (puerto 9500)
# - asistencia-node (puerto 3000 interno)
# - asistencia-postgres (healthy)
# - asistencia-valkey (healthy)
```

---

## Staging: Cloudflare Tunnel

### Configuración Tunnel

Archivo: `cloudflared config.yml`

```yaml
tunnel: <tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: mantochrisal.cl
    service: http://localhost:80

  - hostname: mantochrisal.cl
    path: /asistencia/*
    service: http://localhost:9500

  - service: http_status:404
```

Verificar tunnel:

```bash
systemctl status cloudflared
# o
ps aux | grep cloudflared
```

### URLs Frontend (Staging)

horario.php (línea ~952):

```javascript
openAsistenciaModal(
  "https://mantochrisal.cl/asistencia/features/qr-reader/index.html",
  response.token,
  "Tomar Asistencia"
);
```

main_curso.php:

```javascript
openAsistenciaModal(
  "https://mantochrisal.cl/asistencia/features/qr-projection/index.html",
  response.token,
  "Proyectar QR"
);
```

---

## Producción: Internet Directo

### Diferencias con Staging

| Aspecto | Staging               | Producción         |
| ------- | --------------------- | ------------------ |
| Acceso  | Cloudflare Tunnel     | Apache directo     |
| SSL     | Cloudflare automático | Certificado propio |
| Dominio | mantochrisal.cl       | Dominio UCN        |

### Certificado SSL

```bash
# Let's Encrypt
certbot --apache -d dominio-produccion.cl
```

### VirtualHost Apache

```apache
<VirtualHost *:443>
    ServerName dominio-produccion.cl

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/privkey.pem

    ProxyPass /asistencia http://localhost:9500/asistencia
    ProxyPassReverse /asistencia http://localhost:9500/asistencia

    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/asistencia/ws(.*) ws://localhost:9500/asistencia/ws$1 [P,L]
</VirtualHost>
```

### Firewall

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

### URLs Frontend (Producción)

Actualizar en horario.php y main_curso.php:

- Reemplazar `mantochrisal.cl` por dominio de producción

---

## Testing

### Endpoint JWT Bridge

```bash
# Staging (Cloudflare Tunnel)
curl -b "PHPSESSID=<session>" \
  https://mantochrisal.cl:9001/

# Desarrollo (directo)
curl -b "PHPSESSID=<session>" \
  http://localhost:9001/

# Esperado:
{
  "success": true,
  "token": "eyJhbGci...",
  "expiresIn": 300,
  "userId": 123456,
  "username": "usuario@ucn.cl"
}
```

### Health Check Node.js

```bash
curl https://mantochrisal.cl/asistencia/api/health

# Esperado:
{
  "status": "ok",
  "timestamp": "2026-01-03T...",
  "uptime": 12345
}
```

### Validación JWT

```bash
TOKEN="<token-del-test-anterior>"

curl -H "Authorization: Bearer $TOKEN" \
  https://mantochrisal.cl/asistencia/api/enrollment/status
```

### Flujo End-to-End

Alumno:

1. Login en Hawaii
2. Click "Tomar Asistencia"
3. Modal abre iframe
4. Frontend recibe token vía postMessage
5. Cámara solicita permiso
6. Escanea QR
7. Asistencia registrada

Profesor:

1. Login como profesor
2. Abrir curso, "Proyectar QR"
3. Modal abre iframe
4. WebSocket conecta
5. QR se proyecta y rota cada 30s
6. Lista de estudiantes se actualiza en tiempo real

---

## Troubleshooting

### Build falla: SERVER_MASTER_SECRET undefined

Causa: Variable faltante en .env

Solución:

```bash
echo -e "\nSERVER_MASTER_SECRET=$(openssl rand -base64 64 | tr -d '\n')" >> .env
podman-compose restart node-service
```

### Build falla: TypeScript errors

Síntomas:

```
Error: Module '"../../../../shared/ports"' has no exported member 'IQRGenerator'
Error: Module '"../../../../enrollment/domain/models"' has no exported member 'Device'
```

Causa: Barrel files faltantes o exports incompletos

Solución:

1. Verificar `node-service/src/shared/index.ts`:

```typescript
export * from "./ports";
export * from "./types";
export * from "./config";
```

2. Verificar `enrollment/domain/models.ts`:

```typescript
export type {
  Device,
  CreateDeviceDto,
  UpdateCounterDto,
} from "./entities/device.entity";
```

3. Excluir tests en `tsconfig.json`:

```json
{
  "exclude": [
    "node_modules",
    "dist",
    "**/__tests__/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

### Token inválido en Node.js

Causa: JWT_SECRET no coincide entre JWT Bridge y Node.js

Solución:

```bash
# Verificar JWT Bridge
grep JWT_SECRET /var/www/html/hawaii/asistencia/php-service/.env

# Verificar Node.js
grep JWT_SECRET /var/www/html/hawaii/asistencia/.env

# Actualizar para que coincidan
podman-compose restart php-service node-service
```

### WebSocket no conecta

Causa: Configuración Apache o Cloudflare incorrecta

Debug:

```bash
tail -f /var/log/httpd/error_log
podman logs -f asistencia-node
grep -A 5 "RewriteCond.*websocket" /etc/httpd/conf.d/asistencia.conf
```

### CORS errors

Causa: Headers CORS no configurados

Solución en `node-service/src/middleware/cors.middleware.ts`:

```typescript
allowedOrigins: [
  "https://mantochrisal.cl",
  "https://dominio-produccion.cl",
  "http://localhost",
];
```

---

## Monitoreo

### Logs

```bash
# Apache
tail -f /var/log/httpd/access_log
tail -f /var/log/httpd/error_log

# Node.js
podman logs -f asistencia-node

# PostgreSQL
podman logs -f asistencia-postgres

# Cloudflare Tunnel (staging)
journalctl -u cloudflared -f
```

### Health Check

```bash
# Estado contenedores
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Conectividad
curl -I http://localhost:9500/
curl -I http://localhost:9500/asistencia/
```

### Métricas

- JWT generados vs válidos
- WebSocket connections activas
- Latencia validación QR
- Errores de autenticación

---

## Referencias

- [ARQUITECTURA_PENDIENTE.md](../../implementacion-final/ARQUITECTURA_PENDIENTE.md)
- [COMPONENTES-PHP-REUTILIZABLES.md](../componentes/COMPONENTES-PHP-REUTILIZABLES.md)
