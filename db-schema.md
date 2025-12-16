# Esquemas de Base de Datos

## PostgreSQL - Estructura Relacional

```mermaid
erDiagram
    DEVICES ||--o{ ENROLLMENT_HISTORY : "audita"
    DEVICES ||--o{ REGISTRATIONS : "usa"
    SESSIONS ||--|{ REGISTRATIONS : "contiene"
    REGISTRATIONS ||--|{ VALIDATIONS : "valida_en"
    REGISTRATIONS ||--|| RESULTS : "produce"

    DEVICES {
        serial device_id PK
        int user_id
        text credential_id UK
        text public_key
        text handshake_secret
        text aaguid
        text device_fingerprint
        text attestation_format
        int sign_count
        timestamp enrolled_at
        timestamp last_used_at
        bool is_active
        text transports
        text status "pending|enrolled|revoked"
    }

    ENROLLMENT_HISTORY {
        serial history_id PK
        int device_id FK
        int user_id
        text action "enrolled|revoked"
        timestamp performed_at
    }

    SESSIONS {
        serial session_id PK
        int professor_id
        text course_code
        int max_rounds
        text status "active|closed"
        timestamp start_time
    }

    REGISTRATIONS {
        serial registration_id PK
        int session_id FK
        int user_id
        int device_id FK
        int queue_position
        text status "active|completed"
    }

    VALIDATIONS {
        serial validation_id PK
        int registration_id FK
        int round_number
        timestamp qr_generated_at
        int response_time_ms
        bool totpu_valid
        text validation_status "success|failed"
    }

    RESULTS {
        serial result_id PK
        int registration_id FK "UK"
        int total_rounds
        int successful_rounds
        float certainty_score
        text final_status "PRESENT|ABSENT"
    }
```

## Valkey (Redis) - Estructura Key-Value

```mermaid
graph TB
    subgraph ENROLLMENT["ENROLLMENT DOMAIN"]
        EC["enrollment:challenge:{userId}<br/>TTL: 5min<br/>────<br/>{challenge, userId, createdAt}"]
    end

    subgraph SESSION["SESSION DOMAIN"]
        SK["session:{userId}:key<br/>TTL: 2h<br/>────<br/>{sessionKey, deviceId, createdAt}"]
    end

    subgraph ATTENDANCE["ATTENDANCE DOMAIN"]
        SS["student:session:{sessionId}:{studentId}<br/>TTL: 2h renovable<br/>────<br/>{currentRound, roundsCompleted,<br/>currentAttempt, activeQRNonce}"]
        
        SC["session:config:{sessionId}<br/>────<br/>{maxRounds, maxAttempts, qrTTL}"]
        
        SST["session:students:{sessionId}<br/>SET<br/>────<br/>{studentId1, studentId2, ...}"]
    end

    subgraph FRAUD["FRAUD METRICS"]
        FM["fraud:{sessionId}:count:{type}<br/>────<br/>counter"]
        
        FA["fraud:{sessionId}:attempts<br/>────<br/>counter"]
        
        FS["fraud:{sessionId}:students<br/>SET<br/>────<br/>{studentId1, ...}"]
    end

    style EC fill:#e1f5ff
    style SK fill:#ffe1f5
    style SS fill:#fff5e1
    style SC fill:#fff5e1
    style SST fill:#fff5e1
    style FM fill:#ffe1e1
    style FA fill:#ffe1e1
    style FS fill:#ffe1e1
```

---

## Schemas PostgreSQL

### Schema: `enrollment`
- **devices**: Dispositivos FIDO2 enrolados
- **enrollment_history**: Auditoría de acciones de enrollment

### Schema: `attendance`
- **sessions**: Sesiones de clase creadas por profesores
- **registrations**: Anuncios de participación de estudiantes
- **validations**: Validaciones individuales por ronda (FN3)
- **results**: Resultados finales consolidados

---

## Patrones de Clave Valkey

### Enrollment
- `enrollment:challenge:{userId}` - Challenge WebAuthn temporal (TTL: 5min)

### Session
- `session:{userId}:key` - Session key ECDH (TTL: 2h)

### Attendance
- `student:session:{sessionId}:{studentId}` - Estado de rounds e intentos por estudiante
- `session:config:{sessionId}` - Configuración de sesión (maxRounds, maxAttempts)
- `session:students:{sessionId}` - SET de estudiantes participantes

### Fraud Detection
- `fraud:{sessionId}:count:{type}` - Contadores de eventos de fraude
- `fraud:{sessionId}:attempts` - Contador de intentos totales
- `fraud:{sessionId}:students` - SET de estudiantes con actividad
