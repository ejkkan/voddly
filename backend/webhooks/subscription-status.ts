import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { userDB } from '../user/db';
import { SubscriptionTier } from './stripe';

export interface GetSubscriptionStatusRequest {}

export interface GetSubscriptionStatusResponse {
  tier: SubscriptionTier;
  status: string | null;
  currentPeriodEnd: Date | null;
}

// Get the current user's subscription status
export const getSubscriptionStatus = api<
  GetSubscriptionStatusRequest,
  GetSubscriptionStatusResponse
>(
  { expose: true, method: 'GET', path: '/user/subscription-status', auth: true },
  async (req) => {
    const authData = getAuthData();

    if (!authData?.userID) {
      throw APIError.unauthenticated('User authentication failed');
    }

    const userId = authData.userID;

    // Get user subscription info
    const user = await userDB.queryRow<{
      subscription_tier: string;
      subscription_status: string | null;
      subscription_current_period_end: Date | null;
    }>`
      SELECT 
        subscription_tier,
        subscription_status,
        subscription_current_period_end
      FROM "user"
      WHERE id = ${userId}
    `;

    if (!user) {
      throw APIError.notFound('User not found');
    }

    return {
      tier: (user.subscription_tier as SubscriptionTier) || SubscriptionTier.FREE,
      status: user.subscription_status,
      currentPeriodEnd: user.subscription_current_period_end,
    };
  }
);