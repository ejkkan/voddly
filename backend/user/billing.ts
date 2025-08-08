import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { userQueries } from './queries';
import Stripe from 'stripe';
import { secret } from 'encore.dev/config';

const stripe = new Stripe(secret('StripeSecretKey')());

export interface CreatePortalSessionRequest {
  returnUrl?: string;
}

export interface CreatePortalSessionResponse {
  url: string;
}

// Creates a Stripe customer portal session for managing billing
export const createPortalSession = api<
  CreatePortalSessionRequest,
  CreatePortalSessionResponse
>(
  { expose: true, method: 'POST', path: '/user/billing/portal', auth: true },
  async (req) => {
    // Get user ID from Encore's auth system
    const authData = getAuthData();

    if (!authData?.userID) {
      throw APIError.unauthenticated('User authentication failed');
    }

    const userId = authData.userID;

    // Get user's Stripe customer ID
    const user = await userQueries.findById(userId);
    if (!user) {
      throw APIError.notFound('User not found');
    }

    if (!user.stripeCustomerId) {
      throw APIError.failedPrecondition(
        'User does not have a Stripe customer ID'
      );
    }

    // Default return URL to the billing settings page with proper fallback handling
    const baseUrl =
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    const returnUrl = req.returnUrl || `${baseUrl}/dashboard/settings/billing`;

    // Validate URL format to prevent malformed URLs
    try {
      new URL(returnUrl);
    } catch (urlError) {
      throw APIError.invalidArgument('Invalid return URL format');
    }

    try {
      // Create the portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      return {
        url: session.url,
      };
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw APIError.internal('Failed to create billing portal session');
    }
  }
);
