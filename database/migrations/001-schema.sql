-- ============================================================================
-- MIGRATION: 001-schema.sql
-- ============================================================================
-- Description: Consolidated database schema for Asistencia system
-- Version: 2.0.0 (consolidates 001, 002, 003)
-- Date: 2025-12-16
-- Author: Development Team
-- Dependencies: PostgreSQL 18+
-- Normalization: 3NF (Third Normal Form)
-- ============================================================================
-- CHANGELOG:
--   v1.0.0 (001): Initial schema - enrollment and attendance tables
--   v1.0.1 (002): Added transports column to enrollment.devices
--   v1.0.2 (003): Added status column to enrollment.devices
--   v2.0.0: Consolidated all migrations into single schema file
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

COMMENT ON SCHEMA enrollment IS 'Gestion de dispositivos FIDO2 enrolados';

-- ----------------------------------------------------------------------------
-- 1.2 Create enrollment.devices table
-- ----------------------------------------------------------------------------
-- Purpose: Store FIDO2 device credentials and metadata
-- Normalization: 3NF
--   - PK: device_id (unique identifier)
--   - All non-key attributes depend only on PK
--   - No transitive dependencies
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS enrollment.devices (
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
  is_active BOOLEAN DEFAULT TRUE,
  
  -- From migration 002: transports
  transports TEXT,
  
  -- From migration 003: status column for state machine
  status TEXT DEFAULT 'enrolled' CHECK (status IN ('pending', 'enrolled', 'revoked'))
);

