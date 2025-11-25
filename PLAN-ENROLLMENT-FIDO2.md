# Plan de Implementacion - Enrollment FIDO2

**Fecha inicio:** 2025-11-25  
**Estado:** En progreso  
**Rama base:** feature/database-infrastructure

---

## Resumen de Fases

| Fase | Rama | Descripcion | Estado |
|------|------|-------------|--------|
| 0 | `fase-0-dependencias-enrollment` | Agregar dependencias npm y verificar contenedor | Pendiente |
| 1 | `fase-1-servicios-cripto` | HKDF, FIDO2 base, conexion PostgreSQL | Pendiente |
| 2 | `fase-2-device-repository` | CRUD para enrollment.devices | Pendiente |
| 3 | `fase-3-start-enrollment` | Endpoint /start con challenge real | Pendiente |
| 4 | `fase-4-fido2-validation` | Validacion WebAuthn completa | Pendiente |
| 5 | `fase-5-finish-enrollment` | Endpoint /finish guarda en DB | Pendiente |
| 6 | `fase-6-check-status` | Endpoint /status consulta DB | Pendiente |
| 7 | `fase-7-ecdh-login` | Key exchange para session_key | Pendiente |
| 8 | `fase-8-penalizaciones` | Sistema de delays exponenciales | Pendiente |
| 9 | `fase-9-websocket-enrollment` | Canal interactivo enrollment | Pendiente |

---

## Fase 0: Dependencias Enrollment

**Rama:** `fase-0-dependencias-enrollment`  
**Base:** `feature/database-infrastructure`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 0.1 | Agregar @simplewebauthn/server | `node-service/package.json` | npm list en contenedor |
| 0.2 | Agregar tipos @simplewebauthn/types | `node-service/package.json` | Compilacion sin errores |
| 0.3 | Reconstruir contenedor | N/A | Contenedor inicia correctamente |

### Comandos de verificacion

```bash
# Reconstruir
podman compose -f compose.yaml -f compose.dev.yaml up --build

# Verificar dependencia instalada
podman exec asistencia-node npm list @simplewebauthn/server

# Verificar que compila
podman exec asistencia-node npm run type-check
```

### Criterio de aceptacion

- Contenedor node-service inicia sin errores
- `@simplewebauthn/server` aparece en npm list
- TypeScript compila sin errores

---

## Fase 1: Servicios Cripto

**Rama:** `fase-1-servicios-cripto`  
**Base:** `fase-0-dependencias-enrollment`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 1.1 | Crear HKDFService | `backend/enrollment/infrastructure/crypto/hkdf.service.ts` | Test unitario pasa |
| 1.2 | Crear FIDO2Service (generateOptions) | `backend/enrollment/infrastructure/fido2/fido2.service.ts` | Test unitario pasa |
| 1.3 | Crear PostgresClient shared | `shared/infrastructure/postgres/postgres-client.ts` | Query simple funciona |

### Archivos a crear

```
node-service/src/
  backend/enrollment/infrastructure/
    crypto/
      hkdf.service.ts
    fido2/
      fido2.service.ts
  shared/infrastructure/
    postgres/
      postgres-client.ts
```

### Comandos de verificacion

```bash
# Test conexion PostgreSQL
podman exec asistencia-node node -e "
  const { Client } = require('pg');
  const c = new Client({host:'postgres',user:'asistencia',password:'asistencia_pass',database:'asistencia_db'});
  c.connect().then(() => c.query('SELECT 1')).then(r => console.log('OK:', r.rows)).catch(console.error).finally(() => c.end());
"
```

### Criterio de aceptacion

- HKDFService deriva claves consistentes
- FIDO2Service genera options validas
- PostgresClient conecta y ejecuta queries

---

## Fase 2: Device Repository

**Rama:** `fase-2-device-repository`  
**Base:** `fase-1-servicios-cripto`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 2.1 | DeviceRepository.save() | `backend/enrollment/infrastructure/repositories/device.repository.ts` | INSERT en DB |
| 2.2 | DeviceRepository.findByUserId() | mismo archivo | SELECT retorna datos |
| 2.3 | DeviceRepository.findByCredentialId() | mismo archivo | SELECT por credential_id |
| 2.4 | DeviceRepository.updateSignCount() | mismo archivo | UPDATE sign_count |

### Comandos de verificacion

```bash
# Verificar datos en PostgreSQL
podman exec asistencia-postgres psql -U asistencia -d asistencia_db -c "SELECT * FROM enrollment.devices;"
```

### Criterio de aceptacion

- Insertar device y verificar en psql
- Buscar por user_id retorna device correcto
- Buscar por credential_id retorna device correcto

---

## Fase 3: Start Enrollment Real

**Rama:** `fase-3-start-enrollment`  
**Base:** `fase-2-device-repository`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 3.1 | Reemplazar createEnrollmentChallenge() | `backend/enrollment/application/enrollment.service.ts` | Challenge real generado |
| 3.2 | Usar FIDO2Service.generateOptions() | mismo archivo | Options WebAuthn validas |

### Comandos de verificacion

```bash
# Obtener JWT
TOKEN=$(curl -s http://localhost:9500/api_puente_minodo.php?action=get_token | jq -r .token)

# Llamar start
curl -X POST http://localhost:9503/api/enrollment/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Verificar challenge en Valkey
podman exec asistencia-valkey valkey-cli KEYS "enrollment:*"
```

### Criterio de aceptacion

- POST /api/enrollment/start retorna challenge base64
- Challenge almacenado en Valkey con TTL 5 min
- Options contienen rp, user, pubKeyCredParams correctos

---

## Fase 4: FIDO2 Validation

