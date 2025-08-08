import { api, APIError } from 'encore.dev/api';
import { secret } from 'encore.dev/config';
import { userDB } from '../user/db';
import log from 'encore.dev/log';
import Stripe from 'stripe';
import { json } from 'node:stream/consumers';

// Stripe configuration
const stripeSecret = secret('StripeSecretKey');
const stripeWebhookSecret = secret('StripeWebhookKey');

// Lazy-loaded Stripe client
let stripeClient: Stripe | null = null;
let stripeInitialized = false;

function getStripeClient(): Stripe {
  if (!stripeInitialized) {
    try {
      const apiKey = stripeSecret();
      stripeClient = new Stripe(apiKey);
      stripeInitialized = true;
      log.info('[WEBHOOKS] Stripe client initialized successfully');
    } catch (error) {
      log.error('[WEBHOOKS] Failed to initialize Stripe client', { error });
      throw new Error('Failed to initialize Stripe client');
    }
  }

  if (!stripeClient) {
    throw new Error('Stripe client not initialized');
  }

  return stripeClient;
}

// Subscription plan mapping - replace these with your actual plan IDs
const SUBSCRIPTION_PLANS = {
  FREE: 'price_PLACEHOLDER_FREE', // Replace with actual Stripe price ID for free tier
  BASIC: 'price_PLACEHOLDER_BASIC', // Replace with actual Stripe price ID
  PRO: 'price_PLACEHOLDER_PRO', // Replace with actual Stripe price ID
  ENTERPRISE: 'price_PLACEHOLDER_ENTERPRISE', // Replace with actual Stripe price ID
} as const;

// Subscription tier enum
export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

// Map Stripe price IDs to subscription tiers
function getPlanTier(priceId: string): SubscriptionTier {
  switch (priceId) {
    case SUBSCRIPTION_PLANS.FREE:
      return SubscriptionTier.FREE;
    case SUBSCRIPTION_PLANS.BASIC:
      return SubscriptionTier.BASIC;
    case SUBSCRIPTION_PLANS.PRO:
      return SubscriptionTier.PRO;
    case SUBSCRIPTION_PLANS.ENTERPRISE:
      return SubscriptionTier.ENTERPRISE;
    default:
      log.warn('[WEBHOOKS] Unknown price ID, defaulting to FREE', { priceId });
      return SubscriptionTier.FREE;
  }
}

export interface StripeWebhookRequest {
  payload: string;
  signature: string;
}

export interface StripeWebhookResponse {
  received: boolean;
}

// Stripe webhook endpoint
export const handleStripeWebhook = api.raw(
  { expose: true, method: 'POST', path: '/webhooks/stripe' },
  async (req, res) => {
    try {
      const stripe = getStripeClient();

      // Get the raw body - read from stream
      const rawBody = await json(req);
      const sig = req.headers['stripe-signature'];

      if (!sig) {
        log.error('[WEBHOOKS] Missing Stripe signature header');
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing signature' }));
        return;
      }

      // Convert to Buffer for Stripe
      const payload = Buffer.from(JSON.stringify(rawBody));

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          payload,
          Array.isArray(sig) ? sig[0] : sig,
          stripeWebhookSecret()
        );
      } catch (err) {
        log.error('[WEBHOOKS] Webhook signature verification failed', {
          error: err,
        });
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      // Handle the event
      try {
        await handleWebhookEvent(event);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ received: true }));
      } catch (error) {
        log.error('[WEBHOOKS] Error handling webhook event', {
          eventType: event.type,
          eventId: event.id,
          error,
        });
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to process webhook' }));
      }
    } catch (error) {
      log.error('[WEBHOOKS] Error initializing Stripe client for webhook', {
        error,
      });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to initialize Stripe client' }));
    }
  }
);

async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  log.info('[WEBHOOKS] Processing webhook event', {
    type: event.type,
    id: event.id,
  });

  // Process the event
  switch (event.type) {
    case 'customer.created':
      await handleCustomerCreated(event.data.object as Stripe.Customer);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.trial_will_end':
      await handleSubscriptionTrialWillEnd(
        event.data.object as Stripe.Subscription
      );
      break;

    default:
      log.info('[WEBHOOKS] Unhandled event type', { type: event.type });
  }

  log.info('[WEBHOOKS] Successfully processed webhook event', {
    eventId: event.id,
    type: event.type,
  });
}

