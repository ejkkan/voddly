import { APIError, Header } from 'encore.dev/api';
import { authHandler } from 'encore.dev/auth';
import { userDB } from '../user/db';

// Update AuthParams to include the Cookie header
interface AuthParams {
  cookie: Header<'Cookie'>;
}

// AuthData now includes full user information for use in endpoints
interface AuthData {
  userID: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  role: string;
  stripeCustomerId: string | null;
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

    // Get full user information from our user table
    console.log('🔍 Looking for user with ID:', sessionData.userId);

    const user = await userDB.queryRow<{
      id: string;
      email: string;
      name: string | null;
      emailVerified: boolean;
      role: string | null;
      stripeCustomerId: string | null;
    }>`
      SELECT id, email, name, "emailVerified", role, "stripeCustomerId"
      FROM "user" 
      WHERE id = ${sessionData.userId}
    `;

    console.log('🔍 User query result:', user);

    if (!user) {
      throw APIError.unauthenticated('User not found');
    }

    return {
      userID: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      role: user.role || 'user',
      stripeCustomerId: user.stripeCustomerId,
    };
  } catch (error) {
    console.error('Auth handler error:', error);
    throw APIError.unauthenticated('Invalid session');
  }
});
