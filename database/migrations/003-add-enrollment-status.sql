-- ============================================================================
-- Migration 003: Add enrollment status column
-- ============================================================================
-- Date: 2025-12-10
-- Purpose: Add explicit status field for enrollment state machine
-- 
-- States:
--   - 'pending': Challenge generated, awaiting finishEnrollment
--   - 'enrolled': Active credential, can use service
--   - 'revoked': Credential revoked, must re-enroll
--
-- Note: 'not_enrolled' state is implicit (no device record exists)
-- ============================================================================

-- Add status column with default 'enrolled' (existing devices are enrolled)
ALTER TABLE enrollment.devices 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'enrolled' 
CHECK (status IN ('pending', 'enrolled', 'revoked'));

-- Migrate existing data based on is_active flag
UPDATE enrollment.devices SET status = 'revoked' WHERE is_active = FALSE;
UPDATE enrollment.devices SET status = 'enrolled' WHERE is_active = TRUE;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_devices_status ON enrollment.devices(status);

-- Add comment for new column
COMMENT ON COLUMN enrollment.devices.status IS 'Estado del enrollment: pending, enrolled, revoked';

-- ============================================================================
-- Verification queries (run manually to verify migration)
-- ============================================================================
-- SELECT status, is_active, COUNT(*) FROM enrollment.devices GROUP BY status, is_active;
-- ============================================================================
