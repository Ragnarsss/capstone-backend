# Plan de Fases de Implementacion

**Version:** 1.0  
**Fecha:** 2025-11-27  
**Branch:** fase-8-penalizaciones  
**Estado:** En planificacion

---

## Principios Aplicados

- Monolito modular con vertical slicing
- Cada funcion/metodo hace UNA cosa
- Scripts de prueba en `/scripts/` (eliminables)
- Sin emojis ni emoticones
- Pruebas manuales asistidas
- `podman compose` (no `podman-compose`)
- Todo dentro de contenedores (host sin npm)

---

## Fase Actual: Implementacion Core de Asistencia

### FASE 0: Baseline
**Duracion:** 30 min  
**Riesgo:** Ninguno

**Objetivo:** Verificar estado actual y crear script de regresion.

**Tareas:**
1. Ejecutar `podman compose -f compose.dev.yaml up -d`
2. Verificar Host proyecta QR
3. Verificar WebSocket conecta con JWT
4. Crear `/scripts/test-baseline.sh`

**Criterio de Aceptacion:**
- [ ] PHP responde en puerto 9500
- [ ] Node responde en puerto 9503
- [ ] JWT se genera correctamente
- [ ] Host muestra QR en browser

---

### FASE 1: Payload JSON Estructurado
**Duracion:** 2-3 horas  
**Riesgo:** Bajo

**Objetivo:** Cambiar payload de string a JSON estructurado, sin encriptacion.

**Tareas:**
1. Crear interfaz `QRPayloadV1` en `qr-projection/domain/models.ts`
2. Refactorizar `QRGenerator` con metodos separados:
   - `generateNonce(): string`
   - `buildPayload(): QRPayloadV1`
   - `toQRString(): string`
3. Actualizar WebSocket controller para usar nuevo formato
4. Crear `/scripts/test-fase1.sh`

**Criterio de Aceptacion:**
- [ ] Host sigue mostrando QR
- [ ] QR escaneado contiene JSON valido
- [ ] JSON tiene campos: `v`, `sid`, `uid`, `r`, `ts`, `n`

---

### FASE 2: Mock User + Lector Basico
**Duracion:** 3-4 horas  
**Riesgo:** Bajo

**Objetivo:** Endpoint PHP mock y frontend Guest minimo que capture QR.

**Tareas:**
1. Crear `php-service/src/asistencia-node-integration/api/mock-user.php`
2. Crear `node-service/src/frontend/guest/index.html`
3. Integrar jsQR para captura de camara
4. Registrar ruta `/guest/` en frontend-plugin
5. Crear `/scripts/test-fase2.sh`

**Criterio de Aceptacion:**
- [ ] `/api/mock-user.php` retorna usuario id=999
- [ ] `/guest/` abre camara
- [ ] Escanear QR muestra JSON en pantalla

---

### FASE 3: Modulo Crypto
**Duracion:** 3-4 horas  
**Riesgo:** Medio

**Objetivo:** Utilidades criptograficas modulares sin integrar aun.

**Tareas:**
1. Crear `shared/crypto/aes-gcm.service.ts`
   - `encrypt(plaintext, key): EncryptedData`
   - `decrypt(encrypted, key): string`
2. Crear `shared/crypto/hkdf.service.ts`
   - `derive(ikm, info, length): Buffer`
3. Crear `shared/crypto/totp.service.ts`
   - `generate(secret, timestamp?): string`
   - `verify(token, secret, window?): boolean`
4. Crear `shared/crypto/index.ts` (exports)
5. Crear `/scripts/test-fase3.sh`

**Criterio de Aceptacion:**
- [ ] AES encrypt/decrypt roundtrip funciona
- [ ] HKDF deriva claves consistentes
- [ ] TOTP genera 6 digitos
- [ ] TOTP verifica con ventana

---

### FASE 4: QR Encriptado con Mock Key
**Duracion:** 3-4 horas  
**Riesgo:** Medio

**Objetivo:** QR encriptado usando clave mock compartida.

**Tareas:**
1. Crear `qr-projection/domain/payload-encryptor.ts`
   - `encrypt(payload, key): EncryptedQR`
2. Modificar `QRGenerator` para usar encryptor
3. Agregar `MOCK_SESSION_KEY` a compose.dev.yaml
4. Actualizar Guest para desencriptar con mock key
5. Crear `/scripts/test-fase4.sh`

