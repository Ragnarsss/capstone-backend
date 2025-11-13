# Fix: QR Dinamico con WebSocket despues de Migracion a Vite

**Fecha:** 2025-11-13  
**Estado:** IMPLEMENTADO  
**Prioridad:** CRITICO

---

## Resumen del Problema

Despues de la migracion a Vite como servidor de desarrollo frontend, el sistema de QR dinamico dejo de funcionar. Los codigos QR no se actualizaban cada 3 segundos como se esperaba.

### Sintomas Detectados

1. Modal se abria pero mostraba "Esperando autenticacion..." indefinidamente
2. Error 503 al cargar iframe: `GET http://localhost:9500/asistencia/ 503 (Service Unavailable)`
3. No se establecía conexion WebSocket
4. Los QR no se generaban ni actualizaban

---

## Diagnostico

Se identificaron **3 problemas criticos**:

### Problema 1: JWT Nunca Enviado al Iframe

**Causa:**
- PHP abria el modal con el iframe pero nunca obtenia el JWT
- El frontend esperaba recibir el token via `postMessage`
- Sin JWT, el WebSocket no podia autenticarse

**Ubicacion:** `php-service/src/test-modal.html:104-117`

### Problema 2: Error 503 en Carga de Iframe

**Causa:**
- Apache hace proxy: `/asistencia/` → `http://node-service:3000/asistencia/`
- Node intenta hacer proxy a Vite: `http://localhost:5173/asistencia/`
- Vite NO conoce `/asistencia/`, solo conoce `/`
- Resultado: 503 Service Unavailable

**Ubicacion:** `php-service/apache-config/asistencia.conf:44-46`

### Problema 3: Ruta WebSocket No Adaptativa

**Causa:**
- Cliente WebSocket usaba ruta fija `/ws`
- En contexto iframe de Apache, debe usar `/asistencia/ws`
- No habia deteccion automatica del contexto

**Ubicacion:** `node-service/src/frontend/modules/websocket/websocket.client.ts:44-45`

---

## Soluciones Implementadas

### Solucion 1: PHP Obtiene y Envia JWT

**Archivo:** `php-service/src/test-modal.html`

**Cambio:**
```javascript
async function openModal() {
    // 1. Obtener JWT del backend PHP
    const response = await fetch('/api_puente_minodo.php?action=get_token');
    const data = await response.json();
    
    if (!data.success) {
        alert('Error: ' + data.message);
        return;
    }
    
    // 2. Abrir modal
    const modal = document.getElementById('asistenciaModal');
    const iframe = document.getElementById('asistenciaFrame');
    modal.style.display = 'block';
    iframe.src = '/asistencia';
    
    // 3. Enviar JWT al iframe cuando cargue
    iframe.onload = function() {
        iframe.contentWindow.postMessage({
            type: 'AUTH_TOKEN',
            token: data.token
        }, window.location.origin);
    };
}
```

### Solucion 2: Apache Strip de Prefix /asistencia/

**Archivo:** `php-service/apache-config/asistencia.conf`

**Cambio:**
```apache
# ANTES: Apache enviaba /asistencia/ a Node
ProxyPass /asistencia http://node-service:3000

# DESPUES: Apache hace strip del prefix
ProxyPass /asistencia/ http://node-service:3000/
ProxyPassReverse /asistencia/ http://node-service:3000/

# Sin trailing slash tambien funciona
ProxyPass /asistencia http://node-service:3000/
ProxyPassReverse /asistencia http://node-service:3000/
```

**Efecto:**
- Apache recibe: `GET /asistencia/`
- Node recibe: `GET /` (sin prefix)
- Node puede enviar a Vite que solo conoce rutas desde `/`

### Solucion 3: WebSocket Client con Deteccion de Contexto

**Archivo:** `node-service/src/frontend/modules/websocket/websocket.client.ts`

**Cambio:**
```typescript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

// Detectar si estamos en contexto /asistencia/ (iframe de Apache)
let wsPath = '/ws';
if (window.location.pathname.startsWith('/asistencia')) {
  wsPath = '/asistencia/ws';
  console.log('[WebSocket] Contexto /asistencia/ detectado');
}

const wsUrl = protocol + '//' + window.location.host + wsPath;
```

**Logica:**
- Si `window.location.pathname` comienza con `/asistencia` → usar `/asistencia/ws`
- Si no → usar `/ws` (desarrollo directo o root)
- Funciona tanto en desarrollo containerizado como en produccion

---

## Arquitectura de Flujo Corregida

```
Usuario (navegador)
    |
    | 1. Click "ASISTENCIA"
    v
PHP (test-modal.html)
    |
    | 2. GET /api_puente_minodo.php?action=get_token
    v
api_puente_minodo.php
    |
    | 3. {success: true, token: "eyJ..."}
    v
PHP
    |
    | 4. Abre iframe /asistencia
    | 5. postMessage({type: 'AUTH_TOKEN', token})
    v
Apache (puerto 9500)
    |
    | 6. ProxyPass /asistencia/ → node-service:3000/
    v
Node Backend (puerto 3000)
    |
    | 7. isDev? Proxy a Vite : Servir dist/
    v
Frontend (index.html + main.ts)
    |
    | 8. Recibe JWT via postMessage
    | 9. Almacena en sessionStorage
    |
    | 10. WebSocket connect
    |     Detecta pathname.startsWith('/asistencia')
    |     Usa: ws://localhost:9500/asistencia/ws
    v
Apache
    |
    | 11. ProxyPass /asistencia/ws → ws://node-service:3000/ws
    v
Node WebSocket Handler
    |
    | 12. {type: 'AUTH', token: 'eyJ...'}
    | 13. Valida JWT
    | 14. {type: 'auth-ok'}
    | 15. Loop cada 3s: {type: 'qr-update', payload}
    v
Frontend
    |
    | 16. Renderiza QR en pantalla
    v
Usuario ve QR actualizado
```