-- ----------------------------------------------------------------------------
-- 1.3 Create indexes for enrollment.devices
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_credential_id ON enrollment.devices(credential_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON enrollment.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_aaguid ON enrollment.devices(aaguid);
CREATE INDEX IF NOT EXISTS idx_devices_active ON enrollment.devices(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_devices_status ON enrollment.devices(status);

-- ----------------------------------------------------------------------------
-- 1.4 Create comments for enrollment.devices
-- ----------------------------------------------------------------------------

COMMENT ON TABLE enrollment.devices IS 'Dispositivos FIDO2/WebAuthn enrolados por usuarios';

COMMENT ON COLUMN enrollment.devices.device_id IS 'PK auto-incremental unica por dispositivo';
COMMENT ON COLUMN enrollment.devices.user_id IS 'FK a sistema legacy (no manejado aqui)';
COMMENT ON COLUMN enrollment.devices.credential_id IS 'ID unico de la credencial WebAuthn (base64)';
COMMENT ON COLUMN enrollment.devices.public_key IS 'Clave publica ECDSA P-256 en formato PEM';
COMMENT ON COLUMN enrollment.devices.handshake_secret IS 'Secret derivado con HKDF para generacion de TOTPu';
COMMENT ON COLUMN enrollment.devices.aaguid IS 'Authenticator Attestation GUID (identifica modelo)';
COMMENT ON COLUMN enrollment.devices.device_fingerprint IS 'Fingerprint del navegador/dispositivo';
COMMENT ON COLUMN enrollment.devices.attestation_format IS 'Formato de attestation (packed, fido-u2f, etc.)';
COMMENT ON COLUMN enrollment.devices.sign_count IS 'Contador de firmas (anti-clonacion)';
COMMENT ON COLUMN enrollment.devices.enrolled_at IS 'Timestamp de enrollment inicial';
COMMENT ON COLUMN enrollment.devices.last_used_at IS 'Timestamp de ultimo uso del dispositivo';
COMMENT ON COLUMN enrollment.devices.is_active IS 'Estado activo del dispositivo (true/false)';
COMMENT ON COLUMN enrollment.devices.transports IS 'JSON array of authenticator transports (internal, hybrid, usb, nfc, ble)';
COMMENT ON COLUMN enrollment.devices.status IS 'Estado del enrollment: pending, enrolled, revoked';

-- ----------------------------------------------------------------------------
-- 1.5 Create enrollment.enrollment_history table
-- ----------------------------------------------------------------------------
-- Purpose: Audit log for enrollment actions
-- Normalization: 3NF
--   - PK: history_id (unique identifier)
--   - FK: device_id to enrollment.devices (nullable for failed enrollments)
--   - metadata JSONB justified for unstructured audit data
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS enrollment.enrollment_history (
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

CREATE INDEX IF NOT EXISTS idx_enrollment_history_device ON enrollment.enrollment_history(device_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_user ON enrollment.enrollment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_performed_at ON enrollment.enrollment_history(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_action ON enrollment.enrollment_history(action);

-- ----------------------------------------------------------------------------
-- 1.7 Create comments for enrollment.enrollment_history
-- ----------------------------------------------------------------------------

COMMENT ON TABLE enrollment.enrollment_history IS 'Auditoria de eventos de enrollment y re-enrollment';

COMMENT ON COLUMN enrollment.enrollment_history.history_id IS 'PK auto-incremental unica por evento';
COMMENT ON COLUMN enrollment.enrollment_history.device_id IS 'FK a enrollment.devices (nullable para enrollments fallidos)';
COMMENT ON COLUMN enrollment.enrollment_history.user_id IS 'ID del usuario afectado';
COMMENT ON COLUMN enrollment.enrollment_history.action IS 'Tipo de evento: enrolled, revoked, re-enrolled, updated';
COMMENT ON COLUMN enrollment.enrollment_history.reason IS 'Razon del evento (texto libre)';
COMMENT ON COLUMN enrollment.enrollment_history.performed_at IS 'Timestamp del evento';
COMMENT ON COLUMN enrollment.enrollment_history.performed_by IS 'userId del actor que ejecuto la accion';
COMMENT ON COLUMN enrollment.enrollment_history.metadata IS 'Datos adicionales en formato JSONB (datos no estructurados de auditoria)';

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

COMMENT ON SCHEMA attendance IS 'Gestion de sesiones de asistencia y validaciones';

-- ----------------------------------------------------------------------------
-- 2.2 Create attendance.sessions table
-- ----------------------------------------------------------------------------
-- Purpose: Store professor-initiated attendance sessions
-- Normalization: 3NF
--   - PK: session_id (unique identifier)
--   - Course data denormalized for performance (justified)
--   - No transitive dependencies
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance.sessions (
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

CREATE INDEX IF NOT EXISTS idx_sessions_professor ON attendance.sessions(professor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON attendance.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON attendance.sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON attendance.sessions(course_code);
CREATE INDEX IF NOT EXISTS idx_sessions_semester ON attendance.sessions(semester);

-- ----------------------------------------------------------------------------
-- 2.4 Create comments for attendance.sessions
-- ----------------------------------------------------------------------------

COMMENT ON TABLE attendance.sessions IS 'Sesiones de asistencia (clases) creadas por profesores';

COMMENT ON COLUMN attendance.sessions.session_id IS 'PK auto-incremental unica por sesion';
COMMENT ON COLUMN attendance.sessions.professor_id IS 'FK a sistema legacy (ID del profesor)';
COMMENT ON COLUMN attendance.sessions.professor_name IS 'Nombre del profesor (desnormalizado para performance)';
COMMENT ON COLUMN attendance.sessions.course_code IS 'Codigo de la asignatura';
COMMENT ON COLUMN attendance.sessions.course_name IS 'Nombre de la asignatura (desnormalizado)';
COMMENT ON COLUMN attendance.sessions.room IS 'Sala/aula donde se realiza la clase';
COMMENT ON COLUMN attendance.sessions.semester IS 'Semestre academico (e.g., 2025-1)';
COMMENT ON COLUMN attendance.sessions.start_time IS 'Timestamp de inicio de la sesion';
COMMENT ON COLUMN attendance.sessions.end_time IS 'Timestamp de fin de la sesion (nullable hasta que se cierre)';
COMMENT ON COLUMN attendance.sessions.max_rounds IS 'Numero de rondas de validacion requeridas (1-10)';
COMMENT ON COLUMN attendance.sessions.status IS 'Estado de la sesion: active, closed, cancelled';
COMMENT ON COLUMN attendance.sessions.created_at IS 'Timestamp de creacion del registro';

-- ----------------------------------------------------------------------------
-- 2.5 Create attendance.registrations table
-- ----------------------------------------------------------------------------
-- Purpose: Store student registration in attendance sessions
-- Normalization: 3NF
--   - PK: registration_id (unique identifier)
--   - FK: session_id, device_id
--   - UNIQUE(session_id, user_id): Prevents duplicate registrations
--   - No transitive dependencies
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance.registrations (
  registration_id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES attendance.sessions(session_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  device_id INTEGER NOT NULL REFERENCES enrollment.devices(device_id) ON DELETE CASCADE,
  registered_at TIMESTAMP DEFAULT NOW(),
  ip_address INET NOT NULL,
  user_agent TEXT,

  UNIQUE(session_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 2.6 Create indexes for attendance.registrations
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_registrations_session ON attendance.registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON attendance.registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_device ON attendance.registrations(device_id);
CREATE INDEX IF NOT EXISTS idx_registrations_registered_at ON attendance.registrations(registered_at DESC);

-- ----------------------------------------------------------------------------
-- 2.7 Create comments for attendance.registrations
-- ----------------------------------------------------------------------------

COMMENT ON TABLE attendance.registrations IS 'Registro de estudiantes en sesiones de asistencia';

COMMENT ON COLUMN attendance.registrations.registration_id IS 'PK auto-incremental unica por registro';
COMMENT ON COLUMN attendance.registrations.session_id IS 'FK a attendance.sessions (ON DELETE CASCADE)';
COMMENT ON COLUMN attendance.registrations.user_id IS 'FK a sistema legacy (ID del estudiante)';
COMMENT ON COLUMN attendance.registrations.device_id IS 'FK a enrollment.devices (ON DELETE CASCADE)';
COMMENT ON COLUMN attendance.registrations.registered_at IS 'Timestamp de registro en la sesion';
COMMENT ON COLUMN attendance.registrations.ip_address IS 'IP del cliente (validacion anti-proxy)';
COMMENT ON COLUMN attendance.registrations.user_agent IS 'User agent del navegador';

-- ----------------------------------------------------------------------------
-- 2.8 Create attendance.validations table
-- ----------------------------------------------------------------------------
-- Purpose: Store individual validation rounds (FN3)
-- Normalization: 3NF
--   - PK: validation_id (unique identifier)
--   - FK: registration_id
--   - UNIQUE(registration_id, round_number): One validation per round
--   - No transitive dependencies
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance.validations (
  validation_id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES attendance.registrations(registration_id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number > 0),

  qr_generated_at TIMESTAMP NOT NULL,
  qr_scanned_at TIMESTAMP,
  response_received_at TIMESTAMP,
  response_time_ms FLOAT CHECK (response_time_ms >= 0),

  totpu_valid BOOLEAN,
  totps_valid BOOLEAN,
  rt_valid BOOLEAN,
  secret_valid BOOLEAN,

  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('success', 'failed', 'timeout', 'invalid', 'pending')),
  failed_attempts INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(registration_id, round_number)
);

-- ----------------------------------------------------------------------------
-- 2.9 Create indexes for attendance.validations
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_validations_registration ON attendance.validations(registration_id);
CREATE INDEX IF NOT EXISTS idx_validations_status ON attendance.validations(validation_status);
CREATE INDEX IF NOT EXISTS idx_validations_qr_generated ON attendance.validations(qr_generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_validations_round ON attendance.validations(round_number);

-- ----------------------------------------------------------------------------
-- 2.10 Create comments for attendance.validations
-- ----------------------------------------------------------------------------

COMMENT ON TABLE attendance.validations IS 'Validaciones individuales por ronda (FN3 verificacion)';

COMMENT ON COLUMN attendance.validations.validation_id IS 'PK auto-incremental unica por validacion';
COMMENT ON COLUMN attendance.validations.registration_id IS 'FK a attendance.registrations (ON DELETE CASCADE)';
COMMENT ON COLUMN attendance.validations.round_number IS 'Numero de ronda (1, 2, 3, ..., max_rounds)';
COMMENT ON COLUMN attendance.validations.qr_generated_at IS 'Timestamp de generacion del QR';
COMMENT ON COLUMN attendance.validations.qr_scanned_at IS 'Timestamp de escaneo del QR (nullable hasta escaneo)';
COMMENT ON COLUMN attendance.validations.response_received_at IS 'Timestamp de recepcion de respuesta (nullable hasta respuesta)';
COMMENT ON COLUMN attendance.validations.response_time_ms IS 'Tiempo de respuesta en milisegundos (RT)';
COMMENT ON COLUMN attendance.validations.totpu_valid IS 'TOTP de usuario valido (true/false)';
COMMENT ON COLUMN attendance.validations.totps_valid IS 'TOTP de sistema valido (true/false)';
COMMENT ON COLUMN attendance.validations.rt_valid IS 'Response time valido (true/false)';
COMMENT ON COLUMN attendance.validations.secret_valid IS 'Handshake secret valido (true/false)';
COMMENT ON COLUMN attendance.validations.validation_status IS 'Resultado: success, failed, timeout, invalid';
COMMENT ON COLUMN attendance.validations.failed_attempts IS 'Numero de intentos fallidos en esta ronda';
COMMENT ON COLUMN attendance.validations.created_at IS 'Timestamp de creacion del registro';

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

CREATE TABLE IF NOT EXISTS attendance.results (
  result_id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES attendance.registrations(registration_id) ON DELETE CASCADE,

  total_rounds INTEGER NOT NULL CHECK (total_rounds >= 0),
  successful_rounds INTEGER NOT NULL CHECK (successful_rounds >= 0),
  failed_rounds INTEGER NOT NULL DEFAULT 0,

  avg_response_time_ms FLOAT CHECK (avg_response_time_ms >= 0),
  std_dev_response_time FLOAT CHECK (std_dev_response_time >= 0),
  min_response_time_ms FLOAT CHECK (min_response_time_ms >= 0),
  max_response_time_ms FLOAT CHECK (max_response_time_ms >= 0),
  median_response_time_ms FLOAT CHECK (median_response_time_ms >= 0),

  certainty_score FLOAT NOT NULL CHECK (certainty_score BETWEEN 0 AND 100),
  final_status TEXT NOT NULL CHECK (final_status IN ('PRESENT', 'ABSENT', 'DOUBTFUL', 'ERROR')),

  calculated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(registration_id)
);

-- ----------------------------------------------------------------------------
-- 2.12 Create indexes for attendance.results
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_results_registration ON attendance.results(registration_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON attendance.results(final_status);
CREATE INDEX IF NOT EXISTS idx_results_certainty ON attendance.results(certainty_score DESC);
CREATE INDEX IF NOT EXISTS idx_results_calculated_at ON attendance.results(calculated_at DESC);

-- ----------------------------------------------------------------------------
-- 2.13 Create comments for attendance.results
-- ----------------------------------------------------------------------------

COMMENT ON TABLE attendance.results IS 'Resultado final consolidado con estadisticas';

COMMENT ON COLUMN attendance.results.result_id IS 'PK auto-incremental unica por resultado';
COMMENT ON COLUMN attendance.results.registration_id IS 'FK a attendance.registrations (UNIQUE, ON DELETE CASCADE)';
COMMENT ON COLUMN attendance.results.total_rounds IS 'Total de rondas configuradas';
COMMENT ON COLUMN attendance.results.successful_rounds IS 'Numero de rondas exitosas';
COMMENT ON COLUMN attendance.results.failed_rounds IS 'Numero de rondas fallidas';
COMMENT ON COLUMN attendance.results.avg_response_time_ms IS 'Promedio de tiempo de respuesta';
COMMENT ON COLUMN attendance.results.std_dev_response_time IS 'Desviacion estandar del tiempo de respuesta';
COMMENT ON COLUMN attendance.results.min_response_time_ms IS 'Tiempo de respuesta minimo';
COMMENT ON COLUMN attendance.results.max_response_time_ms IS 'Tiempo de respuesta maximo';
COMMENT ON COLUMN attendance.results.median_response_time_ms IS 'Mediana del tiempo de respuesta';
COMMENT ON COLUMN attendance.results.certainty_score IS 'Umbral de certeza (0-100). >= 70% = PRESENTE';
COMMENT ON COLUMN attendance.results.final_status IS 'Resultado final: PRESENT, ABSENT, DOUBTFUL, ERROR';
COMMENT ON COLUMN attendance.results.calculated_at IS 'Timestamp de calculo del resultado';

-- ============================================================================
-- SECTION 3: NORMALIZATION VERIFICATION
-- ============================================================================
-- All tables satisfy 3NF (Third Normal Form):
--
-- enrollment.devices:
--   OK PK: device_id
--   OK All non-key attributes depend only on device_id
--   OK No transitive dependencies
--
-- enrollment.enrollment_history:
--   OK PK: history_id
--   OK FK: device_id (nullable)
--   OK JSONB metadata justified for unstructured audit data
--   OK No transitive dependencies
--
-- attendance.sessions:
--   OK PK: session_id
--   OK Course data denormalized for performance (justified)
--   OK No transitive dependencies
--
-- attendance.registrations:
--   OK PK: registration_id
--   OK FK: session_id, device_id
--   OK UNIQUE(session_id, user_id)
--   OK No transitive dependencies
--
-- attendance.validations:
--   OK PK: validation_id
--   OK FK: registration_id
--   OK UNIQUE(registration_id, round_number)
--   OK All fields depend only on validation_id
--   OK No transitive dependencies
--
-- attendance.results:
--   OK PK: result_id
--   OK FK: registration_id (UNIQUE)
--   OK Aggregated statistics derived from validations
--   OK No transitive dependencies
--
-- 4NF consideration: Not needed
--   - No multivalued dependencies exist
--   - 3NF is sufficient for this domain
-- ============================================================================

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
