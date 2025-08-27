import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import pg from 'pg';
import { userDB } from '../user/db';
import { createCustomer, CreateCustomerRequest } from '../webhooks/stripe';
import * as crypto from 'crypto';

const { Pool } = pg;

export const auth: any = betterAuth({
  database: new Pool({ connectionString: userDB.connectionString }),
  user: {
    modelName: 'user', // Use our existing user table (singular)
    fields: {
      email: 'email',
      name: 'name',
      emailVerified: 'emailVerified', // Use camelCase to match our schema
      createdAt: 'createdAt', // Use camelCase to match our schema
      updatedAt: 'updatedAt', // Use camelCase to match our schema
    },
    deleteUser: {
      enabled: true,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001', // Add port 3001 for when 3000 is in use
    'http://localhost:4000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:4000',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://192.168.1.14:4000',
    '*',
  ],
  advanced: {
    defaultCookieAttributes: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          console.log('[AUTH-HOOK] Before user create:', {
            id: user.id,
            email: user.email,
            name: user.name,
          });
          return { data: user };
        },
        after: async (user) => {
          console.log('[AUTH-HOOK] After user create:', {
            id: user.id,
            email: user.email,
          });

          // Create Stripe customer after user creation
          // This will be handled by the webhooks service via API call
          try {
            await createStripeCustomer(user.id, user.email, user.name);
          } catch (error) {
            console.error(
              '[AUTH-HOOK] Failed to create Stripe customer:',
              error
            );
            // Don't fail user creation if Stripe fails
          }

          // Create Netflix-style account and default profile for new user
          try {
            const accountId = crypto.randomUUID();
            const profileId = crypto.randomUUID();

            // Create account (1:1 with user)
            await userDB.exec`
              INSERT INTO accounts (id, user_id, name, subscription_tier, subscription_status)
              VALUES (${accountId}, ${user.id}, ${
              user.name + "'s Account"
            }, 'basic', 'active')
              ON CONFLICT (user_id) DO NOTHING
            `;

            // Create default profile with user's name
            await userDB.exec`
              INSERT INTO profiles (id, account_id, name, is_owner)
              VALUES (${profileId}, ${accountId}, ${user.name || 'Main'}, true)
            `;

            console.log('[AUTH-HOOK] Created account and profile:', {
              userId: user.id,
              accountId: accountId,
              profileId: profileId,
            });
          } catch (error) {
            console.error(
              '[AUTH-HOOK] Failed to create account/profile:',
              error
            );
            // Don't fail user creation if account creation fails
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          console.log('[AUTH-HOOK] Before session create:', {
            userId: session.userId,
            token: session.token?.substring(0, 8) + '...',
          });
          return { data: session };
        },
        after: async (session) => {
          console.log('[AUTH-HOOK] After session create:', {
            userId: session.userId,
            expiresAt: session.expiresAt,
          });
        },
      },
    },
    account: {
      create: {
        before: async (account: any) => {
          console.log('[AUTH-HOOK] Before account create:', {
            userId: account.userId,
            providerId: account.providerId,
          });
          return { data: account };
        },
        after: async (account: any) => {
          console.log('[AUTH-HOOK] After account create:', {
            userId: account.userId,
            providerId: account.providerId,
          });
        },
      },
    },
  },
  plugins: [admin()],
});

// Helper function to create Stripe customer via webhooks service
async function createStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<void> {
  console.log('[AUTH-HOOK] Creating Stripe customer for user:', {
    userId,
    email,
  });

  try {
    const request: CreateCustomerRequest = {
      userId,
      email,
      name,
    };

    const response = await createCustomer(request);

    console.log('[AUTH-HOOK] Successfully created Stripe customer:', {
      userId,
      customerId: response.customerId,
    });
  } catch (error) {
    console.error('[AUTH-HOOK] Error calling webhooks service:', error);
    throw error;
  }
}
