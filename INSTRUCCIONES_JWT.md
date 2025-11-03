# Instrucciones: Arquitectura JWT Implementada

## Resumen de Cambios

Se ha implementado la **arquitectura JWT recomendada** para que el cliente hable directamente con Node.js, usando PHP solo como "portero" que emite tokens.

### Archivos Modificados:
- ✅ `node-service/package.json` - Agregada dependencia `jsonwebtoken`
- ✅ `node-service/src/config/index.ts` - Configuración JWT
- ✅ `php-service/apache-config/asistencia.conf` - Reverse proxy `/minodo-api`

### Archivos Nuevos:
- ✅ `node-service/src/features/jwt-utils.ts` - Utilidades JWT
- ✅ `node-service/src/features/auth-middleware.ts` - Middleware autenticación
- ✅ `node-service/src/features/enrollment-handler.ts` - Endpoints protegidos
- ✅ `php-service/src/lib/jwt.php` - Biblioteca JWT PHP
- ✅ `php-service/src/api_puente_minodo.php` - Emisor de JWT
- ✅ `php-service/src/ejemplo-jwt-client.html` - Cliente de prueba
- ✅ `ARQUITECTURA_JWT.md` - Documentación completa

---

## Paso 1: Rebuild de Contenedores

Las dependencias (`jsonwebtoken`) necesitan instalarse. Debes reconstruir los contenedores.

```bash
cd /var/mnt/Git/Capstone02/Asistencia

# Detener contenedores actuales (si están corriendo)
podman-compose down

# Rebuild en modo desarrollo
podman-compose -f compose.yaml -f compose.dev.yaml up --build

# O en modo detached (background):
podman-compose -f compose.yaml -f compose.dev.yaml up --build -d
```

**Qué pasa durante el build:**
1. El Containerfile ejecuta `RUN npm install` (línea 60)
2. Lee `package.json` (que ahora tiene `jsonwebtoken`)
3. Instala todas las dependencias automáticamente
4. El named volume `node-modules` persiste las dependencias

**Tiempo estimado:** 2-3 minutos (primera vez con rebuild)

---

## Paso 2: Verificar que Todo Esté Corriendo

### Verificar contenedores:
```bash
podman ps

# Deberías ver 4 contenedores:
# - asistencia-php (puerto 9500)
# - asistencia-node (puerto 9503 en dev)
# - asistencia-postgres (puerto 9501 en dev)
# - asistencia-valkey (puerto 9502 en dev)
```

### Verificar Node.js:
```bash
curl http://localhost:9503/health

# Debería responder:
# {"status":"ok","timestamp":1730546789123}
```

### Verificar PHP:
```bash
curl http://localhost:9500

# Debería responder con HTML
```

---

## Paso 3: Probar la Arquitectura JWT

### Opción A: Interfaz Web (Recomendada)

1. **Abrir en navegador:**
   ```
   http://localhost:9500/ejemplo-jwt-client.html
   ```

2. **Ejecutar pruebas:**
   - Click en "Obtener JWT" (Paso 1)
   - Click en "Check Enrollment Status" (Paso 2)
   - Click en "Start Enrollment" (Paso 2)
   - Click en "Ejecutar Flujo Completo" (Paso 3)

3. **Observar logs:**
   - Cada acción muestra logs detallados
   - Puedes ver el JWT generado, las respuestas de Node.js, etc.

**NOTA:** Si obtienes error `NOT_AUTHENTICATED`, es porque no hay sesión PHP activa. Esto es normal en desarrollo. En producción, la sesión PHP ya existirá del login legacy.

### Opción B: Testing con curl (Avanzado)

```bash
# 1. Obtener JWT (requiere sesión PHP simulada)
# TODO: Por ahora, usar la interfaz web

# 2. Llamar a Node.js directamente (sin JWT - debería fallar)
curl http://localhost:9503/api/enrollment/status

# Respuesta esperada:
# {"success":false,"error":"UNAUTHORIZED","message":"Header Authorization no proporcionado"}

# 3. Llamar con JWT (reemplazar <TOKEN> con uno real)
curl -H "Authorization: Bearer <TOKEN>" \
     http://localhost:9503/api/enrollment/status

# Respuesta esperada:
# {"success":true,"enrolled":false,"deviceCount":0,"message":"Usuario no enrolado (stub)"}
```

---

## Paso 4: Entender el Flujo

### Flujo Visual:

