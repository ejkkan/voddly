-- Restore database-level device limit enforcement

-- Recreate the function
CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
    max_devices INTEGER;
    tier VARCHAR(50);
BEGIN
    -- Get subscription tier
    SELECT subscription_tier INTO tier
    FROM user_subscription
    WHERE id = NEW.subscription_id;
    
    -- Determine device limit based on tier
    max_devices := CASE tier
        WHEN 'basic' THEN 3
        WHEN 'standard' THEN 5
        WHEN 'premium' THEN 10
        ELSE 3
    END;
    
    -- Count active devices
    SELECT COUNT(*) INTO active_count
    FROM subscription_devices
    WHERE subscription_id = NEW.subscription_id
      AND is_active = TRUE
      AND id != COALESCE(NEW.id, gen_random_uuid());
    
    -- Check limit
    IF NEW.is_active = TRUE AND active_count >= max_devices THEN
        RAISE EXCEPTION 'Device limit reached for subscription tier %', tier;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER enforce_device_limit
    BEFORE INSERT OR UPDATE ON subscription_devices
    FOR EACH ROW
    EXECUTE FUNCTION check_device_limit();

-- Restore comment
COMMENT ON TABLE subscription_devices IS 'Registered devices per subscription';