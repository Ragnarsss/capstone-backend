# PLAN PARTE 2 - Modulo Attendance Backend

**Fecha:** 2025-11-04  
**Actualizado:** 2025-11-28  
**Version:** 3.0  
**Estado:** EN PROGRESO  
**Rama:** fase-6-persistencia-asistencia

---

## Resumen de Estado

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 0 | Baseline - verificacion inicial | COMPLETADO |
| 1 | QRPayloadV1 estructura JSON | COMPLETADO |
| 2 | AES-256-GCM cifrado | COMPLETADO |
| 3 | Valkey storage para QR metadata | COMPLETADO |
| 4 | Endpoint /validate basico | COMPLETADO |
| 5 | Frontend scanner basico | COMPLETADO |
| 6 | Sistema de rounds e intentos | COMPLETADO |
| 6.1 | Frontend crypto + rounds | PENDIENTE |
| 7 | Persistencia PostgreSQL | PENDIENTE |

---

## Arquitectura Implementada

A diferencia del plan original DDD complejo, se implemento una arquitectura mas simple:

```
node-service/src/backend/attendance/
├── application/
│   ├── qr-generator.ts              # Genera QR cifrados
│   ├── attendance-validation.service.ts  # Valida rounds
│   └── participation.service.ts     # Registro y estado
├── domain/
│   └── models.ts                    # Tipos e interfaces
├── infrastructure/
│   ├── crypto.ts                    # AES-256-GCM
│   ├── valkey-store.ts              # Cache QR metadata
│   └── student-session.repository.ts # Estado estudiante
└── presentation/
    ├── routes.ts                    # Endpoints REST
    └── types.ts                     # DTOs
```

---

## Fases Completadas

### Fase 0-5: Core de Cifrado y Validacion

**Commits:** `a17bb0e` a `7f7c8a9`

- QRPayloadV1: `{v, sid, uid, r, ts, n}`
- AES-256-GCM con MOCK_SESSION_KEY
- Almacenamiento en Valkey con TTL
- Endpoint POST /attendance/validate
- Scanner frontend basico

### Fase 6: Rounds e Intentos

**Commit:** `fa66afb`

- Sistema de 3 rounds por estudiante
- Sistema de 3 intentos si falla
- Estado persistente en Valkey
- Calculo de estadisticas (avg, stddev, certainty)
- 22 tests pasando

**Endpoints implementados:**

| Metodo | Ruta | Funcion |
|--------|------|---------|
| POST | /attendance/register | Registra estudiante, genera QR round 1 |
| GET | /attendance/status | Estado actual del estudiante |
| POST | /attendance/validate | Valida round, avanza estado |
| POST | /attendance/refresh-qr | Nuevo QR para round actual |

---

## Fases Pendientes

### Fase 6.1: Frontend Crypto + Rounds

**Objetivo:** El frontend descifra QR, valida round, envia respuesta cifrada

**Archivos a modificar:**

```
node-service/src/frontend/
├── features/attendance/
│   ├── qr-scan.service.ts      # Agregar descifrado + expectedRound
│   ├── attendance-api.client.ts # Manejar respuestas con expectedRound
│   └── camera-view.component.ts # UI progreso rounds
└── shared/crypto/
    ├── aes-gcm.ts              # NUEVO: encrypt/decrypt browser
    └── mock-keys.ts            # NUEVO: MOCK_SESSION_KEY
```

**Flujo a implementar:**

1. Cliente descifra QR con session_key
2. Verifica r === expectedRound
3. Construye response con TOTPu (mock), ts_client
4. Cifra response
5. POST /validate
6. Maneja respuesta: expectedRound, complete, noMoreAttempts

**Estimacion:** 4-6 horas

---

### Fase 7: Persistencia PostgreSQL

**Objetivo:** Guardar validaciones y resultados en DB

**Tablas a usar:**

- `attendance.registrations` - Registro de participacion
- `attendance.validations` - Cada round validado
- `attendance.results` - Resultado final con certeza

**Archivos a crear:**

```
node-service/src/backend/attendance/infrastructure/
├── postgres/
│   ├── attendance.repository.ts    # CRUD validations
│   └── result.repository.ts        # CRUD results
```

**Integracion:**

- Modificar `participation.service.ts` para persistir registro
- Modificar `attendance-validation.service.ts` para persistir validaciones
- Crear servicio de calculo de resultado final

**Estimacion:** 6-8 horas

---

## Criterios de Aceptacion Actualizados

### Ya Cumplidos

- [x] Endpoint POST /attendance/register funcional
- [x] Endpoint POST /attendance/validate funcional con N rounds
- [x] Sistema de intentos implementado
- [x] Calculo de certeza basico implementado
- [x] Cifrado AES-256-GCM operativo
- [x] Estado persistente en Valkey

### Pendientes

- [ ] Frontend descifra QR y valida round
- [ ] Frontend maneja expectedRound en respuestas
- [ ] Persistencia en PostgreSQL attendance.*
- [ ] TOTPu real (depende de enrollment)
- [ ] Tests E2E completos

---

## Notas de Implementacion

### Mocks Activos

| Mock | Valor | Reemplazar en |
|------|-------|---------------|
| MOCK_SESSION_KEY | Hardcoded 32 bytes | Fase enrollment ECDH |
| userId | Parametro en request | JWT de PHP |
| TOTPu | No implementado | Fase enrollment |

### Decisiones Tecnicas

1. **No usar Use Cases como clases:** Servicios directos mas simples
2. **Estado en Valkey:** TTL de 2 horas, patron `student:{sid}:{uid}`
3. **Respuesta siempre incluye expectedRound:** Cliente sabe que buscar
4. **Fallo silencioso:** Cliente no sabe si fallo, solo reinicia

---

## Referencias

- `flujo-validacion-qr-20251128.md` - Flujo tecnico consolidado
- `13-estado-implementacion.md` - Estado general del proyecto
- `scripts/test-fase6.sh` - Tests de la fase 6
