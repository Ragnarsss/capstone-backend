# Analisis: Enrolamiento FIDO2 + ECDH Key Exchange

**Version:** 1.0  
**Fecha:** 2025-11-27  
**Estado:** Analisis tecnico

---

## Resumen

Este documento analiza la viabilidad del proceso de enrolamiento y como cliente y servidor pueden derivar claves compartidas sin transmitir secretos.

---

## Flujo Criptografico

El sistema tiene **dos fases** de intercambio de claves:

### Fase 1: Enrolamiento (FIDO2/WebAuthn) - Una sola vez

```
ENROLAMIENTO (Una vez por dispositivo)

  Cliente (Dispositivo)              Servidor
  ────────────────────              ────────

  1. Autenticador genera:           1. Envia challenge aleatorio
     - privateKey (NUNCA sale)
     - publicKey
     - credentialId

  2. Envia a servidor:              2. Recibe y valida:
     - publicKey                       - Verifica attestation
     - credentialId                    - Extrae publicKey
     - attestation                     - Almacena en BD

  3. Servidor deriva (NO comparte):
     handshake_secret = HKDF(credentialId + userId + SERVER_MASTER_SECRET)

  [!] El handshake_secret NO se transmite al cliente
  [!] Solo existe en el servidor
```

### Fase 2: Login/Sesion (ECDH) - Cada sesion

```
LOGIN/SESION (Cada vez que el alumno participa)

  Cliente                            Servidor
  ───────                            ────────

  1. Genera par ECDH efimero:       1. Recibe pubKey_cliente
     (privKey_c, pubKey_c)

  2. Firma con WebAuthn:            2. Valida assertion WebAuthn
     assertion = sign(challenge)       (usa publicKey almacenada)

  3. Envia:                         3. Genera par ECDH efimero:
     - pubKey_c                        (privKey_s, pubKey_s)
     - assertion

                                    4. Calcula shared_secret:
                                       = ECDH(privKey_s, pubKey_c)

                                    5. Deriva session_key:
                                       = HKDF(shared_secret)

                                    6. Envia:
                                       - pubKey_s

  4. Calcula shared_secret:
     = ECDH(privKey_c, pubKey_s)

  5. Deriva session_key:
     = HKDF(shared_secret)

  [OK] Ambos tienen session_key SIN haberla transmitido
```

---

## Secretos Compartidos

### Durante Enrolamiento (una vez):

| Dato | Direccion | Proposito |
|------|-----------|-----------|
| `challenge` | Servidor -> Cliente | Evitar replay attacks |
| `publicKey` | Cliente -> Servidor | Verificar firmas futuras |
| `credentialId` | Cliente -> Servidor | Identificar credencial |
| `attestation` | Cliente -> Servidor | Verificar autenticidad del dispositivo |

**Nota:** La `privateKey` NUNCA sale del dispositivo. Esta en el Secure Enclave.

### Durante Cada Sesion (login):

| Dato | Direccion | Proposito |
|------|-----------|-----------|
| `pubKey_cliente` | Cliente -> Servidor | Para ECDH |
| `pubKey_servidor` | Servidor -> Cliente | Para ECDH |
| `assertion` | Cliente -> Servidor | Probar posesion de privateKey |

**Nota:** El `shared_secret` y `session_key` NUNCA se transmiten. Cada parte los calcula independientemente.

---

## Problema Identificado

Hay una inconsistencia en la documentacion respecto al `handshake_secret`:

```
Segun 02-componentes-criptograficos.md:

  handshake_secret = HKDF(credentialId + userId + SERVER_MASTER_SECRET)

  Almacenamiento:
    - PostgreSQL enrollment.devices.handshake_secret  <-- Servidor
    - Cliente: ???  <-- No especificado como lo obtiene
```

### El problema:

El `handshake_secret` se usa para generar `TOTPu` (TOTP del usuario). Pero:

1. El servidor lo deriva usando `SERVER_MASTER_SECRET`
2. El cliente NO tiene `SERVER_MASTER_SECRET`
3. Por lo tanto, el cliente NO puede generar `TOTPu` con ese esquema

---

## Solucion Propuesta

### Opcion Seleccionada: TOTPu basado en session_key

```
TOTPu = TOTP(session_key)

Ventajas:
- session_key existe en ambos lados (derivada de ECDH)
- No requiere compartir secrets adicionales
- Cambia cada sesion (mayor seguridad)
- Perfect Forward Secrecy
```

### Esquema Simplificado

```
ENROLAMIENTO:
  - Cliente genera par ECDSA (privateKey en Secure Enclave)
  - Cliente envia publicKey + credentialId
  - Servidor almacena publicKey
  - Servidor deriva handshake_secret (solo para uso interno)

SESION:
  - ECDH key exchange -> session_key (ambos la tienen)
  - TOTPu = TOTP(session_key) <- Ambos pueden calcularlo
  - TOTPs = TOTP(server_secret) <- Solo servidor genera, cliente valida
  - Payloads encriptados con session_key
```

---

## Roles de Cada Secreto

| Secreto | Ubicacion | Proposito | Duracion |
|---------|-----------|-----------|----------|
| `privateKey` | Secure Enclave cliente | Firmar assertions | Permanente |
| `publicKey` | BD servidor | Verificar firmas | Permanente |
| `handshake_secret` | BD servidor | Uso interno servidor | Permanente |
| `session_key` | Memoria ambos | Encriptar payloads, TOTPu | Por sesion |
| `SERVER_MASTER_SECRET` | Env servidor | Derivar secrets | Rotable |

---

## Seguridad del Esquema

### Perfect Forward Secrecy (PFS)

- Cada sesion usa pares ECDH efimeros
- Compromiso de claves futuras no afecta sesiones pasadas
- Claves privadas ECDH destruidas despues de derivar session_key

### Binding de Dispositivo

- WebAuthn assertion prueba posesion de privateKey
- privateKey nunca sale del Secure Enclave
- AAGUID identifica modelo de autenticador

### Anti-Compartir

- Cada dispositivo tiene credentialId unico
- Re-enrolamiento aplica penalizaciones
- Multiples dispositivos activos generan alertas

---

## Implicaciones para Implementacion

### Fases Actuales (0-8): Usar Mock Key

Durante desarrollo, usamos `MOCK_SESSION_KEY` compartida:
- Permite probar flujo completo sin ECDH
- Simula el resultado final del key exchange
- Facil de reemplazar en fases 9-10

### Fases Finales (9-12): Criptografia Real

1. **Fase 9:** Implementar FIDO2 (generar/almacenar credenciales)
2. **Fase 10:** Implementar ECDH (derivar session_key real)
3. **Fase 11:** TOTPu basado en session_key
4. **Fase 12:** Sistema de penalizaciones

---

## Conclusion

El proceso de enrolamiento es **viable** con las siguientes decisiones:

1. **FIDO2/WebAuthn** para vincular dispositivos
2. **ECDH** para derivar session_key sin transmitirla
3. **TOTPu basado en session_key** (no handshake_secret)
4. **handshake_secret solo en servidor** para uso interno

Este esquema cumple con:
- Secretos nunca transmitidos (excepto publicKey inicial)
- Perfect Forward Secrecy
- Binding de dispositivo via Secure Enclave
- Ambos lados pueden calcular TOTPu independientemente

---

## Referencias

- [02-componentes-criptograficos.md](documents/03-especificaciones-tecnicas/02-componentes-criptograficos.md)
- [03-flujo-enrolamiento.md](documents/03-especificaciones-tecnicas/03-flujo-enrolamiento.md)
- [RFC 5869 - HKDF](https://tools.ietf.org/html/rfc5869)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