---

## Archivos Modificados

| Archivo | Lineas | Tipo | Descripcion |
|---------|--------|------|-------------|
| `websocket.client.ts` | 44-56 | Correccion | Deteccion automatica de ruta WebSocket segun contexto |
| `test-modal.html` | 104-145 | Feature | Obtener y enviar JWT via postMessage |
| `asistencia.conf` | 44-50 | Correccion | Strip de prefix /asistencia/ en proxy a Node |

**Total:** 3 archivos, ~60 lineas modificadas

---

## Como Probar

**IMPORTANTE:** Todo el desarrollo esta containerizado. Usar podman compose (no podman-compose).

### 1. Iniciar Servicios

```bash
# Desde el directorio raiz del proyecto
podman compose up

# Ver logs en tiempo real
podman compose logs -f

# Ver logs de servicio especifico
podman compose logs -f node-service
podman compose logs -f php-service

# Detener servicios
podman compose down
```

**Servicios que se inician:**
- PHP Service (Apache): `http://localhost:9500`
- Node Service (Backend): `http://localhost:3000` (interno)
- Vite Dev Server: Interno, proxy via Node
- Valkey (Redis): `localhost:6379`
- PostgreSQL: `localhost:5432`

### 2. Abrir Test Modal

Navegar a: `http://localhost:9500/test-modal.html`

### 3. Verificar Comportamiento Esperado

1. **Click en boton "ASISTENCIA"**

2. **Verificar consola del navegador:**
   ```
   [Test] Abriendo modal...
   [Test] Obteniendo token JWT...
   [Test] Token obtenido exitosamente para usuario: test.user
   [Test] Iframe cargado, enviando token JWT...
   [Test] Token enviado al iframe
   ```

3. **Verificar consola del iframe (DevTools → Frames):**
   ```
   [Auth] Token recibido y almacenado
   [App] Iniciando aplicacion
   [WebSocket] Contexto /asistencia/ detectado
   [WebSocket] Estableciendo conexion... ws://localhost:9500/asistencia/ws
   [WebSocket] Conectado, enviando autenticacion...
   [WebSocket] Autenticacion exitosa: test.user
   ```

4. **Verificar en pantalla:**
   - Countdown: 5, 4, 3, 2, 1
   - QR aparece y cambia cada 3 segundos
   - Status: "Escanea el codigo QR para registrar asistencia"

### 4. Verificar Logs del Servidor

```bash
podman compose logs -f node-service

# Debe mostrar:
[Server] Corriendo en http://0.0.0.0:3000
[WebSocket] Nueva conexion, esperando autenticacion...
[WebSocket] Usuario autenticado: test.user (ID: 123)
[WebSocket] Iniciando proyeccion para sesion: session-1731467891-abc
```

---

## Comparacion Antes/Despues

| Aspecto | Antes (ROTO) | Despues (ARREGLADO) |
|---------|--------------|---------------------|
| **JWT obtencion** | Nunca | Fetch antes de abrir modal |
| **JWT envio** | Nunca | postMessage al iframe |
| **Carga iframe** | 503 Error | 200 OK |
| **Ruta WebSocket** | Fija /ws | Adaptativa segun contexto |
| **Autenticacion WS** | Falla | Exitosa |
| **QR generacion** | No funciona | Cada 3 segundos |
| **Consola errores** | Connection refused, 503 | Sin errores |

---

## Notas Importantes

### Entorno Containerizado

- Todo el desarrollo esta en contenedores
- NO se requiere npm en el host
- Usar `podman compose` (sin guion)
- En desarrollo, el codigo se monta como volumenes con hot reload

### Variable de Sesion PHP (Testing)

El archivo `api_puente_minodo.php` tiene codigo de testing (lineas 29-35) que simula una sesion:

```php
if (!isset($_SESSION['user_id'])) {
    $_SESSION['user_id'] = 123;
    $_SESSION['username'] = 'test.user';
    // ...
}
```

**REMOVER en produccion** - Solo para desarrollo/testing.

### Arquitectura de Puertos

**Desde el HOST:**
- PHP/Apache: `http://localhost:9500` (expuesto)
- Node Backend: `http://localhost:9503` (expuesto solo en dev para debug)
- PostgreSQL: `localhost:9501` (expuesto solo en dev)
- Valkey: `localhost:9502` (expuesto solo en dev)

**Dentro de la red de contenedores:**
- PHP: `http://php-service:80`
- Node: `http://node-service:3000`
- PostgreSQL: `postgres:5432`
- Valkey: `valkey:6379`

---

## Referencias

- [Integracion PHP-Node (Consolidado)](./00-INTEGRACION-PHP-NODE-CONSOLIDADO.md)
- [Protocolo WebSocket](../03-especificaciones-tecnicas/09-protocolo-websocket.md)
- [Vite Proxy Configuration](https://vitejs.dev/config/server-options.html#server-proxy)

---

**Version:** 1.1  
**Autor:** Kilo Code  
**Estado:** Implementado y Documentado