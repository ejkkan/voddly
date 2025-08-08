-- Subscription Management Base Migration
-- Description: Creates Stripe subscription table for billing management

-- Subscription table for Stripe integration
CREATE TABLE "subscription"
(
    -- Primary key
    "id"                   VARCHAR(255) PRIMARY KEY NOT NULL,               -- Unique identifier for each subscription

    -- Subscription details
    "plan"                 VARCHAR(255)             NOT NULL,               -- The name of the subscription plan
    "referenceId"          VARCHAR(255)             NOT NULL,               -- The ID this subscription is associated with (user ID by default)
    "stripeCustomerId"     VARCHAR(255)             NOT NULL,               -- The Stripe customer ID
    "stripeSubscriptionId" VARCHAR(255),                                    -- The Stripe subscription ID
    "status"               VARCHAR(255)             NOT NULL,               -- The status of the subscription (active, canceled, etc.)

    -- Billing period information
    "periodStart"          TIMESTAMP,                                       -- Start date of the current billing period
    "periodEnd"            TIMESTAMP,                                       -- End date of the current billing period
    "cancelAtPeriodEnd"    BOOLEAN                           DEFAULT FALSE, -- Whether the subscription will be canceled at the end of the period

    -- Team plan information
    "seats"                INTEGER,                                         -- Number of seats for team plans

    -- Trial period information
    "trialStart"           TIMESTAMP,                                       -- Start date of the trial period
    "trialEnd"             TIMESTAMP,                                       -- End date of the trial period

    -- Timestamps
    "createdAt"            TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for subscription table performance
CREATE INDEX idx_subscription_reference ON "subscription" ("referenceId");
CREATE INDEX idx_subscription_customer ON "subscription" ("stripeCustomerId");
CREATE INDEX idx_subscription_stripe ON "subscription" ("stripeSubscriptionId");
CREATE INDEX idx_subscription_status ON "subscription" ("status"); 