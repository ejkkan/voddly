
-- Drop the index created in the up migration
DROP INDEX IF EXISTS idx_account_devices_account_device;
-- Add index for faster lookups (unique constraint already exists from migration 018)
CREATE INDEX IF NOT EXISTS idx_account_devices_account_device 
ON account_devices(account_id, device_id);