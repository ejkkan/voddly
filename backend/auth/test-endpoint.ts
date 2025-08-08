import { api } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';

// Test endpoint to verify auth integration is working
export const testAuth = api(
  {
    expose: true,
    method: 'GET',
    path: '/test/auth',
    auth: true, // This endpoint requires authentication
  },
  async (): Promise<{ message: string; userId: string; timestamp: string }> => {
    // Get the authenticated user data from Encore's auth context
    const authData = getAuthData();

    return {
      message:
        'Authentication successful! The new better-auth setup is working.',
      userId: authData!.userID,
      timestamp: new Date().toISOString(),
    };
  }
);

// Public endpoint to test the API is responding
export const healthCheck = api(
  {
    expose: true,
    method: 'GET',
    path: '/test/health',
    auth: false,
  },
  async (): Promise<{ status: string; message: string; timestamp: string }> => {
    return {
      status: 'ok',
      message: 'Better Auth service is running',
      timestamp: new Date().toISOString(),
    };
  }
);
