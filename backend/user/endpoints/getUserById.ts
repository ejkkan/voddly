import { api } from 'encore.dev/api';
import { userDB } from '../db';

// Simple user interface for auth purposes
interface SimpleUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Get user by ID endpoint (for admin/internal use)
export const getUserById = api(
  {
    expose: true,
    method: 'GET',
    path: '/user/:id',
    auth: true,
  },
  async ({ id }: { id: string }): Promise<SimpleUser> => {
    // Query our user table directly
    const user = await userDB.queryRow<SimpleUser>`
      SELECT id, email, name, "emailVerified", "createdAt", "updatedAt"
      FROM "user" 
      WHERE id = ${id}
    `;

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
);