async function handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
  const customerId = customer.id;

  log.info(
    '[WEBHOOKS] Customer created, checking for user before creating subscription',
    { customerId }
  );

  // Wait and retry to find user - handles race condition with database commits
  let user = null;
  let retries = 0;
  const maxRetries = 5;
  const retryDelay = 1000; // Start with 1 second

  while (!user && retries < maxRetries) {
    user = await userDB.queryRow<{ id: string }>`
      SELECT id FROM "user" WHERE "stripeCustomerId" = ${customerId}
    `;

    if (!user) {
      retries++;
      if (retries < maxRetries) {
        const delay = retryDelay * Math.pow(2, retries - 1); // Exponential backoff
        log.info('[WEBHOOKS] User not found yet, retrying...', {
          customerId,
          attempt: retries,
          delayMs: delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  if (!user) {
    log.error(
      '[WEBHOOKS] User not found after retries, skipping subscription creation',
      {
        customerId,
        attempts: retries,
      }
    );
    // Don't create subscription if user doesn't exist
    // The user might retry signup or this could be a test webhook
    return;
  }

  log.info('[WEBHOOKS] User found, checking for existing subscription', {
    customerId,
    userId: user.id,
    retriesNeeded: retries,
  });

  // Check if customer already has any subscriptions (idempotency check)
  try {
    const stripe = getStripeClient();
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });

    const hasActiveSubscription = existingSubscriptions.data.some(
      (sub: Stripe.Subscription) => ['active', 'trialing'].includes(sub.status)
    );

    if (hasActiveSubscription) {
      log.info(
        '[WEBHOOKS] Customer already has active subscription, skipping creation',
        {
          customerId,
          userId: user.id,
          existingCount: existingSubscriptions.data.length,
        }
      );
      return;
    }
  } catch (error) {
    log.error('[WEBHOOKS] Failed to check existing subscriptions', {
      customerId,
      error,
    });
    // Continue to try creating subscription
  }

  try {
    // Create a free subscription for the new customer
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: SUBSCRIPTION_PLANS.FREE }],
      metadata: {
        tier: 'free',
        created_by: 'webhook_auto_signup',
        user_id: user.id, // Include user ID for tracking
      },
    });

    // Immediately update the database to avoid another race condition
    await userDB.exec`
      UPDATE "user" 
      SET 
        subscription_tier = ${SubscriptionTier.FREE},
        subscription_status = 'active',
        subscription_id = ${subscription.id},
        subscription_current_period_end = ${new Date(
          subscription.current_period_end * 1000
        )}
      WHERE id = ${user.id}
    `;

    log.info('[WEBHOOKS] Created free subscription and updated user', {
      customerId,
      userId: user.id,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    log.error('[WEBHOOKS] Failed to create free subscription', {
      customerId,
      userId: user.id,
      error,
    });
    // Don't throw - user can still use the app, they just won't have a subscription
  }
}

