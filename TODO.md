# TODO - Sistema de Asistencia con QR Dinamico

> Ultima actualizacion: 2025-12-02

---

## Fases Completadas

### Fases 1-5: Fundamentos
- [x] Estructura base del proyecto
- [x] Configuracion de contenedores (Podman)
- [x] Integracion PHP/Node.js
- [x] Generacion de QR dinamicos con AES-256-GCM
- [x] Validacion basica de asistencia

### Fase 6: Arquitectura y Refactorizacion

#### 6.1: Manejo de Sesiones
- [x] SessionService para ciclo de vida de sesiones
- [x] Endpoints /api/session/start y /api/session/end
- [x] Propagacion de eventos via WebSocket

#### 6.2: Round-Aware System
- [x] Sistema multi-salon con rounds independientes
- [x] Maquina de estados para control de rounds
- [x] Gestion concurrente de multiples sesiones

#### 6.3: Sistema Multi-Salon
- [x] RoomSessionStore con RoomRoundTracker
- [x] Validacion de freshness del QR por salon
- [x] Estadisticas y eventos segregados por room

#### 6.4: Validation Pipeline
- [x] Patron Pipeline con 10 stages especializados
- [x] ValidateScanUseCase (validacion pura)
- [x] CompleteScanUseCase (validacion + side effects)
- [x] StatsCalculator, ErrorMapper, 3 Adapters
- [x] 20 tests unitarios para stages
- [x] Eliminacion de AttendanceValidationService (415 lineas legacy)

---

## Fases Pendientes

### Fase 7: Persistencia PostgreSQL

**Rama:** `fase-7-persistencia-postgresql`  
**Estimado:** 6-8 horas

#### 7.1 - SessionRepository
- [ ] Crear SessionRepository con CRUD
- [ ] Metodos: saveSession, getSession, updateSession
- [ ] Test manual: insertar/leer sesion

#### 7.2 - ValidationRepository
- [ ] Crear ValidationRepository
- [ ] Metodos: saveValidation, getValidationsByStudent
- [ ] Test manual: insertar validacion, consultar historial

#### 7.3 - ResultRepository
- [ ] Crear ResultRepository
- [ ] Metodos: saveResult, getResultsBySession
- [ ] Test manual: completar flujo, verificar en DB

#### 7.4 - Integracion con CompleteScanUseCase
- [ ] Inyectar repositorios en usecase
- [ ] Persistir validacion exitosa
- [ ] Persistir resultado cuando isComplete=true

#### 7.5 - Script test-fase7.sh
- [ ] Verificar conexion PostgreSQL
- [ ] Test insercion/lectura
- [ ] Test flujo completo con persistencia

---

### Fase 8: QRs Falsos Mejorados

**Rama:** `fase-8-qrs-falsos`  
**Estimado:** 2-4 horas

#### 8.1 - FakeQRGenerator
- [ ] Generar N QRs con formato valido pero clave invalida
- [ ] Configurar ratio real:falsos (ej: 1:5)
- [ ] Test manual: verificar indescifrables

#### 8.2 - Integracion con Pool
- [ ] Metodo addFakeQRs(sessionId, count)
- [ ] Mezclar falsos con reales en pool
- [ ] Test manual: verificar pool mixto

#### 8.3 - Metricas de Fraude
- [ ] Contador de intentos con QR invalido
- [ ] Log de deteccion de intentos fraudulentos

#### 8.4 - Script test-fase8.sh
- [ ] Verificar generacion de falsos
- [ ] Verificar mezcla en pool
- [ ] Verificar logs de fraude

---

### Fase 9: Enrollment FIDO2 + ECDH

**Rama:** `fase-9-enrollment-fido2`  
**Estimado:** 12-16 horas

#### 9.1 - FIDO2Service
- [ ] Instalar @simplewebauthn/server
- [ ] generateRegistrationOptions()
- [ ] verifyRegistrationResponse()
- [ ] Test manual: generar challenge

#### 9.2 - ECDHService
- [ ] generateKeyPair()
- [ ] deriveSharedSecret(publicKey)
- [ ] deriveSessionKey(sharedSecret)
- [ ] Test manual: intercambio de claves

#### 9.3 - Enrollment UseCase
- [ ] Reemplazar stubs con FIDO2Service
- [ ] Almacenar credencial en PostgreSQL
- [ ] Retornar public key para ECDH

#### 9.4 - Login UseCase
- [ ] Autenticacion FIDO2
- [ ] Derivar session_key con ECDH
- [ ] Almacenar session_key en Valkey (TTL)

#### 9.5 - Frontend Enrollment UI
- [ ] Componente de enrollment
- [ ] Integrar WebAuthn API del navegador
- [ ] Almacenar session_key derivada

#### 9.6 - Reemplazar MOCK_SESSION_KEY
- [ ] getSessionKey() obtiene clave real
- [ ] Backend usa clave del estudiante especifico
- [ ] Fallback a mock solo en dev sin enrollment

#### 9.7 - Script test-fase9.sh
- [ ] Test enrollment FIDO2
- [ ] Test derivacion ECDH
- [ ] Test flujo sin mocks

---

### Fase 10: Integracion PHP Legacy

**Rama:** `fase-10-integracion-php`  
**Estimado:** 4-6 horas

#### 10.1 - Endpoint para PHP
- [ ] POST /api/internal/verify-enrollment
- [ ] Autenticacion con shared secret
- [ ] Test manual: llamada desde PHP

#### 10.2 - Extraccion userId de JWT
- [ ] Middleware para extraer userId del JWT de PHP
- [ ] Inyectar en request context
- [ ] Eliminar studentId como parametro manual

#### 10.3 - Sincronizacion de Usuarios
- [ ] Mapear usuarios PHP a enrollments Node
- [ ] Manejar usuarios sin enrollment

#### 10.4 - Script test-fase10.sh
- [ ] Test endpoint interno
- [ ] Test JWT con userId
- [ ] Test flujo PHP-Node completo

---

## Flujo de Ramas

```
main
 +-- fase-7-persistencia-postgresql (7.1 -> 7.5)
 |     merge a main cuando OK
 |
 +-- fase-8-qrs-falsos (8.1 -> 8.4)
 |     merge a main cuando OK
 |
 +-- fase-9-enrollment-fido2 (9.1 -> 9.7)
 |     merge a main cuando OK
 |
 +-- fase-10-integracion-php (10.1 -> 10.4)
       merge a main cuando OK
```

---

## Comandos de Desarrollo

```bash
# Ejecutar tests
podman compose -f compose.yaml -f compose.dev.yaml exec node-service pnpm test

# Verificar TypeScript
podman compose -f compose.yaml -f compose.dev.yaml exec node-service pnpm tsc --noEmit

# Ejecutar script de fase
podman compose -f compose.yaml -f compose.dev.yaml exec node-service bash /app/scripts/test-faseN.sh
```

---

## Referencias

- `daRulez.md` - Reglas del proyecto
- `documents/03-especificaciones-tecnicas/13-estado-implementacion.md` - Estado detallado
- `flujo-validacion-qr-20251128.md` - Especificacion del flujo QR
