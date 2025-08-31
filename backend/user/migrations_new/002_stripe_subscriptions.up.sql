-- =====================================================
-- Stripe Subscription Management
-- Description: Tables for Stripe billing integration
-- =====================================================

-- Subscription table for Stripe integration
CREATE TABLE "subscription"
(
    -- Primary key
    "id"                   VARCHAR(255) PRIMARY KEY NOT NULL,

    -- Subscription details
    "plan"                 VARCHAR(255)             NOT NULL,
    "referenceId"          VARCHAR(255)             NOT NULL,
    "stripeCustomerId"     VARCHAR(255)             NOT NULL,
    "stripeSubscriptionId" VARCHAR(255),
    "status"               VARCHAR(255)             NOT NULL,

    -- Billing period information
    "periodStart"          TIMESTAMP,
    "periodEnd"            TIMESTAMP,
    "cancelAtPeriodEnd"    BOOLEAN                           DEFAULT FALSE,

    -- Team plan information
    "seats"                INTEGER,

    -- Trial period information
    "trialStart"           TIMESTAMP,
    "trialEnd"             TIMESTAMP,

    -- Timestamps
    "createdAt"            TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for subscription table performance
CREATE INDEX idx_subscription_reference ON "subscription" ("referenceId");
CREATE INDEX idx_subscription_customer ON "subscription" ("stripeCustomerId");
CREATE INDEX idx_subscription_stripe ON "subscription" ("stripeSubscriptionId");
CREATE INDEX idx_subscription_status ON "subscription" ("status");

-- Create trigger for subscription updatedAt
CREATE TRIGGER update_subscription_updated_at 
    BEFORE UPDATE ON "subscription" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();