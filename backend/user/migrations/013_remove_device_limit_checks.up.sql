-- Remove database-level device limit enforcement
-- Device limits will be handled in application logic only

-- Drop the trigger first
DROP TRIGGER IF EXISTS enforce_device_limit ON subscription_devices;

-- Drop the function
DROP FUNCTION IF EXISTS check_device_limit();

-- Add comment
COMMENT ON TABLE subscription_devices IS 'Registered devices per subscription - limits enforced in application layer';