**Criterio de Aceptacion:**
- [ ] Host genera QR encriptado
- [ ] Guest desencripta con mock key
- [ ] Con key incorrecta, falla

---

### FASE 5: TOTP en Payload
**Duracion:** 2-3 horas  
**Riesgo:** Bajo

**Objetivo:** Agregar TOTPs al payload y validar en Guest.

**Tareas:**
1. Crear `qr-projection/domain/totp-generator.ts`
   - `generateForRound(sessionId, userId, round): string`
   - `buildSecret(sessionId, userId, round): string`
2. Integrar en `QRGenerator.buildPayload()`
3. Guest valida TOTP localmente
4. Crear `/scripts/test-fase5.sh`

**Criterio de Aceptacion:**
- [ ] Payload incluye campo `o` con 6 digitos
- [ ] TOTP cambia cada 30 segundos
- [ ] Guest indica si TOTP es valido

---

### FASE 6: Respuesta del Alumno
**Duracion:** 3-4 horas  
**Riesgo:** Medio

**Objetivo:** Guest envia respuesta encriptada, servidor la recibe.

**Tareas:**
1. Crear `backend/attendance/` con estructura vertical slicing:
   - `domain/models.ts`
   - `presentation/attendance.controller.ts`
2. Implementar `POST /api/attendance/validate` (solo log)
3. Guest construye y envia respuesta:
   - `buildResponse(payload): ResponsePayload`
   - `encryptResponse(response, key): EncryptedResponse`
   - `sendToServer(encrypted): Promise<Result>`
4. Crear `/scripts/test-fase6.sh`

**Criterio de Aceptacion:**
- [ ] Guest envia POST al escanear
- [ ] Server loguea recepcion
- [ ] Respuesta tiene campos requeridos

---

### FASE 7: Validacion Server
**Duracion:** 4-5 horas  
**Riesgo:** Alto

**Objetivo:** Server valida respuesta completa.

**Tareas:**
1. Crear `attendance/domain/response-decryptor.ts`
   - `decrypt(encrypted, key): ResponsePayload`
2. Crear `attendance/domain/validators/`
   - `totp.validator.ts` - `validateTOTPs(token, context): boolean`
   - `timing.validator.ts` - `validateRT(rt): boolean`
3. Crear `attendance/application/validate.usecase.ts`
   - `execute(encrypted): ValidationResult`
4. Crear `attendance/domain/rt-calculator.ts`
   - `calculate(t_tx, timestamp_envio): number`
5. Almacenar RTs en memoria (Map temporal)
6. Crear `/scripts/test-fase7.sh`

**Criterio de Aceptacion:**
- [ ] Server desencripta respuesta
- [ ] Valida TOTPs correctamente
- [ ] Calcula RT
- [ ] Despues de N rondas, indica completado

---

### FASE 8: Persistencia PostgreSQL
**Duracion:** 3-4 horas  
**Riesgo:** Medio

**Objetivo:** Ejecutar migracion y persistir en BD.

**Tareas:**
1. Verificar/ejecutar `001-initial-schema.sql`
2. Crear `attendance/infrastructure/postgres-attendance.repository.ts`
   - `saveValidation(validation): Promise<void>`
   - `getValidationsByRegistration(id): Promise<Validation[]>`
   - `saveResult(result): Promise<void>`
3. Crear `attendance/domain/certainty-calculator.ts`
   - `calculate(rts): CertaintyResult`
   - `determineStatus(certainty): AttendanceStatus`
4. Integrar repository en usecase
5. Crear `/scripts/test-fase8.sh`

**Criterio de Aceptacion:**
- [ ] Schemas existen en PostgreSQL
- [ ] Validaciones se guardan en BD
- [ ] Resultado final con certeza calculada

---

## Fase Final: Enrolamiento FIDO2 + ECDH

Ver analisis detallado en: [ANALISIS-ENROLAMIENTO-ECDH.md](ANALISIS-ENROLAMIENTO-ECDH.md)

### FASE 9: Enrolamiento FIDO2
**Duracion:** 5-6 horas  
**Riesgo:** Alto

**Objetivo:** Implementar enrolamiento WebAuthn real.

**Tareas:**
1. Integrar `@simplewebauthn/server`
2. Implementar `enrollment/domain/webauthn.service.ts`
   - `generateRegistrationOptions(user): Options`
   - `verifyRegistration(credential, challenge): Result`
