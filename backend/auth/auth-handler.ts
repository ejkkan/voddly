import { APIError, Header } from 'encore.dev/api';
import { authHandler } from 'encore.dev/auth';
import log from 'encore.dev/log';
import { userDB } from '../user/db';
import { checkDeviceStatus } from '../user/lib/device-management';

// Update AuthParams to include the Cookie header, Device ID, and optional Passphrase
interface AuthParams {
  cookie: Header<'Cookie'>;
  deviceId?: Header<'x-device-id'>;
  passphrase?: Header<'x-passphrase'>;
}

// AuthData now includes full user information for use in endpoints
interface AuthData {
  userID: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  role: string;
  stripeCustomerId: string | null;
  accountId?: string;
  deviceId?: string;
  passphrase?: string;
}

// Authentication handler implementation
export const handler = authHandler<AuthParams, AuthData>(async (params) => {
  const cookieHeader = params.cookie;

  if (!cookieHeader) throw APIError.unauthenticated('Not authenticated');

  try {
    // Parse the cookie string to find the better-auth session token
    const cookieMap = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);

    // Try different possible cookie names for better-auth
    const possibleCookieNames = [
      'better-auth.session_token',
      'session_token',
      'better-auth.session-token',
      'session-token',
      'betterAuth.sessionToken',
    ];

    let sessionToken: string | undefined;
    let usedCookieName: string | undefined;

    for (const cookieName of possibleCookieNames) {
      if (cookieMap[cookieName]) {
        sessionToken = cookieMap[cookieName];
        usedCookieName = cookieName;
        break;
      }
    }

    if (!sessionToken) throw APIError.unauthenticated('No session token found');

    // URL-decode the session token since cookies are URL-encoded
    const decodedSessionToken = decodeURIComponent(sessionToken);
    // Better-auth signs the session token in cookies, but stores only the base token in DB
    // Extract the base token (everything before the first '.')
    const baseToken = decodedSessionToken.split('.')[0];

    // Validate session directly with the database to get full user info
    const sessionData = await userDB.queryRow<{
      userId: string;
      expiresAt: Date;
    }>`
      SELECT "userId", "expiresAt" 
      FROM "session" 
      WHERE token = ${baseToken} AND "expiresAt" > NOW()
    `;

    if (!sessionData) {
      throw APIError.unauthenticated('Invalid or expired session');
    }

    // Get full user information from our user table (stripeCustomerId now in accounts table)
    log.debug('Looking for user', { userId: sessionData.userId });

    const user = await userDB.queryRow<{
      id: string;
      email: string;
      name: string | null;
      emailVerified: boolean;
      role: string | null;
      stripeCustomerId: string | null;
    }>`
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u."emailVerified", 
        u.role,
        a.stripe_customer_id as "stripeCustomerId"
      FROM "user" u
      LEFT JOIN user_subscription a ON a.user_id = u.id
      WHERE u.id = ${sessionData.userId}
    `;

    log.debug('User query result', { user });

    if (!user) {
      throw APIError.unauthenticated('User not found');
    }

    // Get the user's account ID
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${user.id}
    `;

    let accountId: string | undefined;
    let deviceId: string | undefined;
    let passphrase: string | undefined;

    // Only validate device if we have an account and device ID
    if (account && params.deviceId) {
      accountId = account.id;
      deviceId = params.deviceId;
      passphrase = params.passphrase;

      log.info('[Auth] Validating device', { deviceId, accountId, hasPassphrase: !!passphrase });

      try {
        const deviceStatus = await checkDeviceStatus(accountId, deviceId);

        if (deviceStatus.exists) {
          // Device exists and is now marked as active
          log.info('[Auth] Device validated and activated', { deviceId });
        } else if (deviceStatus.canRegister) {
          // Device can be registered
          if (passphrase) {
            // Auto-register the device since we have the passphrase
            log.info('[Auth] Auto-registering device with provided passphrase', { 
              deviceId, 
              deviceCount: deviceStatus.deviceCount, 
              maxDevices: deviceStatus.maxDevices 
            });
            // Passphrase will be available in AuthData for middleware to use
          } else {
            log.info('[Auth] Device not registered but can be registered (no passphrase provided)', { 
              deviceId, 
              deviceCount: deviceStatus.deviceCount, 
              maxDevices: deviceStatus.maxDevices 
            });
          }
        } else {
          // Device limit exceeded
          log.error('[Auth] Device limit exceeded', {
            accountId,
            deviceCount: deviceStatus.deviceCount,
            maxDevices: deviceStatus.maxDevices
          });
          throw APIError.forbidden(
            `Device limit exceeded. You have ${deviceStatus.deviceCount} devices registered out of ${deviceStatus.maxDevices} allowed. Please remove a device to continue.`
          );
        }
      } catch (error) {
        // If it's already an APIError, re-throw it
        if (error && typeof error === 'object' && 'code' in error) {
          throw error;
        }
        // Otherwise log and continue (backward compatibility)
        log.error('[Auth] Device validation error', { error });
      }
    } else if (account && !params.deviceId) {
      // We have an account but no device ID - log warning but allow for backward compatibility
      log.warn('[Auth] No device ID provided', { accountId: account.id });
    }

    return {
      userID: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      role: user.role || 'user',
      stripeCustomerId: user.stripeCustomerId,
      accountId,
      deviceId,
      passphrase,
    };
  } catch (error) {
    log.error('Auth handler error', { 
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    
    // If it's already an APIError, re-throw it
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }
    
    throw APIError.unauthenticated('Invalid session');
  }
});
