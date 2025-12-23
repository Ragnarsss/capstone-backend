-- Migration: 004-bigint-user-ids.sql
-- Date: 2025-12-18
-- Description: Cambiar user_id INTEGER a BIGINT
-- Severidad: CRÍTICA - Soluciona error 500 en enrollment para usuarios con IDs > 2.14B

BEGIN;

ALTER TABLE enrollment.devices ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE enrollment.enrollment_history ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE enrollment.enrollment_history ALTER COLUMN performed_by TYPE BIGINT;
ALTER TABLE attendance.sessions ALTER COLUMN professor_id TYPE BIGINT;
ALTER TABLE attendance.registrations ALTER COLUMN user_id TYPE BIGINT;

COMMIT;
