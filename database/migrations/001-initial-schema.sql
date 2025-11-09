-- ============================================================================
-- MIGRATION: 001-initial-schema.sql
-- ============================================================================
-- Description: Initial database schema for Asistencia system
-- Version: 1.0.0
-- Date: 2025-11-09
-- Author: Development Team
-- Dependencies: PostgreSQL 18+
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


-- ----------------------------------------------------------------------------
-- 1.2 Create enrollment.devices table
-- ----------------------------------------------------------------------------
-- Purpose: Store FIDO2 device credentials and metadata
-- Fields:
--   - device_id: Primary key (UUID)
--   - user_id: User identifier (VARCHAR)
--   - credential_id: FIDO2 credential ID (UNIQUE)
--   - public_key: FIDO2 public key (BYTEA)
--   - handshake_secret: Derived secret for TOTP generation (BYTEA)
--   - aaguid: Authenticator AAGUID (UUID)
--   - device_fingerprint: Browser/device fingerprint (VARCHAR)
--   - attestation_format: Attestation format (VARCHAR)
--   - sign_count: Signature counter for replay protection (INTEGER)
--   - enrolled_at: Enrollment timestamp (TIMESTAMPTZ)
--   - last_used_at: Last usage timestamp (TIMESTAMPTZ)
--   - is_active: Device active status (BOOLEAN)
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 1.3 Create indexes for enrollment.devices
-- ----------------------------------------------------------------------------
-- Indexes:
--   - idx_devices_credential_id: UNIQUE index on credential_id
--   - idx_devices_user_id: Index on user_id for lookups
--   - idx_devices_aaguid: Index on aaguid for device filtering
--   - idx_devices_active: Partial index on is_active WHERE TRUE
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 1.4 Create enrollment.enrollment_history table
-- ----------------------------------------------------------------------------
-- Purpose: Audit log for enrollment actions
-- Fields:
--   - history_id: Primary key (UUID)
--   - device_id: Foreign key to devices (nullable for failed enrollments)
--   - user_id: User identifier (VARCHAR)
--   - action: Action type (enrolled, revoked, re-enrolled, updated)
--   - reason: Reason for action (VARCHAR)
--   - performed_at: Action timestamp (TIMESTAMPTZ)
--   - performed_by: Actor who performed action (VARCHAR)
--   - metadata: Additional JSON metadata (JSONB)
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 1.5 Create indexes for enrollment.enrollment_history
-- ----------------------------------------------------------------------------


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


-- ----------------------------------------------------------------------------
-- 2.2 Create attendance.sessions table
-- ----------------------------------------------------------------------------
-- Purpose: Store professor-initiated attendance sessions
-- Fields:
--   - session_id: Primary key (UUID)
--   - professor_id: Professor identifier (VARCHAR)
--   - professor_name: Professor name (VARCHAR)
--   - course_code: Course code (VARCHAR)
--   - course_name: Course name (VARCHAR)
--   - room: Classroom/location (VARCHAR)
--   - semester: Academic semester (VARCHAR)
--   - start_time: Session start timestamp (TIMESTAMPTZ)
--   - end_time: Session end timestamp (TIMESTAMPTZ nullable)
--   - max_rounds: Maximum validation rounds 1-10 (SMALLINT)
--   - status: Session status (active, closed, cancelled)
--   - created_at: Creation timestamp (TIMESTAMPTZ)
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 2.3 Create indexes for attendance.sessions
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 2.4 Create attendance.registrations table
-- ----------------------------------------------------------------------------
-- Purpose: Store student participation announcements
-- Fields:
--   - registration_id: Primary key (UUID)
--   - session_id: Foreign key to sessions (NOT NULL)
--   - user_id: Student identifier (VARCHAR)
--   - device_id: Foreign key to enrollment.devices (nullable)
--   - queue_position: Position in validation queue (INTEGER)
--   - registered_at: Registration timestamp (TIMESTAMPTZ)
--   - status: Registration status (active, processing, completed, failed)
-- Constraints:
--   - UNIQUE(session_id, user_id): One registration per user per session
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 2.5 Create indexes for attendance.registrations
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 2.6 Create attendance.validations table
-- ----------------------------------------------------------------------------
-- Purpose: Store individual validation round data (FN3 protocol)
-- Fields:
--   - validation_id: Primary key (UUID)
--   - registration_id: Foreign key to registrations (NOT NULL)
--   - round_number: Round number 1-10 (SMALLINT)
--   - qr_generated_at: QR code generation timestamp (TIMESTAMPTZ)
--   - qr_scanned_at: QR code scan timestamp (TIMESTAMPTZ nullable)
--   - response_received_at: Response received timestamp (TIMESTAMPTZ nullable)
--   - response_time_ms: Response time in milliseconds (INTEGER)
--   - totpu_valid: TOTP-U validation result (BOOLEAN)
--   - totps_valid: TOTP-S validation result (BOOLEAN)
--   - rt_valid: Response time validation result (BOOLEAN)
--   - secret_valid: Handshake secret validation result (BOOLEAN)
--   - validation_status: Overall validation status (pending, valid, invalid, timeout)
--   - failed_attempts: Number of failed validation attempts (SMALLINT)
--   - created_at: Creation timestamp (TIMESTAMPTZ)
-- Constraints:
--   - UNIQUE(registration_id, round_number): One validation per round per registration
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 2.7 Create indexes for attendance.validations
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 2.8 Create attendance.results table
-- ----------------------------------------------------------------------------
-- Purpose: Store final consolidated attendance results
-- Fields:
--   - result_id: Primary key (UUID)
--   - registration_id: Foreign key to registrations (UNIQUE)
--   - total_rounds: Total number of validation rounds (SMALLINT)
--   - successful_rounds: Number of successful rounds (SMALLINT)
--   - failed_rounds: Number of failed rounds (SMALLINT)
--   - avg_response_time_ms: Average response time (FLOAT)
--   - std_dev_response_time: Standard deviation of response time (FLOAT)
--   - min_response_time_ms: Minimum response time (INTEGER)
--   - max_response_time_ms: Maximum response time (INTEGER)
--   - median_response_time_ms: Median response time (INTEGER)
--   - certainty_score: Certainty score 0-100 (SMALLINT)
--   - final_status: Final attendance status (PRESENT, ABSENT, DOUBTFUL, ERROR)
--   - calculated_at: Calculation timestamp (TIMESTAMPTZ)
-- Constraints:
--   - UNIQUE(registration_id): One result per registration
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 2.9 Create indexes for attendance.results
-- ----------------------------------------------------------------------------


-- ============================================================================
-- SECTION 3: COMMENTS AND DOCUMENTATION
-- ============================================================================
-- Purpose: Add comments to schemas and tables for documentation
-- ============================================================================


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
