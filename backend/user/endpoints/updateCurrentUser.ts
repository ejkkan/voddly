import { api } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { userQueries, User } from '../queries';

// Update current user endpoint
export const updateCurrentUser = api(
  {
    expose: true,
    method: 'PATCH',
    path: '/user/me',
    auth: true,
  },
  async (userData: { name?: string; email?: string }): Promise<User> => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw new Error('User not authenticated');
    }

    // Update user data
    await userQueries.update(authData.userID, userData);

    // Return updated user
    const updatedUser = await userQueries.findById(authData.userID);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    return updatedUser;
  }
);