**Rama:** `fase-4-fido2-validation`  
**Base:** `fase-3-start-enrollment`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 4.1 | FIDO2Service.verifyRegistration() | `backend/enrollment/infrastructure/fido2/fido2.service.ts` | Valida credential mock |
| 4.2 | Extraer publicKey formato PEM | mismo archivo | Key en formato correcto |
| 4.3 | Extraer AAGUID | mismo archivo | AAGUID extraido correctamente |

### Criterio de aceptacion

- Credential valida pasa verificacion
- Credential invalida es rechazada
- PublicKey en formato PEM

---

## Fase 5: Finish Enrollment Real

**Rama:** `fase-5-finish-enrollment`  
**Base:** `fase-4-fido2-validation`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 5.1 | Reemplazar verifyAndCompleteEnrollment() | `backend/enrollment/application/enrollment.service.ts` | Device guardado en DB |
| 5.2 | Derivar handshake_secret con HKDF | mismo archivo | Secret derivado correctamente |
| 5.3 | Guardar en enrollment.devices | mismo archivo | Registro existe en PostgreSQL |

### Comandos de verificacion

```bash
# Verificar device guardado
podman exec asistencia-postgres psql -U asistencia -d asistencia_db \
  -c "SELECT device_id, user_id, aaguid, enrolled_at FROM enrollment.devices;"
```

### Criterio de aceptacion

- POST /api/enrollment/finish guarda device en DB
- handshake_secret derivado y almacenado
- Respuesta incluye deviceId

---

## Fase 6: Check Status Real

**Rama:** `fase-6-check-status`  
**Base:** `fase-5-finish-enrollment`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 6.1 | Reemplazar checkEnrollmentStatus() | `backend/enrollment/application/enrollment.service.ts` | Consulta DB real |

### Comandos de verificacion

```bash
curl http://localhost:9503/api/enrollment/status \
  -H "Authorization: Bearer $TOKEN"

# Usuario sin enrollment: {enrolled: false, deviceCount: 0}
# Usuario con enrollment: {enrolled: true, deviceCount: 1, ...}
```

### Criterio de aceptacion

- Retorna enrolled: false si no hay devices
- Retorna enrolled: true si hay devices
- Incluye deviceCount correcto

---

## Fase 7: ECDH Login

**Rama:** `fase-7-ecdh-login`  
**Base:** `fase-6-check-status`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 7.1 | Crear ECDHService.generateKeyPair() | `backend/enrollment/infrastructure/crypto/ecdh.service.ts` | Par de claves P-256 |
| 7.2 | ECDHService.deriveSharedSecret() | mismo archivo | Secret compartido derivado |
| 7.3 | Reemplazar performECDHLogin() | `backend/enrollment/application/enrollment.service.ts` | Retorna serverPublicKey |

### Criterio de aceptacion

- POST /api/enrollment/login retorna serverPublicKey
- Cliente puede derivar mismo shared secret
- TOTPu generado correctamente

---

## Fase 8: Penalizaciones

**Rama:** `fase-8-penalizaciones`  
**Base:** `fase-7-ecdh-login`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 8.1 | PenaltyService.increment() | `backend/enrollment/infrastructure/penalties/penalty.service.ts` | Contador en Valkey |
| 8.2 | PenaltyService.isBlocked() | mismo archivo | Retorna true si bloqueado |
| 8.3 | PenaltyService.getDelayMinutes() | mismo archivo | Escala exponencial |
| 8.4 | Integrar en enrollment flow | `backend/enrollment/application/enrollment.service.ts` | Delay aplicado |

### Escala de penalizacion

```
Device 1: 0 min
Device 2: 5 min
Device 3: 30 min
Device 4+: Exponencial (max 24h)
```

### Criterio de aceptacion

- Segundo enrollment tiene delay 5 min
- Contador persiste en Valkey (TTL 24h)

---

## Fase 9: WebSocket Enrollment

**Rama:** `fase-9-websocket-enrollment`  
**Base:** `fase-8-penalizaciones`

### Tareas

| # | Tarea | Archivo | Verificacion |
|---|-------|---------|--------------|
| 9.1 | Crear WebSocket controller | `backend/enrollment/presentation/enrollment-ws.controller.ts` | Conexion funciona |
| 9.2 | Auth JWT en handshake | mismo archivo | Rechaza sin token |
| 9.3 | Mensaje CHALLENGE | mismo archivo | Cliente recibe options |
| 9.4 | Mensaje CREDENTIAL -> SUCCESS | mismo archivo | Flujo completo |
| 9.5 | Registrar en app.ts | `app.ts` | Ruta /enrollment/ws activa |

### Criterio de aceptacion

- wscat conecta con JWT valido
- Flujo completo via WebSocket funciona
- Codigos de cierre: 4401, 4403, 4408

---

## Diagrama de Ramas

```
feature/database-infrastructure
    |
    +-- fase-0-dependencias-enrollment
            |
            +-- fase-1-servicios-cripto
                    |
                    +-- fase-2-device-repository
                            |
                            +-- fase-3-start-enrollment
                                    |
                                    +-- fase-4-fido2-validation
                                            |
                                            +-- fase-5-finish-enrollment
                                                    |
                                                    +-- fase-6-check-status
                                                            |
                                                            +-- fase-7-ecdh-login
                                                                    |
                                                                    +-- fase-8-penalizaciones
                                                                            |
                                                                            +-- fase-9-websocket-enrollment
```

---

## Notas

- Cada fase debe estar funcional antes de crear la siguiente rama
- Probar con `podman compose` antes de hacer commit
- Commits descriptivos siguiendo daRulez.md
- No mezclar tareas de diferentes fases en una rama
