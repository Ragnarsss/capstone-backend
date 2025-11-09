-- ============================================================================
-- MIGRATION: 001-initial-schema.sql
-- ============================================================================
-- Description: Initial database schema for Asistencia system
-- Version: 1.0.0
-- Date: 2025-11-09
-- Author: Development Team
-- Dependencies: PostgreSQL 18+
-- Normalization: 3NF (Third Normal Form)
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENROLLMENT SCHEMA
-- ============================================================================
-- Purpose: Manages FIDO2 device enrollment and registration
-- Tables:
--   - enrollment.devices: FIDO2 enrolled devices
--   - enrollment.enrollment_history: Audit log for enrollment actions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Create enrollment schema
-- ----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS enrollment;

COMMENT ON SCHEMA enrollment IS 'Gestión de dispositivos FIDO2 enrolados';

-- ----------------------------------------------------------------------------
-- 1.2 Create enrollment.devices table
-- ----------------------------------------------------------------------------
-- Purpose: Store FIDO2 device credentials and metadata
-- Normalization: 3NF
--   - PK: device_id (unique identifier)
--   - All non-key attributes depend only on PK
--   - No transitive dependencies
-- ----------------------------------------------------------------------------

CREATE TABLE enrollment.devices (
  device_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  handshake_secret TEXT NOT NULL,
  aaguid TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  attestation_format TEXT,
  sign_count INTEGER DEFAULT 0,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- ----------------------------------------------------------------------------
-- 1.3 Create indexes for enrollment.devices
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX idx_devices_credential_id ON enrollment.devices(credential_id);
CREATE INDEX idx_devices_user_id ON enrollment.devices(user_id);
CREATE INDEX idx_devices_aaguid ON enrollment.devices(aaguid);
CREATE INDEX idx_devices_active ON enrollment.devices(is_active) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- 1.4 Create comments for enrollment.devices
-- ----------------------------------------------------------------------------

COMMENT ON TABLE enrollment.devices IS 'Dispositivos FIDO2/WebAuthn enrolados por usuarios';

COMMENT ON COLUMN enrollment.devices.device_id IS 'PK auto-incremental única por dispositivo';
COMMENT ON COLUMN enrollment.devices.user_id IS 'FK a sistema legacy (no manejado aquí)';
COMMENT ON COLUMN enrollment.devices.credential_id IS 'ID único de la credencial WebAuthn (base64)';
COMMENT ON COLUMN enrollment.devices.public_key IS 'Clave pública ECDSA P-256 en formato PEM';
COMMENT ON COLUMN enrollment.devices.handshake_secret IS 'Secret derivado con HKDF para generación de TOTPu';
COMMENT ON COLUMN enrollment.devices.aaguid IS 'Authenticator Attestation GUID (identifica modelo)';
COMMENT ON COLUMN enrollment.devices.device_fingerprint IS 'Fingerprint del navegador/dispositivo';
COMMENT ON COLUMN enrollment.devices.attestation_format IS 'Formato de attestation (packed, fido-u2f, etc.)';
COMMENT ON COLUMN enrollment.devices.sign_count IS 'Contador de firmas (anti-clonación)';
COMMENT ON COLUMN enrollment.devices.enrolled_at IS 'Timestamp de enrollment inicial';
COMMENT ON COLUMN enrollment.devices.last_used_at IS 'Timestamp de último uso del dispositivo';
COMMENT ON COLUMN enrollment.devices.is_active IS 'Estado activo del dispositivo (true/false)';

-- ----------------------------------------------------------------------------
-- 1.5 Create enrollment.enrollment_history table
-- ----------------------------------------------------------------------------
-- Purpose: Audit log for enrollment actions
-- Normalization: 3NF
--   - PK: history_id (unique identifier)
--   - FK: device_id to enrollment.devices (nullable for failed enrollments)
--   - metadata JSONB justified for unstructured audit data
-- ----------------------------------------------------------------------------

CREATE TABLE enrollment.enrollment_history (
  history_id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES enrollment.devices(device_id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('enrolled', 'revoked', 're-enrolled', 'updated')),
  reason TEXT,
  performed_at TIMESTAMP DEFAULT NOW(),
  performed_by INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ----------------------------------------------------------------------------
-- 1.6 Create indexes for enrollment.enrollment_history
-- ----------------------------------------------------------------------------

CREATE INDEX idx_enrollment_history_device ON enrollment.enrollment_history(device_id);
CREATE INDEX idx_enrollment_history_user ON enrollment.enrollment_history(user_id);
CREATE INDEX idx_enrollment_history_performed_at ON enrollment.enrollment_history(performed_at DESC);
CREATE INDEX idx_enrollment_history_action ON enrollment.enrollment_history(action);

-- ----------------------------------------------------------------------------
-- 1.7 Create comments for enrollment.enrollment_history
-- ----------------------------------------------------------------------------

COMMENT ON TABLE enrollment.enrollment_history IS 'Auditoría de eventos de enrollment y re-enrollment';

COMMENT ON COLUMN enrollment.enrollment_history.history_id IS 'PK auto-incremental única por evento';
COMMENT ON COLUMN enrollment.enrollment_history.device_id IS 'FK a enrollment.devices (nullable para enrollments fallidos)';
COMMENT ON COLUMN enrollment.enrollment_history.user_id IS 'ID del usuario afectado';
COMMENT ON COLUMN enrollment.enrollment_history.action IS 'Tipo de evento: enrolled, revoked, re-enrolled, updated';
COMMENT ON COLUMN enrollment.enrollment_history.reason IS 'Razón del evento (texto libre)';
COMMENT ON COLUMN enrollment.enrollment_history.performed_at IS 'Timestamp del evento';
COMMENT ON COLUMN enrollment.enrollment_history.performed_by IS 'userId del actor que ejecutó la acción';
COMMENT ON COLUMN enrollment.enrollment_history.metadata IS 'Datos adicionales en formato JSONB (datos no estructurados de auditoría)';

-- ============================================================================
-- SECTION 2: ATTENDANCE SCHEMA
-- ============================================================================
-- Purpose: Manages attendance sessions and validation process
-- Tables:
--   - attendance.sessions: Professor-created attendance sessions
--   - attendance.registrations: Student participation announcements
--   - attendance.validations: Individual validation rounds (FN3)
--   - attendance.results: Final consolidated attendance results
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Create attendance schema
-- ----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS attendance;

COMMENT ON SCHEMA attendance IS 'Gestión de sesiones de asistencia y validaciones';

-- ----------------------------------------------------------------------------
-- 2.2 Create attendance.sessions table
-- ----------------------------------------------------------------------------
-- Purpose: Store professor-initiated attendance sessions
-- Normalization: 3NF
--   - PK: session_id (unique identifier)
--   - Course data denormalized for performance (justified)
--   - No transitive dependencies
-- ----------------------------------------------------------------------------

CREATE TABLE attendance.sessions (
  session_id SERIAL PRIMARY KEY,
  professor_id INTEGER NOT NULL,
  professor_name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  room TEXT NOT NULL,
  semester TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  max_rounds INTEGER DEFAULT 3 CHECK (max_rounds BETWEEN 1 AND 10),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2.3 Create indexes for attendance.sessions
-- ----------------------------------------------------------------------------

CREATE INDEX idx_sessions_professor ON attendance.sessions(professor_id);
CREATE INDEX idx_sessions_status ON attendance.sessions(status);
CREATE INDEX idx_sessions_start_time ON attendance.sessions(start_time DESC);
CREATE INDEX idx_sessions_course ON attendance.sessions(course_code);
CREATE INDEX idx_sessions_semester ON attendance.sessions(semester);

-- ----------------------------------------------------------------------------
-- 2.4 Create comments for attendance.sessions
-- ----------------------------------------------------------------------------

COMMENT ON TABLE attendance.sessions IS 'Sesiones de asistencia (clases) creadas por profesores';

COMMENT ON COLUMN attendance.sessions.session_id IS 'PK auto-incremental única por sesión';
COMMENT ON COLUMN attendance.sessions.professor_id IS 'FK a sistema legacy (ID del profesor)';
COMMENT ON COLUMN attendance.sessions.professor_name IS 'Nombre del profesor (desnormalizado para performance)';
COMMENT ON COLUMN attendance.sessions.course_code IS 'Código de la asignatura';
COMMENT ON COLUMN attendance.sessions.course_name IS 'Nombre de la asignatura (desnormalizado)';
COMMENT ON COLUMN attendance.sessions.room IS 'Sala/aula donde se realiza la clase';
COMMENT ON COLUMN attendance.sessions.semester IS 'Semestre académico (e.g., 2025-1)';
COMMENT ON COLUMN attendance.sessions.start_time IS 'Timestamp de inicio de la sesión';
COMMENT ON COLUMN attendance.sessions.end_time IS 'Timestamp de fin de la sesión (nullable hasta que se cierre)';
COMMENT ON COLUMN attendance.sessions.max_rounds IS 'Número de rondas de validación requeridas (1-10)';
COMMENT ON COLUMN attendance.sessions.status IS 'Estado de la sesión: active, closed, cancelled';
COMMENT ON COLUMN attendance.sessions.created_at IS 'Timestamp de creación del registro';

-- ----------------------------------------------------------------------------
-- 2.5 Create attendance.registrations table
-- ----------------------------------------------------------------------------
-- Purpose: Store student participation announcements
-- Normalization: 3NF
--   - PK: registration_id (unique identifier)
--   - FK: session_id, device_id
--   - UNIQUE(session_id, user_id): One registration per user per session
-- ----------------------------------------------------------------------------

CREATE TABLE attendance.registrations (
  registration_id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES attendance.sessions(session_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  device_id INTEGER REFERENCES enrollment.devices(device_id) ON DELETE SET NULL,
  queue_position INTEGER NOT NULL,
  registered_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'processing', 'completed', 'failed')),

  UNIQUE(session_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 2.6 Create indexes for attendance.registrations
-- ----------------------------------------------------------------------------

CREATE INDEX idx_registrations_session ON attendance.registrations(session_id);
CREATE INDEX idx_registrations_user ON attendance.registrations(user_id);
CREATE INDEX idx_registrations_status ON attendance.registrations(status);
CREATE INDEX idx_registrations_queue ON attendance.registrations(session_id, queue_position);
CREATE INDEX idx_registrations_device ON attendance.registrations(device_id);

-- ----------------------------------------------------------------------------
-- 2.7 Create comments for attendance.registrations
-- ----------------------------------------------------------------------------

COMMENT ON TABLE attendance.registrations IS 'Anuncios de participación de estudiantes en sesiones';

COMMENT ON COLUMN attendance.registrations.registration_id IS 'PK auto-incremental única por registro';
COMMENT ON COLUMN attendance.registrations.session_id IS 'FK a attendance.sessions (ON DELETE CASCADE)';
COMMENT ON COLUMN attendance.registrations.user_id IS 'ID del estudiante que se registra';
COMMENT ON COLUMN attendance.registrations.device_id IS 'FK a enrollment.devices (nullable si no tiene dispositivo enrolado)';
COMMENT ON COLUMN attendance.registrations.queue_position IS 'Posición en cola de proyección (orden de llegada)';
COMMENT ON COLUMN attendance.registrations.registered_at IS 'Timestamp de registro';
COMMENT ON COLUMN attendance.registrations.status IS 'Estado: active, processing, completed, failed';

-- ----------------------------------------------------------------------------
-- 2.8 Create attendance.validations table
-- ----------------------------------------------------------------------------
-- Purpose: Store individual validation round data (FN3 protocol)
-- Normalization: 3NF strict
--   - PK: validation_id (unique identifier)
--   - FK: registration_id
--   - UNIQUE(registration_id, round_number): One validation per round
--   - All fields depend only on PK, no transitive dependencies
-- ----------------------------------------------------------------------------

CREATE TABLE attendance.validations (
  validation_id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES attendance.registrations(registration_id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),

  -- Timestamps
  qr_generated_at TIMESTAMP NOT NULL,
  qr_scanned_at TIMESTAMP,
  response_received_at TIMESTAMP,

  -- Calculated times
  response_time_ms INTEGER CHECK (response_time_ms >= 0),

  -- Validations
  totpu_valid BOOLEAN,
  totps_valid BOOLEAN,
  rt_valid BOOLEAN,
  secret_valid BOOLEAN,

  -- Status
  validation_status TEXT CHECK (validation_status IN ('success', 'failed', 'timeout', 'invalid')),
  failed_attempts INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(registration_id, round_number)
);

-- ----------------------------------------------------------------------------
-- 2.9 Create indexes for attendance.validations
-- ----------------------------------------------------------------------------

CREATE INDEX idx_validations_registration ON attendance.validations(registration_id);
CREATE INDEX idx_validations_round ON attendance.validations(registration_id, round_number);
CREATE INDEX idx_validations_status ON attendance.validations(validation_status);
CREATE INDEX idx_validations_created_at ON attendance.validations(created_at DESC);

-- ----------------------------------------------------------------------------
-- 2.10 Create comments for attendance.validations
-- ----------------------------------------------------------------------------

COMMENT ON TABLE attendance.validations IS 'Validaciones individuales por ronda (una fila por ronda)';

COMMENT ON COLUMN attendance.validations.validation_id IS 'PK auto-incremental única por validación';
COMMENT ON COLUMN attendance.validations.registration_id IS 'FK a attendance.registrations (ON DELETE CASCADE)';
COMMENT ON COLUMN attendance.validations.round_number IS 'Número de ronda (1, 2, 3, ..., max_rounds)';
COMMENT ON COLUMN attendance.validations.qr_generated_at IS 'Timestamp de generación del QR';
COMMENT ON COLUMN attendance.validations.qr_scanned_at IS 'Timestamp de escaneo del QR (nullable hasta escaneo)';
COMMENT ON COLUMN attendance.validations.response_received_at IS 'Timestamp de recepción de respuesta (nullable hasta respuesta)';
COMMENT ON COLUMN attendance.validations.response_time_ms IS 'Tiempo de respuesta en milisegundos (RT)';
COMMENT ON COLUMN attendance.validations.totpu_valid IS 'TOTP de usuario válido (true/false)';
COMMENT ON COLUMN attendance.validations.totps_valid IS 'TOTP de sistema válido (true/false)';
COMMENT ON COLUMN attendance.validations.rt_valid IS 'Response time válido (true/false)';
COMMENT ON COLUMN attendance.validations.secret_valid IS 'Handshake secret válido (true/false)';
COMMENT ON COLUMN attendance.validations.validation_status IS 'Resultado: success, failed, timeout, invalid';
COMMENT ON COLUMN attendance.validations.failed_attempts IS 'Número de intentos fallidos en esta ronda';
COMMENT ON COLUMN attendance.validations.created_at IS 'Timestamp de creación del registro';

-- ----------------------------------------------------------------------------
-- 2.11 Create attendance.results table
-- ----------------------------------------------------------------------------
-- Purpose: Store final consolidated attendance results
-- Normalization: 3NF
--   - PK: result_id (unique identifier)
--   - FK: registration_id (UNIQUE: one result per registration)
--   - Aggregated statistics derived from validations (not redundant)
--   - No transitive dependencies
-- ----------------------------------------------------------------------------

CREATE TABLE attendance.results (
  result_id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES attendance.registrations(registration_id) ON DELETE CASCADE,

  -- Statistics calculated from validations
  total_rounds INTEGER NOT NULL CHECK (total_rounds >= 0),
  successful_rounds INTEGER NOT NULL CHECK (successful_rounds >= 0),
  failed_rounds INTEGER NOT NULL DEFAULT 0,

  avg_response_time_ms FLOAT CHECK (avg_response_time_ms >= 0),
  std_dev_response_time FLOAT CHECK (std_dev_response_time >= 0),
  min_response_time_ms FLOAT CHECK (min_response_time_ms >= 0),
  max_response_time_ms FLOAT CHECK (max_response_time_ms >= 0),
  median_response_time_ms FLOAT CHECK (median_response_time_ms >= 0),

  -- Final result
  certainty_score FLOAT NOT NULL CHECK (certainty_score BETWEEN 0 AND 100),
  final_status TEXT NOT NULL CHECK (final_status IN ('PRESENT', 'ABSENT', 'DOUBTFUL', 'ERROR')),

  calculated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(registration_id)
);

-- ----------------------------------------------------------------------------
-- 2.12 Create indexes for attendance.results
-- ----------------------------------------------------------------------------

CREATE INDEX idx_results_registration ON attendance.results(registration_id);
CREATE INDEX idx_results_status ON attendance.results(final_status);
CREATE INDEX idx_results_certainty ON attendance.results(certainty_score DESC);
CREATE INDEX idx_results_calculated_at ON attendance.results(calculated_at DESC);

-- ----------------------------------------------------------------------------
-- 2.13 Create comments for attendance.results
-- ----------------------------------------------------------------------------

COMMENT ON TABLE attendance.results IS 'Resultado final consolidado con estadísticas';

COMMENT ON COLUMN attendance.results.result_id IS 'PK auto-incremental única por resultado';
COMMENT ON COLUMN attendance.results.registration_id IS 'FK a attendance.registrations (UNIQUE, ON DELETE CASCADE)';
COMMENT ON COLUMN attendance.results.total_rounds IS 'Total de rondas configuradas';
COMMENT ON COLUMN attendance.results.successful_rounds IS 'Número de rondas exitosas';
COMMENT ON COLUMN attendance.results.failed_rounds IS 'Número de rondas fallidas';
COMMENT ON COLUMN attendance.results.avg_response_time_ms IS 'Promedio de tiempo de respuesta';
COMMENT ON COLUMN attendance.results.std_dev_response_time IS 'Desviación estándar del tiempo de respuesta';
COMMENT ON COLUMN attendance.results.min_response_time_ms IS 'Tiempo de respuesta mínimo';
COMMENT ON COLUMN attendance.results.max_response_time_ms IS 'Tiempo de respuesta máximo';
COMMENT ON COLUMN attendance.results.median_response_time_ms IS 'Mediana del tiempo de respuesta';
COMMENT ON COLUMN attendance.results.certainty_score IS 'Umbral de certeza (0-100). >= 70% = PRESENTE';
COMMENT ON COLUMN attendance.results.final_status IS 'Resultado final: PRESENT, ABSENT, DOUBTFUL, ERROR';
COMMENT ON COLUMN attendance.results.calculated_at IS 'Timestamp de cálculo del resultado';

-- ============================================================================
-- SECTION 3: NORMALIZATION VERIFICATION
-- ============================================================================
-- All tables satisfy 3NF (Third Normal Form):
--
-- enrollment.devices:
--   ✓ PK: device_id
--   ✓ All non-key attributes depend only on device_id
--   ✓ No transitive dependencies
--
-- enrollment.enrollment_history:
--   ✓ PK: history_id
--   ✓ FK: device_id (nullable)
--   ✓ JSONB metadata justified for unstructured audit data
--   ✓ No transitive dependencies
--
-- attendance.sessions:
--   ✓ PK: session_id
--   ✓ Course data denormalized for performance (justified)
--   ✓ No transitive dependencies
--
-- attendance.registrations:
--   ✓ PK: registration_id
--   ✓ FK: session_id, device_id
--   ✓ UNIQUE(session_id, user_id)
--   ✓ No transitive dependencies
--
-- attendance.validations:
--   ✓ PK: validation_id
--   ✓ FK: registration_id
--   ✓ UNIQUE(registration_id, round_number)
--   ✓ All fields depend only on validation_id
--   ✓ No transitive dependencies
--
-- attendance.results:
--   ✓ PK: result_id
--   ✓ FK: registration_id (UNIQUE)
--   ✓ Aggregated statistics derived from validations
--   ✓ No transitive dependencies
--
-- 4NF consideration: Not needed
--   - No multivalued dependencies exist
--   - 3NF is sufficient for this domain
-- ============================================================================

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