3. Implementar `enrollment/domain/credential-validator.ts`
   - `validateChallenge(received, stored): boolean`
   - `validateOrigin(origin): boolean`
   - `extractPublicKey(attestation): PublicKey`
4. Persistir en `enrollment.devices`
5. Crear `/scripts/test-fase9.sh`

**Criterio de Aceptacion:**
- [ ] Usuario puede enrolar dispositivo con biometria
- [ ] Credencial se almacena en BD
- [ ] Re-enrolamiento detecta dispositivo previo

---

### FASE 10: ECDH Key Exchange
**Duracion:** 4-5 horas  
**Riesgo:** Alto

**Objetivo:** Derivar session_key sin transmitirla.

**Tareas:**
1. Crear `shared/crypto/ecdh.service.ts`
   - `generateKeyPair(): { privateKey, publicKey }`
   - `deriveSharedSecret(privateKey, peerPublicKey): Buffer`
2. Crear `enrollment/domain/session-manager.ts`
   - `initiateKeyExchange(userId): { serverPublicKey, challenge }`
   - `completeKeyExchange(clientPublicKey, assertion): session_key`
3. Actualizar Guest para ECDH
4. Reemplazar MOCK_SESSION_KEY por session_key real
5. Crear `/scripts/test-fase10.sh`

**Criterio de Aceptacion:**
- [ ] Cliente y servidor derivan misma session_key
- [ ] session_key nunca se transmite
- [ ] Payloads se encriptan con session_key derivada

---

### FASE 11: TOTPu basado en session_key
**Duracion:** 2-3 horas  
**Riesgo:** Bajo

**Objetivo:** TOTPu calculable por ambos lados.

**Tareas:**
1. Modificar `totp.service.ts`
   - `generateTOTPu(sessionKey): string`
   - `verifyTOTPu(token, sessionKey): boolean`
2. Cliente genera TOTPu en cada respuesta
3. Server valida TOTPu
4. Crear `/scripts/test-fase11.sh`

**Criterio de Aceptacion:**
- [ ] Ambos generan mismo TOTPu
- [ ] TOTPu cambia cada 30 segundos
- [ ] Validacion rechaza TOTPu incorrecto

---

### FASE 12: Penalizaciones
**Duracion:** 3-4 horas  
**Riesgo:** Medio

**Objetivo:** Sistema de penalizacion por re-enrolamiento.

**Tareas:**
1. Crear `enrollment/domain/penalty.service.ts`
   - `calculateDelay(deviceCount): number`
   - `applyPenalty(userId): void`
2. Crear `enrollment/infrastructure/penalty.repository.ts`
3. Integrar con flujo de enrolamiento
4. Crear `/scripts/test-fase12.sh`

**Criterio de Aceptacion:**
- [ ] Primer dispositivo: sin delay
- [ ] Segundo dispositivo: 5 min delay
- [ ] Tercer dispositivo: 30 min delay
- [ ] Cuarto+: exponencial

---

## Resumen de Fases

| Fase | Duracion | Riesgo | Dependencias |
|------|----------|--------|--------------|
| 0 | 30 min | Ninguno | - |
| 1 | 2-3h | Bajo | 0 |
| 2 | 3-4h | Bajo | 1 |
| 3 | 3-4h | Medio | 0 |
| 4 | 3-4h | Medio | 1, 3 |
| 5 | 2-3h | Bajo | 3, 4 |
| 6 | 3-4h | Medio | 2, 4 |
| 7 | 4-5h | Alto | 5, 6 |
| 8 | 3-4h | Medio | 7 |
| 9 | 5-6h | Alto | 3 |
| 10 | 4-5h | Alto | 9 |
| 11 | 2-3h | Bajo | 10 |
| 12 | 3-4h | Medio | 9 |

**Total estimado:** 40-50 horas

---

## Orden de Ejecucion

```
FASE ACTUAL (Core Asistencia):
  0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

FASE FINAL (Enrolamiento):
  9 -> 10 -> 11 -> 12
```

---

## Notas

- Fases 0-8 usan MOCK_SESSION_KEY para desarrollo
- Fases 9-12 reemplazan mock por criptografia real
- Cada fase es testeable de forma independiente
- Scripts de test en `/scripts/` pueden eliminarse al finalizar
