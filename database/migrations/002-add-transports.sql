-- ============================================================================
-- MIGRATION: 002-add-transports.sql
-- ============================================================================
-- Description: Add transports column to enrollment.devices
-- Version: 1.0.1
-- Date: 2025-12-03
-- Author: Development Team
-- Dependencies: 001-initial-schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Add transports column to enrollment.devices
-- Stores WebAuthn authenticator transport hints (JSON array)
-- Examples: ["internal", "hybrid"], ["usb", "nfc"]
-- ----------------------------------------------------------------------------

ALTER TABLE enrollment.devices
ADD COLUMN IF NOT EXISTS transports TEXT;

COMMENT ON COLUMN enrollment.devices.transports IS 'JSON array of authenticator transports (internal, hybrid, usb, nfc, ble)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