async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;

  // Retry logic to handle race conditions
  let user = null;
  let retries = 0;
  const maxRetries = 5;
  const retryDelay = 1000; // Start with 1 second

  while (!user && retries < maxRetries) {
    user = await userDB.queryRow<{
      id: string;
      subscription_tier: string;
      subscription_status: string;
    }>`
      SELECT id, subscription_tier, subscription_status 
      FROM "user" WHERE "stripeCustomerId" = ${customerId}
    `;

    if (!user) {
      retries++;
      if (retries < maxRetries) {
        const delay = retryDelay * Math.pow(2, retries - 1); // Exponential backoff
        log.info(
          '[WEBHOOKS] User not found for subscription update, retrying...',
          {
            customerId,
            subscriptionId: subscription.id,
            attempt: retries,
            delayMs: delay,
          }
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  if (!user) {
    log.error('[WEBHOOKS] User not found for Stripe customer after retries', {
      customerId,
      subscriptionId: subscription.id,
      attempts: retries,
    });

    // Special handling: This might be a subscription created by handleCustomerCreated
    // that hit a race condition. Log it for manual intervention.
    log.error(
      '[WEBHOOKS] MANUAL INTERVENTION REQUIRED: Subscription exists without user',
      {
        customerId,
        subscriptionId: subscription.id,
        status: subscription.status,
        metadata: subscription.metadata,
      }
    );
    return;
  }

  log.info('[WEBHOOKS] Processing subscription update', {
    userId: user.id,
    subscriptionId: subscription.id,
    retriesNeeded: retries,
  });

  // Get the price ID from the subscription
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    log.error('[WEBHOOKS] No price ID found in subscription', {
      subscriptionId: subscription.id,
    });
    return;
  }

  // Determine the subscription tier
  const newTier = getPlanTier(priceId);
  const status = subscription.status;

  // Log tier changes for monitoring
  if (user.subscription_tier !== newTier) {
    log.info('[WEBHOOKS] User subscription tier changed', {
      userId: user.id,
      oldTier: user.subscription_tier,
      newTier,
      upgrade: isUpgrade(user.subscription_tier, newTier),
    });
  }

  // Log status changes
  if (user.subscription_status !== status) {
    log.info('[WEBHOOKS] User subscription status changed', {
      userId: user.id,
      oldStatus: user.subscription_status,
      newStatus: status,
      isCancellation:
        status === 'canceled' && subscription.cancel_at_period_end,
    });
  }

  // Update user subscription info
  await userDB.exec`
    UPDATE "user" 
    SET 
      subscription_tier = ${newTier},
      subscription_status = ${status},
      subscription_id = ${subscription.id},
      subscription_current_period_end = ${new Date(
        subscription.current_period_end * 1000
      )}
    WHERE id = ${user.id}
  `;

  log.info('[WEBHOOKS] Updated user subscription', {
    userId: user.id,
    tier: newTier,
    status,
    subscriptionId: subscription.id,
    priceId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  });

  // Handle special cases
  if (subscription.cancel_at_period_end) {
    log.info('[WEBHOOKS] Subscription will cancel at period end', {
      userId: user.id,
      cancelDate: new Date(subscription.current_period_end * 1000),
    });
  }

  if (status === 'past_due') {
    log.warn('[WEBHOOKS] Subscription payment past due', {
      userId: user.id,
      subscriptionId: subscription.id,
    });
    // TODO: You might want to send an email notification here
  }

  if (status === 'incomplete' || status === 'incomplete_expired') {
    log.warn('[WEBHOOKS] Subscription payment incomplete', {
      userId: user.id,
      subscriptionId: subscription.id,
      status,
    });
    // TODO: Handle incomplete payment scenarios
  }
}

// Helper function to determine if it's an upgrade
function isUpgrade(oldTier: string, newTier: string): boolean {
  const tierOrder: Record<string, number> = {
    [SubscriptionTier.FREE]: 0,
    [SubscriptionTier.BASIC]: 1,
    [SubscriptionTier.PRO]: 2,
    [SubscriptionTier.ENTERPRISE]: 3,
  };

  return (tierOrder[newTier] || 0) > (tierOrder[oldTier] || 0);
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const user = await userDB.queryRow<{ id: string }>`
    SELECT id FROM "user" WHERE "stripeCustomerId" = ${customerId}
  `;

  if (!user) {
    log.error('[WEBHOOKS] User not found for Stripe customer', { customerId });
    return;
  }

  log.info('[WEBHOOKS] Processing subscription deletion', {
    userId: user.id,
    subscriptionId: subscription.id,
    customerId,
  });

  // IMPORTANT: Check if user has other active subscriptions
  // This handles the upgrade scenario where old subscription is deleted
  try {
    const stripe = getStripeClient();
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10,
    });

    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 10,
    });

    const hasOtherActiveSubscriptions =
      activeSubscriptions.data.length > 0 ||
      trialingSubscriptions.data.length > 0;

    if (hasOtherActiveSubscriptions) {
      log.info(
        '[WEBHOOKS] User has other active subscriptions, not creating free subscription',
        {
          userId: user.id,
          activeCount: activeSubscriptions.data.length,
          trialingCount: trialingSubscriptions.data.length,
        }
      );

      // Don't create a free subscription or update the database
      // The user's active subscription will handle their tier
      return;
    }

    // No other active subscriptions - create free subscription
    log.info(
      '[WEBHOOKS] No other active subscriptions found, creating free subscription',
      {
        userId: user.id,
      }
    );

    const newSubscription = await getStripeClient().subscriptions.create({
      customer: customerId,
      items: [{ price: SUBSCRIPTION_PLANS.FREE }],
      metadata: {
        tier: 'free',
        created_by: 'webhook_downgrade',
      },
    });

    // Update database immediately to maintain consistency
    await userDB.exec`
      UPDATE "user" 
      SET 
        subscription_tier = ${SubscriptionTier.FREE},
        subscription_status = 'active',
        subscription_id = ${newSubscription.id},
        subscription_current_period_end = ${new Date(
          newSubscription.current_period_end * 1000
        )}
      WHERE id = ${user.id}
    `;

    log.info('[WEBHOOKS] Successfully downgraded to free subscription', {
      userId: user.id,
      oldSubscriptionId: subscription.id,
      newSubscriptionId: newSubscription.id,
    });
  } catch (error) {
    log.error('[WEBHOOKS] Error handling subscription deletion', {
      userId: user.id,
      customerId,
      error,
    });

    // Don't update the database if we couldn't check/create subscriptions
    // This maintains consistency - better to have stale data than incorrect data
    // The user will still have their last known subscription state

    // Send alert for manual intervention if needed
    log.error(
      '[WEBHOOKS] MANUAL INTERVENTION REQUIRED: User subscription in inconsistent state',
      {
        userId: user.id,
        customerId,
        deletedSubscriptionId: subscription.id,
      }
    );
  }
}

