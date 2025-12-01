# Diagramas de Secuencia

---

## Índice

1. [Enrolamiento Completo](#enrolamiento-completo)
2. [Login ECDH](#login-ecdh)
3. [Registro en Sesión](#registro-en-sesión)
4. [Ciclo Completo N Rondas](#ciclo-completo-n-rondas)
5. [Validación de Ronda](#validación-de-ronda)
6. [Manejo de Errores](#manejo-de-errores)

---

## Enrolamiento Completo

```mermaid
sequenceDiagram
    participant U as Usuario
    participant B as Browser
    participant P as PHP Service
    participant E as Módulo Enrolamiento
    participant DB as PostgreSQL

    Note over U,DB: Fase 1: Solicitud
    U->>B: Click "Enrolar Dispositivo"
    B->>P: POST /api/enrollment/start
    P->>E: Forward request {userId, username}
    
    Note over E: Genera challenge
    E->>E: challenge = crypto.randomBytes(32)
    E->>E: Store in session (TTL 5min)
    E->>P: {challenge, options}
    P->>B: Return challenge + options

    Note over B,U: Fase 2: Generación Credenciales
    B->>U: Solicita biometría/PIN
    U->>B: Proporciona autenticación
    
    Note over B: WebAuthn API
    B->>B: navigator.credentials.create()
    B->>B: Autenticador genera par ECDSA P-256
    B->>B: privateKey->Secure Enclave (NO sale)
    B->>B: publicKey + credentialId + attestation

    Note over B,E: Fase 3: Envío y Validación
    B->>P: POST /api/enrollment/finish {credential}
    P->>E: Forward credential
    
    E->>E: Valida challenge
    E->>E: Valida origin
    E->>E: Decodifica attestationObject
    E->>E: Extrae publicKey
    E->>E: Verifica attestation
    E->>E: Valida AAGUID
    
    Note over E: Fase 4: Almacenamiento de Credenciales
    E->>E: device_fingerprint = SHA256(...)

    Note over E,DB: Fase 5: Almacenamiento
    E->>DB: INSERT INTO enrollment.devices (publicKey, credentialId, aaguid)
    DB-->>E: device_id
    E->>DB: INSERT INTO enrollment_history
    
    E->>P: {success: true, deviceId}
    P->>B: Success response
    B->>U: "Dispositivo enrolado exitosamente"
```

---

## Login ECDH

```mermaid
sequenceDiagram
    participant U as Usuario
    participant B as Browser
    participant P as PHP Service
    participant E as Módulo Enrolamiento
    participant DB as PostgreSQL

    Note over U: Usuario ya enrolado
    U->>B: Click "Iniciar Sesión"
    
    Note over B: Fase 1: Generar Par ECDH Cliente
    B->>B: (privKey_c, pubKey_c) = generateECDHPair()
    B->>B: Mantiene privKey_c en memoria
    
    Note over B: Fase 2: WebAuthn Assertion
    B->>U: Solicita autenticación
    U->>B: Biometría/PIN
    B->>B: assertion = navigator.credentials.get()
    
    Note over B,P: Fase 3: Envío
    B->>P: POST /api/enrollment/login
    P->>E: {pubKey_c, assertion, userId}

    Note over E: Fase 4: Validación Assertion
    E->>DB: SELECT credential WHERE userId
    DB-->>E: {credentialId, publicKey}
    
    E->>E: Verifica assertion.signature con publicKey
    E->>E: Valida challenge, origin
    
    Note over E: Fase 5: ECDH Servidor
    E->>E: (privKey_s, pubKey_s) = generateECDHPair()
    E->>E: shared_secret = ECDH(privKey_s, pubKey_c)
    E->>E: session_key = HKDF(shared_secret)
    Note over E: TOTPu se deriva de session_key (ambos la tienen)
    E->>E: Destruye privKey_s
    
    E->>E: Store session_key (TTL 2h)
    E->>P: {pubKey_s}
    P->>B: Return response

    Note over B: Fase 6: ECDH Cliente
    B->>B: shared_secret = ECDH(privKey_c, pubKey_s)
    B->>B: session_key = HKDF(shared_secret)
    B->>B: TOTPu = TOTP(session_key)
    B->>B: Destruye privKey_c
    
    Note over B,E: Ambos tienen session_key SIN transmitirla
    B->>B: Store session_key
    B->>U: "Sesión iniciada"
```

---

## Registro en Sesión

```mermaid
sequenceDiagram
    participant U as Alumno
    participant B as Browser
    participant P as PHP Service
    participant A as Módulo Asistencia
    participant E as Módulo Enrolamiento
    participant V as Valkey Cache
    participant DB as PostgreSQL

    U->>B: Selecciona sesión + Click "Participar"
    B->>P: POST /api/attendance/register
    P->>A: {userId, sessionId}

    Note over A,E: Verificación Enrolamiento
    A->>E: GET /internal/enrollment/verify/{userId}
    E->>DB: SELECT FROM enrollment.devices
    DB-->>E: {enrolled: true, deviceId, aaguid}
    E-->>A: Device verificado

    alt Dispositivo NO enrolado
        E-->>A: {enrolled: false}
        A-->>P: Error: NOT_ENROLLED
        P-->>B: Error
        B-->>U: "Debes enrolar tu dispositivo"
    else Dispositivo enrolado
        Note over A: Generación Payload Ronda 1
        A->>A: Genera TOTPs único
        A->>A: Crea payload encriptado
        A->>A: timestamp_envio = Date.now()
        
        Note over A,V: Almacenamiento
        A->>V: HSET qr:session:userId:1 metadata (TTL 120s)
        A->>V: LPUSH proyeccion:sessionId payload_enc
        
        A-->>P: {status: "registered", queuePosition: 15}
        P-->>B: Success
        B-->>U: "Registrado, busca tu QR"
        B->>B: Inicia escáner QR
    end
```

---

## Ciclo Completo N Rondas

```mermaid
sequenceDiagram
    participant U as Usuario
    participant B as Browser (Scanner)
    participant WS as WebSocket Proyección
    participant A as Módulo Asistencia
    participant V as Valkey Cache
    participant DB as PostgreSQL

    Note over U: N = 3 rondas

    loop Ronda 1 a N
        Note over WS,V: Rotación Aleatoria
        V->>WS: LRANGE proyeccion:session
        WS->>WS: Selecciona QR aleatorio
        WS->>V: HINCRBY mostrado_count
        WS-->>B: Proyecta QR en pantalla (500ms)

        Note over B: Escaneo Continuo
        B->>B: Decodifica QR
        B->>B: Intenta desencriptar con session_key
        
        alt QR desencripta OK
            B->>B: payload.userId == mi_id?
            alt Es mi QR
                B->>B: Pausar escáner
                B->>B: Crea response con TOTPu
                B->>B: Encripta con session_key
                B->>A: POST /api/attendance/validate

                Note over A: Validación
                A->>A: Desencripta response
                A->>A: Valida TOTPu
                A->>A: Valida TOTPs
                A->>V: GET qr_metadata
                V-->>A: {timestamp_envio, intentos_fallidos}
                A->>A: RT = timestamp_enviado - timestamp_envio
                A->>A: Valida RT (500ms - 15s)

                alt Validación OK
                    A->>DB: INSERT round_time RT
                    A->>V: DEL qr:session:userId:ronda
                    
                    alt ronda < N
                        A->>A: Genera payload ronda+1
                        A->>V: HSET qr:session:userId:(ronda+1)
                        A->>V: LPUSH proyeccion:session payload_enc
                        A-->>B: {success: true, ronda: siguiente}
                        B-->>U: "Ronda validada, busca siguiente"
                        B->>B: Reanudar escáner
                    else ronda == N
                        A->>A: Calcula umbral_certeza
                        alt certeza >= 70%
                            A->>DB: INSERT attendance.records (PRESENTE)
                            A-->>B: {success: true, status: "PRESENTE"}
                            B-->>U: "Asistencia confirmada: PRESENTE"
                        else certeza < 70%
                            A->>DB: INSERT attendance.records (AUSENTE)
                            A-->>B: {success: false, status: "AUSENTE"}
                            B-->>U: "Tiempos inconsistentes: AUSENTE"
                        end
                    end
                else Validación FALLO
                    A->>V: HINCRBY intentos_fallidos
                    alt intentos < MAX
                        A-->>B: {success: false, reintentar: true}
                        B-->>U: "Intento fallido, reintenta"
                        B->>B: Reanudar escáner
                    else intentos >= MAX
                        A->>V: DEL qr:session:userId:ronda
                        A-->>B: {success: false, status: "ERROR"}
                        B-->>U: "Máximo intentos alcanzado"
                    end
                end
            else No es mi QR
                B->>B: Continuar escaneando
            end
        else QR NO desencripta
            B->>B: Continuar escaneando
        end
    end
```

---

## Validación de Ronda

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as Módulo Asistencia
    participant V as Valkey Cache
    participant DB as PostgreSQL

    B->>A: POST /api/attendance/validate {response_enc}
    
    Note over A: Paso 1: Desencriptación
    A->>A: response = AES_GCM_decrypt(input, session_key)
    
    Note over A: Paso 2: Validar TOTPu
    A->>V: GET session_key from Valkey cache
    V-->>A: session_key
    A->>A: TOTPu_expected = TOTP(session_key, T)
    A->>A: Compara response.TOTPu == TOTPu_expected
    
    alt TOTPu inválido
        A-->>B: {error: "SESSION_INVALID"}
    end

    Note over A: Paso 3: Validar TOTPs
    A->>A: secret = SHA256(sessionId||userId||ronda||SECRET)
    A->>A: TOTPs_expected = TOTP(secret, T)
    A->>A: Ventana (-1, 0, +1)
    
    alt TOTPs inválido
        A-->>B: {error: "QR_INVALID"}
    end

    Note over A: Paso 4: Recuperar Metadata
    A->>V: HGET qr:session:userId:ronda
    V-->>A: {timestamp_envio, intentos_fallidos, valido}
    
    alt QR no existe
        A-->>B: {error: "QR_EXPIRED"}
    end

    Note over A: Paso 5: Validar RT
    A->>A: RT = response.timestamp_enviado - metadata.timestamp_envio
    A->>A: Verifica 500 < RT < 15000
    
    alt RT fuera de rango
        A->>V: HINCRBY intentos_fallidos
        A-->>B: {error: "RT_INVALID", reintentar: true}
    end

    Note over A: Paso 6: Validar Secreto
    A->>A: secreto_dec = AES_decrypt(response.secreto, server_key)
    A->>A: Verifica TOTPs y nonce
    
    alt Secreto inválido
        A->>V: HINCRBY intentos_fallidos
        A-->>B: {error: "SECRET_INVALID"}
    end

    Note over A: Paso 7: Todo OK
    A->>DB: INSERT round_time (RT)
    A->>V: HSET qr:...valido false (anti-replay)
    A-->>B: {success: true}
```

---

## Manejo de Errores

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as Módulo Asistencia
    participant V as Valkey Cache
    participant U as Usuario

    alt Error: TOTPu Inválido
        A-->>B: {error: "SESSION_INVALID"}
        B->>U: "Sesión expirada, inicia sesión nuevamente"
        B->>B: Redirect a /login
    end

    alt Error: TOTPs Inválido
        A->>V: HINCRBY intentos_fallidos
        alt intentos < MAX
            A-->>B: {error: "QR_INVALID", reintentar: true}
            B->>U: "QR inválido, reintenta"
        else intentos >= MAX
            A->>V: DEL qr:session:userId:ronda
            A-->>B: {error: "MAX_ATTEMPTS"}
            B->>U: "Máximo intentos alcanzado"
        end
    end

    alt Error: RT Fuera de Rango
        A->>V: HINCRBY intentos_fallidos
        A-->>B: {error: "RT_INVALID"}
        B->>U: "Respuesta muy rápida/lenta, reintenta"
    end

    alt Error: QR Expirado
        A-->>B: {error: "QR_EXPIRED"}
        B->>U: "QR expiró, espera el siguiente"
    end

    alt Error: QR No Capturado
        Note over A: mostrado_count > MAX_DISPLAYS
        A->>B: WebSocket mensaje
        B->>U: "No detectamos tu captura, verifica escáner"
    end
```

---

## Cálculo de Umbral (Final)

```mermaid
graph TD
    A[N Rondas Completadas] --> B[Recuperar RT_array]
    B --> C[Calcular Estadísticas]
    C --> D{std_dev < 500 AND<br/>800 < avg < 3000?}
    
    D -->|Sí| E[certeza = 95%<br/>PRESENTE]
    D -->|No| F{std_dev < 1000 AND<br/>500 < avg < 5000?}
    
    F -->|Sí| G[certeza = 70%<br/>PROBABLE_PRESENTE]
    F -->|No| H{std_dev < 2000 AND<br/>300 < avg < 8000?}
    
    H -->|Sí| I[certeza = 50%<br/>DUDOSO]
    H -->|No| J[certeza = 20%<br/>AUSENTE]
    
    E --> K[INSERT attendance.records]
    G --> K
    I --> K
    J --> K
    
    K --> L[Notificar Usuario]
```

---

## Flujo Completo Simplificado

```mermaid
flowchart TD
    Start([Usuario Accede]) --> Enroll{Dispositivo<br/>Enrolado?}
    Enroll -->|No| EnrollProcess[Proceso Enrolamiento]
    EnrollProcess --> Login
    Enroll -->|Sí| Login[Login ECDH]
    
    Login --> Register[Registro en Sesión]
    Register --> VerifyEnroll{Verificar<br/>Enrolamiento}
    VerifyEnroll -->|No| ErrorEnroll[Error: NO_ENROLLED]
    VerifyEnroll -->|Sí| GenerateR1[Generar Payload R1]
    
    GenerateR1 --> QueueR1[Añadir a Cola Proyección]
    QueueR1 --> LoopStart{Ronda <= N?}
    
    LoopStart -->|Sí| Display[Proyectar QR]
    Display --> Scan[Escanear QR]
    Scan --> Decrypt{Desencripta<br/>y es mío?}
    
    Decrypt -->|No| Display
    Decrypt -->|Sí| Validate[Validar Response]
    
    Validate --> ValidateOK{Validación<br/>OK?}
    ValidateOK -->|No| ErrorHandle{Intentos<br/>< MAX?}
    ErrorHandle -->|Sí| Display
    ErrorHandle -->|No| End([Fin: ERROR])
    
    ValidateOK -->|Sí| SaveRT[Guardar RT]
    SaveRT --> NextRound{ronda < N?}
    
    NextRound -->|Sí| GenerateNext[Generar Payload R+1]
    GenerateNext --> LoopStart
    
    NextRound -->|No| CalcCertainty[Calcular Umbral]
    CalcCertainty --> FinalStatus{certeza >= 70%?}
    
    FinalStatus -->|Sí| Present[PRESENTE]
    FinalStatus -->|No| Absent[AUSENTE]
    
    Present --> End
    Absent --> End
    ErrorEnroll --> End
```

---

**Versión:** 1.0  
**Fecha:** 2025-11-02  
**Estado:** Especificación Técnica
