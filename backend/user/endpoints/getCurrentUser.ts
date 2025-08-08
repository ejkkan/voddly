import { api } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { userQueries, User } from '../queries';

// Get current user endpoint
export const getCurrentUser = api(
  {
    expose: true,
    method: 'GET',
    path: '/user/me',
    auth: true,
  },
  async (): Promise<User> => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw new Error('User not authenticated');
    }

    const user = await userQueries.findById(authData.userID);
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
);