async function handleSubscriptionTrialWillEnd(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const user = await userDB.queryRow<{ id: string; email: string }>`
    SELECT id, email FROM "user" WHERE "stripeCustomerId" = ${customerId}
  `;

  if (!user) {
    log.error('[WEBHOOKS] User not found for Stripe customer', { customerId });
    return;
  }

  // Check if trial_end exists before processing
  if (!subscription.trial_end) {
    log.warn('[WEBHOOKS] Trial end date not found in subscription', {
      subscriptionId: subscription.id,
      userId: user.id,
    });
    return;
  }

  // Log the trial ending event - you might want to send an email here
  log.info('[WEBHOOKS] Trial ending soon', {
    userId: user.id,
    email: user.email,
    trialEnd: new Date(subscription.trial_end * 1000),
  });

  // TODO: Send trial ending notification email
}

export interface CreateCustomerRequest {
  userId: string;
  email: string;
  name?: string;
}

export interface CreateCustomerResponse {
  customerId: string;
  success: boolean;
}

// Internal API endpoint for creating Stripe customers
export const createCustomer = api(
  {
    expose: false, // Internal only
    method: 'POST',
    path: '/internal/stripe/create-customer',
  },
  async (req: CreateCustomerRequest): Promise<CreateCustomerResponse> => {
    try {
      const stripe = getStripeClient();

      const { userId, email, name } = req;

      log.info('[WEBHOOKS] Creating Stripe customer', { userId, email });

      try {
        // Create Stripe customer
        const customer = await stripe.customers.create({
          email,
          name: name || undefined,
          metadata: {
            userId,
            created_by: 'auth_service',
          },
        });

        // Update user with Stripe customer ID
        await userDB.exec`
          UPDATE "user" 
          SET "stripeCustomerId" = ${customer.id}
          WHERE id = ${userId}
        `;

        log.info('[WEBHOOKS] Successfully created Stripe customer', {
          userId,
          customerId: customer.id,
        });

        return {
          customerId: customer.id,
          success: true,
        };
      } catch (error) {
        log.error('[WEBHOOKS] Failed to create Stripe customer', {
          userId,
          email,
          error,
        });
        throw APIError.internal('Failed to create Stripe customer');
      }
    } catch (error) {
      log.error(
        '[WEBHOOKS] Error initializing Stripe client for create-customer',
        {
          error,
        }
      );
      throw APIError.internal('Failed to initialize Stripe client');
    }
  }
);