```
┌──────────────┐
│   CLIENTE    │
│  (Browser)   │
└──────┬───────┘
       │
       │ (1) GET /api_puente_minodo.php?action=get_token
       ▼
┌──────────────┐
│     PHP      │  Verifica sesión PHP
│  "PORTERO"   │  Genera JWT firmado
└──────┬───────┘
       │
       │ (2) { "token": "eyJhbGc..." }
       ▼
┌──────────────┐
│   CLIENTE    │  Guarda JWT en variable
└──────┬───────┘
       │
       │ (3) GET /minodo-api/enrollment/status
       │     Authorization: Bearer eyJhbGc...
       ▼
┌──────────────┐
│   Apache     │  Reverse proxy:
│ (Proxy Rev.)│  /minodo-api/* → node-service:3000/api/*
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   NODE.JS    │  Valida JWT
│ "ESPECIALISTA"│  Verifica firma, expiracion, issuer, audience
└──────┬───────┘  Extrae userId del payload
       │         Ejecuta lógica de negocio
       │
       │ (4) { "success": true, "enrolled": false, ... }
       ▼
┌──────────────┐
│   CLIENTE    │
└──────────────┘
```

### Puntos Clave:

1. **PHP NO hace proxy** - Solo emite JWT
2. **Cliente habla directamente con Node** - Vía reverse proxy Apache
3. **JWT viaja en header** - `Authorization: Bearer <token>`
4. **Node valida JWT** - Usando la misma clave secreta que PHP
5. **Desacoplamiento total** - PHP y Node no se comunican entre sí

---

## Paso 5: Verificar Logs (Opcional)

### Ver logs de Node.js:
```bash
podman logs -f asistencia-node

# Deberías ver:
# [Server] Corriendo en http://0.0.0.0:3000
# {"level":30,"msg":"Usuario autenticado via JWT","userId":123,"username":"juan.perez"}
```

### Ver logs de PHP:
```bash
podman logs -f asistencia-php
```

---

## Solución de Problemas

### Problema: "No se pudo obtener JWT: Debes iniciar sesión primero"

**Causa:** No hay sesión PHP activa.

**Solución (Testing):**
- En el archivo `api_puente_minodo.php`, simular sesión agregando al inicio:
  ```php
  <?php
  session_start();

  // SOLO PARA TESTING - Remover en producción
  if (!isset($_SESSION['user_id'])) {
      $_SESSION['user_id'] = 123;
      $_SESSION['username'] = 'test.user';
      $_SESSION['nombre_completo'] = 'Usuario de Prueba';
      $_SESSION['rol'] = 'alumno';
  }
  ```

**Solución (Producción):**
- La sesión PHP debe existir del login legacy (ya implementado en "Hawaii")

---

### Problema: "Error de red al llamar a Node.js"

**Verificar:**
```bash
# 1. ¿Está corriendo el contenedor?
podman ps | grep asistencia-node

# 2. ¿Responde el health check?
curl http://localhost:9503/health

# 3. ¿Está bien configurado el proxy?
cat php-service/apache-config/asistencia.conf | grep minodo-api
```

---

### Problema: "Token inválido" o "Token expirado"

**Causa:** JWT expiró (5 minutos) o clave secreta no coincide.

**Solución:**
1. Verificar que PHP y Node usan la misma clave:
   ```bash
   grep SECRET php-service/src/lib/jwt.php
   grep secret node-service/src/config/index.ts
   ```
2. Obtener un nuevo JWT (el anterior expiró)

---

## Próximos Pasos (Desarrollo)

Una vez que hayas verificado que todo funciona:

1. **Implementar lógica real FIDO2:**
   - Editar `node-service/src/features/enrollment-handler.ts`
   - Reemplazar stubs con lógica real de WebAuthn

2. **Conectar con PostgreSQL:**
   - Crear schema `enrollment` y tabla `devices`
   - Persistir credenciales FIDO2

3. **Implementar ECDH key exchange:**
   - Login con intercambio de claves ECDH
   - Generación de TOTPu

4. **Testing de seguridad:**
   - Probar con tokens expirados
   - Probar con tokens malformados
   - Probar sin token

5. **Migración a producción:**
   - Generar clave secreta robusta (32 bytes)
   - Configurar en variables de entorno
   - Deployment en servidor "Hawaii"

---

## Recursos

- **Documentación completa:** [ARQUITECTURA_JWT.md](ARQUITECTURA_JWT.md)
- **Recomendación original:** [documents/recomendacion.md](documents/recomendacion.md)
- **Guía integración PHP-Node:** [documents/10-guia-integracion-php-node.md](documents/10-guia-integracion-php-node.md)

---

## Resumen de Comandos

```bash
# Rebuild completo
podman-compose -f compose.yaml -f compose.dev.yaml up --build -d

# Ver logs
podman logs -f asistencia-node
podman logs -f asistencia-php

# Health checks
curl http://localhost:9503/health
curl http://localhost:9500

# Testing web
# Abrir: http://localhost:9500/ejemplo-jwt-client.html

# Detener todo
podman-compose down
```

---

**¡Listo!** La arquitectura JWT está implementada y lista para probar. 🎉
